import { useState } from 'react'
import {
  Check,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  Monitor,
  Moon,
  Sun,
  Trash2
} from 'lucide-react'
import type { Model, Preferences } from '../../../shared/contracts'
import { Modal } from '../components/Modal'
import { unwrap } from '../hooks/useWorkspace'
export function Settings({
  open,
  onOpenChange,
  preferences,
  hasKey,
  onPreferences,
  onHasKey
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preferences: Preferences
  hasKey: boolean
  onPreferences: (patch: Partial<Preferences>) => void
  onHasKey: (value: boolean) => void
}) {
  const [key, setKey] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('')
  async function connect() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (key.trim()) {
        unwrap(await window.jev.setKey(key.trim()))
        setKey('')
        onHasKey(true)
      }
      const models: Model[] = unwrap(await window.jev.models())
      onPreferences({ models })
      setMessage(
        `Connected to TypeSafe. ${models.length} model${models.length === 1 ? '' : 's'} available.`
      )
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Connection failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title="Make yourself at home."
      description="Connect TypeSafe and adjust your workspace."
      open={open}
      onOpenChange={(value) => {
        if (!value) setKey('')
        onOpenChange(value)
      }}
    >
      <section className="settings-section">
        <div className="section-label">
          <span>
            <KeyRound size={15} /> TYPESAFE CONNECTION
          </span>
          <span className={hasKey ? 'accept-pill' : 'muted'}>
            {hasKey ? 'Key saved' : 'Not connected'}
          </span>
        </div>
        <p className="helper">
          Use an API key from your TypeSafe account. It is encrypted on this Windows computer and
          excluded from exports.
        </p>
        <label className="field-label" htmlFor="api-key">
          {hasKey ? 'Replace API key' : 'API key'}
        </label>
        <input
          id="api-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={
            hasKey ? 'Enter a new key to replace the saved key' : 'Paste your TypeSafe API key'
          }
          value={key}
          onChange={(event) => setKey(event.target.value)}
        />
        <div className="settings-actions">
          <button
            className="primary"
            onClick={() => void connect()}
            disabled={busy || (!key.trim() && !hasKey)}
          >
            {busy ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}{' '}
            {key.trim() ? 'Save & test connection' : 'Test connection'}
          </button>
          {hasKey && (
            <button
              className="text-button danger-text"
              disabled={busy}
              onClick={() => {
                void window.jev
                  .removeKey()
                  .then(unwrap)
                  .then(() => {
                    onHasKey(false)
                    setMessage('Saved key removed.')
                    setError('')
                  })
                  .catch((error) => setError(String(error)))
              }}
            >
              <Trash2 size={13} /> Remove key
            </button>
          )}
        </div>
        {message && (
          <p className="success-text" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <p className="helper">
          Connection testing lists available models. Only Run submits experiment content for
          evaluation.
        </p>
      </section>
      <button
        className="text-button"
        style={{ marginBottom: 20 }}
        onClick={() => {
          void window.jev
            .openConsole()
            .then(unwrap)
            .catch((error) => setError(String(error)))
        }}
      >
        <ExternalLink size={13} /> Open your TypeSafe console
      </button>
      <section className="settings-section">
        <div className="section-label">
          <span>APPEARANCE</span>
        </div>
        <div className="theme-options">
          {(
            [
              { value: 'system', label: 'System', Icon: Monitor },
              { value: 'light', label: 'Light', Icon: Sun },
              { value: 'dark', label: 'Dark', Icon: Moon }
            ] as const
          ).map(({ value, label, Icon }) => (
            <button
              aria-pressed={preferences.theme === value}
              className={preferences.theme === value ? 'selected' : ''}
              key={value}
              onClick={() => onPreferences({ theme: value })}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>
      </section>
      <div className="about-row">
        <span>
          Jev Workshop <strong>1.0.0</strong>
        </span>
        <span>Personal workspace · Windows</span>
      </div>
    </Modal>
  )
}
