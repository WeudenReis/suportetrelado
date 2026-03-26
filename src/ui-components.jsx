import React from 'react';

export function Button({ children, className = '', icon, ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function Badge({ children, className = '' }) {
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${className}`}>{children}</span>
  );
}

export function ColumnHeader({ children }) {
  return <h3 className="font-semibold text-slate-700 mb-2">{children}</h3>;
}

export function Card({ ticket, priorityClass, elapsed, isUrgent }) {
  return (
    <div
      className={
        'rounded-xl border p-3 bg-white shadow-sm transition-all ' +
        `${priorityClass} ` +
        (isUrgent ? 'border-2 border-rose-500 animate-pulse' : 'border-slate-200')
      }
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-slate-800">{ticket.title}</h4>
        <Badge className={priorityClass}>{ticket.priority}</Badge>
      </div>
      <p className="text-xs text-slate-500 mb-2">Cliente: {ticket.client_instance}</p>
      <p className="text-sm mb-2">{ticket.diagnosis || 'Sem descrição'}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
        <span>Responsável: {ticket.assigned_to || '—'}</span>
        <span>Tempo: {elapsed}</span>
      </div>
    </div>
  );
}
