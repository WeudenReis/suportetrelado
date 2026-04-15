import { useRef } from 'react'
import { motion } from 'framer-motion'
import { X, Palette, Image, Upload, RotateCcw, Clock, Trash2, Tag, Pencil, Settings, Users } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'

const WALLPAPER_PRESETS = [
  { label: 'Oceano', value: 'linear-gradient(135deg, #1a3a5c 0%, #0d2137 50%, #1e4976 100%)' },
  { label: 'Grafite', value: 'linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 50%, #333 100%)' },
  { label: 'Floresta', value: '#1d5c3a' },
  { label: 'Vinho', value: '#6b1f2a' },
]

interface SettingsPanelProps {
  wallpaper: string
  wallpaperInput: string
  recentWallpapers: string[]
  onWallpaperInputChange: (value: string) => void
  onApplyWallpaper: (url: string) => void
  onWallpaperFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveRecentWallpaper: (index: number) => void
  onClearRecentWallpapers: () => void
  onDeleteCurrentWallpaper: () => void
  onOpenLabelsManager: () => void
  onOpenAutoRules: () => void
  onOpenMembersPanel: () => void
  onClose: () => void
}

export default function SettingsPanel({
  wallpaper, wallpaperInput, recentWallpapers,
  onWallpaperInputChange, onApplyWallpaper, onWallpaperFileSelect,
  onRemoveRecentWallpaper, onClearRecentWallpapers, onDeleteCurrentWallpaper,
  onOpenLabelsManager, onOpenAutoRules, onOpenMembersPanel, onClose,
}: SettingsPanelProps) {
  const wallpaperFileInputRef = useRef<HTMLInputElement | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, true)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div ref={panelRef} role="dialog" aria-modal="true" aria-label="Configurações" initial={{ x: 340 }} animate={{ x: 0 }} exit={{ x: 340 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ width: 320, height: '100%', overflowY: 'auto', background: '#1d2125', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(37,208,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Palette size={16} style={{ color: '#25D066' }} />
              </div>
              <h2 style={{ fontSize: 15, fontWeight: 900, color: '#E5E7EB', margin: 0, fontFamily: "'Paytone One', sans-serif" }}>Aparência</h2>
            </div>
            <button onClick={onClose}
              style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: '#596773', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#B6C2CF' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#596773' }}
            ><X size={15} /></button>
          </div>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Temas prontos */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#25D066', margin: '0 0 10px', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>Temas</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {WALLPAPER_PRESETS.map(wp => {
                const isActive = wallpaper === wp.value
                return (
                  <button key={wp.label} onClick={() => onApplyWallpaper(wp.value)}
                    style={{
                      height: 64, borderRadius: 10, fontSize: 12, fontWeight: 600,
                      fontFamily: "'Space Grotesk', sans-serif",
                      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8,
                      background: wp.value,
                      border: isActive ? '2px solid #25D066' : '1px solid rgba(255,255,255,0.08)',
                      color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                      cursor: 'pointer', transition: 'transform 0.15s, border-color 0.15s',
                      boxShadow: isActive ? '0 0 0 1px rgba(37,208,102,0.3)' : 'none',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                  >{wp.label}</button>
                )
              })}
            </div>
          </div>

          {/* Personalizar */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#25D066', margin: '0 0 10px', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>Personalizar</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <input type="color" value={wallpaper.startsWith('#') ? wallpaper : '#0f3b73'} onChange={e => onApplyWallpaper(e.target.value)}
                style={{ width: 36, height: 36, borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'none', padding: 0 }} title="Cor sólida" />
              <span style={{ fontSize: 12, color: '#8C96A3', fontFamily: "'Space Grotesk', sans-serif" }}>Cor sólida</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input placeholder="URL da imagem..." value={wallpaperInput} onChange={e => onWallpaperInputChange(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontFamily: "'Space Grotesk', sans-serif", color: '#E5E7EB', background: '#22272B', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', transition: 'border-color 0.15s' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(37,208,102,0.4)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
              />
              <button onClick={() => { if (wallpaperInput.trim()) { onApplyWallpaper(wallpaperInput.trim()); onWallpaperInputChange('') } }}
                style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#25D066', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Image size={14} />
              </button>
            </div>
            <input ref={wallpaperFileInputRef} type="file" accept="image/*" className="hidden" onChange={onWallpaperFileSelect} />
            <button onClick={() => wallpaperFileInputRef.current?.click()}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.15)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.08)' }}
              style={{ width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", background: 'rgba(37,208,102,0.08)', border: '1px solid rgba(37,208,102,0.2)', color: '#25D066', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.15s' }}>
              <Upload size={13} /> Importar imagem
            </button>

            {wallpaper && (wallpaper.startsWith('data:') || wallpaper.startsWith('http')) && (
              <button onClick={onDeleteCurrentWallpaper}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,85,85,0.12)'; e.currentTarget.style.borderColor = 'rgba(255,85,85,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,85,85,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,85,85,0.15)' }}
                style={{ width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", marginTop: 8, background: 'rgba(255,85,85,0.06)', border: '1px solid rgba(255,85,85,0.15)', color: '#ff5555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.15s, border-color 0.15s' }}>
                <Trash2 size={13} /> Excluir wallpaper
              </button>
            )}
          </div>

          {/* Recentes */}
          {recentWallpapers.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 10px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#25D066', margin: 0, fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={11} /> Recentes
                </p>
                <button onClick={onClearRecentWallpapers}
                  onMouseEnter={e => { e.currentTarget.style.color = '#ff5555' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#8C96A3' }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8C96A3', fontSize: 10, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, padding: 0, transition: 'color 0.15s' }}>
                  <Trash2 size={10} /> Limpar
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {recentWallpapers.map((wp, i) => {
                  const isActive = wallpaper === wp
                  return (
                    <div key={i} style={{ position: 'relative' }}>
                      <button onClick={() => onApplyWallpaper(wp)}
                        style={{ width: '100%', aspectRatio: '1', borderRadius: 8, cursor: 'pointer', backgroundImage: `url(${wp})`, backgroundSize: 'cover', backgroundPosition: 'center', border: isActive ? '2px solid #25D066' : '1px solid rgba(255,255,255,0.08)', boxShadow: isActive ? '0 0 0 1px rgba(37,208,102,0.3)' : 'none', transition: 'transform 0.15s, border-color 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                      />
                      <button onClick={e => { e.stopPropagation(); onRemoveRecentWallpaper(i) }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,50,50,0.9)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.65)' }}
                        style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: '1.5px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'background 0.15s' }}>
                        <X size={10} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Restaurar */}
          <button onClick={() => onApplyWallpaper('')}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
            style={{ width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#8C96A3', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.15s' }}>
            <RotateCcw size={12} /> Restaurar padrão
          </button>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Etiquetas */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Tag size={13} style={{ color: '#25D066' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#25D066', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>Etiquetas</span>
            </div>
            <button onClick={onOpenLabelsManager}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.15)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.08)' }}
              style={{ width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", background: 'rgba(37,208,102,0.08)', border: '1px solid rgba(37,208,102,0.2)', color: '#25D066', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.15s' }}>
              <Pencil size={12} /> Gerenciar Etiquetas
            </button>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Regras Automáticas */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Settings size={13} style={{ color: '#25D066' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#25D066', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>Regras Automáticas</span>
            </div>
            <button onClick={onOpenAutoRules}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.15)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.08)' }}
              style={{ width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", background: 'rgba(37,208,102,0.08)', border: '1px solid rgba(37,208,102,0.2)', color: '#25D066', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.15s' }}>
              <Settings size={12} /> Gerenciar Regras
            </button>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Equipe */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Users size={13} style={{ color: '#25D066' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#25D066', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>Equipe</span>
            </div>
            <button onClick={onOpenMembersPanel}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.15)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.08)' }}
              style={{ width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", background: 'rgba(37,208,102,0.08)', border: '1px solid rgba(37,208,102,0.2)', color: '#25D066', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.15s' }}>
              <Users size={12} /> Ver Membros e Roles
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
