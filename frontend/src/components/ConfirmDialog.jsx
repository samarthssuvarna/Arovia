import { useEffect, useRef } from 'react'

// A small "are you sure?" box. Escape or clicking outside cancels.
export default function ConfirmDialog({ title, message, confirmText = 'Yes', danger = false, busy = false, onConfirm, onCancel }) {
  const cancelRef = useRef(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

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
          <button className={danger ? 'danger solid' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Please wait...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
