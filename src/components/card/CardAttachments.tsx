import React, { useState, useEffect, useRef, useCallback } from 'react'
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
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Contador de dragEnter/Leave aninhados para evitar flicker
  const dragCounter = useRef(0)

  useEffect(() => {
    fetchAttachments(ticketId).then(setAttachments)
  }, [ticketId])

  // ── Função central de upload: usada por botão, drop e paste ──
  const processFiles = useCallback(async (files: File[]) => {
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const compressed = await compressAttachment(file)
      const resolvedDept = ticketDepartmentId ?? userDeptId ?? undefined
      const att = await uploadAttachment(ticketId, compressed, user, resolvedDept)
      if (att) setAttachments(prev => [...prev, att])
    }
    setUploading(false)
  }, [ticketId, ticketDepartmentId, userDeptId, user])

  // ── Botão "Adicionar" ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    processFiles(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Excluir ──
  const handleDeleteAttachment = async (att: Attachment) => {
    setAttachments(prev => prev.filter(a => a.id !== att.id))
    await deleteAttachment(att.id, att.file_url)
  }

  // ── Paste (Ctrl+V): captura imagens coladas de qualquer origem ──
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Não interceptar paste dentro de inputs / textareas
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageFiles = items
        .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter((f): f is File => f !== null)
      if (!imageFiles.length) return
      e.preventDefault()
      processFiles(imageFiles)
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [processFiles])

  // ── Drag & Drop handlers ──
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer.items.length > 0) setIsDragging(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragging(false) }
  }
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    processFiles(files)
  }

  return (
    <section
      className="mt-3"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-2 mb-1 text-xs font-semibold" style={{ color: '#b6c2cf' }}>
        <Paperclip size={14} style={{ color: isDragging ? '#25D066' : '#596773', transition: 'color 0.15s' }} />
        Anexos
        {isDragging && (
          <span className="text-[10px] font-semibold animate-pulse" style={{ color: '#25D066' }}>
            Solte para anexar
          </span>
        )}
      </div>

      <div className="space-y-2">
        {/* Grid de arquivos já anexados */}
        {(attachments.length > 0 || uploading) && (
          <div className="grid grid-cols-2 gap-2">
            {attachments.map(att => (
              <div
                key={att.id}
                className="group relative rounded-lg overflow-hidden"
                style={{ background: '#22272b', border: '1px solid rgba(166,197,226,0.12)' }}
              >
                {att.file_type === 'image' ? (
                  <a href={att.file_url} target="_blank" rel="noreferrer">
                    <img src={att.file_url} alt={att.file_name} className="w-full h-16 object-cover" />
                  </a>
                ) : att.file_type === 'video' ? (
                  <a href={att.file_url} target="_blank" rel="noreferrer" className="flex items-center justify-center h-16">
                    <Video size={18} style={{ color: '#596773' }} />
                  </a>
                ) : (
                  <a href={att.file_url} target="_blank" rel="noreferrer" className="flex items-center justify-center h-16">
                    <FileText size={18} style={{ color: '#596773' }} />
                  </a>
                )}
                <div className="px-2 py-1 flex items-center justify-between">
                  <span className="text-[9px] truncate" style={{ color: '#596773' }}>{att.file_name}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={att.file_url} download target="_blank" rel="noreferrer" className="p-0.5 rounded hover:bg-white/10">
                      <Download size={10} style={{ color: '#596773' }} />
                    </a>
                    <button onClick={() => handleDeleteAttachment(att)} className="p-0.5 rounded hover:bg-red-500/20">
                      <Trash2 size={10} className="text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {uploading && (
              <div
                className="flex flex-col items-center justify-center gap-1 h-16 rounded-lg"
                style={{ background: '#22272b', border: '2px dashed rgba(37,208,102,0.2)' }}
              >
                <Loader2 size={16} className="animate-spin" style={{ color: '#25D066' }} />
                <span className="text-[9px]" style={{ color: '#596773' }}>Enviando...</span>
              </div>
            )}
          </div>
        )}

        {/* Zona de drop / botão de adicionar */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium"
          style={{
            background: isDragging ? 'rgba(37,208,102,0.08)' : 'rgba(255,255,255,0.03)',
            border: isDragging ? '1px dashed rgba(37,208,102,0.5)' : '1px dashed rgba(166,197,226,0.12)',
            color: isDragging ? '#25D066' : '#596773',
            cursor: uploading ? 'wait' : 'pointer',
            transition: 'background 0.15s, border-color 0.15s, color 0.15s',
          }}
        >
          <ImageIcon size={14} />
          {isDragging ? 'Solte os arquivos aqui' : uploading ? 'Enviando...' : 'Adicionar arquivo'}
        </button>

        {/* Dica de atalho */}
        {!uploading && (
          <p className="text-[10px] text-center select-none" style={{ color: '#3b4755' }}>
            Ctrl+V para colar · Arraste arquivos
          </p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,.pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={handleFileChange}
      />
    </section>
  )
}
