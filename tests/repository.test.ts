import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import Database from 'better-sqlite3'
import { Repository } from '../src/main/repository'
import { experiment, run } from './fixtures'

let folder: string, repository: Repository
beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'jev-test-'))
  repository = new Repository(join(folder, 'library.sqlite'))
})
afterEach(() => {
  try {
    repository.close()
  } catch {
    /* Some tests explicitly close and reopen. */
  }
})
describe('real SQLite persistence', () => {
  it('restores invalid drafts, preferences, and immutable run snapshots', () => {
    const e = experiment()
    e.draft = '{ not finished'
    e.editorMode = 'json'
    repository.save(e)
    const r = run()
    r.experimentId = e.id
    repository.addRun(r)
    repository.setPreferences({
      ...repository.getPreferences(),
      theme: 'dark',
      lastExperimentId: e.id
    })
    repository.close()
    repository = new Repository(join(folder, 'library.sqlite'))
    expect(repository.experiments().find((value) => value.id === e.id)?.draft).toBe(
      '{ not finished'
    )
    expect(repository.getPreferences()).toMatchObject({ theme: 'dark', lastExperimentId: e.id })
    expect(repository.runs()[0]).toEqual(r)
    expect(() => repository.addRun(r)).toThrow()
  })
  it('round-trips a backup as new experiments with remapped run ownership', () => {
    const e = experiment()
    repository.save(e)
    const r = run()
    r.experimentId = e.id
    repository.addRun(r)
    const bundle = repository.export(e.id)
    expect(repository.import(bundle)).toBe(1)
    const imported = repository.experiments().find((value) => value.name.endsWith('(imported)'))!
    expect(imported.id).not.toBe(e.id)
    expect(repository.runs().find((value) => value.id !== r.id)?.experimentId).toBe(imported.id)
    expect(imported.request).toEqual(e.request)
  })
  it('does not import partially when a run references an unknown experiment', () => {
    const before = repository.export(),
      bundle = repository.export()
    bundle.runs.push(run())
    expect(() => repository.import(bundle)).toThrow('no matching experiment')
    expect(repository.experiments()).toEqual(before.experiments)
    expect(repository.runs()).toEqual(before.runs)
  })
  it('rejects unsupported backup versions and duplicate experiment IDs', () => {
    const bundle = repository.export()
    expect(() => repository.import({ ...bundle, schemaVersion: 99 })).toThrow()
    expect(() =>
      repository.import({ ...bundle, experiments: [bundle.experiments[0], bundle.experiments[0]] })
    ).toThrow('duplicate')
  })
  it('recovers in-flight requests without rerunning them', () => {
    const r = run()
    repository.beginRun(r)
    repository.close()
    repository = new Repository(join(folder, 'library.sqlite'))
    expect(repository.runs()[0]).toMatchObject({ id: r.id, status: 'interrupted' })
    repository.close()
    repository = new Repository(join(folder, 'library.sqlite'))
    expect(repository.runs()).toHaveLength(1)
  })
  it('backs up an existing database before its first migration', () => {
    const path = join(folder, 'old.sqlite'),
      old = new Database(path)
    old.exec('CREATE TABLE legacy (value TEXT)')
    old.close()
    const migrated = new Repository(path)
    migrated.close()
    expect(readdirSync(folder).some((name) => name.startsWith('old.sqlite.backup-'))).toBe(true)
  })
  it('refuses future database formats rather than overwriting them', () => {
    const path = join(folder, 'future.sqlite'),
      future = new Database(path)
    future.pragma('user_version=99')
    future.close()
    expect(() => new Repository(path)).toThrow('newer version')
  })
  it('never includes credential storage in a backup', () => {
    expect(Object.keys(repository.export()).sort()).toEqual([
      'experiments',
      'exportedAt',
      'runs',
      'schemaVersion'
    ])
  })
})
