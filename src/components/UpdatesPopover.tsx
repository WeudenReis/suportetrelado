import { useEffect, useState } from 'react'
import { Gift, Sparkles, Wrench, Bug, ShieldCheck } from 'lucide-react'
import IconButton from './ui/IconButton'
import Badge from './ui/Badge'
import Popover from './ui/Popover'
import { CHANGELOG, CHANGELOG_LAST_SEEN_KEY, countUnseen, type ChangelogType } from '../data/changelog'

const TYPE_META: Record<ChangelogType, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  feat:        { label: 'Novidade', color: '#25D066', bg: 'rgba(37,208,102,0.12)', icon: <Sparkles size={11} /> },
  improvement: { label: 'Melhoria', color: '#579DFF', bg: 'rgba(87,157,255,0.12)', icon: <Wrench size={11} /> },
  fix:         { label: 'Correção', color: '#F5A623', bg: 'rgba(245,166,35,0.12)', icon: <Bug size={11} /> },
  security:    { label: 'Segurança', color: '#A259FF', bg: 'rgba(162,89,255,0.14)', icon: <ShieldCheck size={11} /> },
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function UpdatesPopover() {
  const [open, setOpen] = useState(false)
  const [lastSeenId, setLastSeenId] = useState<string | null>(null)

  useEffect(() => {
    setLastSeenId(localStorage.getItem(CHANGELOG_LAST_SEEN_KEY))
  }, [])

  const unseen = countUnseen(lastSeenId)

  const handleToggle = () => {
    setOpen(prev => {
      const next = !prev
      if (next && CHANGELOG.length > 0) {
        const latestId = CHANGELOG[0].id
        localStorage.setItem(CHANGELOG_LAST_SEEN_KEY, latestId)
        setLastSeenId(latestId)
      }
      return next
    })
  }

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="end"
      width={360}
      anchor={
        <IconButton
          icon={<Gift size={16} />}
          label="Novidades"
          onClick={handleToggle}
          active={open}
          badge={unseen > 0 ? <Badge variant="dot" color="green" pulse /> : undefined}
        />
      }
    >
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'rgba(37,208,102,0.14)', color: '#25D066',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Gift size={13} />
          </span>
          <h3 style={{
            margin: 0, fontFamily: "'Paytone One', sans-serif",
            fontSize: 15, fontWeight: 800, color: '#E6E5E8', letterSpacing: '-0.01em',
          }}>
            Novidades do chatPro
          </h3>
        </div>
        <p style={{ margin: 0, fontSize: 11.5, color: '#8C96A3' }}>
          O que rolou de novo na ferramenta
        </p>
      </div>

      <div
        style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', padding: '8px 8px 12px' }}
        className="inbox-scroll"
      >
        {CHANGELOG.map((entry, index) => {
          const meta = TYPE_META[entry.type]
          const isNew = !lastSeenId || (CHANGELOG.findIndex(e => e.id === lastSeenId) > index)

          return (
            <article
              key={entry.id}
              style={{
                position: 'relative',
                padding: '12px 12px 12px 14px',
                borderRadius: 10,
                marginBottom: 4,
                background: isNew ? 'rgba(37,208,102,0.04)' : 'transparent',
                transition: 'background 0.12s',
              }}
            >
              {isNew && (
                <span style={{
                  position: 'absolute', left: 4, top: 18,
                  width: 4, height: 4, borderRadius: '50%',
                  background: '#25D066', boxShadow: '0 0 6px rgba(37,208,102,0.6)',
                }} />
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 6px', borderRadius: 4,
                  background: meta.bg, color: meta.color,
                  fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {meta.icon}
                  {meta.label}
                </span>
                <time style={{ fontSize: 10.5, color: '#6B7685' }}>
                  {formatDate(entry.date)}
                </time>
              </div>

              <h4 style={{
                margin: '0 0 4px', fontSize: 13, fontWeight: 700,
                color: '#E6E5E8', lineHeight: 1.3,
              }}>
                {entry.title}
              </h4>
              <p style={{
                margin: 0, fontSize: 12, lineHeight: 1.5,
                color: '#9FADBC',
              }}>
                {entry.description}
              </p>
            </article>
          )
        })}
      </div>
    </Popover>
  )
}
