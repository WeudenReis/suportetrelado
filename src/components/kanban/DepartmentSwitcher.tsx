import { useState, useRef, useEffect } from 'react'
import { Icon } from '../../lib/icons'
import { useOrg } from '../../lib/orgContext'

/**
 * Seletor de departamento no header do Kanban.
 * Só aparece para usuários com 2+ departamentos visíveis (admin/supervisor cross-dept).
 */
export default function DepartmentSwitcher() {
  const { departmentId, departments, switchDepartment, loading } = useOrg()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClickOutside)
    return () => window.removeEventListener('mousedown', onClickOutside)
  }, [open])

  if (loading || departments.length < 2) return null

  const current = departments.find(d => d.id === departmentId)
  const label = current?.name ?? 'Selecionar departamento'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="trello-icon-btn"
        title="Trocar departamento"
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
          borderRadius: 8, fontSize: 12, fontWeight: 600,
          color: '#B6C2CF', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(166,197,226,0.12)',
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        <Icon name="Building2" size={14} style={{ color: '#25D066' }} />
        <span style={{ maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        <Icon name="ChevronDown" size={12} style={{ color: '#596773' }} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Departamentos"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 220,
            background: '#1d2125', border: '1px solid rgba(166,197,226,0.16)',
            borderRadius: 10, padding: 6, zIndex: 50,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {departments.map(d => {
            const active = d.id === departmentId
            return (
              <button
                key={d.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => { switchDepartment(d.id); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '8px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  color: active ? '#25D066' : '#B6C2CF',
                  background: active ? 'rgba(37,208,102,0.08)' : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ flex: 1 }}>{d.name}</span>
                {active && <Icon name="Check" size={12} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
