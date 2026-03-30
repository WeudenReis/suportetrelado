
import { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import { Archive, Pencil, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
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

        {/* ── LINHA DO TÍTULO + AÇÕES ─────── */}
        <div className={styles.titleRow}>

          {/* Botão de check (esquerda) — só no hover ou se concluído */}
          <button
            className={`${styles.checkBtn} ${card.is_completed ? styles.checkBtnDone : ''} ${isHovered || card.is_completed ? styles.checkBtnVisible : ''}`}
            onClick={handleToggleComplete}
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
                title="Arquivar cartão"
                type="button"
              >
                <Archive size={13} />
              </button>
              <button
                className={styles.actionBtn}
                onClick={handleEditClick}
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
            {/* badges de data, anexos, etc */}
          </div>
        )}
      </div>
    </div>
  );
}

export default Card;
