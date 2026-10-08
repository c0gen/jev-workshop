import { useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronRight,
  CircleHelp,
  Cloud,
  Copy,
  Download,
  FlaskConical,
  LoaderCircle,
  Play,
  Star,
  Trash2,
  X
} from 'lucide-react'
import { parseDraft, pretty } from '../../shared/domain'
import { Library } from './features/Library'
import { Editor } from './features/Editor'
import { Results } from './features/Results'
import { Settings } from './features/Settings'
import { Onboarding } from './features/Onboarding'
import { CodeExport } from './features/CodeExport'
import { Divider } from './components/Divider'
import { Modal } from './components/Modal'
import { unwrap, useWorkspace } from './hooks/useWorkspace'

export function App() {
  const workspace = useWorkspace()
  const { library, current } = workspace
  const [settings, setSettings] = useState(false),
    [templates, setTemplates] = useState(false),
    [code, setCode] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [notice, setNotice] = useState('')
  const [libraryWidth, setLibraryWidth] = useState<number>(),
    [editorPercent, setEditorPercent] = useState<number>()
  const widths = useRef({ library: 248, editor: 54 }),
    workGrid = useRef<HTMLDivElement>(null)
  const theme = library?.preferences.theme ?? 'system'
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
  useEffect(() => {
    if (library && libraryWidth === undefined) {
      setLibraryWidth(library.preferences.libraryWidth)
      setEditorPercent(library.preferences.editorPercent)
      widths.current = {
        library: library.preferences.libraryWidth,
        editor: library.preferences.editorPercent
      }
    }
  }, [library, libraryWidth])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 3500)
    return () => clearTimeout(timer)
  }, [notice])
  const invalid = current ? parseDraft(current.draft).error : undefined
  function run() {
    if (!current || invalid || workspace.runningId) return
    if (!library?.hasKey) setSettings(true)
    else void workspace.run(current)
  }
  const runRef = useRef(run)
  runRef.current = run
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault()
        if (!document.querySelector('[role="dialog"]')) runRef.current()
      }
      if (event.ctrlKey && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void workspace.flush().catch(() => {})
      }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [workspace.flush])
  if (!library)
    return (
      <div className="startup">
        <FlaskConical size={36} />
        <h1>Jev Workshop</h1>
        {workspace.error ? (
          <>
            <p className="error-text">{workspace.error}</p>
            <button onClick={() => location.reload()}>Try again</button>
          </>
        ) : (
          <p>Opening your workspace…</p>
        )}
      </div>
    )
  const runs = current ? library.runs.filter((run) => run.experimentId === current.id) : []
  const doExport = (id?: string) => {
    void workspace
      .exportLibrary(id)
      .then((saved) => {
        if (saved) setNotice('Backup exported. API keys are never included.')
      })
      .catch(workspace.report)
  }
  return (
    <div
      className="app-shell"
      style={{ gridTemplateColumns: `${libraryWidth ?? 248}px 5px minmax(0, 1fr)` }}
    >
      <Library
        experiments={library.experiments}
        selectedId={current?.id}
        onSelect={(id) => workspace.changePreferences({ lastExperimentId: id })}
        onNew={() => setTemplates(true)}
        onDuplicate={workspace.duplicate}
        onSettings={() => setSettings(true)}
        onImport={() => {
          void workspace
            .importLibrary()
            .then((count) => {
              if (count)
                setNotice(
                  `Imported ${count} experiment${count === 1 ? '' : 's'} into your library.`
                )
            })
            .catch(workspace.report)
        }}
        onExport={() => doExport()}
      />
      <Divider
        label="Resize experiment library"
        onMove={(delta) => {
          const next = Math.max(200, Math.min(400, widths.current.library + delta))
          widths.current.library = next
          setLibraryWidth(next)
        }}
        onCommit={() => workspace.changePreferences({ libraryWidth: widths.current.library })}
      />
      <main className="main-workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <span>Experiment</span>
          </div>
          <div className="topbar-right">
            <span className="personal-label">PERSONAL WORKSHOP</span>
            <button className="connection-button" onClick={() => setSettings(true)}>
              <span className={`status-dot ${library.hasKey ? '' : 'offline'}`} />
              {library.hasKey ? 'API key saved' : 'Connect TypeSafe'}
            </button>
          </div>
        </header>
        {current ? (
          <>
            <div className="experiment-titlebar">
              <div className="title-area">
                <div className="eyebrow">EXPLORE · EVALUATE · REFINE</div>
                <div className="title-input-row">
                  <input
                    aria-label="Experiment name"
                    value={current.name}
                    placeholder="Untitled experiment"
                    maxLength={200}
                    onChange={(event) => workspace.update({ ...current, name: event.target.value })}
                  />
                  <button
                    className={`icon-button ${current.favorite ? 'favorite' : ''}`}
                    aria-label={current.favorite ? 'Unfavorite experiment' : 'Favorite experiment'}
                    onClick={() => workspace.update({ ...current, favorite: !current.favorite })}
                  >
                    <Star size={17} fill={current.favorite ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <div className="title-meta">
                  <span>{Object.keys(current.request.questions).length} questions</span>
                  <span>·</span>
                  <button
                    className={`save-status ${workspace.saveStatus.includes('failed') ? 'error-text' : ''}`}
                    onClick={() => {
                      void workspace.flush().catch(() => {})
                    }}
                  >
                    {workspace.saveStatus === 'Saving…' ? (
                      <LoaderCircle size={11} className="spin" />
                    ) : (
                      <Check size={11} />
                    )}{' '}
                    {workspace.saveStatus}
                  </button>
                </div>
              </div>
              <div className="title-actions">
                <button
                  className="icon-button"
                  aria-label="Duplicate experiment"
                  title="Duplicate experiment"
                  onClick={() => workspace.duplicate(current)}
                >
                  <Copy size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Export experiment"
                  title="Export experiment"
                  onClick={() => doExport(current.id)}
                >
                  <Download size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Delete experiment"
                  title="Delete experiment"
                  disabled={workspace.runningId === current.id}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={16} />
                </button>
                <button
                  className="primary run-button"
                  onClick={run}
                  disabled={!!invalid || !!workspace.runningId}
                >
                  {workspace.runningId ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <Play size={15} fill="currentColor" />
                  )}
                  {workspace.runningId ? 'Running' : 'Run experiment'}
                  <kbd>Ctrl ↵</kbd>
                </button>
              </div>
            </div>
            {workspace.error && (
              <div className="app-error" role="alert">
                <span>{workspace.error}</span>
                <button
                  className="icon-button"
                  aria-label="Dismiss error"
                  onClick={() => workspace.setError('')}
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div
              className="work-grid"
              ref={workGrid}
              style={{
                gridTemplateColumns: `minmax(280px, ${editorPercent ?? 54}fr) 5px minmax(280px, ${100 - (editorPercent ?? 54)}fr)`
              }}
            >
              <Editor
                key={'editor-' + current.id}
                experiment={current}
                models={library.preferences.models}
                onChange={workspace.update}
                onExportCode={() => setCode(true)}
              />
              <Divider
                label="Resize editor and results"
                onMove={(delta) => {
                  const width = workGrid.current?.clientWidth ?? 1000
                  const next = Math.max(
                    35,
                    Math.min(70, widths.current.editor + (delta * 100) / width)
                  )
                  widths.current.editor = next
                  setEditorPercent(next)
                }}
                onCommit={() =>
                  workspace.changePreferences({ editorPercent: widths.current.editor })
                }
              />
              <Results
                key={'results-' + current.id}
                experiment={current}
                runs={runs}
                running={workspace.runningId === current.id}
                hasKey={library.hasKey}
                onSettings={() => setSettings(true)}
                onCancel={() => {
                  void window.jev.cancel().then(unwrap).catch(workspace.report)
                }}
                onThreshold={(key, values) =>
                  workspace.update({
                    ...current,
                    thresholds: { ...current.thresholds, [key]: values }
                  })
                }
                onPin={(model) => {
                  const request = { ...current.request, model }
                  workspace.update({ ...current, request, draft: pretty(request) })
                  setNotice(`Future runs will use ${model}.`)
                }}
              />
            </div>
            <footer className="statusbar">
              <span>
                <Cloud size={12} /> Evaluations run on TypeSafe · edits stay local
              </span>
              <button className="text-button" onClick={() => setTemplates(true)}>
                <CircleHelp size={12} /> Explore examples
              </button>
              <span>{workspace.runningId ? 'Evaluation in progress' : 'Ready when you are'}</span>
            </footer>
          </>
        ) : (
          <div className="workspace-empty">
            <FlaskConical size={40} />
            <h1>Room for your next idea.</h1>
            <p>Create an experiment to start exploring Jev.</p>
            <button className="primary" onClick={() => setTemplates(true)}>
              Create an experiment
            </button>
          </div>
        )}
      </main>
      <Settings
        open={settings}
        onOpenChange={setSettings}
        preferences={library.preferences}
        hasKey={library.hasKey}
        onPreferences={workspace.changePreferences}
        onHasKey={workspace.setHasKey}
      />
      <Onboarding open={templates} onOpenChange={setTemplates} onChoose={workspace.add} />
      {current && <CodeExport open={code} onOpenChange={setCode} request={current.request} />}
      <Modal
        title="Delete this experiment?"
        description="This removes the experiment and its run history from your local library. Export a backup first if you want to keep a copy."
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
      >
        <div className="modal-actions">
          <button onClick={() => setConfirmDelete(false)}>Keep experiment</button>
          <button
            className="danger-button"
            onClick={() => {
              if (current)
                void workspace
                  .remove(current.id)
                  .then(() => setConfirmDelete(false))
                  .catch(workspace.report)
            }}
          >
            Delete experiment
          </button>
        </div>
      </Modal>
      {notice && (
        <div className="toast" role="status">
          <Check size={15} />
          {notice}
        </div>
      )}
    </div>
  )
}
