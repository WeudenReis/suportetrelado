import React, { useState, useEffect, useRef } from 'react'
import { Paperclip, Download, Trash2, Loader2, Video, FileText, Image as ImageIcon } from 'lucide-react'
import { fetchAttachments, uploadAttachment, deleteAttachment } from '../../lib/supabase'
import { compressAttachment } from '../../lib/imageUtils'
import { useOrg } from '../../lib/org'
import type { Attachment, Ticket } from '../../lib/supabase'

interface CardAttachmentsProps {
  ticketId: string
  ticketDepartmentId: string | null
  user: string
  onUpdate?: (ticket: Ticket) => void
}

export default function CardAttachments({ ticketId, ticketDepartmentId, user }: CardAttachmentsProps) {
  const { departmentId: userDeptId } = useOrg()
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchAttachments(ticketId).then(setAttachments)
  }, [ticketId])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const compressed = await compressAttachment(file)
      // Prioridade: dept do ticket → dept ativo do usuário → undefined (cai em 'shared/')
      const resolvedDept = ticketDepartmentId ?? userDeptId ?? undefined
      const att = await uploadAttachment(ticketId, compressed, user, resolvedDept)
      if (att) setAttachments(prev => [...prev, att])
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDeleteAttachment = async (att: Attachment) => {
    setAttachments(prev => prev.filter(a => a.id !== att.id))
    await deleteAttachment(att.id, att.file_url)
  }

  return (
    <section className="mt-3">
      <div className="flex items-center gap-2 mb-1 text-xs font-semibold" style={{ color: '#b6c2cf' }}>
        <Paperclip size={14} style={{ color: '#596773' }} />
        Anexos
      </div>
      <div className="space-y-2">
        {attachments.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {attachments.map(att => (
              <div key={att.id} className="group relative rounded-lg overflow-hidden" style={{ background: '#22272b', border: '1px solid rgba(166,197,226,0.12)' }}>
                {att.file_type === 'image' ? (
                  <a href={att.file_url} target="_blank" rel="noreferrer"><img src={att.file_url} alt={att.file_name} className="w-full h-16 object-cover" /></a>
                ) : att.file_type === 'video' ? (
                  <a href={att.file_url} target="_blank" rel="noreferrer" className="flex items-center justify-center h-16"><Video size={18} style={{ color: '#596773' }} /></a>
                ) : (
                  <a href={att.file_url} target="_blank" rel="noreferrer" className="flex items-center justify-center h-16"><FileText size={18} style={{ color: '#596773' }} /></a>
                )}
                <div className="px-2 py-1 flex items-center justify-between">
                  <span className="text-[9px] truncate" style={{ color: '#596773' }}>{att.file_name}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={att.file_url} download target="_blank" rel="noreferrer" className="p-0.5 rounded hover:bg-white/10"><Download size={10} style={{ color: '#596773' }} /></a>
                    <button onClick={() => handleDeleteAttachment(att)} className="p-0.5 rounded hover:bg-red-500/20"><Trash2 size={10} className="text-red-400" /></button>
                  </div>
                </div>
              </div>
            ))}
            {uploading && (
              <div className="flex items-center justify-center h-16 rounded-lg" style={{ background: '#22272b', border: '2px dashed rgba(166,197,226,0.12)' }}>
                <Loader2 size={16} className="animate-spin" style={{ color: '#579dff' }} />
              </div>
            )}
          </div>
        )}
        <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(166,197,226,0.12)', color: '#596773' }}>
          <ImageIcon size={14} /> Adicionar Foto ou Video
        </button>
      </div>
      <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileUpload} />
    </section>
  )
}
