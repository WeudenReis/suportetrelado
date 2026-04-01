import { useState, useEffect } from 'react'
import { X, Save, Clock, Briefcase, User, Info, Loader2 } from 'lucide-react'
import { insertDemand, updateDemand } from '../lib/supabase'
import type { Demand, DemandInsert, DemandActivityType, DemandStatus } from '../lib/supabase'

interface DemandModalProps {
  user: string
  demand: Demand | null
  onClose: () => void
  onSaved: (savedDemand: Demand) => void
}

const ACTIVITY_LABELS: Record<DemandActivityType, string> = {
  training: 'Treinamento',
  '1:1': 'Sessão 1:1',
  operational_support: 'Suporte Operacional',
  studying: 'Estudo / Capacitação',
  dashboard_creation: 'Criação de Dashboard',
  other: 'Outro'
}

export default function DemandModal({ user, demand, onClose, onSaved }: DemandModalProps) {
  const [title, setTitle] = useState(demand?.title || '')
  const [description, setDescription] = useState(demand?.description || '')
  const [status, setStatus] = useState<DemandStatus>(demand?.status || 'pendente')
  const [activityType, setActivityType] = useState<DemandActivityType>(demand?.activity_type || 'training')
  const [timeSpent, setTimeSpent] = useState<string>(demand?.time_spent_minutes?.toString() || '0')
  const [isSelfAssigned, setIsSelfAssigned] = useState<boolean>(demand ? demand.is_self_assigned : true)
  const [assignedTo, setAssignedTo] = useState<string>(demand?.coach_email || user)
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isSelfAssigned) {
      setAssignedTo(user)
    }
  }, [isSelfAssigned, user])

  const handleSave = async () => {
    if (!title.trim()) {
      setError('O título é obrigatório.')
      return
    }
    setError('')
    setSaving(true)

    const payload: DemandInsert = {
      title: title.trim(),
      description: description.trim(),
      status,
      activity_type: activityType,
      time_spent_minutes: parseInt(timeSpent, 10) || 0,
      is_self_assigned: isSelfAssigned,
      coach_email: assignedTo || null,
      requester_email: demand?.requester_email || user,
    }

    try {
      if (demand) {
        await updateDemand(demand.id, payload)
        onSaved({ ...demand, ...payload } as Demand)
      } else {
        const created = await insertDemand(payload, user)
        if (created) onSaved(created)
      }
    } catch (err: any) {
      setError('Erro ao salvar demanda. Verifique sua conexão.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="relative w-full max-w-lg rounded-xl flex flex-col overflow-hidden max-h-full" style={{ background: 'var(--bg-card)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {demand ? 'Editar Demanda' : 'Nova Demanda'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4" style={{ color: 'var(--text-secondary)' }}>
          {error && (
            <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1 uppercase tracking-wide opacity-80">Título</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Treinamento sobre a nova feature..."
              className="w-full p-2.5 rounded-lg focus:outline-none transition-shadow text-sm"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              data-focus-style
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 uppercase tracking-wide opacity-80">Descrição (Opcional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Detalhes da atividade..."
              rows={3}
              className="w-full p-2.5 rounded-lg focus:outline-none transition-shadow text-sm resize-none custom-scrollbar"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              data-focus-style
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide opacity-80 flex items-center gap-1">
                <Briefcase size={12} /> Tipo de Atividade
              </label>
              <select
                value={activityType}
                onChange={e => setActivityType(e.target.value as DemandActivityType)}
                className="w-full p-2.5 rounded-lg focus:outline-none transition-shadow text-sm"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-1/3">
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide opacity-80 flex items-center gap-1">
                <Clock size={12} /> Tempo (Minutos)
              </label>
              <input
                type="number"
                min="0"
                step="15"
                value={timeSpent}
                onChange={e => setTimeSpent(e.target.value)}
                className="w-full p-2.5 rounded-lg focus:outline-none transition-shadow text-sm"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide opacity-80">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as DemandStatus)}
                className="w-full p-2.5 rounded-lg focus:outline-none transition-shadow text-sm"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <label className="flex items-center gap-2 mt-4 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={isSelfAssigned}
                  onChange={e => setIsSelfAssigned(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 focus:ring-green-500 w-4 h-4"
                />
                <span>Demanda auto-atribuída</span>
              </label>
            </div>
          </div>

          {!isSelfAssigned && (
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide opacity-80 flex items-center gap-1">
                <User size={12} /> Atribuído a (Email do Coach)
              </label>
              <input
                type="email"
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                placeholder="email@exemplo.com"
                className="w-full p-2.5 rounded-lg focus:outline-none transition-shadow text-sm"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              />
            </div>
          )}

          {isSelfAssigned && !demand && (
             <div className="mt-2 text-xs flex items-center gap-1.5 p-2 rounded-lg bg-[#579dff]/10 text-[#579dff]">
               <Info size={14} /> Outros administradores serão notificados no dashboard.
             </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white transition-opacity disabled:opacity-50"
            style={{ background: 'var(--cp-green2)' }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
      <style>{`
        [data-focus-style]:focus {
          border-color: #579dff !important;
          box-shadow: inset 0 0 0 1px #579dff;
        }
      `}</style>
    </div>
  )
}
