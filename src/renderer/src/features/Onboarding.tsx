import { Clock3, Route, Search, ShieldCheck, ArrowUpRight } from 'lucide-react'
import { Modal } from '../components/Modal'
import { templates } from '../../../shared/templates'
const icons = [Route, ShieldCheck, Clock3, Search]
export function Onboarding({
  open,
  onOpenChange,
  onChoose
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (index: number) => void
}) {
  return (
    <Modal
      title="A small question. A useful decision."
      description="Start with an example and make it yours. Everything here is editable."
      open={open}
      onOpenChange={onOpenChange}
      wide
    >
      <div className="template-grid">
        {templates.map((template, index) => {
          const Icon = icons[index]
          return (
            <button
              className="template-card"
              key={template.name}
              onClick={() => {
                onChoose(index)
                onOpenChange(false)
              }}
            >
              <span className={`template-icon tone-${index}`}>
                <Icon size={22} />
              </span>
              <h3>{template.name}</h3>
              <p>{template.description}</p>
              <span className="template-types">
                {[...new Set(Object.values(template.request.questions).map((q) => q.type))].map(
                  (type) => (
                    <small key={type}>{type === 'noul' ? 'YES / NO' : type.toUpperCase()}</small>
                  )
                )}
                <ArrowUpRight size={16} />
              </span>
            </button>
          )
        })}
      </div>
      <p className="helper">
        Examples use fictional data. Nothing is sent to TypeSafe until you select Run.
      </p>
    </Modal>
  )
}
