import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Trash2, X, ExternalLink, Search, Link2, FolderOpen } from 'lucide-react'
import { fetchUsefulLinks, insertUsefulLink, deleteUsefulLink, type UsefulLink } from '../lib/supabase'
import { useOrg } from '../lib/org'
import { logger } from '../lib/logger'

interface LinksViewProps {
  user: string
  onClose: () => void
}

const DEFAULT_CATEGORIES = ['Geral', 'Documentação', 'Ferramentas', 'Suporte', 'Treinamento']

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') }
  catch { return '' }
}

export default function LinksView({ user, onClose }: LinksViewProps) {
  const [links, setLinks] = useState<UsefulLink[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Geral')
  const [customCategory, setCustomCategory] = useState('')
  const [search, setSearch] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const org = useOrg()

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchUsefulLinks()
    setLinks(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load]) // eslint-disable-line react-hooks/set-state-in-effect -- carregamento inicial

  const filtered = useMemo(() => {
    if (!search.trim()) return links
    const q = search.toLowerCase()
    return links.filter(l =>
      l.title.toLowerCase().includes(q) ||
      l.description.toLowerCase().includes(q) ||
      l.url.toLowerCase().includes(q) ||
      l.category.toLowerCase().includes(q)
    )
  }, [links, search])

  const grouped = useMemo(() => {
    const map: Record<string, UsefulLink[]> = {}
    for (const link of filtered) {
      if (!map[link.category]) map[link.category] = []
      map[link.category].push(link)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const handleSubmit = async () => {
    if (!title.trim() || !url.trim()) return
    const finalCategory = (category === '__custom' ? customCategory.trim() : category) || 'Geral'
    const link = await insertUsefulLink({
      title: title.trim(),
      url: url.trim(),
      description: description.trim(),
      category: finalCategory,
      added_by: user,
      ...(org?.departmentId ? { department_id: org.departmentId } : {}),
    })
    if (link) {
      setLinks(prev => [...prev, link])
      setTitle(''); setUrl(''); setDescription(''); setCategory('Geral'); setCustomCategory(''); setShowForm(false)
    } else {
      logger.error('LinksView', 'Falha ao salvar link', { departmentId: org?.departmentId })
    }
  }

  const handleDelete = async (id: string) => {
    const backup = links
    setLinks(prev => prev.filter(l => l.id !== id))
    const success = await deleteUsefulLink(id)
    if (!success) {
      setLinks(backup)
    }
  }

  const font = "'Space Grotesk', sans-serif"

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

      {/* HEADER */}
      <div data-stagger-child style={{ padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(37,208,102,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Link2 size={16} style={{ color: '#25D066' }} />
            </div>
            <div>
              <h2 style={{
                fontSize: 15, fontWeight: 900, color: '#E5E7EB', margin: 0,
                fontFamily: "'Paytone One', sans-serif",
              }}>
                Links Úteis
              </h2>
              <p style={{ fontSize: 11, color: '#596773', margin: 0, fontFamily: font }}>
                {links.length} recurso{links.length !== 1 ? 's' : ''} salvo{links.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Fechar"
            style={{
              width: 28, height: 28, borderRadius: 8, border: 'none',
              background: 'transparent', color: '#596773', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#B6C2CF' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#596773' }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* BUSCA */}
      <div data-stagger-child style={{ padding: '0 20px 12px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#596773',
          }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar links..."
            style={{
              width: '100%', padding: '9px 14px 9px 34px', borderRadius: 10,
              fontSize: 12, outline: 'none', fontFamily: font,
              background: '#282E33', color: '#E5E7EB',
              border: '1px solid rgba(255,255,255,0.06)',
              transition: 'border 0.15s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(37,208,102,0.4)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
          />
        </div>
      </div>

      {/* BOTAO ADICIONAR */}
      <div data-stagger-child style={{ padding: '0 20px 14px' }}>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 7, padding: '10px 0', borderRadius: 10, cursor: 'pointer',
            fontSize: 13, fontWeight: 700, fontFamily: font,
            background: showForm ? 'rgba(255,255,255,0.04)' : '#25D066',
            color: showForm ? '#8C96A3' : '#000',
            border: 'none', transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            if (!showForm) e.currentTarget.style.background = '#1BAD53'
            else e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
          }}
          onMouseLeave={e => {
            if (!showForm) e.currentTarget.style.background = '#25D066'
            else e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
          }}
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancelar' : 'Adicionar Link'}
        </button>
      </div>

      {/* FORMULARIO */}
      {showForm && (
        <div data-stagger-child style={{ padding: '0 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Nome do link"
              autoFocus
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                fontSize: 13, fontWeight: 600, outline: 'none', fontFamily: font,
                background: '#282E33', color: '#E5E7EB',
                border: '1px solid rgba(255,255,255,0.06)', transition: 'border 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(37,208,102,0.4)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
            />
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              type="url"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                fontSize: 12, outline: 'none', fontFamily: font,
                background: '#282E33', color: '#B6C2CF',
                border: '1px solid rgba(255,255,255,0.06)', transition: 'border 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(37,208,102,0.4)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
            />
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descrição (opcional)"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                fontSize: 12, outline: 'none', fontFamily: font,
                background: '#282E33', color: '#B6C2CF',
                border: '1px solid rgba(255,255,255,0.06)', transition: 'border 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(37,208,102,0.4)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={category}
                onChange={e => { setCategory(e.target.value); setCustomCategory('') }}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 10,
                  fontSize: 12, outline: 'none', fontFamily: font,
                  background: '#282E33', color: '#B6C2CF',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {DEFAULT_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="__custom">+ Nova categoria</option>
              </select>
              {category === '__custom' && (
                <input
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                  placeholder="Nome da categoria"
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 10,
                    fontSize: 12, outline: 'none', fontFamily: font,
                    background: '#282E33', color: '#B6C2CF',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || !url.trim()}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  fontSize: 12, fontWeight: 700, fontFamily: font,
                  cursor: (title.trim() && url.trim()) ? 'pointer' : 'default',
                  background: (title.trim() && url.trim()) ? '#25D066' : '#2A3038',
                  color: (title.trim() && url.trim()) ? '#000' : '#596773',
                  transition: 'all 0.15s',
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LISTA DE LINKS */}
      <div className="inbox-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '6px 20px 80px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <div style={{
              width: 24, height: 24, border: '2px solid #25D06630',
              borderTop: '2px solid #25D066', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : grouped.length === 0 ? (
          <div data-stagger-child style={{ textAlign: 'center', padding: '52px 24px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px',
              background: 'rgba(37,208,102,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FolderOpen size={24} style={{ color: '#25D066', opacity: 0.6 }} />
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#8C96A3', margin: '0 0 4px', fontFamily: font }}>
              {search ? 'Nenhum resultado' : 'Nenhum link salvo'}
            </p>
            <p style={{ fontSize: 11, color: '#596773', fontFamily: font, lineHeight: '1.5' }}>
              {search ? 'Tente buscar com termos diferentes.' : 'Adicione links úteis para a equipe.'}
            </p>
          </div>
        ) : (
          grouped.map(([cat, catLinks]) => (
            <div key={cat} data-stagger-child>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: '#25D066', fontFamily: font,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {cat}
                </span>
                <span style={{
                  fontSize: 10, color: '#596773', fontFamily: font,
                }}>
                  ({catLinks.length})
                </span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {catLinks.map(link => {
                  const hovered = hoveredId === link.id
                  return (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onMouseEnter={() => setHoveredId(link.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
                        background: hovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: 'rgba(37,208,102,0.10)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <ExternalLink size={14} style={{ color: '#25D066' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 13, fontWeight: 700, color: '#E5E7EB', margin: 0,
                          fontFamily: font,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {link.title}
                        </p>
                        <p style={{
                          fontSize: 11, color: '#596773', margin: '2px 0 0',
                          fontFamily: font,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {link.description || getDomain(link.url)}
                        </p>
                      </div>
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); handleDelete(link.id) }}
                        title="Remover"
                        style={{
                          width: 26, height: 26, borderRadius: 6, border: 'none',
                          background: 'rgba(255,255,255,0.06)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#8C96A3',
                          opacity: hovered ? 1 : 0,
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,92,72,0.15)'; e.currentTarget.style.color = '#ef5c48' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#8C96A3' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </a>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
