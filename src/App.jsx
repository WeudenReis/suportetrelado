import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { Card, ColumnHeader, Badge, Button } from './ui-components';
import { Slack, LogOut, AlertTriangle, Hammer, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

const STATUSES = ['Backlog', 'In Progress', 'Waiting for Devs', 'Resolved'];
const PRIORITY = {
  Low: 'bg-green-100 text-green-700',
  Medium: 'bg-blue-100 text-blue-700',
  High: 'bg-orange-100 text-orange-700',
  Critical: 'bg-rose-100 text-rose-700'
};

const BASE_DOMAIN = 'gmail.com'; // Mude para seu domínio corporativo depois

const buildTicket = (row) => ({
  id: row.id,
  title: row.title ?? 'Sem título',
  client_instance: row.client_instance ?? 'Indefinido',
  priority: row.priority ?? 'Low',
  links: { 
    backoffice_url: row.backoffice_url, 
    session_url: row.session_url 
  },
  diagnosis: row.diagnosis ?? '',
  assigned_to: row.assigned_slack_user ?? 'Sem responsável',
  status: row.status ?? 'Backlog',
  created_at: row.created_at,
  updated_at: row.updated_at
});

const getElapsedMinutes = (updatedAt) => {
  if (!updatedAt) return 0;
  const diff = Date.now() - new Date(updatedAt).getTime();
  return Math.floor(diff / 1000 / 60);
};

const formatElapsed = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [devMode, setDevMode] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));

  const boardTickets = useMemo(() => {
    if (!tickets.length && !loading && !error) {
      return [
        {
          id: 'sample-1',
          title: 'Exemplo de ticket: arrume a tela branca',
          client_instance: 'Cliente Demo',
          priority: 'Medium',
          links: { backoffice_url: '', session_url: '' },
          diagnosis: 'Ticket de exemplo para garantir que o Kanban seja renderizado.',
          evidence_storage_url: '',
          assigned_to: 'time-suporte',
          status: 'Backlog',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
    }
    return tickets;
  }, [tickets, loading, error]);

  const grouped = useMemo(() => {
    const map = {};
    STATUSES.forEach((status) => (map[status] = []));
    boardTickets.forEach((ticket) => {
      if (map[ticket.status]) map[ticket.status].push(ticket);
      else map.Backlog.push(ticket);
    });
    return map;
  }, [boardTickets]);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('tickets')
        .select('*')
        .order('updated_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }
      if (data) {
        setTickets(data.map(buildTicket));
      }
    } catch (err) {
      console.error('Supabase fetch error', err);
      setError('Falha ao carregar tickets. Verifique a conexão Supabase.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();

    const subscription = supabase
      .channel('realtime-tickets')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tickets' }, (payload) => {
        setTickets((prev) => [buildTicket(payload.new), ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets' }, (payload) => {
        setTickets((prev) => prev.map((t) => (t.id === payload.new.id ? buildTicket(payload.new) : t)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tickets' }, (payload) => {
        setTickets((prev) => prev.filter((t) => t.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [fetchTickets]);

  useEffect(() => {
    const init = async () => {
      const session = await supabase.auth.getSession();
      setUser(session.data.session?.user ?? null);
      supabase.auth.onAuthStateChange((_event, session2) => {
        setUser(session2?.user ?? null);
      });
    };
    init();
  }, []);

  const signInSlack = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'slack-oidc', options: { redirectTo: window.location.origin } });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const validCompanyEmail = (email) => email?.endsWith(`@${BASE_DOMAIN}`);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || !active) return;

    const fromTicket = tickets.find((t) => t.id === active.id);
    if (!fromTicket) return;

    if (fromTicket.status === over.id) return;

    const updated = { ...fromTicket, status: over.id, updated_at: new Date().toISOString() };
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

    const { error } = await supabase
      .from('tickets')
      .update({ status: updated.status, updated_at: updated.updated_at })
      .eq('id', updated.id);

    if (error) console.error('status update error', error);
  };

  const waitingForDevs = grouped['Waiting for Devs'];
  const devModeCards = devMode ? waitingForDevs : [];

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white shadow-xl rounded-xl p-8 text-center max-w-md w-full">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-rose-500" />
          <h2 className="text-xl font-semibold">Erro de carga</h2>
          <p className="mt-2 text-slate-600">{error}</p>
          <Button onClick={fetchTickets} className="mt-4">
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white shadow-xl rounded-xl p-8 text-center max-w-md w-full">
          <h1 className="text-2xl font-semibold mb-4">Suporte Trelado - Login</h1>
          <p className="mb-4 text-slate-600">Entre com Slack (somente domínio corporativo).</p>
          <Button onClick={signInSlack} icon={<Slack className="mr-2 h-4 w-4" />} className="w-full">
            Entrar com Slack
          </Button>
        </div>
      </div>
    );
  }

  if (user?.email && !validCompanyEmail(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white shadow-xl rounded-xl p-8 text-center max-w-md w-full">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-rose-500" />
          <h2 className="text-xl font-semibold">Domínio inválido</h2>
          <p className="mt-2">O acesso deve ser feito com e-mail @{BASE_DOMAIN}. Entre em contato com o suporte.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white shadow-xl rounded-xl p-8 text-center max-w-md w-full">
          <h2 className="text-xl font-semibold">Carregando...</h2>
          <p className="mt-2 text-slate-500">Aguarde enquanto inicializamos o sistema.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white shadow-xl rounded-xl p-8 text-center max-w-md w-full">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-rose-500" />
          <h2 className="text-xl font-semibold">Erro</h2>
          <p className="mt-2 text-slate-500">{error}</p>
          <Button onClick={fetchTickets} className="mt-4">
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="flex gap-6 p-4 max-w-full">
        <aside className="w-72 bg-white rounded-xl shadow px-4 py-4 sticky top-4 h-fit">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Filtros e modo</h2>
            <button onClick={signOut} className="text-slate-500 hover:text-slate-700" title="Logout">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-600">Usuário: {user.user_metadata?.full_name ?? user.email}</p>
          <div className="mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={devMode} onChange={(e) => setDevMode(e.target.checked)} />
              <span>Dev Mode: Waiting for Devs</span>
            </label>
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-3">
            <h3 className="font-semibold">KPIs</h3>
            <p>Total tickets: {tickets.length}</p>
            <p>Waiting for Devs: {waitingForDevs.length}</p>
            <p>Inativos &gt; 2h: {tickets.filter((t) => getElapsedMinutes(t.updated_at) > 120).length}</p>
          </div>
        </aside>

        <main className="flex-1">
          <h1 className="text-2xl font-bold mb-4">Kanban de Suporte</h1>

          {tickets.length === 0 && !loading && (
            <div className="mb-4 rounded-xl bg-white p-4 text-center text-slate-500 shadow">
              Nenhum ticket encontrado. Crie um ticket no Supabase ou aguarde o Realtime.
            </div>
          )}

          {devMode ? (
            <section className="grid gap-4">
              <div className="rounded-2xl bg-white p-4 shadow">
                <h3 className="font-semibold mb-2">Dev Mode: Waiting for Devs apurados</h3>
                <p className="text-sm text-slate-500">Exibe lista alternada com tickets em espera de dev.</p>
              </div>
              {devModeCards.length === 0 ? (
                <div className="rounded-xl bg-white p-4 text-center text-slate-500 border border-dashed border-slate-300">
                  Nenhum ticket em Waiting for Devs no momento.
                </div>
              ) : (
                devModeCards.map((ticket) => (
                  <Card key={ticket.id} ticket={ticket} priorityClass={PRIORITY[ticket.priority]} elapsed={formatElapsed(getElapsedMinutes(ticket.updated_at))} isUrgent={getElapsedMinutes(ticket.updated_at) > 120} />
                ))
              )}
            </section>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {STATUSES.map((status) => (
                  <div key={status} id={status} className="bg-slate-100 p-3 rounded-xl shadow min-h-[500px]">
                    <ColumnHeader>{status}</ColumnHeader>
                    <SortableContext items={grouped[status].map((t) => t.id)} strategy={rectSortingStrategy}>
                      <div className="space-y-3 pt-2">
                        {grouped[status].map((ticket) => {
                          const elapsedMin = getElapsedMinutes(ticket.updated_at);
                          const isUrgent = elapsedMin > 120;
                          return (
                            <div key={ticket.id} id={ticket.id}>
                              <div
                                className={clsx(
                                  'rounded-xl border p-3 bg-white shadow-sm transition-all',
                                  PRIORITY[ticket.priority],
                                  isUrgent && 'border-2 border-rose-500 animate-pulse'
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="font-semibold text-slate-800">{ticket.title}</h4>
                                  <Badge className={PRIORITY[ticket.priority]}>{ticket.priority}</Badge>
                                </div>
                                <p className="text-xs text-slate-500 mb-2">Cliente: {ticket.client_instance}</p>
                                <p className="text-sm mb-2">{ticket.diagnosis}</p>
                                {ticket.links?.backoffice_url && (
                                  <a href={ticket.links.backoffice_url} target="_blank" rel="noreferrer" className="text-blue-600 text-xs block">
                                    Backoffice
                                  </a>
                                )}
                                {ticket.links?.session_url && (
                                  <a href={ticket.links.session_url} target="_blank" rel="noreferrer" className="text-blue-600 text-xs block">
                                    Sessão remota
                                  </a>
                                )}
                                <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                                  <span>Responsável: {ticket.assigned_to || '—'}</span>
                                  <span>Atualizado: {formatElapsed(elapsedMin)}</span>
                                  {isUrgent && <Badge className="bg-rose-200 text-rose-800">Urgent</Badge>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </SortableContext>
                  </div>
                ))}
              </div>
            </DndContext>
          )}

          {loading && <p className="text-slate-500 mt-4">Carregando tickets...</p>}
        </main>
      </div>
    </div>
  );
}
