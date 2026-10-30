import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)

export const UNDO_MS = 3000 // change this one number to make the undo window longer

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})
  const nextId = useRef(1)

  const remove = useCallback((id) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  // A plain message that goes away by itself.
  const show = useCallback((message, tone = 'ok') => {
    const id = nextId.current++
    setToasts((list) => [...list, { id, message, tone }])
    timers.current[id] = setTimeout(() => remove(id), 4000)
  }, [remove])

  // An action that really happens only after the undo window ends.
  // commit(): does the real work. onUndo(): puts the screen back.
  const undoable = useCallback((message, commit, onUndo) => {
    const id = nextId.current++
    const cancel = () => {
      remove(id)
      onUndo && onUndo()
    }
    setToasts((list) => [...list, { id, message, tone: 'ok', undo: true, cancel }])
    timers.current[id] = setTimeout(() => {
      remove(id)
      // the real action must always run once the window ends, even if the screen changed
      Promise.resolve()
        .then(commit)
        .catch((err) => {
          console.error('Undoable action failed', err)
          onUndo && onUndo()
          show(`That did not work: ${err.message || 'please try again'}`, 'bad')
        })
    }, UNDO_MS)
  }, [remove, show])

  return (
    <ToastContext.Provider value={{ show, undoable }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            <span>{t.message}</span>
            {t.undo && (
              <button className="toast-undo" onClick={t.cancel}>Undo</button>
            )}
            {t.undo && <span className="toast-bar" style={{ animationDuration: `${UNDO_MS}ms` }} />}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
