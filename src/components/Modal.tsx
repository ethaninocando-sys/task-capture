import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/** A pop-up panel: slides up from the bottom on phones, centered on bigger screens. Esc closes it. */
export function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // When pop-ups are stacked, Esc only closes the one on top.
      const dialogs = document.querySelectorAll('[role=dialog]')
      if (dialogs[dialogs.length - 1] === dialogRef.current) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-line bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-xl sm:rounded-2xl"
      >
        {children}
      </div>
    </div>
  )
}
