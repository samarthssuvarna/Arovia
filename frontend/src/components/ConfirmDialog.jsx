import { useEffect, useRef, useState } from 'react'

// A small "are you sure?" box. Escape or clicking outside cancels.
// The confirm button stays locked for `waitSeconds` so it cannot be hit by accident.
export default function ConfirmDialog({
  title, message, confirmText = 'Yes', danger = false, busy = false, waitSeconds = 3, onConfirm, onCancel,
}) {
  const cancelRef = useRef(null)
  const [left, setLeft] = useState(waitSeconds)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [left])

  const locked = left > 0

  return (
    <div className="modal-back" onClick={onCancel}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title">{title}</h3>
        <p className="muted">{message}</p>
        <div className="modal-actions">
          <button ref={cancelRef} onClick={onCancel} disabled={busy}>Keep it</button>
          <button
            className={`confirm-btn ${danger ? 'danger solid' : 'primary'}`}
            onClick={onConfirm}
            disabled={busy || locked}
            aria-live="polite"
          >
            {busy ? 'Please wait...' : locked ? `${confirmText} (${left})` : confirmText}
            {locked && waitSeconds > 0 && (
              <span className="confirm-bar" style={{ animationDuration: `${waitSeconds * 1000}ms` }} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
