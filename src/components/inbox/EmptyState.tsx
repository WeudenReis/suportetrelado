import { motion } from 'framer-motion'
import { BellOff, CheckCircle2, AtSign } from 'lucide-react'
import type { TabFilter } from './InboxTabs'

interface EmptyStateProps {
  filter: TabFilter
}

const STATES: Record<TabFilter, { icon: React.ReactNode; title: string; desc: string }> = {
  all: {
    icon: <BellOff size={32} strokeWidth={1.5} />,
    title: 'Tudo em dia!',
    desc: 'Nenhuma notificação por aqui.',
  },
  unread: {
    icon: <CheckCircle2 size={32} strokeWidth={1.5} />,
    title: 'Tudo em dia!',
    desc: 'Você não tem notificações pendentes.',
  },
  mentions: {
    icon: <AtSign size={32} strokeWidth={1.5} />,
    title: 'Sem menções',
    desc: 'Quando alguém te @mencionar, aparecerá aqui.',
  },
}

export default function EmptyState({ filter }: EmptyStateProps) {
  const s = STATES[filter]
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '56px 32px', textAlign: 'center', gap: 12,
      }}
    >
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'rgba(37,208,102,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#25D066', marginBottom: 4,
      }}>
        {s.icon}
      </div>
      <p style={{
        fontSize: 14, fontWeight: 700, color: '#E5E7EB',
        margin: 0, fontFamily: "'Space Grotesk', sans-serif",
      }}>{s.title}</p>
      <p style={{
        fontSize: 12, color: '#8C96A3', margin: 0,
        maxWidth: 220, lineHeight: 1.5,
        fontFamily: "'Space Grotesk', sans-serif",
      }}>{s.desc}</p>
    </motion.div>
  )
}
