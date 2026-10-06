import { useState } from 'react'
import {
  BookOpen,
  ChevronRight,
  Copy,
  Download,
  FlaskConical,
  FolderOpen,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Star,
  Upload
} from 'lucide-react'
import type { Experiment } from '../../../shared/contracts'

export function Library({
  experiments,
  selectedId,
  onSelect,
  onNew,
  onDuplicate,
  onSettings,
  onImport,
  onExport
}: {
  experiments: Experiment[]
  selectedId?: string
  onSelect: (id: string) => void
  onNew: () => void
  onDuplicate: (experiment: Experiment) => void
  onSettings: () => void
  onImport: () => void
  onExport: () => void
}) {
  const [query, setQuery] = useState('')
  const filtered = experiments
    .filter((e) => `${e.name} ${e.notes}`.toLowerCase().includes(query.toLowerCase()))
    .sort(
      (a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt)
    )
  return (
    <aside className="library">
      <div className="brand">
        <span className="brand-mark">
          <FlaskConical size={22} />
        </span>
        <div>
          <strong>
            jev<span className="brand-dot">.</span>
          </strong>
          <span>PLAYGROUND</span>
        </div>
        <span className="local-badge">LOCAL</span>
      </div>
      <button className="primary new-experiment" onClick={onNew}>
        <Plus size={16} /> New experiment
      </button>
      <label className="search-field">
        <Search size={15} />
        <input
          aria-label="Search experiments"
          placeholder="Find an experiment…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <kbd>⌕</kbd>
      </label>
      <div className="section-heading">
        <span>YOUR WORKSPACE</span>
        <span>{experiments.length}</span>
      </div>
      <nav aria-label="Experiments" className="experiment-list">
        {filtered.map((experiment) => (
          <div
            className={`experiment-item ${selectedId === experiment.id ? 'active' : ''}`}
            key={experiment.id}
          >
            <button className="experiment-select" onClick={() => onSelect(experiment.id)}>
              <span className="experiment-glyph">
                <FlaskConical size={16} />
              </span>
              <span className="experiment-label">
                <strong>{experiment.name || 'Untitled experiment'}</strong>
                <small>
                  {Object.keys(experiment.request.questions).length} questions ·{' '}
                  {new Date(experiment.updatedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric'
                  })}
                </small>
              </span>
              {experiment.favorite ? (
                <Star size={13} className="favorite" fill="currentColor" />
              ) : (
                <ChevronRight size={13} />
              )}
            </button>
            <button
              className="icon-button duplicate-inline"
              aria-label={`Duplicate ${experiment.name}`}
              title="Duplicate experiment"
              onClick={() => onDuplicate(experiment)}
            >
              <Copy size={13} />
            </button>
          </div>
        ))}
        {!filtered.length && (
          <div className="small-empty">
            <FolderOpen size={22} />
            <p>{query ? 'No matching experiments' : 'Your next idea starts here.'}</p>
          </div>
        )}
      </nav>
      <button className="template-callout" onClick={onNew}>
        <Sparkles size={18} />
        <span>
          <strong>Start with an example</strong>
          <small>A little inspiration, ready to edit</small>
        </span>
        <ChevronRight size={15} />
      </button>
      <div className="library-footer">
        <button onClick={onImport}>
          <Upload size={15} /> Import
        </button>
        <button onClick={onExport}>
          <Download size={15} /> Backup
        </button>
        <button className="settings-link" onClick={onSettings}>
          <Settings2 size={16} /> Settings <span>⌘</span>
        </button>
      </div>
      <div className="local-note">
        <BookOpen size={12} /> Your library stays on this computer
      </div>
    </aside>
  )
}
