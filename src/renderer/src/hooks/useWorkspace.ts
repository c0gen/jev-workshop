import { useCallback, useEffect, useRef, useState } from 'react'
import type { Experiment, LibraryState, Preferences, Reply } from '../../../shared/contracts'
import { createExperiment } from '../../../shared/domain'
import { templates } from '../../../shared/templates'

export function unwrap<T>(reply: Reply<T>): T {
  if (!reply.ok) throw new Error(reply.error)
  return reply.value
}
export function useWorkspace() {
  const [library, setLibrary] = useState<LibraryState | null>(null)
  const [error, setError] = useState(''),
    [saveStatus, setSaveStatus] = useState('Saved locally'),
    [runningId, setRunningId] = useState<string | null>(null)
  const dirty = useRef(new Map<string, Experiment>()),
    timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pending = useRef<Promise<void>>(Promise.resolve()),
    prefs = useRef<Preferences>(undefined)
  const report = useCallback((error: unknown) => {
    setError(error instanceof Error ? error.message : 'The operation failed.')
  }, [])
  const flush = useCallback(() => {
    clearTimeout(timer.current)
    const operation = pending.current
      .catch(() => {})
      .then(async () => {
        try {
          while (dirty.current.size) {
            for (const [id, experiment] of [...dirty.current.entries()]) {
              unwrap(await window.jev.save(experiment))
              if (dirty.current.get(id) === experiment) dirty.current.delete(id)
            }
          }
          setSaveStatus(dirty.current.size ? 'Saving…' : 'Saved locally')
        } catch (error) {
          setSaveStatus('Save failed — retry')
          report(error)
          throw error
        }
      })
    pending.current = operation
    return operation
  }, [report])
  const load = useCallback(async () => {
    const value = unwrap(await window.jev.load())
    prefs.current = value.preferences
    setLibrary(value)
  }, [])
  useEffect(() => {
    if (!window.jev) {
      setError('The desktop bridge is unavailable. Launch this app through Electron.')
      return
    }
    void load().catch(report)
  }, [load, report])
  useEffect(
    () =>
      window.jev?.onClose(async () => {
        await flush()
      }),
    [flush]
  )
  const changePreferences = useCallback(
    (patch: Partial<Preferences>) => {
      if (!prefs.current) return
      const value = { ...prefs.current, ...patch }
      prefs.current = value
      setLibrary((previous) => (previous ? { ...previous, preferences: value } : previous))
      void window.jev.preferences(value).then(unwrap).catch(report)
    },
    [report]
  )
  function update(experiment: Experiment) {
    const value = { ...experiment, updatedAt: new Date().toISOString() }
    dirty.current.set(value.id, value)
    setLibrary((previous) =>
      previous
        ? {
            ...previous,
            experiments: previous.experiments.some((e) => e.id === value.id)
              ? previous.experiments.map((e) => (e.id === value.id ? value : e))
              : [value, ...previous.experiments]
          }
        : previous
    )
    setSaveStatus('Saving…')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void flush().catch(() => {})
    }, 500)
  }
  function add(templateIndex: number) {
    const template = templates[templateIndex]
    const value = createExperiment(template.name, template.request)
    update(value)
    changePreferences({ lastExperimentId: value.id })
    return value
  }
  function duplicate(experiment: Experiment) {
    const now = new Date().toISOString()
    const copy = {
      ...structuredClone(experiment),
      id: crypto.randomUUID(),
      name: `${experiment.name.slice(0, 192)} (copy)`,
      createdAt: now,
      updatedAt: now
    }
    update(copy)
    changePreferences({ lastExperimentId: copy.id })
  }
  async function remove(id: string) {
    await flush()
    unwrap(await window.jev.deleteExperiment(id))
    setLibrary((previous) =>
      previous
        ? {
            ...previous,
            experiments: previous.experiments.filter((e) => e.id !== id),
            runs: previous.runs.filter((r) => r.experimentId !== id)
          }
        : previous
    )
    changePreferences({
      lastExperimentId: library?.experiments.find((e) => e.id !== id)?.id ?? null
    })
  }
  async function run(experiment: Experiment) {
    if (runningId) return
    setRunningId(experiment.id)
    setError('')
    try {
      await flush()
      const record = unwrap(await window.jev.run(structuredClone(experiment)))
      setLibrary((previous) =>
        previous ? { ...previous, runs: [record, ...previous.runs] } : previous
      )
    } catch (error) {
      report(error)
    } finally {
      setRunningId(null)
    }
  }
  async function exportLibrary(id?: string) {
    await flush()
    return unwrap(await window.jev.exportLibrary(id))
  }
  async function importLibrary() {
    await flush()
    const count = unwrap(await window.jev.importLibrary())
    await load()
    return count
  }
  const current =
    library?.experiments.find((e) => e.id === library.preferences.lastExperimentId) ??
    library?.experiments[0]
  return {
    library,
    current,
    error,
    setError,
    report,
    saveStatus,
    flush,
    runningId,
    run,
    update,
    add,
    duplicate,
    remove,
    changePreferences,
    exportLibrary,
    importLibrary,
    setHasKey: (hasKey: boolean) =>
      setLibrary((previous) => (previous ? { ...previous, hasKey } : previous))
  }
}
