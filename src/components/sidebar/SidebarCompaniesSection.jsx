import { useState, useEffect, useRef } from 'react'
import SectionHeader from './SectionHeader'
import RenameInput from './RenameInput'

export default function SidebarCompaniesSection({
  funds,
  sgrCount,
  taskCountByCo,
  companiesByFund,
  companiesUnassigned,
  collapsed,        // full collapsed map from parent
  onToggle,         // toggle(key) — flips boolean in parent
  onExpand,         // expand(key) — forces open (for quick-add)
  navFilter,
  onNavFilter,
  onContextMenu,    // openCtx(e, items) from parent
  addCompany,
  addFund,
  updateCompany,
  deleteCompany,
  renameFund,
  deleteFund,
  onDataChanged,
}) {
  // ── Rename state ─────────────────────────────────────────────────────────
  const [renamingId, setRenamingId]   = useState(null)
  const [renameVal,  setRenameVal]    = useState('')
  const renameInputRef                = useRef(null)

  useEffect(() => {
    if (renamingId && renameInputRef.current) renameInputRef.current.focus()
  }, [renamingId])

  function startRename(prefix, id, currentName) {
    setRenamingId(`${prefix}-${id}`)
    setRenameVal(currentName)
  }

  async function commitRename(prefix, id) {
    const v = renameVal.trim()
    if (v) {
      if (prefix === 'co')   await updateCompany(id, { name: v })
      if (prefix === 'fund') await renameFund(id, v)
      onDataChanged?.()
    }
    setRenamingId(null)
    setRenameVal('')
  }

  function renameProps(prefix, id) {
    return {
      inputRef: renameInputRef,
      value:    renameVal,
      onChange: setRenameVal,
      onCommit: () => commitRename(prefix, id),
      onCancel: () => { setRenamingId(null); setRenameVal('') },
    }
  }

  // ── Quick-add state ───────────────────────────────────────────────────────
  const [quickAdd,  setQuickAdd]  = useState(null)
  const [quickVal,  setQuickVal]  = useState('')
  const quickInputRef             = useRef(null)
  const submittingRef             = useRef(false)

  useEffect(() => {
    if (quickAdd && quickInputRef.current) quickInputRef.current.focus()
  }, [quickAdd])

  function startQuickAdd(kind, fundId) {
    setQuickAdd({ kind, fundId })
    setQuickVal('')
    if (kind.startsWith('company') || kind === 'new-fund') onExpand('companies')
    if (kind === 'company-in-fund' && fundId) onExpand(`fund-${fundId}`)
  }

  async function commitQuickAdd() {
    if (submittingRef.current) return
    const v = quickVal.trim()
    if (v && quickAdd) {
      submittingRef.current = true
      try {
        if (quickAdd.kind === 'company-in-fund')   await addCompany({ name: v, type: 'portfolio', fund_id: quickAdd.fundId })
        else if (quickAdd.kind === 'new-fund')      await addFund(v)
        else if (quickAdd.kind === 'company-sgr')   await addCompany({ name: v, type: 'sgr', fund_id: null })
      } finally { submittingRef.current = false }
    }
    setQuickAdd(null)
    setQuickVal('')
  }

  function cancelQuickAdd() { setQuickAdd(null); setQuickVal('') }

  function renderQuickInput(placeholder) {
    return (
      <div className="ftm-quick-add-row">
        <input
          ref={quickInputRef}
          className="ftm-quick-add-input"
          placeholder={placeholder}
          value={quickVal}
          onChange={e => setQuickVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commitQuickAdd(); if (e.key === 'Escape') cancelQuickAdd() }}
          onBlur={commitQuickAdd}
        />
      </div>
    )
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function isNavActive(type, id) {
    return navFilter?.type === type && navFilter?.id === id
  }

  function companyCtxItems(co) {
    const moveToFund = funds
      .filter(f => f.id !== co.fund_id)
      .map(f => ({
        label:  `→ Move to ${f.name}`,
        action: () => updateCompany(co.id, { fund_id: f.id, type: co.type === 'sgr' ? 'portfolio' : co.type }),
      }))
    const moveToFundLevel = co.type !== 'sgr'
      ? [{ label: '→ Move to SGR', action: () => updateCompany(co.id, { type: 'sgr', fund_id: null }) }]
      : []
    const moveFromFundLevel = co.type === 'sgr' && funds.length > 0
      ? funds.map(f => ({
          label:  `→ Move to ${f.name}`,
          action: () => updateCompany(co.id, { type: 'portfolio', fund_id: f.id }),
        }))
      : []
    return [
      { label: '✎ Rename', action: () => startRename('co', co.id, co.name) },
      ...(moveToFundLevel.length > 0 || moveFromFundLevel.length > 0 || moveToFund.length > 0
        ? ['divider', ...moveToFundLevel, ...moveFromFundLevel, ...moveToFund]
        : []),
      'divider',
      { label: '✕ Delete', danger: true, action: async () => { await deleteCompany(co.id); onDataChanged?.() } },
    ]
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="ftm-snav">
      <SectionHeader
        label="Companies"
        collapsed={collapsed.companies}
        onToggle={() => onToggle('companies')}
        showGear
      />
      {!collapsed.companies && (
        <>
          {/* SGR row */}
          <div
            className={`ftm-sitem${isNavActive('sgr', null) ? ' active' : ''}`}
            onClick={() => onNavFilter({ type: 'sgr', id: null, name: 'SGR' })}
          >
            <div className="ftm-sdot" style={{ background: '#9b71d455', border: '1px solid #9b71d4' }} />
            <span className="ftm-sitem-label">SGR</span>
            <span className="ftm-scnt">{sgrCount || ''}</span>
          </div>

          {/* Fund groups */}
          {funds.map(fund => {
            const fundKey       = `fund-${fund.id}`
            const children      = companiesByFund[fund.id] ?? []
            const fundTaskCount = children.reduce((s, c) => s + c.count, 0) + (taskCountByCo[fund.id] ?? 0)
            const fundCollapsed = collapsed[fundKey]
            return (
              <div key={fund.id}>
                <div
                  className={`ftm-ssub-heading ftm-ssub-heading-clickable${isNavActive('fund', fund.id) ? ' active' : ''}`}
                  onClick={() => onNavFilter({ type: 'fund', id: fund.id, name: fund.name })}
                  onContextMenu={e => onContextMenu(e, [
                    { label: '✎ Rename fund', action: () => startRename('fund', fund.id, fund.name) },
                    'divider',
                    { label: '✕ Delete fund', danger: true, action: () => deleteFund(fund.id) },
                  ])}
                >
                  {renamingId === `fund-${fund.id}`
                    ? <RenameInput {...renameProps('fund', fund.id)} />
                    : <span className="ftm-ssub-label" style={{ margin: 0 }}>{fund.name}</span>
                  }
                  <span className="ftm-scnt">{fundTaskCount || ''}</span>
                  <button
                    className="ftm-snew-btn"
                    title={`Add company to ${fund.name}`}
                    onClick={e => { e.stopPropagation(); startQuickAdd('company-in-fund', fund.id) }}
                  >+</button>
                  <span
                    className={`ftm-schevron ftm-ssub-chevron${fundCollapsed ? ' closed' : ''}`}
                    onClick={e => { e.stopPropagation(); onToggle(fundKey) }}
                  >▾</span>
                </div>

                {!fundCollapsed && (
                  <>
                    {children.map(co => (
                      <div
                        key={co.id}
                        className={`ftm-sitem ftm-sitem-sub${isNavActive('company', co.id) ? ' active' : ''}`}
                        onClick={() => renamingId !== `co-${co.id}` && onNavFilter({ type: 'company', id: co.id, name: co.name })}
                        onContextMenu={e => onContextMenu(e, companyCtxItems(co))}
                      >
                        <div className="ftm-sdot" style={{ background: '#378add55', border: '1px solid #378add' }} />
                        {renamingId === `co-${co.id}`
                          ? <RenameInput {...renameProps('co', co.id)} />
                          : <span className="ftm-sitem-label">
                              {co.name}{co.type === 'prospect' && !co.name.includes('(prospect)') ? ' (prospect)' : ''}
                            </span>
                        }
                        <span className="ftm-scnt">{co.count || ''}</span>
                      </div>
                    ))}
                    {quickAdd?.kind === 'company-in-fund' && quickAdd.fundId === fund.id && (
                      <div className="ftm-quick-add-row ftm-quick-add-row-sub">
                        {renderQuickInput('Company name…')}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}

          {/* New fund quick-add */}
          {quickAdd?.kind === 'new-fund' && renderQuickInput('Fund name…')}

          {/* Unassigned companies */}
          {companiesUnassigned.length > 0 && (
            <>
              <div
                className="ftm-ssub-heading ftm-ssub-heading-clickable"
                onClick={() => onToggle('companies-unassigned')}
              >
                <span className="ftm-ssub-label" style={{ margin: 0, opacity: 0.6 }}>Unassigned</span>
                <span className={`ftm-schevron ftm-ssub-chevron${collapsed['companies-unassigned'] ? ' closed' : ''}`}>▾</span>
              </div>
              {!collapsed['companies-unassigned'] && companiesUnassigned.map(co => (
                <div
                  key={co.id}
                  className={`ftm-sitem ftm-sitem-sub${isNavActive('company', co.id) ? ' active' : ''}`}
                  onClick={() => renamingId !== `co-${co.id}` && onNavFilter({ type: 'company', id: co.id, name: co.name })}
                  onContextMenu={e => onContextMenu(e, companyCtxItems(co))}
                >
                  <div className="ftm-sdot" style={{ background: '#aaa5', border: '1px solid #aaa' }} />
                  {renamingId === `co-${co.id}`
                    ? <RenameInput {...renameProps('co', co.id)} />
                    : <span className="ftm-sitem-label">{co.name}</span>
                  }
                  <span className="ftm-scnt">{co.count || ''}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}
