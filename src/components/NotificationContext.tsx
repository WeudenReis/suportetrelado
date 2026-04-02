import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, fetchNotifications, markNotificationRead, markAllNotificationsRead, fetchTickets, fetchPlannerSettings, insertNotification } from '../lib/supabase';
import type { Notification } from '../lib/supabase';

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastNotification, setToastNotification] = useState<Notification | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Solicitar permissão de notificação push nativa
  useEffect(() => {
    if ('Notification' in window && window.Notification.permission === 'default') {
      window.Notification.requestPermission().catch(() => {/* ignorar */});
    }
  }, []);

  const showBrowserNotification = useCallback((notif: Notification) => {
    if ('Notification' in window && window.Notification.permission === 'granted' && document.hidden) {
      const body = notif.message || `Nova notificação em "${notif.ticket_title || 'ticket'}"`;
      const n = new window.Notification('chatPro — Suporte', {
        body,
        icon: '/icon-192.png',
        tag: notif.id,
      });
      n.onclick = () => { window.focus(); n.close(); };
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
    const data = await fetchNotifications(user);
    setNotifications(data);
    setLoading(false);
  }, [user]);

  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead(user);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }, [user]);

  // Polling for due date alerts
  useEffect(() => {
    const checkDueDates = async () => {
      try {
        const settings = await fetchPlannerSettings(user);
        if (!settings || !settings.notify_days_before || settings.notify_days_before.length === 0) return;
        
        const tickets = await fetchTickets();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Ensure we don't spam. Check localstorage for last run.
        const cacheKey = `chatpro_notified_due_dates:${user}`;
        const notifiedCache = JSON.parse(localStorage.getItem(cacheKey) || '{}');
        const newCache = { ...notifiedCache };
        let modified = false;

        for (const t of tickets) {
          if (!t.due_date || t.status === 'resolved') continue;
          // Se o ticket nao tem assignee ou nao é meu (dependendo da regra de negocio, consideramos todos ou só meus)
          // Mas vamos notificar apenas pro usuario q agendou os dias ou esta no board. 
          const due = new Date(t.due_date);
          const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
          const diffDays = Math.ceil((dueDay.getTime() - today.getTime()) / 86400000);
          
          if (settings.notify_days_before.includes(diffDays)) {
            const notifId = `${t.id}_due_${diffDays}`;
            if (!newCache[notifId]) {
              // disparar notificação
              await insertNotification({
                recipient_email: user,
                sender_name: 'Sistema',
                type: 'due_date_alert',
                ticket_id: t.id,
                ticket_title: t.title,
                message: diffDays === 0 ? 'Este cartão vence hoje!' : `Este cartão vence em ${diffDays} dia(s) (${t.due_date.slice(0, 10)}).`
              });
              newCache[notifId] = true;
              modified = true;
            }
          }
        }

        
        if (modified) {
          localStorage.setItem(cacheKey, JSON.stringify(newCache));
        }
      } catch (e) {
        console.error('Error checking due dates', e);
      }
    };

    checkDueDates();
    const interval = setInterval(checkDueDates, 30 * 60 * 1000); // Check every 30 mins
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    refreshNotifications();
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
        const notif = payload.new as Notification;
        if (notif.recipient_email === user) {
          setNotifications(prev => [notif, ...prev]);
          showToast(notif);
          showBrowserNotification(notif);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, payload => {
        setNotifications(prev => prev.map(n => n.id === (payload.new as Notification).id ? payload.new as Notification : n));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refreshNotifications, user]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, loading, refreshNotifications, markRead, markAllRead, toastNotification, dismissToast }}>
      {children}
    </NotificationContext.Provider>
  );
};
