import { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getHelpForKey } from '../help/pageHelp'

function HelpModal({ open, onClose, helpKey }) {
  const help = useMemo(() => getHelpForKey(helpKey), [helpKey])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal modal-help" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-help__header">
          <div>
            <div className="modal-help__eyebrow">Page Guide</div>
            <h2 className="modal-help__title">{help.title}</h2>
          </div>
          <button className="btn btn-secondary" onClick={onClose} type="button" aria-label="Close help">
            Close
          </button>
        </div>

        <div className="modal-help__body">
          <section className="modal-help__section">
            <h3>What this page is</h3>
            <p>{help.overview}</p>
          </section>

          {Array.isArray(help.howItWorks) && help.howItWorks.length > 0 && (
            <section className="modal-help__section">
              <h3>How it works (A → Z)</h3>
              <ol>
                {help.howItWorks.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ol>
            </section>
          )}

          {Array.isArray(help.bestPractice) && help.bestPractice.length > 0 && (
            <section className="modal-help__section">
              <h3>Best practices</h3>
              <ul>
                {help.bestPractice.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function InfoButton({ helpKey, label = 'Help' }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="icon-btn"
        aria-label={`${label} (page tutorial)`}
        title="How to use this page"
        onClick={() => setOpen(true)}
      >
        i
      </button>
      <HelpModal open={open} onClose={() => setOpen(false)} helpKey={helpKey} />
    </>
  )
}

