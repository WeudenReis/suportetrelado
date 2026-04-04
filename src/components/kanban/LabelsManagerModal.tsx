import { useState } from 'react'
import { Tag, X, Pencil, Trash2 } from 'lucide-react'
import { fetchBoardLabels, insertBoardLabel, updateBoardLabel, deleteBoardLabel } from '../../lib/supabase'
import type { BoardLabel } from '../../lib/supabase'

const LABEL_COLORS = ['#ef5c48', '#e2b203', '#4bce97', '#579dff', '#6366f1', '#a259ff', '#ec4899', '#06b6d4', '#f97316', '#596773']

interface LabelsManagerModalProps {
  boardLabels: BoardLabel[]
  onLabelsChange: (labels: BoardLabel[]) => void
  onClose: () => void
}

export default function LabelsManagerModal({ boardLabels, onLabelsChange, onClose }: LabelsManagerModalProps) {
  const [editingLabel, setEditingLabel] = useState<BoardLabel | null>(null)
  const [editLabelName, setEditLabelName] = useState('')
  const [editLabelColor, setEditLabelColor] = useState('')
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState('#579dff')

  const refreshLabels = async () => {
    const labels = await fetchBoardLabels()
    onLabelsChange(labels)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm mx-4 rounded-xl shadow-2xl overflow-hidden" style={{ background: '#282e33', border: '1px solid rgba(166,197,226,0.16)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ background: '#1d2125', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2">
            <Tag size={15} style={{ color: '#579dff' }} />
            <h3 className="font-bold text-sm" style={{ color: '#b6c2cf' }}>Gerenciar Etiquetas</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><X size={16} style={{ color: '#596773' }} /></button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-2 max-h-[55vh] overflow-y-auto">
          {boardLabels.map(label => (
            editingLabel?.id === label.id ? (
              <div key={label.id} className="rounded-lg p-3.5 space-y-3" style={{ background: '#1d2125', border: '1px solid rgba(87,157,255,0.2)' }}>
                <input
                  value={editLabelName}
                  onChange={e => setEditLabelName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs font-medium outline-none"
                  style={{ background: '#22272b', border: '1px solid rgba(166,197,226,0.15)', color: '#b6c2cf' }}
                  placeholder="Nome da etiqueta..."
                />
                <div className="flex flex-wrap gap-2">
                  {LABEL_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setEditLabelColor(c)}
                      className="rounded-full transition-transform hover:scale-110"
                      style={{ width: 24, height: 24, background: c, border: editLabelColor === c ? '2.5px solid #fff' : '2.5px solid transparent', boxShadow: editLabelColor === c ? '0 0 0 2px ' + c : 'none' }}
                    />
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={async () => { if (!editLabelName.trim()) return; await updateBoardLabel(label.id, { name: editLabelName.trim(), color: editLabelColor }); await refreshLabels(); setEditingLabel(null) }}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: '#579dff', color: '#1d2125' }}>Salvar</button>
                  <button onClick={async () => { if (confirm('Excluir esta etiqueta?')) { await deleteBoardLabel(label.id); await refreshLabels(); setEditingLabel(null) } }}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#ef5c48' }}>Excluir</button>
                  <button onClick={() => setEditingLabel(null)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-white/5"
                    style={{ color: '#596773' }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div key={label.id} className="flex items-center gap-2 group">
                <div className="flex-1 px-3.5 py-2.5 rounded-lg text-xs font-bold text-white" style={{ background: label.color }}>{label.name}</div>
                <button onClick={() => { setEditingLabel(label); setEditLabelName(label.name); setEditLabelColor(label.color) }}
                  className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10"
                  title="Editar"><Pencil size={14} style={{ color: '#9fadbc' }} /></button>
              </div>
            )
          ))}

          {boardLabels.length === 0 && !editingLabel && (
            <div className="text-center py-6">
              <Tag size={28} style={{ color: '#596773', margin: '0 auto 8px' }} />
              <p className="text-xs" style={{ color: '#596773' }}>Nenhuma etiqueta criada ainda</p>
            </div>
          )}
        </div>

        {/* Create new label footer */}
        <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: '#1d2125' }}>
          <div className="text-[11px] font-semibold mb-2.5" style={{ color: '#596773' }}>Criar nova etiqueta</div>
          <input
            value={newLabelName}
            onChange={e => setNewLabelName(e.target.value)}
            placeholder="Nome da etiqueta..."
            className="w-full px-3 py-2 rounded-lg text-xs font-medium outline-none mb-3"
            style={{ background: '#22272b', border: '1px solid rgba(166,197,226,0.15)', color: '#b6c2cf' }}
            onKeyDown={async e => { if (e.key === 'Enter' && newLabelName.trim()) { await insertBoardLabel(newLabelName.trim(), newLabelColor); await refreshLabels(); setNewLabelName('') } }}
          />
          <div className="flex flex-wrap gap-2 mb-3">
            {LABEL_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setNewLabelColor(c)}
                className="rounded-full transition-transform hover:scale-110"
                style={{ width: 24, height: 24, background: c, border: newLabelColor === c ? '2.5px solid #fff' : '2.5px solid transparent', boxShadow: newLabelColor === c ? '0 0 0 2px ' + c : 'none' }}
              />
            ))}
          </div>
          <button
            onClick={async () => { if (!newLabelName.trim()) return; await insertBoardLabel(newLabelName.trim(), newLabelColor); await refreshLabels(); setNewLabelName('') }}
            className="w-full py-2 rounded-lg text-xs font-bold transition-colors"
            style={{ background: newLabelName.trim() ? '#579dff' : 'rgba(87,157,255,0.15)', color: newLabelName.trim() ? '#1d2125' : '#579dff' }}
          >Criar etiqueta</button>
        </div>
      </div>
    </div>
  )
}
