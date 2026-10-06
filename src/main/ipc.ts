import { ipcMain, dialog, clipboard, shell, type BrowserWindow } from 'electron'
import { readFile, writeFile, stat } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  experimentSchema,
  preferencesSchema,
  type Reply,
  type RunRecord
} from '../shared/contracts'
import { parseDraft, pretty } from '../shared/domain'
import { Repository } from './repository'
import { CredentialStore } from './credentials'
import { friendlyError, JevClient } from './jev-client'

export function registerIpc(
  window: BrowserWindow,
  repository: Repository,
  credentials: CredentialStore
) {
  let active: { controller: AbortController; experimentId: string } | undefined
  function handle<T>(name: string, fn: (value: unknown) => T | Promise<T>) {
    ipcMain.handle(`jev:${name}`, async (event, value): Promise<Reply<T>> => {
      if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame)
        return { ok: false, error: 'Untrusted application request.' }
      try {
        return { ok: true, value: await fn(value) }
      } catch (error) {
        if (error instanceof z.ZodError)
          return {
            ok: false,
            error:
              'The data does not match the supported format. Check your request or import file.'
          }
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'The operation failed.'
        }
      }
    })
  }
  handle('load', () => ({
    experiments: repository.experiments(),
    runs: repository.runs(),
    preferences: repository.getPreferences(),
    hasKey: credentials.hasKey()
  }))
  handle('save', (value) => repository.save(experimentSchema.parse(value)))
  handle('delete', (value) => {
    const id = z.uuid().parse(value)
    if (active?.experimentId === id)
      throw new Error('Cancel the active run before deleting its experiment.')
    repository.delete(id)
  })
  handle('preferences', (value) => repository.setPreferences(preferencesSchema.parse(value)))
  handle('set-key', (value) => credentials.set(z.string().trim().min(1).max(4096).parse(value)))
  handle('remove-key', () => credentials.remove())
  handle('models', async () => {
    const key = credentials.get()
    try {
      const models = await new JevClient(key).models()
      repository.setPreferences({ ...repository.getPreferences(), models })
      return models
    } catch (error) {
      throw new Error(friendlyError(error))
    }
  })
  handle('run', async (value) => {
    if (active) throw new Error('Another evaluation is already running.')
    const experiment = experimentSchema.parse(value)
    const parsed = parseDraft(experiment.draft)
    if (parsed.error || !parsed.request) throw new Error('Fix the JSON draft before running.')
    const key = credentials.get()
    // The renderer flushes drafts before starting. Never save this frozen run
    // snapshot over a newer draft that may have been edited in the meantime.
    const controller = new AbortController()
    active = { controller, experimentId: experiment.id }
    const snapshot = {
      id: randomUUID(),
      experimentId: experiment.id,
      request: parsed.request,
      startedAt: new Date().toISOString()
    }
    const start = performance.now()
    let run: RunRecord
    try {
      repository.beginRun(snapshot)
      try {
        const response = await new JevClient(key).evaluate(snapshot.request, controller.signal)
        if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError')
        run = {
          ...snapshot,
          response,
          status: 'success',
          finishedAt: new Date().toISOString(),
          durationMs: performance.now() - start
        }
      } catch (error) {
        run = {
          ...snapshot,
          status: controller.signal.aborted ? 'cancelled' : 'error',
          error: controller.signal.aborted
            ? 'Stopped waiting for this request. TypeSafe may still have processed it.'
            : friendlyError(error),
          finishedAt: new Date().toISOString(),
          durationMs: performance.now() - start
        }
      }
      repository.addRun(run)
      return run
    } finally {
      active = undefined
    }
  })
  handle('cancel', () => {
    active?.controller.abort()
  })
  handle('copy', (value) => {
    clipboard.writeText(
      z
        .string()
        .max(10 * 1024 * 1024)
        .parse(value)
    )
  })
  handle('console', () => shell.openExternal('https://console.typesafe.ai'))
  handle('export', async (value) => {
    const id = z.uuid().optional().parse(value)
    const { canceled, filePath } = await dialog.showSaveDialog(window, {
      title: 'Export Jev library',
      defaultPath: id ? 'experiment.jev.json' : 'jev-library.json',
      filters: [{ name: 'Jev JSON backup', extensions: ['json'] }]
    })
    if (canceled || !filePath) return false
    await writeFile(filePath, pretty(repository.export(id)), 'utf8')
    return true
  })
  handle('import', async () => {
    const result = await dialog.showOpenDialog(window, {
      title: 'Import Jev experiments',
      filters: [{ name: 'Jev JSON backup', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return 0
    const path = result.filePaths[0]
    if ((await stat(path)).size > 50 * 1024 * 1024)
      throw new Error('This backup exceeds the 50 MB import limit.')
    let raw: unknown
    try {
      raw = JSON.parse(await readFile(path, 'utf8'))
    } catch {
      throw new Error('This file is not valid JSON.')
    }
    return repository.import(raw)
  })
  return () => {
    active?.controller.abort()
    for (const name of [
      'load',
      'save',
      'delete',
      'preferences',
      'set-key',
      'remove-key',
      'models',
      'run',
      'cancel',
      'copy',
      'console',
      'export',
      'import'
    ])
      ipcMain.removeHandler(`jev:${name}`)
  }
}
