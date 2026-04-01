import { useState, useEffect, useMemo } from 'react'
import { Plus, Briefcase, Search, RefreshCw, Loader2, Clock, CheckCircle2, CircleDashed, Filter } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase, fetchDemands } from '../lib/supabase'
import type { Demand } from '../lib/supabase'
import DemandModal from './DemandModal'

interface DemandViewProps {
  user: string
  onClose: () => void
}

const ACTIVITY_LABELS: Record<string, string> = {
  training: 'Treinamento',
  '1:1': 'Sessão 1:1',
  operational_support: 'Suporte Operacional',
  studying: 'Estudo / Capacitação',
  dashboard_creation: 'Criação de Dashboard',
  other: 'Outro'
}

export default function DemandView({ user, onClose }: DemandViewProps) {
  const [demands, setDemands] = useState<Demand[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  
  const [modalDemand, setModalDemand] = useState<Demand | null>(null)
  const [showModal, setShowModal] = useState(false)

  const loadData = async () => {
    try {
      const data = await fetchDemands()
      // Mostramos demandas auto-atribuídas do usuário (coach_email) ou onde ele é o solicitante
      const userDemands = data.filter(d => 
        (d.coach_email && d.coach_email.toLowerCase() === user.toLowerCase()) || 
        d.requester_email.toLowerCase() === user.toLowerCase()
      )
      setDemands(userDemands)
    } catch (err) {
      console.error('Failed to parse demands', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()

    // Setup realtime
    const channel = supabase.channel('demands-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'demands' }, () => {
        loadData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  const filtered = useMemo(() => {
    return demands.filter(d => {
      if (search && !(d.title.toLowerCase().includes(search.toLowerCase()) || d.description?.toLowerCase().includes(search.toLowerCase()))) return false
      if (filterType !== 'all' && d.activity_type !== filterType) return false
      if (filterStatus !== 'all' && d.status !== filterStatus) return false
      return true
    })
  }, [demands, search, filterType, filterStatus])

  const totalTime = useMemo(() => {
    return filtered.reduce((acc, curr) => acc + (curr.time_spent_minutes || 0), 0)
  }, [filtered])

  const formatHours = (mins: number) => {
    if (mins < 60) return `${mins} min`
    const hours = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${hours}h ${m}m` : `${hours}h`
  }

  const handleSaved = () => {
    setShowModal(false)
    loadData()
  }

  return (
    <div className="flex-1 flex flex-col bg-[#1d2125] min-h-0 relative">
      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8 min-h-0">
        
        {/* TOP BAR */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Briefcase size={28} className="text-[#579dff]" fill="currentColor" fillOpacity={0.2} />
              Gestão de Demandas
            </h1>
            <p className="text-sm text-[#9fadbc] mt-1 lg:max-w-md">
              Acompanhe suas solicitações, registre seu tempo e controle e defina demandas auto-atribuídas.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { setRefreshing(true); loadData() }}
              className="p-2 rounded-lg bg-white/5 text-[#9fadbc] hover:text-white hover:bg-white/10 transition-colors"
              title="Atualizar"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={() => { setModalDemand(null); setShowModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-[#25D066] hover:bg-[#1BAD53] text-black font-semibold rounded-lg shadow-[0_4px_12px_rgba(37,208,102,0.3)] transition-all transform hover:scale-[1.02]"
            >
              <Plus size={18} /> Cadastrar Nova
            </button>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 shrink-0">
          <div className="bg-[#22272b] p-4 rounded-xl border border-white/5 flex flex-col gap-1">
            <div className="text-xs font-semibold text-[#8c9bab] uppercase tracking-wider flex items-center gap-1">
              <CircleDashed size={14} /> Total de Demandas
            </div>
            <div className="text-3xl font-bold text-white">{filtered.length}</div>
          </div>
          <div className="bg-[#22272b] p-4 rounded-xl border border-[rgba(87,157,255,0.2)] flex flex-col gap-1 relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 opacity-10"><Clock size={80} /></div>
            <div className="text-xs font-semibold text-[#8c9bab] uppercase tracking-wider flex items-center gap-1 z-10">
              <Clock size={14} className="text-[#579dff]" /> Tempo Registrado
            </div>
            <div className="text-3xl font-bold text-[#579dff] z-10">{formatHours(totalTime)}</div>
          </div>
          <div className="bg-[#22272b] p-4 rounded-xl border border-white/5 flex flex-col gap-1">
            <div className="text-xs font-semibold text-[#8c9bab] uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 size={14} className="text-[#25D066]" /> Concluídas
            </div>
            <div className="text-3xl font-bold text-white">{filtered.filter(d => d.status === 'concluido').length}</div>
          </div>
        </div>

        {/* FILTERS & SEARCH */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4 shrink-0 bg-[#22272b] p-3 rounded-xl border border-white/5">
          <div className="flex-1 flex items-center gap-2 bg-[#1d2125] px-3 py-2 rounded-lg border border-white/10 focus-within:border-[#579dff]">
            <Search size={16} className="text-[#8c9bab]" />
            <input 
              type="text" 
              placeholder="Buscar demandas..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-[#b6c2cf] w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-[#1d2125] px-3 py-2 rounded-lg border border-white/10">
              <Filter size={14} className="text-[#8c9bab]" />
              <select 
                value={filterType} 
                onChange={e => setFilterType(e.target.value)} 
                className="bg-transparent border-none outline-none text-sm text-[#b6c2cf] cursor-pointer"
              >
                <option value="all">Todas Atividades</option>
                {Object.entries(ACTIVITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 bg-[#1d2125] px-3 py-2 rounded-lg border border-white/10">
              <select 
                value={filterStatus} 
                onChange={e => setFilterStatus(e.target.value)} 
                className="bg-transparent border-none outline-none text-sm text-[#b6c2cf] cursor-pointer"
              >
                <option value="all">Todos os Status</option>
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>
          </div>
        </div>

        {/* DEMAND LIST */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1 -mr-1 custom-scrollbar pb-24 relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
              <Loader2 size={24} className="animate-spin text-[#579dff]" />
              <span className="text-sm">Buscando quadro de demandas...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
              <Briefcase size={32} className="opacity-30" />
              <span className="text-sm">Nenhuma demanda encontrada.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <AnimatePresence>
                {filtered.map(demand => (
                  <motion.div
                    key={demand.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => { setModalDemand(demand); setShowModal(true) }}
                    className="bg-[#22272b] border border-[rgba(166,197,226,0.1)] hover:border-[#579dff]/40 p-4 rounded-xl cursor-pointer transition-colors shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded tracking-wider
                            ${demand.status === 'pendente' ? 'bg-[#f5a623]/20 text-[#f5a623]' : 
                              demand.status === 'em_andamento' ? 'bg-[#579dff]/20 text-[#579dff]' : 
                              'bg-[#25D066]/20 text-[#25D066]'}`}
                          >
                            {demand.status.replace('_', ' ')}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] bg-white/10 text-[#dfe1e6] rounded font-semibold">
                            {ACTIVITY_LABELS[demand.activity_type] || demand.activity_type}
                          </span>
                          {demand.is_self_assigned && (
                            <span className="px-2 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded font-semibold">
                              Auto-Atribuída
                            </span>
                          )}
                        </div>
                        <h3 className="text-[#dfe1e6] font-semibold text-[15px] truncate">{demand.title}</h3>
                        {demand.description && (
                          <p className="text-[#8c9bab] text-xs mt-1 truncate max-w-2xl">{demand.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-[#b6c2cf] font-medium bg-black/20 px-2 py-1 rounded">
                          <Clock size={12} className={demand.time_spent_minutes > 0 ? 'text-[#25D066]' : 'text-slate-500'} />
                          {demand.time_spent_minutes > 0 ? formatHours(demand.time_spent_minutes) : '--'}
                        </div>
                        <div className="text-[10px] text-[#596773]">
                          Atualizado: {new Date(demand.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <DemandModal
          user={user}
          demand={modalDemand}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  )
}
