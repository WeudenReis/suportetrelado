
import { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import { Archive, Pencil, Check, Clock, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { parseTag } from './CardDetailModal';
import styles from './Card.module.css';
import type { Card as CardType } from '@/types';

interface CardProps {
  card: CardType;
  onClick: () => void;
  onUpdate: (updated: CardType) => void;
  onArchive: (cardId: string) => void;
  isDragging?: boolean;
  style?: React.CSSProperties;
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

function Card({ card, onClick, onUpdate, onArchive, isDragging, style }: CardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focar no input ao entrar em modo de edição
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // ── Toggle completo/incompleto ──────────────────────────
  const handleToggleComplete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();   // não abre o modal

    const newValue = !card.is_completed;

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

  // Enter salva, Escape cancela
  const handleKeyDown = (e: React.KeyboardEvent) => {
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

    onArchive(card.id);   // remover do estado local imediatamente

    const { error } = await supabase
      .from('tickets')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', card.id);

    if (error) {
      console.error('Erro ao arquivar:', error);
      // Se falhar, o card deveria voltar — depende de como onArchive é implementado
    }
  }, [card.id, onArchive]);

  // ── Clique no card (abre modal apenas se não estiver editando) ──
  const handleCardClick = (e: React.MouseEvent) => {
    if (isEditing) return;
    onClick();
  };

  return (
    <div
      className={`${styles.card} ${card.is_completed ? styles.cardCompleted : ''} ${isDragging ? styles.cardDragging : ''}`}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={style}
    >
      {/* ── CAPA ─────────────────────────── */}
      {card.cover_image_url && (
        <div className={styles.cover}>
          <img src={card.cover_image_url} alt="" className={styles.coverImg} loading="lazy" />
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

          {/* Título ou input de edição */}
          {isEditing ? (
            <textarea
              ref={inputRef}
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveTitle}
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
                className={`${styles.actionBtn} ${styles.checkActionBtn} ${card.is_completed ? styles.checkActionBtnDone : ''}`}
                onClick={handleToggleComplete}
                onPointerDown={e => e.stopPropagation()}
                title={card.is_completed ? 'Marcar como incompleto' : 'Marcar como concluído'}
                type="button"
              >
                <Check size={13} strokeWidth={card.is_completed ? 3 : 2} />
              </button>
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

        {/* Descrição resumida */}
        {card.description && !isEditing && (
          <p className={styles.description}>
            {card.description.slice(0, 80)}{card.description.length > 80 ? '…' : ''}
          </p>
        )}

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

export default Card;
