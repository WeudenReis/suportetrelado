
import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Archive, Pencil, Check, Clock, Calendar, AlignLeft, Paperclip, CheckSquare } from 'lucide-react';
import { animate, useReducedMotion } from 'framer-motion';
import { updateTicket, type Ticket } from '../lib/supabase';
import { parseTag } from './CardDetailModal';
import styles from './Card.module.css';

interface CardProps {
  card: Ticket;
  onClick: () => void;
  onUpdate: (updated: Ticket) => void;
  onArchive: (cardId: string) => void;
  isDragging?: boolean;
  style?: React.CSSProperties;
  onShowToast?: (msg: string, type: 'ok' | 'err') => void;
  compact?: boolean;
  isMutating?: boolean;
}

/** Calcula tempo decorrido e retorna {label, isOverdue} */
function getElapsedInfo(createdAt?: string): { label: string; isOverdue: boolean } | null {
  if (!createdAt) return null;
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const diffMs = now - created;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffD = Math.floor(diffMs / 86_400_000);

  let label: string;
  if (diffMin < 60) label = `${Math.max(diffMin, 1)}m`;
  else if (diffH < 24) label = `${diffH}h`;
  else label = `${diffD}d`;

  // Considerar "atrasado" se passou de 2 horas
  return { label, isOverdue: diffH >= 2 };
}

/** Formata data para exibição curta */
function formatDate(createdAt?: string): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  const day = d.getDate();
  const months = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  const month = months[d.getMonth()];
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${day} de ${month}, ${hours}:${mins}`;
}

/** Gera cor determinística para avatar a partir do nome */
function avatarColor(name: string): string {
  const colors = ['#579dff', '#4bce97', '#f5a623', '#ef5c48', '#a259ff', '#20c997', '#6366f1', '#ec4899'];
  return colors[name.charCodeAt(0) % colors.length];
}

/** Resolve assignee para exibição legível (email \u2192 nome) */
function getAssigneeDisplay(raw: string): { initial: string; tooltip: string } {
  const first = raw.split(',')[0].trim()
  const displayName = first.includes('@') ? first.split('@')[0] : first
  const capitalized = displayName.charAt(0).toUpperCase() + displayName.slice(1)
  const allNames = raw.split(',').map(s => {
    const t = s.trim()
    return t.includes('@') ? t.split('@')[0] : t
  }).filter(Boolean)
  return { initial: capitalized.charAt(0).toUpperCase(), tooltip: allNames.join(', ') }
}

function Card({ card, onClick, onUpdate, onArchive, isDragging, style, onShowToast, compact, isMutating: isMutatingProp }: CardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [isHovered, setIsHovered] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const justToggledRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  // Focar no input ao entrar em modo de edição
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // ── Toggle completo/incompleto ──────────────────────────
  const handleToggleComplete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    e.nativeEvent.stopImmediatePropagation();

    // Flag para impedir o clique do card de abrir o modal
    justToggledRef.current = true;
    setTimeout(() => { justToggledRef.current = false; }, 300);

    const newValue = !card.is_completed;

    // Efeito ao concluir (Framer Motion)
    if (cardRef.current && newValue && !prefersReducedMotion) {
      animate(cardRef.current, { scale: [1, 0.95, 1] }, { duration: 0.47, ease: 'easeOut' });
      animate(
        cardRef.current,
        { boxShadow: ['0 0 0 0px rgba(75,206,151,0)', '0 0 0 3px rgba(75,206,151,0.5)', '0 0 0 0px rgba(75,206,151,0)'] },
        { duration: 0.8, ease: 'easeOut' }
      );
    }

    // Atualizar estado local imediatamente (otimista)
    onUpdate({ ...card, is_completed: newValue });

    // Persistir no banco
    try {
      await updateTicket(card.id, { is_completed: newValue });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      onUpdate({ ...card, is_completed: card.is_completed });
    }
  }, [card, onUpdate]);

  // ── Abrir edição inline ─────────────────────────────────
  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(card.title);
    setIsEditing(true);
  }, [card.title]);

  // ── Salvar título editado ───────────────────────────────
  const handleSaveTitle = useCallback(async () => {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === card.title) {
      setIsEditing(false);
      setEditTitle(card.title);
      return;
    }

    setIsEditing(false);
    onUpdate({ ...card, title: trimmed });

    try {
      await updateTicket(card.id, { title: trimmed });
    } catch (error) {
      console.error('Erro ao salvar título:', error);
      onUpdate({ ...card, title: card.title }); // reverter
    }
  }, [editTitle, card, onUpdate]);

  // Enter salva, Escape cancela — stopPropagation impede dnd-kit de capturar teclas
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveTitle();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditTitle(card.title);
    }
  };

  // ── Arquivar ────────────────────────────────────────────
  const handleArchive = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Efeito de saída ao arquivar (Framer Motion)
    if (cardRef.current && !prefersReducedMotion) {
      await animate(cardRef.current, { opacity: 0.4, x: 60, scale: 0.96 }, { duration: 0.35, ease: 'easeInOut' });
    }

    onArchive(card.id);   // remover do estado local imediatamente
    onShowToast?.('Cartão arquivado com sucesso', 'ok');

    try {
      await updateTicket(card.id, { is_archived: true });
    } catch (error) {
      console.error('Erro ao arquivar:', error);
      onShowToast?.('Erro ao arquivar cartão', 'err');
    }
  }, [card.id, onArchive, onShowToast]);

  // ── Clique no card (abre modal apenas se não estiver editando/toggling) ──
  const handleCardClick = (_e: React.MouseEvent) => {
    if (isEditing) return;
    if (justToggledRef.current) return;
    onClick();
  };

  // SLA: only show overdue indicator for cards idle 24h+, not warning (too noisy)
  const slaClass = (() => {
    if (card.is_completed) return '';
    const updatedAt = card.updated_at;
    if (!updatedAt) return '';
    const hoursIdle = (Date.now() - new Date(updatedAt).getTime()) / 3_600_000; // eslint-disable-line react-hooks/purity -- IIFE calculada a cada render, sem cache
    if (hoursIdle >= 24) return styles.cardOverdue;
    return '';
  })();

  return (
    <div
      ref={cardRef}
      className={`${styles.card} ${card.is_completed ? styles.cardCompleted : ''} ${isDragging ? styles.cardDragging : ''} ${compact ? styles.cardCompact : ''} ${slaClass} ${isMutatingProp ? styles.cardMutating : ''}`}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(e as unknown as React.MouseEvent) } }}
      style={style}
      tabIndex={0}
      role="button"
      aria-label={`${card.title}${card.is_completed ? ' (concluído)' : ''}${card.priority ? ` — prioridade ${card.priority}` : ''}`}
    >
      {/* ── MODO COMPACTO ────────────────── */}
      {compact ? (
        <div className={styles.compactBody}>
          {/* Indicador de prioridade */}
          {card.priority && (
            <span className={styles.compactPrio} style={{
              background: card.priority === 'high' ? '#ef5c48' : card.priority === 'medium' ? '#e2b203' : '#4bce97',
            }} />
          )}
          {/* Check */}
          <button
            className={`${styles.checkBtn} ${card.is_completed ? styles.checkBtnDone : ''} ${isHovered || card.is_completed ? styles.checkBtnVisible : ''}`}
            onClick={handleToggleComplete}
            onPointerDown={e => e.stopPropagation()}
            title={card.is_completed ? 'Marcar como incompleto' : 'Marcar como concluído'}
            type="button"
          >
            {card.is_completed && <Check size={11} strokeWidth={3} />}
          </button>
          {/* Título */}
          <p className={`${styles.compactTitle} ${card.is_completed ? styles.titleDone : ''}`}>{card.title}</p>
          {/* Avatar */}
          {card.assignee && (() => {
            const { initial, tooltip } = getAssigneeDisplay(card.assignee)
            return (
            <span className={styles.compactAvatar} style={{ background: avatarColor(card.assignee) }} title={tooltip}>
              {initial}
            </span>
            )
          })()}
          {/* Ações */}
          {!isEditing && (
            <div className={`${styles.actions} ${isHovered ? styles.actionsVisible : ''}`}>
              <button className={styles.actionBtn} onClick={handleArchive} onPointerDown={e => e.stopPropagation()} title="Arquivar" type="button"><Archive size={12} /></button>
            </div>
          )}
        </div>
      ) : (
      <>
      {/* ── CAPA ─────────────────────────── */}
      {(card.cover_thumb_url || card.cover_image_url) && !coverError && (
        <div className={styles.cover}>
          <img
            src={card.cover_thumb_url || card.cover_image_url || undefined}
            alt=""
            className={styles.coverImg}
            loading="lazy"
            decoding="async"
            onError={() => setCoverError(true)}
          />
        </div>
      )}

      {/* ── CORPO ────────────────────────── */}
      <div className={styles.body}>

        {/* Tag de prioridade */}
        {card.priority && !isEditing && (
          <span className={
            `${styles.tag} ` +
            (card.priority === 'high'
              ? styles.high
              : card.priority === 'medium'
              ? styles.medium
              : styles.low)
          }>
            {card.priority === 'high'
              ? 'ALTA'
              : card.priority === 'medium'
              ? 'MÉDIA'
              : 'BAIXA'}
          </span>
        )}

        {/* Etiquetas/tags */}
        {card.tags && card.tags.length > 0 && !isEditing && (
          <div className={styles.tagsRow}>
            {card.tags.map((raw: string) => {
              const { name, color } = parseTag(raw);
              return (
                <span key={raw} className={styles.cardTag} style={{ background: color }}>
                  {name}
                </span>
              );
            })}
          </div>
        )}

        {/* ── LINHA DO TÍTULO + AÇÕES ─────── */}
        <div className={styles.titleRow}>

          {/* Botão de check (esquerda) — só no hover ou se concluído */}
          <button
            className={`${styles.checkBtn} ${card.is_completed ? styles.checkBtnDone : ''} ${isHovered || card.is_completed ? styles.checkBtnVisible : ''}`}
            onClick={handleToggleComplete}
            onPointerDown={e => e.stopPropagation()}
            title={card.is_completed ? 'Marcar como incompleto' : 'Marcar como concluído'}
            type="button"
          >
            {card.is_completed && <Check size={11} strokeWidth={3} />}
          </button>

          {/* Título ou input de edição */}
          {isEditing ? (
            <textarea
              ref={inputRef}
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveTitle}
              onPointerDown={e => e.stopPropagation()}
              className={styles.titleInput}
              rows={2}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <p className={`${styles.title} ${card.is_completed ? styles.titleDone : ''}`}>
              {card.title}
            </p>
          )}

          {/* Botões de ação (direita) — só no hover */}
          {!isEditing && (
            <div className={`${styles.actions} ${isHovered ? styles.actionsVisible : ''}`}>
              <button
                className={styles.actionBtn}
                onClick={handleArchive}
                onPointerDown={e => e.stopPropagation()}
                title="Arquivar cartão"
                type="button"
              >
                <Archive size={13} />
              </button>
              <button
                className={styles.actionBtn}
                onClick={handleEditClick}
                onPointerDown={e => e.stopPropagation()}
                title="Editar título"
                type="button"
              >
                <Pencil size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Badges de conteúdo (descrição, anexos, checklist) */}
        {!isEditing && (() => {
          const hasDesc = !!(card.description && card.description.trim());
          const attCount = card.attachment_count || 0;
          const obs = card.observacao || '';
          const checkTotal = (obs.match(/^[☐☑]/gm) || []).length;
          const checkDone = (obs.match(/^☑/gm) || []).length;
          const hasChecklist = checkTotal > 0;

          if (!hasDesc && !attCount && !hasChecklist) return null;

          return (
            <div className={styles.badgesRow}>
              {hasDesc && (
                <span className={styles.badge} title="Tem descrição">
                  <AlignLeft size={12} />
                </span>
              )}
              {attCount > 0 && (
                <span className={styles.badge} title={`${attCount} anexo(s)`}>
                  <Paperclip size={12} />
                  {attCount}
                </span>
              )}
              {hasChecklist && (
                <span className={`${styles.badge} ${checkDone === checkTotal ? styles.badgeDone : ''}`} title={`Checklist: ${checkDone}/${checkTotal}`}>
                  <CheckSquare size={12} />
                  {checkDone}/{checkTotal}
                </span>
              )}
            </div>
          );
        })()}

        {/* Footer */}
        {!isEditing && (
          <div className={styles.footer}>
            {/* Tempo decorrido */}
            {(() => {
              const elapsed = getElapsedInfo(card.created_at);
              if (!elapsed) return null;
              return (
                <span className={`${styles.footerBadge} ${elapsed.isOverdue ? styles.footerOverdue : ''}`}>
                  <Clock size={12} />
                  {elapsed.label}
                </span>
              );
            })()}

            {/* Data de criação */}
            {card.created_at && (
              <span className={styles.footerBadge}>
                <Calendar size={12} />
                {formatDate(card.created_at)}
              </span>
            )}

            {/* Spacer para empurrar avatar para a direita */}
            <span style={{ flex: 1 }} />

            {/* Avatar do responsável */}
            {card.assignee && (() => {
              const { initial, tooltip } = getAssigneeDisplay(card.assignee)
              return (
              <span
                className={styles.avatar}
                style={{ background: avatarColor(card.assignee) }}
                title={tooltip}
              >
                {initial}
              </span>
              )
            })()}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}

export default memo(Card);
