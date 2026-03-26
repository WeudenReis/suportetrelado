import { DndContext, DragEndEvent, DragStartEvent, useDroppable } from '@dnd-kit/core';
import Card, { Ticket } from './Card';
import { PlusCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

const STATUSES = ['Backlog', 'In Progress', 'Waiting for Devs', 'Resolved'] as const;

type KanbanBoardProps = {
  tickets: Ticket[];
  onMove: (id: string, status: string) => void;
  onAdd: (status: string) => void;
  search: string;
  devMode: boolean;
};

function Column({ status, tickets, onAdd, isActive }: { status: string; tickets: Ticket[]; onAdd: (status: string) => void; isActive: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className="w-68 min-w-[272px] h-[calc(100vh-198px)] overflow-y-auto p-3 rounded-2xl border border-white/10 bg-slate-950/60 backdrop-blur-md"
      style={{ boxShadow: isOver ? '0 0 0 2px rgba(59,130,246,0.5)' : 'none' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-100">{status}</h2>
        {isActive && <span className="text-xs text-blue-300">Dev Mode</span>}
      </div>
      <div className="space-y-1">
        {tickets.map((ticket) => (
          <Card key={ticket.id} ticket={ticket} />
        ))}
      </div>
      <button
        onClick={() => onAdd(status)}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 text-xs font-semibold rounded-lg border border-slate-600 px-2 py-2 text-slate-100 hover:bg-blue-500/20"
        title="Adicionar um cartão"
      >
        <PlusCircle className="h-4 w-4" />
        Adicionar um cartão
      </button>
    </div>
  );
}

export default function KanbanBoard({ tickets, onMove, onAdd, search, devMode }: KanbanBoardProps) {
  const [activeDrop, setActiveDrop] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tickets;
    return tickets.filter((item) => item.title.toLowerCase().includes(term) || item.client_instance.toLowerCase().includes(term));
  }, [tickets, search]);

  const groups = useMemo(() => {
    const map: Record<string, Ticket[]> = {
      Backlog: [],
      'In Progress': [],
      'Waiting for Devs': [],
      Resolved: []
    };

    filtered.forEach((ticket) => {
      if (devMode && ticket.status !== 'Waiting for Devs') return;
      map[ticket.status]?.push(ticket) ?? map.Backlog.push(ticket);
    });

    return map;
  }, [filtered, devMode]);

  function getStatusName(id?: string | null) {
    if (!id) return null;
    const allowed = STATUSES as unknown as string[];
    return allowed.includes(id) ? id : null;
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDrop(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const destStatus = getStatusName(over?.id as string);
    if (!destStatus) return;

    const id = active.id as string;
    onMove(id, destStatus);
    setActiveDrop(null);
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragOver={(event) => setActiveDrop(String(event.over?.id ?? ''))}>
      <div className="flex gap-4 overflow-x-auto pb-4 pt-2 pl-2">
        {STATUSES.map((status) => (
          <Column key={status} status={status} tickets={groups[status]} onAdd={onAdd} isActive={status === 'Waiting for Devs'} />
        ))}
      </div>
    </DndContext>
  );
}
