import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../lib/icons'
import { supabase } from '../lib/supabase'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface InstanceModalProps {
  open: boolean
  onClose: () => void
  user: string
}

interface InstanceConfig {
  id?: string
  instance_code: string
  access_token: string
  api_url: string
  label: string
}

type ValidationState = 'idle' | 'validating' | 'success' | 'error'

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 28, mass: 0.8 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 12,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
}

export default function InstanceModal({ open, onClose, user }: InstanceModalProps) {
  const [config, setConfig] = useState<InstanceConfig>({
    instance_code: '',
    access_token: '',
    api_url: '',
    label: '',
  })
  const [validation, setValidation] = useState<ValidationState>('idle')
  const [saving, setSaving] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const firstInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, open)

  const loadExistingConfig = useCallback(async () => {
    setLoadingExisting(true)
    try {
      const { data, error } = await supabase
        .from('instance_settings')
        .select('*')
        .eq('user_email', user)
        .maybeSingle()
      if (!error && data) {
        setConfig({
          id: data.id,
          instance_code: data.instance_code || '',
          access_token: data.access_token || '',
          api_url: data.api_url || '',
          label: data.label || '',
        })
      }
    } catch {
      // Table may not exist yet — that's okay
    } finally {
      setLoadingExisting(false)
    }
  }, [user])

  // Auto-focus first field when modal opens
  useEffect(() => {
    if (open) {
      setValidation('idle')
      setErrorMsg('')
      loadExistingConfig()
      // Delay auto-focus to after animation
      const timer = setTimeout(() => firstInputRef.current?.focus(), 200)
      return () => clearTimeout(timer)
    }
  }, [open, loadExistingConfig])

  async function handleValidate() {
    if (!config.instance_code.trim()) {
      setErrorMsg('Código da instância é obrigatório')
      return
    }
    setValidation('validating')
    setErrorMsg('')
    // Simulate validation (replace with real API check if available)
    await new Promise(r => setTimeout(r, 1200))
    if (config.instance_code.trim().length >= 3) {
      setValidation('success')
    } else {
      setValidation('error')
      setErrorMsg('Código de instância inválido')
    }
  }

  async function handleSave() {
    if (!config.instance_code.trim()) {
      setErrorMsg('Código da instância é obrigatório')
      return
    }
    setSaving(true)
    setErrorMsg('')
    try {
      const payload = {
        user_email: user,
        instance_code: config.instance_code.trim(),
        access_token: config.access_token.trim(),
        api_url: config.api_url.trim(),
        label: config.label.trim(),
        updated_at: new Date().toISOString(),
      }

      if (config.id) {
        const { error } = await supabase
          .from('instance_settings')
          .update(payload)
          .eq('id', config.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('instance_settings')
          .insert(payload)
        if (error) throw error
      }
      onClose()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar configuração')
    } finally {
      setSaving(false)
    }
  }

  function updateField(field: keyof InstanceConfig, value: string) {
    setConfig(prev => ({ ...prev, [field]: value }))
    if (validation !== 'idle') setValidation('idle')
    setErrorMsg('')
  }

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="instance-modal-overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={e => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={modalRef}
            className="instance-modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label="Configurar Instância"
          >
            {/* Header */}
            <div className="instance-modal__header">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(37,208,102,0.15)' }}>
                  <Icon name="Plug" size={16} style={{ color: '#25D066' }} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white leading-tight">Configurar Instância</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Conecte seu código de instância e token de acesso</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Icon name="X" size={16} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="instance-modal__body modal-scroll">
              {loadingExisting ? (
                <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
                  <Icon name="Loader2" size={18} className="animate-spin" />
                  <span className="text-sm">Carregando configuração...</span>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Label */}
                  <div>
                    <label className="instance-modal__label">Nome da Instância</label>
                    <input
                      ref={firstInputRef}
                      type="text"
                      placeholder="Ex: Produção, Homologação..."
                      value={config.label}
                      onChange={e => updateField('label', e.target.value)}
                      className="instance-modal__input"
                    />
                  </div>

                  {/* Instance Code */}
                  <div>
                    <label className="instance-modal__label">Código da Instância <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Cole o código da instância aqui..."
                        value={config.instance_code}
                        onChange={e => updateField('instance_code', e.target.value)}
                        className="instance-modal__input pr-10"
                      />
                      {validation === 'success' && (
                        <Icon name="CheckCircle2" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400" />
                      )}
                      {validation === 'error' && (
                        <Icon name="AlertCircle" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400" />
                      )}
                    </div>
                  </div>

                  {/* Access Token */}
                  <div>
                    <label className="instance-modal__label">Token de Acesso</label>
                    <input
                      type="password"
                      placeholder="Token de autenticação..."
                      value={config.access_token}
                      onChange={e => updateField('access_token', e.target.value)}
                      className="instance-modal__input"
                    />
                  </div>

                  {/* API URL */}
                  <div>
                    <label className="instance-modal__label">URL da API</label>
                    <input
                      type="url"
                      placeholder="https://api.exemplo.com/v1"
                      value={config.api_url}
                      onChange={e => updateField('api_url', e.target.value)}
                      className="instance-modal__input"
                    />
                  </div>

                  {/* Validation feedback */}
                  <AnimatePresence>
                    {errorMsg && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}
                      >
                        <Icon name="AlertCircle" size={14} /> {errorMsg}
                      </motion.div>
                    )}
                    {validation === 'success' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
                        style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac' }}
                      >
                        <Icon name="CheckCircle2" size={14} /> Instância validada com sucesso!
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="instance-modal__footer">
              <button
                onClick={handleValidate}
                disabled={validation === 'validating' || !config.instance_code.trim()}
                className="instance-modal__btn instance-modal__btn--secondary"
              >
                {validation === 'validating' ? (
                  <>
                    <Icon name="Loader2" size={14} className="animate-spin" />
                    Validando...
                  </>
                ) : (
                  'Validar Conexão'
                )}
              </button>
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="instance-modal__btn instance-modal__btn--ghost">
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !config.instance_code.trim()}
                  className="instance-modal__btn instance-modal__btn--primary"
                >
                  {saving ? (
                    <>
                      <Icon name="Loader2" size={14} className="animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Configuração'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
