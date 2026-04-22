import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, fetchNotifications, deleteNotification, deleteAllNotifications, deleteNotificationsByTicket, fetchTickets, fetchPlannerSettings, fetchPlannerEvents, insertNotification } from '../lib/supabase';
import type { Notification, Ticket } from '../lib/supabase';
import { useOrg } from '../lib/org';
import { logger } from '../lib/logger';

interface NotificationContextProps {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  refreshNotifications: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  toastNotification: Notification | null;
  dismissToast: () => void;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export const useNotificationContext = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotificationContext must be used within NotificationProvider');
  return ctx;
};

export const NotificationProvider: React.FC<{ user: string; children: React.ReactNode }> = ({ user, children }) => {
  const { departmentId } = useOrg();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastNotification, setToastNotification] = useState<Notification | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSyncDoneRef = React.useRef(false);
  const browserDeliveredIdsRef = React.useRef<Set<string>>(new Set());

  // Solicitar permissão de notificação push nativa
  useEffect(() => {
    if ('Notification' in window && window.Notification.permission === 'default') {
      window.Notification.requestPermission().catch(() => {/* ignorar */});
    }
  }, []);

  const showBrowserNotification = useCallback((notif: Notification) => {
    if (browserDeliveredIdsRef.current.has(notif.id)) return;

    // Exibe push apenas quando o app nao esta em primeiro plano.
    const appVisible = document.visibilityState === 'visible' && document.hasFocus();
    const createdAt = new Date(notif.created_at).getTime();
    const ageMs = Number.isFinite(createdAt) ? Date.now() - createdAt : 0;

    // Para avisos, se o evento chegou atrasado (aba em background), ainda notifica.
    const shouldSuppress = appVisible && (notif.type !== 'announcement' || ageMs < 5000);
    if (shouldSuppress || !('Notification' in window)) return;

    const isAnnouncement = notif.type === 'announcement';
    const title = isAnnouncement ? 'chatPro — Novo Aviso' : 'chatPro — Suporte';
    const body = notif.message || notif.ticket_title || 'Você recebeu uma nova notificação.';

    const notify = () => {
      try {
        const n = new window.Notification(title, {
          body,
          icon: '/icon-192.png',
          tag: notif.id,
          requireInteraction: isAnnouncement,
        });
        browserDeliveredIdsRef.current.add(notif.id);
        n.onclick = () => {
          window.focus();
          window.dispatchEvent(new CustomEvent('chatpro-open-tab', {
            detail: { tab: isAnnouncement ? 'announcements' : 'inbox' },
          }));
          n.close();
        };
      } catch (error) {
        logger.warn('Notifications', 'Falha ao disparar notificação do navegador', { error: String(error) });
      }
    };

    if (window.Notification.permission === 'granted') {
      notify();
      return;
    }

    if (window.Notification.permission === 'default') {
      window.Notification.requestPermission()
        .then(permission => { if (permission === 'granted') notify(); })
        .catch(() => {/* ignorar */});
    }
  }, []);

  const dismissToast = useCallback(() => {
    setToastNotification(null);
    if (toastTimer.current) { clearTimeout(toastTimer.current); toastTimer.current = null; }
  }, []);

  const showToast = useCallback((notif: Notification) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastNotification(notif);
    toastTimer.current = setTimeout(() => setToastNotification(null), 6000);
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const data = await fetchNotifications(user);
      setNotifications(prev => {
        const prevIds = new Set(prev.map(n => n.id));
        const fresh = data.filter(n => !prevIds.has(n.id));

        if (initialSyncDoneRef.current) {
          // Realtime pode falhar em background; polling garante push/browser para novos itens.
          for (const n of fresh) showBrowserNotification(n);
          if (fresh.length > 0 && document.visibilityState === 'visible') {
            showToast(fresh[0]);
          }
        } else {
          initialSyncDoneRef.current = true;
        }

        return data;
      });
    } catch (err) {
      logger.warn('Notifications', 'Falha ao carregar notificações', { error: String(err) });
    } finally {
      setLoading(false);
    }
  }, [showBrowserNotification, showToast, user]);

  // Marcar como lida ao mesmo tempo remove da caixa de entrada — comportamento
  // alinhado com a expectativa do usuario: ao reconhecer a notificacao, ela some.
  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await deleteNotification(id);
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications([]);
    await deleteAllNotifications(user);
  }, [user]);

  // Polling for due date alerts and planner events
  useEffect(() => {
    const checkDueDates = async () => {
      try {
        const settings = await fetchPlannerSettings(user);
        const notifyDays = settings?.notify_days_before ?? [];

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const cacheKey = `chatpro_notified_due_dates:${user}`;
        const notifiedCache = JSON.parse(localStorage.getItem(cacheKey) || '{}');
        const newCache = { ...notifiedCache };
        let modified = false;

        // ── Tickets com due_date ──
        if (notifyDays.length > 0) {
          const tickets = await fetchTickets();
          for (const t of tickets) {
            if (!t.due_date || t.status === 'resolved') continue;
            const due = new Date(t.due_date);
            const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
            const diffDays = Math.ceil((dueDay.getTime() - today.getTime()) / 86400000);

            if (notifyDays.includes(diffDays)) {
              const notifId = `${t.id}_due_${diffDays}`;
              if (!newCache[notifId]) {
                const ok = await insertNotification({
                  department_id: t.department_id,
                  recipient_email: user,
                  sender_name: 'Sistema',
                  type: 'due_date_alert',
                  ticket_id: t.id,
                  ticket_title: t.title,
                  message: diffDays === 0
                    ? 'Este cartão vence hoje!'
                    : `Este cartão vence em ${diffDays} dia(s) (${t.due_date.slice(0, 10)}).`,
                });
                if (ok) { newCache[notifId] = true; modified = true; }
              }
            }
          }
        }

        // ── Eventos do Planejador ──
        const plannerEvents = await fetchPlannerEvents(user);
        for (const ev of plannerEvents) {
          // Notificar eventos futuros com base em notify_days_before
          const evDay = new Date(ev.date + 'T12:00:00');
          const evDayOnly = new Date(evDay.getFullYear(), evDay.getMonth(), evDay.getDate());
          const diffDays = Math.ceil((evDayOnly.getTime() - today.getTime()) / 86400000);

          if (notifyDays.includes(diffDays) && diffDays > 0) {
            const notifId = `planner_${ev.id}_days_${diffDays}`;
            if (!newCache[notifId]) {
              const ok = await insertNotification({
                department_id: departmentId || '00000000-0000-0000-0000-000000000010',
                recipient_email: user,
                sender_name: 'Sistema',
                type: 'planner_event',
                ticket_id: null,
                ticket_title: ev.title,
                message: `Lembrete: "${ev.title}" acontece em ${diffDays} dia(s) (${ev.date}).`,
              });
              if (ok) { newCache[notifId] = true; modified = true; }
            }
          }

          // Notificar eventos do dia atual baseados no horário
          if (ev.date === todayStr) {
            if (ev.start_time) {
              // Janela: de 15 min antes até 60 min após o início
              const [h, m] = ev.start_time.split(':').map(Number);
              const eventMinutes = h * 60 + m;
              const nowMinutes = now.getHours() * 60 + now.getMinutes();
              const diff = nowMinutes - eventMinutes; // positivo = já passou do horário
              const inWindow = diff >= -15 && diff <= 60;

              const notifId = `planner_${ev.id}_today_time`;
              if (inWindow && !newCache[notifId]) {
                const timeLabel = diff < 0
                  ? `em ${-diff} min`
                  : diff === 0
                  ? 'agora'
                  : `há ${diff} min`;
                const ok = await insertNotification({
                  department_id: departmentId || '00000000-0000-0000-0000-000000000010',
                  recipient_email: user,
                  sender_name: 'Sistema',
                  type: 'planner_event',
                  ticket_id: null,
                  ticket_title: ev.title,
                  message: `Evento "${ev.title}" começa ${timeLabel} (${ev.start_time}).`,
                });
                if (ok) { newCache[notifId] = true; modified = true; }
              }
            } else {
              // Evento sem horário: notificar uma vez no dia
              const notifId = `planner_${ev.id}_today_allday`;
              if (!newCache[notifId]) {
                const ok = await insertNotification({
                  department_id: departmentId || '00000000-0000-0000-0000-000000000010',
                  recipient_email: user,
                  sender_name: 'Sistema',
                  type: 'planner_event',
                  ticket_id: null,
                  ticket_title: ev.title,
                  message: `Evento de hoje: "${ev.title}".`,
                });
                if (ok) { newCache[notifId] = true; modified = true; }
              }
            }
          }
        }

        if (modified) {
          localStorage.setItem(cacheKey, JSON.stringify(newCache));
        }
      } catch (e) {
        logger.error('Notifications', 'Falha ao verificar datas e eventos', { error: String(e) });
      }
    };

    checkDueDates();
    const interval = setInterval(checkDueDates, 5 * 60 * 1000); // Verifica a cada 5 min
    return () => clearInterval(interval);
  }, [user, departmentId]);

  useEffect(() => {
    refreshNotifications();
    // Use server-side filter so Supabase only sends events for this user's notifications.
    // This is required when RLS is active — without the filter, realtime events for
    // other recipients are blocked by RLS before reaching the client.
    const channel = supabase
      .channel(`notifications-realtime-${user}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_email=eq.${user}` },
        payload => {
          const notif = payload.new as Notification;
          setNotifications(prev => prev.some(n => n.id === notif.id) ? prev : [notif, ...prev]);
          showToast(notif);
          showBrowserNotification(notif);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `recipient_email=eq.${user}` },
        payload => {
          setNotifications(prev => prev.map(n => n.id === (payload.new as Notification).id ? payload.new as Notification : n));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications' },
        payload => {
          const removed = payload.old as { id?: string };
          if (!removed?.id) return;
          setNotifications(prev => prev.filter(n => n.id !== removed.id));
        }
      )
      .subscribe((status) => {
        // If the channel fails to subscribe, fall back to a fresh fetch so the
        // inbox is at least populated after the page loads.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Notifications', 'Canal realtime com problema, sincronizando via fetch', { status });
          refreshNotifications();
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [refreshNotifications, user, showBrowserNotification, showToast]);

  // Fallback de sincronização para casos em que o realtime atrasa/falha em background.
  useEffect(() => {
    const interval = setInterval(() => {
      refreshNotifications();
    }, 20_000);
    return () => clearInterval(interval);
  }, [refreshNotifications]);

  // Quando o ticket vinculado a uma notificacao for concluido, arquivado ou
  // excluido, removemos as notificacoes correspondentes deste usuario.
  useEffect(() => {
    const channel = supabase
      .channel('notifications-ticket-cleanup')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets' }, payload => {
        const next = payload.new as Ticket;
        const prev = payload.old as Partial<Ticket>;
        const becameResolved = prev.status !== 'resolved' && next.status === 'resolved';
        const becameArchived = !prev.is_archived && next.is_archived;
        if (!becameResolved && !becameArchived) return;
        // Otimismo local + persistencia
        setNotifications(curr => curr.filter(n => n.ticket_id !== next.id));
        deleteNotificationsByTicket(next.id, user).catch(err =>
          logger.warn('Notifications', 'cleanup ticket update falhou', { error: String(err) })
        );
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tickets' }, payload => {
        const removed = payload.old as { id?: string };
        if (!removed?.id) return;
        setNotifications(curr => curr.filter(n => n.ticket_id !== removed.id));
        deleteNotificationsByTicket(removed.id, user).catch(err =>
          logger.warn('Notifications', 'cleanup ticket delete falhou', { error: String(err) })
        );
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, loading, refreshNotifications, markRead, markAllRead, toastNotification, dismissToast }}>
      {children}
    </NotificationContext.Provider>
  );
};
