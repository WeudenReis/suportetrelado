import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Icon } from '../lib/icons'
import clsx from 'clsx';
import styles from './ArchivedPanel.module.css';
import { useOrg } from '../lib/orgContext';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ArchivedCard {
  id: string
  title: string
  priority: string
  created_at: string
  updated_at: string
}

interface ArchivedList {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface ArchivedPanelProps {
  onClose: () => void;
  onRestore: () => void;
}

const PRIORITY_LABEL: Record<string, string> = {
  high: 'Alta', medium: 'Média', low: 'Baixa',
  alta: 'Alta', média: 'Média', media: 'Média', baixa: 'Baixa',
}
const PRIORITY_COLOR: Record<string, { bg: string; text: string }> = {
  high:   { bg: '#ef5c48', text: '#fff' },
  medium: { bg: '#e2b203', text: '#000' },
  low:    { bg: '#4bce97', text: '#000' },
  alta:   { bg: '#ef5c48', text: '#fff' },
  média:  { bg: '#e2b203', text: '#000' },
  media:  { bg: '#e2b203', text: '#000' },
  baixa:  { bg: '#4bce97', text: '#000' },
}

export function ArchivedPanel({ onClose, onRestore }: ArchivedPanelProps) {
  const { departmentId, hasPermission, role } = useOrg();
  const isAdmin = role === 'admin';
  const [archivedCards, setArchivedCards] = useState<ArchivedCard[]>([]);
  const [archivedLists, setArchivedLists] = useState<ArchivedList[]>([]);
  const [tab, setTab] = useState<'cards' | 'lists'>('cards');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

  const fetchArchived = useCallback(async () => {
    setLoading(true);
    let cardsQuery = supabase.from('tickets').select('id, title, priority, created_at, updated_at')
      .eq('is_archived', true).order('updated_at', { ascending: false });
    let listsQuery = supabase.from('board_columns').select('id, title, created_at, updated_at')
      .eq('is_archived', true).order('updated_at', { ascending: false });
    if (departmentId) {
      cardsQuery = cardsQuery.eq('department_id', departmentId);
      listsQuery = listsQuery.eq('department_id', departmentId);
    }
    const [{ data: cards }, { data: lists }] = await Promise.all([cardsQuery, listsQuery]);
    setArchivedCards(cards ?? []);
    setArchivedLists(lists ?? []);
    setLoading(false);
  }, [departmentId]);

  useEffect(() => { fetchArchived(); }, [fetchArchived]); // eslint-disable-line react-hooks/set-state-in-effect -- carregamento inicial + reatividade a dept

  const restoreCard = async (cardId: string) => {
    await supabase.from('tickets')
      .update({ is_archived: false, updated_at: new Date().toISOString() })
      .eq('id', cardId);
    await fetchArchived();
    onRestore();
  };

  const deleteCard = async (cardId: string) => {
    if (!hasPermission('tickets:delete')) {
      alert('Apenas administradores podem excluir cartões');
      return;
    }
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
    if (!isAdmin) {
      alert('Apenas administradores podem excluir listas');
      return;
    }
    if (!confirm('Excluir lista permanentemente? Os tickets dentro dela serão perdidos.')) return;
    await supabase.from('tickets').delete().eq('column_id', listId);
    await supabase.from('board_columns').delete().eq('id', listId);
    await fetchArchived();
  };

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      .format(new Date(iso));

  const q = search.toLowerCase().trim();
  const filteredCards = useMemo(() =>
    q ? archivedCards.filter(c => (c.title || '').toLowerCase().includes(q)) : archivedCards,
    [archivedCards, q]
  );
  const filteredLists = useMemo(() =>
    q ? archivedLists.filter(l => (l.title || '').toLowerCase().includes(q)) : archivedLists,
    [archivedLists, q]
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Itens arquivados" className={styles.panel} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Itens arquivados</h2>
          <button className={styles.closeBtn} onClick={onClose} type="button">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Search bar */}
        <div className={styles.searchWrapper}>
          <Icon name="Search" size={13} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Buscar arquivados..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.searchClear} onClick={() => setSearch('')} type="button">
              <Icon name="X" size={11} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={clsx(styles.tab, tab === 'cards' && styles.tabActive)}
            onClick={() => setTab('cards')} type="button"
          >
            Cartões ({filteredCards.length})
          </button>
          <button
            className={clsx(styles.tab, tab === 'lists' && styles.tabActive)}
            onClick={() => setTab('lists')} type="button"
          >
            Listas ({filteredLists.length})
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {loading && <p className={styles.empty}>Carregando...</p>}

          {!loading && tab === 'cards' && (
            filteredCards.length === 0
              ? <p className={styles.empty}>{search ? 'Nenhum resultado para a busca' : 'Nenhum cartão arquivado'}</p>
              : filteredCards.map(card => {
                  const pKey = (card.priority || '').toLowerCase()
                  const pColor = PRIORITY_COLOR[pKey]
                  const pLabel = PRIORITY_LABEL[pKey]
                  return (
                    <div key={card.id} className={styles.item}>
                      <div className={styles.itemInfo}>
                        {pLabel && pColor && (
                          <span
                            className={styles.itemTag}
                            style={{ background: pColor.bg, color: pColor.text }}
                          >
                            {pLabel}
                          </span>
                        )}
                        <p className={styles.itemTitle}>{card.title}</p>
                        <p className={styles.itemDate}>Arquivado em {formatDate(card.updated_at)}</p>
                      </div>
                      <div className={styles.itemActions}>
                        <button
                          className={styles.restoreBtn}
                          onClick={() => restoreCard(card.id)}
                          title="Restaurar cartão" type="button"
                        >
                          <Icon name="ArchiveRestore" size={14} />
                          Restaurar
                        </button>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => deleteCard(card.id)}
                          title="Excluir permanentemente" type="button"
                          disabled={!hasPermission('tickets:delete')}
                        >
                          <Icon name="Trash2" size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })
          )}

          {!loading && tab === 'lists' && (
            filteredLists.length === 0
              ? <p className={styles.empty}>{search ? 'Nenhum resultado para a busca' : 'Nenhuma lista arquivada'}</p>
              : filteredLists.map(list => (
                <div key={list.id} className={styles.item}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemTag} style={{ background: '#579dff22', color: '#579dff' }}>
                      Lista
                    </span>
                    <p className={styles.itemTitle}>{list.title}</p>
                    <p className={styles.itemDate}>Arquivada em {formatDate(list.updated_at)}</p>
                  </div>
                  <div className={styles.itemActions}>
                    <button
                      className={styles.restoreBtn}
                      onClick={() => restoreList(list.id)}
                      title="Restaurar lista" type="button"
                    >
                      <Icon name="ArchiveRestore" size={14} />
                      Restaurar
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => deleteList(list.id)}
                      title="Excluir permanentemente" type="button"
                      disabled={!isAdmin}
                    >
                      <Icon name="Trash2" size={14} />
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
