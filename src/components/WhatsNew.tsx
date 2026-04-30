import { motion, AnimatePresence } from 'framer-motion'
import { Icon, type IconName } from '../lib/icons'
import { useWhatsNew } from '../hooks/useWhatsNew'

const FONT = "'Space Grotesk', sans-serif"
const FONT_HEAD = "'Paytone One', sans-serif"

interface NewsItem {
  icon: IconName
  iconColor: string
  title: string
  description: string
  hint: string
}

const NEWS: NewsItem[] = [
  {
    icon: 'Camera',
    iconColor: '#a259ff',
    title: 'Foto de perfil personalizada',
    description: 'Agora você pode subir uma foto sua, recortar em formato circular e ajustar o zoom.',
    hint: 'Menu do usuário (canto superior direito) > Meu perfil',
  },
  {
    icon: 'Bold',
    iconColor: '#579dff',
    title: 'Formatação rica nos cartões',
    description: 'Negrito, itálico, sublinhado, código, listas, citação e link. Atalhos Ctrl+B / I / U / K.',
    hint: 'Aparece ao focar a Descrição ou Observação dentro de um cartão',
  },
  {
    icon: 'LayoutGrid',
    iconColor: '#25D066',
    title: 'Painel personalizado no Dashboard',
    description: 'Monte gráficos próprios escolhendo tipo e dimensão. Agora com 6 tipos de gráfico: barras, barras horizontais, pizza, donut, linhas e funil.',
    hint: 'Dashboard > aba "Meu Painel" > "Adicionar bloco"',
  },
]

/**
 * Popover de novidades para usuarios existentes. Mostrado uma vez por
 * versao (controlado pelo hook useWhatsNew + WHATS_NEW_VERSION).
 */
export default function WhatsNew() {
  const { open, dismiss } = useWhatsNew()

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="whatsnew-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={dismiss}
            style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
            }}
          />
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 10001,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16, pointerEvents: 'none',
            }}
          >
          <motion.div
            key="whatsnew-modal"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="whatsnew-title"
            style={{
              width: 'min(540px, 92vw)',
              maxHeight: '88vh',
              display: 'flex', flexDirection: 'column',
              background: '#22272b',
              border: '1px solid rgba(37,208,102,0.22)',
              borderRadius: 16,
              boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(37,208,102,0.06)',
              overflow: 'hidden',
              fontFamily: FONT,
              pointerEvents: 'auto',
            }}
          >
            <header style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '18px 22px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'linear-gradient(180deg, rgba(37,208,102,0.10), rgba(37,208,102,0))',
            }}>
              <span style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'rgba(37,208,102,0.15)',
                color: '#25D066',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon name="Sparkles" size={18} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 id="whatsnew-title" style={{
                  margin: 0, fontFamily: FONT_HEAD, fontSize: 17, color: '#E6E5E8',
                  letterSpacing: -0.2,
                }}>
                  Novidades no chatPro
                </h2>
                <p style={{
                  margin: '2px 0 0', fontSize: 11.5, color: '#8C96A3', fontWeight: 500,
                }}>
                  3 melhorias acabaram de chegar
                </p>
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Fechar"
                style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#8C96A3', display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.12s, color 0.12s',
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.color = '#D1D1D5'
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#8C96A3'
                }}
              >
                <Icon name="X" size={14} />
              </button>
            </header>

            <div style={{
              padding: '18px 22px',
              overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              {NEWS.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + i * 0.07, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 14px',
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(166,197,226,0.10)',
                    borderRadius: 10,
                  }}
                >
                  <span style={{
                    width: 34, height: 34, borderRadius: 9,
                    background: `${item.iconColor}1a`,
                    color: item.iconColor,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `0 0 12px ${item.iconColor}25`,
                  }}>
                    <Icon name={item.icon} size={15} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{
                      margin: 0, fontSize: 13.5, fontWeight: 700, color: '#E6E5E8',
                    }}>
                      {item.title}
                    </h3>
                    <p style={{
                      margin: '4px 0 0', fontSize: 12, color: '#B6C2CF', lineHeight: 1.5,
                    }}>
                      {item.description}
                    </p>
                    <p style={{
                      margin: '6px 0 0', fontSize: 10.5, color: '#8C96A3', fontWeight: 500,
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                    }}>
                      <Icon name="ArrowRight" size={9} />
                      {item.hint}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            <footer style={{
              display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10,
              padding: '12px 22px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(0,0,0,0.18)',
            }}>
              <button
                type="button"
                onClick={dismiss}
                style={{
                  background: '#25D066', color: '#0d1417',
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  fontFamily: FONT, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 0 12px rgba(37,208,102,0.35)',
                  transition: 'background 0.12s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = '#1BAD53' }}
                onMouseOut={e => { e.currentTarget.style.background = '#25D066' }}
              >
                Entendi
              </button>
            </footer>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
