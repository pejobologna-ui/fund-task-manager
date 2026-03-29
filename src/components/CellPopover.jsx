import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * Wraps a cell with a click-to-open popover rendered via a portal so it never
 * gets clipped by the table's overflow:hidden.  Closes on outside mousedown.
 */
export default function CellPopover({ trigger, children, open, onOpen, onClose, disableAutoClose = false }) {
  const triggerRef = useRef(null)
  const popRef     = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open) return

    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }

    if (disableAutoClose) return

    function onMouseDown(e) {
      if (triggerRef.current?.contains(e.target)) return
      if (popRef.current?.contains(e.target))     return
      onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open, onClose, disableAutoClose])

  return (
    <>
      <div
        ref={triggerRef}
        className="ftm-cell-trigger"
        onClick={e => { e.stopPropagation(); open ? onClose() : onOpen() }}
      >
        {trigger}
      </div>
      {open && createPortal(
        <div ref={popRef} className="ftm-popover" style={{ top: pos.top, left: pos.left }}>
          {children}
        </div>,
        document.body
      )}
    </>
  )
}
