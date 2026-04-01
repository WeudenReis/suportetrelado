import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link2, Plus, Trash2, X, ExternalLink, Search, FolderOpen } from 'lucide-react'
import { fetchUsefulLinks, insertUsefulLink, deleteUsefulLink, type UsefulLink } from '../lib/supabase'

interface LinksViewProps {
  user: string
  onClose: () => void
}

const DEFAULT_CATEGORIES = ['Geral', 'Documentação', 'Ferramentas', 'Suporte', 'Treinamento']

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return ''
  }
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
  const [filterCategory, setFilterCategory] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchUsefulLinks()
    setLinks(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const categories = useMemo(() => {
    const cats = new Set(links.map(l => l.category))
    DEFAULT_CATEGORIES.forEach(c => cats.add(c))
    return Array.from(cats).sort()
  }, [links])

  const filtered = useMemo(() => {
    let result = links
    if (filterCategory !== 'all') {
      result = result.filter(l => l.category === filterCategory)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q)
      )
    }
    return result
  }, [links, filterCategory, search])

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
    const finalCategory = customCategory.trim() || category
    const link = await insertUsefulLink({
      title: title.trim(),
      url: url.trim(),
      description: description.trim(),
      category: finalCategory,
      added_by: user,
    })
    if (link) {
      setLinks(prev => [...prev, link])
      setTitle('')
      setUrl('')
      setDescription('')
      setCategory('Geral')
      setCustomCategory('')
      setShowForm(false)
    }
  }

  const handleDelete = async (id: string) => {
    setLinks(prev => prev.filter(l => l.id !== id))
    await deleteUsefulLink(id)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

      {/* ══════ HEADER ══════ */}
      <div data-gsap-child style={{ padding: '18px 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{
              fontSize: 16, fontWeight: 900, color: '#E5E7EB', margin: 0,
              fontFamily: "'Paytone One', sans-serif",
              letterSpacing: '-0.2px',
            }}>
              Links Úteis
            </h2>
            {links.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                background: '#25D066', color: '#000',
                fontFamily: "'Space Grotesk', sans-serif",
                lineHeight: '18px',
              }}>
                {links.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            title="Fechar"
            style={{
              width: 28, height: 28, borderRadius: 7, border: 'none',
              background: 'transparent', color: '#8C96A3', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#E5E7EB' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8C96A3' }}
          >
            <X size={15} />
          </button>
        </div>
        <p style={{
          fontSize: 12, color: '#6B7A8D', margin: '4px 0 0',
          fontFamily: "'Space Grotesk', sans-serif",
        }}>
          Recursos e referências da equipe
        </p>
      </div>

      {/* ══════ BUSCA ══════ */}
      <div data-gsap-child style={{
        padding: '0 20px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: '#6B7A8D',
          }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar links..."
            style={{
              width: '100%', padding: '8px 14px 8px 34px', borderRadius: 10,
              fontSize: 12, outline: 'none',
              fontFamily: "'Space Grotesk', sans-serif",
              background: '#22272B', color: '#E5E7EB',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          />
        </div>
      </div>

      {/* ══════ FILTRO POR CATEGORIA ══════ */}
      <div data-gsap-child style={{
        display: 'flex', gap: 6, padding: '10px 20px 10px',
        overflowX: 'auto',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <button
          onClick={() => setFilterCategory('all')}
          style={{
            padding: '5px 12px', borderRadius: 8, border: 'none',
            fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            fontFamily: "'Space Grotesk', sans-serif",
            background: filterCategory === 'all' ? 'rgba(37,208,102,0.12)' : 'transparent',
            color: filterCategory === 'all' ? '#25D066' : '#6B7A8D',
            transition: 'all 0.15s',
          }}
        >
          Todos
        </button>
        {categories.map(cat => {
          const isActive = filterCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              style={{
                padding: '5px 12px', borderRadius: 8, border: 'none',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                fontFamily: "'Space Grotesk', sans-serif",
                background: isActive ? 'rgba(37,208,102,0.12)' : 'transparent',
                color: isActive ? '#25D066' : '#6B7A8D',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              {cat}
            </button>
          )
        })}
      </div>

      {/* ══════ BOTÃO ADICIONAR ══════ */}
      <div data-gsap-child style={{ padding: '12px 20px 8px' }}>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, padding: '10px 0', borderRadius: 10, cursor: 'pointer',
            fontSize: 12, fontWeight: 700,
            fontFamily: "'Space Grotesk', sans-serif",
            background: 'rgba(37,208,102,0.08)', color: '#25D066',
            border: '1px dashed rgba(37,208,102,0.30)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.15)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.08)' }}
        >
          <Plus size={14} />
          Adicionar Link
        </button>
      </div>

      {/* ══════ FORMULÁRIO ══════ */}
      {showForm && (
        <div data-gsap-child style={{
          padding: '0 20px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Nome do link"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                fontSize: 13, fontWeight: 600, outline: 'none',
                fontFamily: "'Space Grotesk', sans-serif",
                background: '#22272B', color: '#E5E7EB',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            />
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              type="url"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                fontSize: 12, outline: 'none',
                fontFamily: "'Space Grotesk', sans-serif",
                background: '#22272B', color: '#B6C2CF',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            />
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descrição (opcional)"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                fontSize: 12, outline: 'none',
                fontFamily: "'Space Grotesk', sans-serif",
                background: '#22272B', color: '#B6C2CF',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                value={category}
                onChange={e => { setCategory(e.target.value); setCustomCategory('') }}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 10,
                  fontSize: 12, outline: 'none',
                  fontFamily: "'Space Grotesk', sans-serif",
                  background: '#22272B', color: '#B6C2CF',
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
                    fontSize: 12, outline: 'none',
                    fontFamily: "'Space Grotesk', sans-serif",
                    background: '#22272B', color: '#B6C2CF',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button
                onClick={() => setShowForm(false)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  fontFamily: "'Space Grotesk', sans-serif",
                  background: 'transparent', color: '#6B7A8D',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || !url.trim()}
                style={{
                  padding: '6px 16px', borderRadius: 8, border: 'none',
                  fontSize: 11, fontWeight: 700,
                  cursor: (title.trim() && url.trim()) ? 'pointer' : 'default',
                  fontFamily: "'Space Grotesk', sans-serif",
                  background: (title.trim() && url.trim()) ? '#25D066' : 'rgba(37,208,102,0.3)',
                  color: '#000',
                  transition: 'all 0.15s',
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ LISTA DE LINKS ══════ */}
      <div
        className="inbox-scroll"
        style={{
          flex: 1, overflowY: 'auto', padding: '8px 20px 80px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        {loading ? (
          <p style={{
            textAlign: 'center', padding: '40px 0',
            fontSize: 12, color: '#6B7A8D',
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            Carregando links...
          </p>
        ) : grouped.length === 0 ? (
          <div data-gsap-child style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
              background: 'rgba(255,255,255,0.03)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <FolderOpen size={24} style={{ color: '#454F59' }} />
            </div>
            <p style={{
              fontSize: 13, fontWeight: 700, color: '#8C96A3', margin: '0 0 4px',
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              Nenhum link encontrado
            </p>
            <p style={{
              fontSize: 11, color: '#596773',
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              Adicione links úteis para a equipe consultar.
            </p>
          </div>
        ) : (
          grouped.map(([cat, catLinks]) => (
            <div key={cat} data-gsap-child>
              <p style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.05em', color: '#6B7A8D', margin: '0 0 8px',
                fontFamily: "'Space Grotesk', sans-serif",
              }}>
                {cat}{' '}
                <span style={{ color: '#454F59' }}>({catLinks.length})</span>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {catLinks.map(link => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
                      border: '1px solid rgba(255,255,255,0.04)',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: 'rgba(37,208,102,0.10)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <ExternalLink size={13} style={{ color: '#25D066' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 13, fontWeight: 700, color: '#E5E7EB', margin: 0,
                        fontFamily: "'Space Grotesk', sans-serif",
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {link.title}
                      </p>
                      {link.description && (
                        <p style={{
                          fontSize: 11, color: '#6B7A8D', margin: '2px 0 0',
                          fontFamily: "'Space Grotesk', sans-serif",
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {link.description}
                        </p>
                      )}
                      <p style={{
                        fontSize: 10, color: '#454F59', margin: '2px 0 0',
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}>
                        {getDomain(link.url)}
                      </p>
                    </div>
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); handleDelete(link.id) }}
                      title="Remover link"
                      style={{
                        width: 24, height: 24, borderRadius: 6, border: 'none',
                        background: 'transparent', color: '#596773', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: 0, transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,92,72,0.08)'; e.currentTarget.style.color = '#ef5c48' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#596773' }}
                      onFocus={e => { e.currentTarget.style.opacity = '1' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </a>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
