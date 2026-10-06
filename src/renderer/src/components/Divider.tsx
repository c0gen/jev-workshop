import { useRef } from 'react'
export function Divider({
  label,
  onMove,
  onCommit
}: {
  label: string
  onMove: (delta: number) => void
  onCommit: () => void
}) {
  const last = useRef<number | null>(null)
  return (
    <div
      className="divider"
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      tabIndex={0}
      onPointerDown={(event) => {
        last.current = event.clientX
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (last.current !== null) {
          onMove(event.clientX - last.current)
          last.current = event.clientX
        }
      }}
      onPointerUp={(event) => {
        last.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
        onCommit()
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          onMove(event.key === 'ArrowLeft' ? -12 : 12)
          onCommit()
        }
      }}
    />
  )
}
