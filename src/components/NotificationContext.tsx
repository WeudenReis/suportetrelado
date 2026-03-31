import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, fetchNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/supabase';
import type { Notification } from '../lib/supabase';

interface NotificationContextProps {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  refreshNotifications: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
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

  useEffect(() => {
    refreshNotifications();
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
        const notif = payload.new as Notification;
        if (notif.recipient_email === user) {
          setNotifications(prev => [notif, ...prev]);
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
    <NotificationContext.Provider value={{ notifications, unreadCount, loading, refreshNotifications, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
};
