import { useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  const style = {
    position: 'fixed',
    top:  Math.min(y, window.innerHeight - 8 - (items.filter(i => i !== 'divider').length * 32 + 8)),
    left: Math.min(x, window.innerWidth  - 180 - 8),
    zIndex: 9999,
  }

  return createPortal(
    <div ref={ref} className="ftm-ctx-menu" style={style}>
      {items.map((item, i) =>
        item === 'divider'
          ? <div key={i} className="ftm-ctx-divider" />
          : (
            <button
              key={i}
              className={`ftm-ctx-item${item.danger ? ' danger' : ''}`}
              onClick={() => { onClose(); item.action() }}
            >
              {item.label}
            </button>
          )
      )}
    </div>,
    document.body
  )
}
