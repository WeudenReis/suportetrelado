import { motion } from 'framer-motion'
import { Keyboard, X } from 'lucide-react'

const SHORTCUTS = [
  { key: 'N', desc: 'Novo ticket' },
  { key: 'F', desc: 'Abrir/fechar filtros' },
  { key: '/', desc: 'Foco na pesquisa' },
  { key: 'Ctrl + K', desc: 'Foco na pesquisa' },
  { key: 'R', desc: 'Atualizar tickets' },
  { key: 'C', desc: 'Modo compacto' },
  { key: 'Esc', desc: 'Fechar modal/painel' },
  { key: 'Shift + ?', desc: 'Este painel de atalhos' },
]

interface ShortcutsHelpModalProps {
  onClose: () => void
}

export default function ShortcutsHelpModal({ onClose }: ShortcutsHelpModalProps) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="rounded-2xl w-full max-w-sm overflow-hidden"
        style={{ background: '#1a1f23', border: '1px solid rgba(37,208,102,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
      >
        <div className="px-6 pt-5 pb-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(37,208,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Keyboard size={18} style={{ color: '#25D066' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#E5E7EB', margin: 0, fontFamily: "'Paytone One', sans-serif" }}>Atalhos de Teclado</h2>
            <p style={{ fontSize: 11, color: '#596773', margin: 0, marginTop: 1 }}>Navegue mais rápido pelo chatPro</p>
          </div>
          <button onClick={onClose} style={{ color: '#596773', background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8 }}><X size={16} /></button>
        </div>
        <div className="px-6 py-5" style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '60vh', overflowY: 'auto' }}>
          {SHORTCUTS.map(({ key, desc }) => (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              <span style={{ fontSize: 13, color: '#B6C2CF', fontWeight: 500 }}>{desc}</span>
              <kbd style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                background: 'rgba(37,208,102,0.08)', border: '1px solid rgba(37,208,102,0.2)',
                color: '#25D066', fontFamily: "'Space Grotesk', monospace",
              }}>{key}</kbd>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
