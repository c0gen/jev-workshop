import Database from 'better-sqlite3'
import { mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  experimentSchema,
  exportSchema,
  preferencesSchema,
  runSchema,
  type Experiment,
  type ExportBundle,
  type Preferences,
  type RunRecord
} from '../shared/contracts'
import { createExperiment, parseDraft, validateResponse } from '../shared/domain'
import { templates } from '../shared/templates'

export class Repository {
  private db: Database.Database
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true })
    const existed = existsSync(path)
    this.db = new Database(path)
    const version = this.db.pragma('user_version', { simple: true }) as number
    if (version > 1) {
      this.db.close()
      throw new Error(
        'This library belongs to a newer version of Jev Playground. Install the newer app to open it.'
      )
    }
    if (version < 1) {
      if (existed) {
        this.db.pragma('wal_checkpoint(TRUNCATE)')
        copyFileSync(path, `${path}.backup-${Date.now()}`)
      }
      this.db.transaction(() => {
        this.db.exec(
          'CREATE TABLE IF NOT EXISTS experiments (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, experiment_id TEXT NOT NULL, data TEXT NOT NULL); CREATE INDEX IF NOT EXISTS run_experiment ON runs(experiment_id); CREATE TABLE IF NOT EXISTS preferences (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS pending_runs (id TEXT PRIMARY KEY, data TEXT NOT NULL); PRAGMA user_version=1;'
        )
      })()
    }
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('busy_timeout = 5000')
    const pending = this.db.prepare('SELECT data FROM pending_runs').all() as { data: string }[]
    this.db.transaction(() => {
      for (const row of pending) {
        const value = JSON.parse(row.data) as Pick<
          RunRecord,
          'id' | 'experimentId' | 'request' | 'startedAt'
        >
        this.addRun({
          ...value,
          finishedAt: new Date().toISOString(),
          durationMs: Math.max(0, Date.now() - Date.parse(value.startedAt)),
          status: 'interrupted',
          error:
            'The app closed before this request finished. The provider may have processed it. Run again manually if needed.'
        })
      }
      this.db.exec('DELETE FROM pending_runs')
    })()
    if (!this.db.prepare('SELECT id FROM preferences WHERE id=1').get()) {
      this.db.transaction(() => {
        const starter = createExperiment(templates[0].name, templates[0].request)
        this.save(starter)
        this.setPreferences({ ...preferencesSchema.parse({}), lastExperimentId: starter.id })
      })()
    }
  }
  experiments(): Experiment[] {
    return (this.db.prepare('SELECT data FROM experiments').all() as { data: string }[]).map(
      (row) => experimentSchema.parse(JSON.parse(row.data))
    )
  }
  runs(): RunRecord[] {
    return (
      this.db.prepare('SELECT data FROM runs ORDER BY rowid DESC').all() as { data: string }[]
    ).map((row) => runSchema.parse(JSON.parse(row.data)))
  }
  getPreferences(): Preferences {
    const row = this.db.prepare('SELECT data FROM preferences WHERE id=1').get() as
      { data: string } | undefined
    return preferencesSchema.parse(row ? JSON.parse(row.data) : {})
  }
  setPreferences(value: Preferences) {
    this.db
      .prepare('INSERT OR REPLACE INTO preferences(id,data) VALUES(1,?)')
      .run(JSON.stringify(preferencesSchema.parse(value)))
  }
  save(value: Experiment) {
    const experiment = experimentSchema.parse(value)
    const parsed = parseDraft(experiment.draft)
    if (parsed.request) experiment.request = parsed.request
    this.db
      .prepare('INSERT OR REPLACE INTO experiments(id,data) VALUES(?,?)')
      .run(experiment.id, JSON.stringify(experiment))
  }
  delete(id: string) {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM runs WHERE experiment_id=?').run(id)
      this.db.prepare('DELETE FROM experiments WHERE id=?').run(id)
    })()
  }
  beginRun(value: Pick<RunRecord, 'id' | 'experimentId' | 'request' | 'startedAt'>) {
    const { id, experimentId, request, startedAt } = value
    this.db
      .prepare('INSERT INTO pending_runs(id,data) VALUES(?,?)')
      .run(id, JSON.stringify({ id, experimentId, request, startedAt }))
  }
  addRun(value: RunRecord) {
    const run = runSchema.parse(value)
    this.db.transaction(() => {
      this.db
        .prepare('INSERT INTO runs(id,experiment_id,data) VALUES(?,?,?)')
        .run(run.id, run.experimentId, JSON.stringify(run))
      this.db.prepare('DELETE FROM pending_runs WHERE id=?').run(run.id)
    })()
  }
  export(experimentId?: string): ExportBundle {
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      experiments: this.experiments().filter((e) => !experimentId || e.id === experimentId),
      runs: this.runs().filter((r) => !experimentId || r.experimentId === experimentId)
    }
  }
  import(raw: unknown) {
    const bundle = exportSchema.parse(raw)
    const idMap = new Map<string, string>()
    for (const experiment of bundle.experiments) {
      if (idMap.has(experiment.id)) throw new Error('The backup contains duplicate experiment IDs.')
      idMap.set(experiment.id, randomUUID())
    }
    if (bundle.runs.some((run) => !idMap.has(run.experimentId)))
      throw new Error('A run in this backup has no matching experiment.')
    for (const run of bundle.runs) if (run.response) validateResponse(run.request, run.response)
    this.db.transaction(() => {
      for (const experiment of bundle.experiments)
        this.save({
          ...experiment,
          id: idMap.get(experiment.id)!,
          name: `${experiment.name.slice(0, 189)} (imported)`,
          updatedAt: new Date().toISOString()
        })
      for (const run of bundle.runs)
        this.addRun({ ...run, id: randomUUID(), experimentId: idMap.get(run.experimentId)! })
    })()
    return bundle.experiments.length
  }
  close() {
    this.db.close()
  }
}
