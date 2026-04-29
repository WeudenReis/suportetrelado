import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Icon } from '../lib/icons'
import IconButton from './ui/IconButton'
import Badge from './ui/Badge'
import Popover from './ui/Popover'
import {
  CHANGELOG,
  countUnseen,
  isUnseen,
  readLastSeenId,
  writeLastSeenId,
  type ChangelogEntry,
  type ChangelogType,
} from '../data/changelog'

interface UpdatesPopoverProps {
  /** Email do usuário autenticado, usado para escopar o estado de "lido" no localStorage. */
  user?: string | null
}

const TYPE_META: Record<
  ChangelogType,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  feat:        { label: 'Novidade', color: '#25D066', bg: 'rgba(37,208,102,0.12)', icon: <Icon name="Sparkles" size={11} /> },
  improvement: { label: 'Melhoria', color: '#579DFF', bg: 'rgba(87,157,255,0.12)', icon: <Icon name="Wrench" size={11} /> },
  fix:         { label: 'Correção', color: '#F5A623', bg: 'rgba(245,166,35,0.12)', icon: <Icon name="Bug" size={11} /> },
  security:    { label: 'Segurança', color: '#A259FF', bg: 'rgba(162,89,255,0.14)', icon: <Icon name="ShieldCheck" size={11} /> },
}

const TYPE_ORDER: ChangelogType[] = ['feat', 'improvement', 'fix', 'security']

type TypeFilter = 'all' | ChangelogType

/** Converte ISO YYYY-MM-DD em rótulo relativo amigável. */
function relativeDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const entry = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - entry.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  if (diffDays > 1 && diffDays <= 6) return `${diffDays} dias atrás`
  return entry.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function UpdatesPopover({ user }: UpdatesPopoverProps) {
  const [open, setOpen] = useState(false)
  const [lastSeenId, setLastSeenId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [onlyUnread, setOnlyUnread] = useState(false)

  useEffect(() => {
    setLastSeenId(readLastSeenId(user))
  }, [user])

  const counts = useMemo(() => {
    const out: Record<TypeFilter, number> = { all: CHANGELOG.length, feat: 0, improvement: 0, fix: 0, security: 0 }
    for (const e of CHANGELOG) out[e.type]++
    return out
  }, [])

  const unseen = countUnseen(lastSeenId)

  const visible = useMemo(() => {
    return CHANGELOG.filter(e => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      if (onlyUnread && !isUnseen(e.id, lastSeenId)) return false
      return true
    })
  }, [typeFilter, onlyUnread, lastSeenId])

  const groups = useMemo(() => groupByDate(visible), [visible])

  const closeAndMarkSeen = () => {
    setOpen(false)
    if (CHANGELOG.length > 0) {
      const latestId = CHANGELOG[0].id
      if (latestId !== lastSeenId) {
        writeLastSeenId(user, latestId)
        // Damos um leve grace para o popover terminar a animação de saída
        // antes de remover o badge — evita "flash" de estado.
        setTimeout(() => setLastSeenId(latestId), 250)
      }
    }
  }

  const handleToggle = () => {
    if (open) closeAndMarkSeen()
    else setOpen(true)
  }

  return (
    <Popover
      open={open}
      onClose={closeAndMarkSeen}
      align="end"
      width={380}
      anchor={
        <IconButton
          icon={<Icon name="Gift" size={16} />}
          label="Novidades"
          onClick={handleToggle}
          active={open}
          badge={unseen > 0 ? <Badge variant="dot" color="green" pulse /> : undefined}
        />
      }
    >
      <Header unseen={unseen} />

      <Filters
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        counts={counts}
        onlyUnread={onlyUnread}
        setOnlyUnread={setOnlyUnread}
        anyUnseen={unseen > 0}
      />

      <div
        style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', padding: '4px 8px 12px' }}
        className="inbox-scroll"
      >
        {groups.length === 0 ? (
          <EmptyState onlyUnread={onlyUnread} typeFilter={typeFilter} />
        ) : (
          groups.map(group => (
            <section key={group.date} style={{ marginTop: 8 }}>
              <h5 style={{
                margin: '6px 8px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: '#6B7685',
              }}>
                {group.label}
              </h5>
              {group.entries.map(entry => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  unread={isUnseen(entry.id, lastSeenId)}
                />
              ))}
            </section>
          ))
        )}
      </div>
    </Popover>
  )
}

function Header({ unseen }: { unseen: number }) {
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <span style={{
          width: 24, height: 24, borderRadius: 6,
          background: 'rgba(37,208,102,0.14)', color: '#25D066',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="Gift" size={13} />
        </span>
        <h3 style={{
          margin: 0, fontFamily: "'Paytone One', sans-serif",
          fontSize: 15, fontWeight: 800, color: '#E6E5E8', letterSpacing: '-0.01em',
        }}>
          Novidades do chatPro
        </h3>
        {unseen > 0 && (
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 800,
            color: '#0d1417', background: '#25D066',
            padding: '2px 6px', borderRadius: 999,
          }}>
            {unseen} {unseen === 1 ? 'nova' : 'novas'}
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 11.5, color: '#8C96A3' }}>
        O que rolou de novo na ferramenta
      </p>
    </div>
  )
}

interface FiltersProps {
  typeFilter: TypeFilter
  setTypeFilter: (f: TypeFilter) => void
  counts: Record<TypeFilter, number>
  onlyUnread: boolean
  setOnlyUnread: (v: boolean) => void
  anyUnseen: boolean
}

function Filters({ typeFilter, setTypeFilter, counts, onlyUnread, setOnlyUnread, anyUnseen }: FiltersProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <FilterChip
        active={typeFilter === 'all'}
        onClick={() => setTypeFilter('all')}
        label="Todos"
        count={counts.all}
        accent="#9FADBC"
      />
      {TYPE_ORDER.map(t => (
        <FilterChip
          key={t}
          active={typeFilter === t}
          onClick={() => setTypeFilter(t)}
          label={TYPE_META[t].label}
          count={counts[t]}
          accent={TYPE_META[t].color}
        />
      ))}
      <button
        type="button"
        onClick={() => setOnlyUnread(!onlyUnread)}
        disabled={!anyUnseen && !onlyUnread}
        style={{
          marginLeft: 'auto', fontSize: 10.5, fontWeight: 600,
          color: onlyUnread ? '#0d1417' : '#8C96A3',
          background: onlyUnread ? '#25D066' : 'transparent',
          border: `1px solid ${onlyUnread ? '#25D066' : 'rgba(166,197,226,0.16)'}`,
          padding: '4px 9px', borderRadius: 999,
          cursor: !anyUnseen && !onlyUnread ? 'not-allowed' : 'pointer',
          opacity: !anyUnseen && !onlyUnread ? 0.45 : 1,
          fontFamily: "'Space Grotesk', sans-serif",
          transition: 'background 0.12s, color 0.12s',
        }}
        title="Mostrar apenas as novidades ainda não lidas"
      >
        Apenas não lidas
      </button>
    </div>
  )
}

interface FilterChipProps {
  active: boolean
  onClick: () => void
  label: string
  count: number
  accent: string
}

function FilterChip({ active, onClick, label, count, accent }: FilterChipProps) {
  const style: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 9px', borderRadius: 999,
    fontSize: 10.5, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
    border: `1px solid ${active ? accent : 'rgba(166,197,226,0.16)'}`,
    background: active ? `${accent}22` : 'transparent',
    color: active ? accent : '#8C96A3',
    cursor: count === 0 ? 'not-allowed' : 'pointer',
    opacity: count === 0 ? 0.4 : 1,
    transition: 'background 0.12s, color 0.12s, border-color 0.12s',
  }
  return (
    <button type="button" onClick={onClick} disabled={count === 0} style={style}>
      {label}
      <span style={{
        fontSize: 9.5, fontWeight: 600,
        color: active ? accent : '#6B7685',
      }}>
        {count}
      </span>
    </button>
  )
}

function EntryCard({ entry, unread }: { entry: ChangelogEntry; unread: boolean }) {
  const meta = TYPE_META[entry.type]
  return (
    <article
      style={{
        position: 'relative',
        padding: '10px 12px 12px 14px',
        borderRadius: 10,
        marginBottom: 2,
        background: unread ? 'rgba(37,208,102,0.05)' : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      {unread && (
        <span style={{
          position: 'absolute', left: 4, top: 16,
          width: 4, height: 4, borderRadius: '50%',
          background: '#25D066', boxShadow: '0 0 6px rgba(37,208,102,0.6)',
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 6px', borderRadius: 4,
          background: meta.bg, color: meta.color,
          fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {meta.icon}
          {meta.label}
        </span>
      </div>
      <h4 style={{
        margin: '0 0 4px', fontSize: 13, fontWeight: 700,
        color: '#E6E5E8', lineHeight: 1.3,
      }}>
        {entry.title}
      </h4>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: '#9FADBC' }}>
        {entry.description}
      </p>
      {entry.items && entry.items.length > 0 && (
        <ul style={{
          margin: '6px 0 0', padding: 0, listStyle: 'none',
          fontSize: 11.5, lineHeight: 1.45, color: '#8C96A3',
        }}>
          {entry.items.map((it, i) => (
            <li key={i} style={{ display: 'flex', gap: 6, padding: '1px 0' }}>
              <span style={{ color: meta.color, flexShrink: 0 }}>›</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
      {entry.link && (
        <a
          href={entry.link.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            marginTop: 6, fontSize: 11, fontWeight: 600, color: meta.color,
            textDecoration: 'none',
          }}
        >
          {entry.link.label}
          <Icon name="ExternalLink" size={11} />
        </a>
      )}
    </article>
  )
}

function EmptyState({ onlyUnread, typeFilter }: { onlyUnread: boolean; typeFilter: TypeFilter }) {
  const message = onlyUnread
    ? 'Tudo lido por aqui — você está em dia.'
    : typeFilter === 'all'
      ? 'Sem novidades por enquanto.'
      : `Sem entradas do tipo "${TYPE_META[typeFilter as ChangelogType].label}".`
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 8, padding: '32px 16px', color: '#6B7685', textAlign: 'center',
    }}>
      <Icon name="Inbox" size={28} style={{ opacity: 0.5 }} />
      <span style={{ fontSize: 12 }}>{message}</span>
    </div>
  )
}

interface DateGroup {
  date: string
  label: string
  entries: ChangelogEntry[]
}

function groupByDate(entries: ReadonlyArray<ChangelogEntry>): DateGroup[] {
  const map = new Map<string, ChangelogEntry[]>()
  for (const e of entries) {
    const list = map.get(e.date)
    if (list) list.push(e)
    else map.set(e.date, [e])
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, label: relativeDateLabel(date), entries: items }))
}
