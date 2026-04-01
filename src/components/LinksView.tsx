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
    <div className="flex flex-col h-full" data-gsap-child>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(166,197,226,0.08)' }}>
        <div className="flex items-center gap-2">
          <Link2 size={18} style={{ color: '#579dff' }} />
          <h2 className="text-sm font-semibold" style={{ color: '#b6c2cf' }}>Links Úteis</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: 'rgba(87,157,255,0.12)', color: '#579dff' }}>
            {links.length}
          </span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/5" style={{ color: '#596773' }}>
          <X size={16} />
        </button>
      </div>

      {/* Busca */}
      <div className="px-4 py-2 border-b" style={{ borderColor: 'rgba(166,197,226,0.06)' }} data-gsap-child>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#596773' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar links..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none"
            style={{ background: '#282e33', color: '#b6c2cf', border: '1px solid rgba(166,197,226,0.12)' }}
          />
        </div>
      </div>

      {/* Filtro por categoria */}
      <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto border-b" style={{ borderColor: 'rgba(166,197,226,0.06)' }} data-gsap-child>
        <button
          onClick={() => setFilterCategory('all')}
          className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap"
          style={{
            background: filterCategory === 'all' ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: filterCategory === 'all' ? '#b6c2cf' : '#596773',
          }}
        >
          Todos
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap"
            style={{
              background: filterCategory === cat ? 'rgba(87,157,255,0.12)' : 'transparent',
              color: filterCategory === cat ? '#579dff' : '#596773',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Botão adicionar */}
      <div className="px-4 py-2" data-gsap-child>
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
          style={{ background: 'rgba(37,208,102,0.08)', color: '#25D066', border: '1px dashed rgba(37,208,102,0.25)' }}
        >
          <Plus size={14} />
          Adicionar Link
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="px-4 pb-3 space-y-2" style={{ borderBottom: '1px solid rgba(166,197,226,0.06)' }}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Nome do link"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: '#282e33', color: '#b6c2cf', border: '1px solid rgba(166,197,226,0.12)' }}
          />
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://..."
            type="url"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: '#282e33', color: '#b6c2cf', border: '1px solid rgba(166,197,226,0.12)' }}
          />
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: '#282e33', color: '#b6c2cf', border: '1px solid rgba(166,197,226,0.12)' }}
          />
          <div className="flex items-center gap-2">
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); setCustomCategory('') }}
              className="flex-1 px-3 py-2 rounded-lg text-xs outline-none"
              style={{ background: '#282e33', color: '#b6c2cf', border: '1px solid rgba(166,197,226,0.12)' }}
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
                className="flex-1 px-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: '#282e33', color: '#b6c2cf', border: '1px solid rgba(166,197,226,0.12)' }}
              />
            )}
          </div>
          <div className="flex justify-end gap-1.5">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded text-xs" style={{ color: '#596773' }}>
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || !url.trim()}
              className="px-3 py-1.5 rounded text-xs font-semibold transition-colors disabled:opacity-40"
              style={{ background: '#25D066', color: '#000' }}
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* Lista de links agrupados por categoria */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4 inbox-scroll">
        {loading ? (
          <p className="text-center text-xs py-8" style={{ color: '#596773' }}>Carregando...</p>
        ) : grouped.length === 0 ? (
          <div className="text-center py-10" data-gsap-child>
            <FolderOpen size={32} className="mx-auto mb-2" style={{ color: '#596773', opacity: 0.4 }} />
            <p className="text-xs" style={{ color: '#596773' }}>Nenhum link encontrado</p>
          </div>
        ) : (
          grouped.map(([cat, catLinks]) => (
            <div key={cat} data-gsap-child>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#596773' }}>
                {cat} <span style={{ color: '#454f59' }}>({catLinks.length})</span>
              </p>
              <div className="space-y-1">
                {catLinks.map(link => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2.5 px-3 py-2 rounded-lg transition-colors hover:bg-white/[0.04]"
                    style={{ border: '1px solid rgba(166,197,226,0.06)' }}
                  >
                    <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(87,157,255,0.12)' }}>
                      <ExternalLink size={12} style={{ color: '#579dff' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate group-hover:underline" style={{ color: '#b6c2cf' }}>{link.title}</p>
                      {link.description && (
                        <p className="text-[10px] mt-0.5 truncate" style={{ color: '#596773' }}>{link.description}</p>
                      )}
                      <p className="text-[9px] mt-0.5" style={{ color: '#454f59' }}>{getDomain(link.url)}</p>
                    </div>
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); handleDelete(link.id) }}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10"
                      style={{ color: '#ef5c48' }}
                      title="Remover link"
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
