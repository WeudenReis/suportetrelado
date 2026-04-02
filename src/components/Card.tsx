
import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Archive, Pencil, Check, Clock, Calendar, AlignLeft, Paperclip, CheckSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { parseTag } from './CardDetailModal';
import gsap from 'gsap';
import styles from './Card.module.css';
import type { Card as CardType } from '@/types';

interface CardProps {
  card: CardType;
  onClick: () => void;
  onUpdate: (updated: CardType) => void;
  onArchive: (cardId: string) => void;
  isDragging?: boolean;
  style?: React.CSSProperties;
  onShowToast?: (msg: string, type: 'ok' | 'err') => void;
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

function Card({ card, onClick, onUpdate, onArchive, isDragging, style, onShowToast }: CardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const justToggledRef = useRef(false);

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

    // Efeito GSAP ao concluir
    if (cardRef.current && newValue) {
      const tl = gsap.timeline();
      tl.to(cardRef.current, {
        scale: 0.95,
        duration: 0.12,
        ease: 'power2.in',
      })
      .to(cardRef.current, {
        scale: 1,
        duration: 0.35,
        ease: 'elastic.out(1.2, 0.5)',
      })
      .to(cardRef.current, {
        boxShadow: '0 0 0 3px rgba(75, 206, 151, 0.5)',
        duration: 0.15,
        ease: 'power1.out',
      }, 0)
      .to(cardRef.current, {
        boxShadow: '0 0 0 0px rgba(75, 206, 151, 0)',
        duration: 0.5,
        ease: 'power2.out',
      }, 0.3);
    }

    // Atualizar estado local imediatamente (otimista)
    onUpdate({ ...card, is_completed: newValue });

    // Persistir no banco
    const { error } = await supabase
      .from('tickets')
      .update({
        is_completed: newValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', card.id);

    if (error) {
      console.error('Erro ao atualizar status:', error);
      // Reverter se falhar
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

    const { error } = await supabase
      .from('tickets')
      .update({ title: trimmed, updated_at: new Date().toISOString() })
      .eq('id', card.id);

    if (error) {
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

    // Efeito GSAP de saída ao arquivar
    if (cardRef.current) {
      await gsap.to(cardRef.current, {
        opacity: 0.4,
        x: 60,
        scale: 0.96,
        duration: 0.35,
        ease: 'power2.inOut',
      });
    }

    onArchive(card.id);   // remover do estado local imediatamente
    onShowToast?.('Cartão arquivado com sucesso', 'ok');

    const { error } = await supabase
      .from('tickets')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', card.id);

    if (error) {
      console.error('Erro ao arquivar:', error);
      onShowToast?.('Erro ao arquivar cartão', 'err');
    }
  }, [card.id, onArchive, onShowToast]);

  // ── Clique no card (abre modal apenas se não estiver editando/toggling) ──
  const handleCardClick = (e: React.MouseEvent) => {
    if (isEditing) return;
    if (justToggledRef.current) return;
    onClick();
  };

  return (
    <div
      ref={cardRef}
      className={`${styles.card} ${card.is_completed ? styles.cardCompleted : ''} ${isDragging ? styles.cardDragging : ''}`}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={style}
    >
      {/* ── CAPA ─────────────────────────── */}
      {(card.cover_thumb_url || card.cover_image_url) && (
        <div className={styles.cover}>
          <img src={card.cover_thumb_url || card.cover_image_url} alt="" className={styles.coverImg} loading="lazy" decoding="async" />
        </div>
      )}

      {/* ── CORPO ────────────────────────── */}
      <div className={styles.body}>

        {/* Tag de prioridade */}
        {card.priority && !isEditing && (
          <span className={
            `${styles.tag} ` +
            (card.priority === 'high' || card.priority === 'alta' || card.priority === 'Alta'
              ? styles.high
              : card.priority === 'medium' || card.priority === 'media' || card.priority === 'média' || card.priority === 'Média' || card.priority === 'Media'
              ? styles.medium
              : styles.low)
          }>
            {card.priority === 'high' || card.priority === 'alta' || card.priority === 'Alta'
              ? 'ALTA'
              : card.priority === 'medium' || card.priority === 'media' || card.priority === 'média' || card.priority === 'Média' || card.priority === 'Media'
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
          const attCount = (card as any).attachment_count || 0;
          const obs = (card as any).observacao || '';
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
            {card.assignee && (
              <span
                className={styles.avatar}
                style={{ background: avatarColor(card.assignee) }}
                title={card.assignee}
              >
                {card.assignee.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(Card);
