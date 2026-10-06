import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { JevRequest } from '../../../shared/contracts'
import { exportSnippet, pretty } from '../../../shared/domain'
import { Modal } from '../components/Modal'
import { copyText } from '../components/clipboard'
export function CodeExport({
  open,
  onOpenChange,
  request
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: JevRequest
}) {
  const [language, setLanguage] = useState<'python' | 'typescript' | 'json'>('python'),
    [copied, setCopied] = useState(false)
  const code = language === 'json' ? pretty(request) : exportSnippet(request, language)
  return (
    <Modal
      title="Take your experiment with you."
      description="Runnable examples use TYPESAFE_API_KEY from your environment. Your saved key is never included."
      open={open}
      onOpenChange={onOpenChange}
      wide
    >
      <div className="export-toolbar">
        <div className="segmented">
          {(['python', 'typescript', 'json'] as const).map((value) => (
            <button
              className={language === value ? 'selected' : ''}
              onClick={() => {
                setLanguage(value)
                setCopied(false)
              }}
              key={value}
            >
              {value === 'json' ? 'Request JSON' : value === 'python' ? 'Python' : 'TypeScript'}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            void copyText(code).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            })
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy code'}
        </button>
      </div>
      <pre className="code-export" tabIndex={0}>
        {code}
      </pre>
      <p className="helper">
        {language === 'python'
          ? 'Python 3 · standard library only'
          : language === 'typescript'
            ? 'Node.js 20+ · native fetch · run with your TypeScript runner'
            : 'HTTP request body for POST https://api.typesafe.ai/v1/systemone'}
      </p>
    </Modal>
  )
}
