import { useMemo } from 'react';
import { ExternalLink, Link2, Clock3 } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export type Ticket = {
  id: string;
  title: string;
  client_instance: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  links: { backoffice_url?: string; session_url?: string };
  diagnosis: string;
  assigned_to: string;
  status: string;
  created_at?: string;
  updated_at?: string;
};

type CardProps = {
  ticket: Ticket;
};

const PRIORITY_THEME: Record<string, string> = {
  Critical: 'bg-rose-500/20 text-rose-200 ring-rose-400',
  High: 'bg-orange-500/20 text-orange-200 ring-orange-400',
  Medium: 'bg-amber-500/20 text-amber-200 ring-amber-400',
  Low: 'bg-emerald-500/20 text-emerald-200 ring-emerald-400'
};

export default function Card({ ticket }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ticket.id });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined
  };

  const elapsedMinutes = useMemo(() => {
    if (!ticket.updated_at) return 0;
    const diff = Date.now() - new Date(ticket.updated_at).getTime();
    return Math.floor(diff / 1000 / 60);
  }, [ticket.updated_at]);

  const isUrgent = elapsedMinutes > 120;

  return (
    <motion.article
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, boxShadow: '0 10px 20px rgba(0,0,0,0.35)' }}
      transition={{ duration: 0.15 }}
      className={clsx(
        'rounded-xl p-4 mb-3 cursor-grab bg-slate-900/70 border border-slate-700 text-slate-100',
        isUrgent && 'ring-2 ring-rose-400 animate-pulse',
        isDragging && 'opacity-70'
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex justify-between items-start gap-2">
        <span
          className={clsx(
            'text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full ring-1',
            PRIORITY_THEME[ticket.priority]
          )}
        >
          {ticket.priority}
        </span>
        <span className="text-xs text-slate-300 font-medium">{elapsedMinutes} min</span>
      </div>

      <h3 className="mt-3 text-sm font-semibold leading-snug">{ticket.title}</h3>
      <p className="mt-1 text-xs text-slate-300">{ticket.client_instance}</p>
      <p className="mt-2 text-xs text-slate-400 line-clamp-2">{ticket.diagnosis || 'Sem diagnóstico informado'}</p>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Clock3 className="h-3.5 w-3.5" />
          {ticket.assigned_to || 'Sem responsável'}
        </div>
        <div className="flex items-center gap-2">
          {ticket.links.backoffice_url && (
            <a
              href={ticket.links.backoffice_url}
              target="_blank"
              rel="noreferrer"
              className="p-1 rounded-md hover:bg-slate-700/50"
              title="Retaguarda"
            >
              <Link2 className="h-4 w-4" />
            </a>
          )}
          {ticket.links.session_url && (
            <a
              href={ticket.links.session_url}
              target="_blank"
              rel="noreferrer"
              className="p-1 rounded-md hover:bg-slate-700/50"
              title="Sessão"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </motion.article>
  );
}
