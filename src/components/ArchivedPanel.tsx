import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArchiveRestore, Trash2, X } from 'lucide-react';
import styles from './ArchivedPanel.module.css';

interface ArchivedPanelProps {
  onClose: () => void;
  onRestore: () => void;
}

export function ArchivedPanel({ onClose, onRestore }: ArchivedPanelProps) {
  const [archivedCards, setArchivedCards] = useState<any[]>([]);
  const [archivedLists, setArchivedLists] = useState<any[]>([]);
  const [tab, setTab] = useState<'cards' | 'lists'>('cards');
  const [loading, setLoading] = useState(true);

  const fetchArchived = async () => {
    setLoading(true);
    const [{ data: cards }, { data: lists }] = await Promise.all([
      supabase.from('tickets').select('id, title, priority, created_at, updated_at')
        .eq('is_archived', true).order('updated_at', { ascending: false }),
      supabase.from('board_columns').select('id, title, created_at, updated_at')
        .eq('is_archived', true).order('updated_at', { ascending: false }),
    ]);
    setArchivedCards(cards ?? []);
    setArchivedLists(lists ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchArchived(); }, []);

  const restoreCard = async (cardId: string) => {
    await supabase.from('tickets')
      .update({ is_archived: false, updated_at: new Date().toISOString() })
      .eq('id', cardId);
    await fetchArchived();
    onRestore();
  };

  const deleteCard = async (cardId: string) => {
    if (!confirm('Excluir permanentemente? Não poderá ser recuperado.')) return;
    await supabase.from('tickets').delete().eq('id', cardId);
    await fetchArchived();
  };

  const restoreList = async (listId: string) => {
    await supabase.from('board_columns')
      .update({ is_archived: false, updated_at: new Date().toISOString() })
      .eq('id', listId);
    await fetchArchived();
    onRestore();
  };

  const deleteList = async (listId: string) => {
    if (!confirm('Excluir lista permanentemente? Os tickets dentro dela serão perdidos.')) return;
    await supabase.from('tickets').delete().eq('column_id', listId);
    await supabase.from('board_columns').delete().eq('id', listId);
    await fetchArchived();
  };

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      .format(new Date(iso));

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Itens arquivados</h2>
          <button className={styles.closeBtn} onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'cards' ? styles.tabActive : ''}`}
            onClick={() => setTab('cards')}
            type="button"
          >
            Cartões ({archivedCards.length})
          </button>
          <button
            className={`${styles.tab} ${tab === 'lists' ? styles.tabActive : ''}`}
            onClick={() => setTab('lists')}
            type="button"
          >
            Listas ({archivedLists.length})
          </button>
        </div>
        <div className={styles.content}>
          {loading && <p className={styles.empty}>Carregando...</p>}
          {!loading && tab === 'cards' && (
            archivedCards.length === 0
              ? <p className={styles.empty}>Nenhum cartão arquivado</p>
              : archivedCards.map(card => (
                <div key={card.id} className={styles.item}>
                  <div className={styles.itemInfo}>
                    {card.priority && (
                      <span className={`${styles.itemTag} ${styles[card.priority.toLowerCase()]}`}>
                        {card.priority}
                      </span>
                    )}
                    <p className={styles.itemTitle}>{card.title}</p>
                    <p className={styles.itemDate}>Arquivado em {formatDate(card.updated_at)}</p>
                  </div>
                  <div className={styles.itemActions}>
                    <button
                      className={styles.restoreBtn}
                      onClick={() => restoreCard(card.id)}
                      title="Restaurar cartão"
                      type="button"
                    >
                      <ArchiveRestore size={14} />
                      Restaurar
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => deleteCard(card.id)}
                      title="Excluir permanentemente"
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
          )}
          {!loading && tab === 'lists' && (
            archivedLists.length === 0
              ? <p className={styles.empty}>Nenhuma lista arquivada</p>
              : archivedLists.map(list => (
                <div key={list.id} className={styles.item}>
                  <div className={styles.itemInfo}>
                    <p className={styles.itemTitle}>{list.title}</p>
                    <p className={styles.itemDate}>Arquivada em {formatDate(list.updated_at)}</p>
                  </div>
                  <div className={styles.itemActions}>
                    <button
                      className={styles.restoreBtn}
                      onClick={() => restoreList(list.id)}
                      title="Restaurar lista"
                      type="button"
                    >
                      <ArchiveRestore size={14} />
                      Restaurar
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => deleteList(list.id)}
                      title="Excluir permanentemente"
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
