import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import KanbanBoard from './KanbanBoard';
import { Slack, LogOut, Search, Users, Inbox, CalendarDays, LayoutGrid, LifeBuoy, ArrowRight, Zap } from 'lucide-react';
import type { Ticket } from './Card';

const STATUSES = ['Backlog', 'In Progress', 'Waiting for Devs', 'Resolved'] as const;

const buildTicket = (row: any): Ticket => ({
  id: row.id,
  title: row.title || 'Sem título',
  client_instance: row.client_instance || 'Indefefinido',
  priority: row.priority || 'Low',
  links: { backoffice_url: row.backoffice_url, session_url: row.session_url },
  diagnosis: row.diagnosis || '',
  assigned_to: row.assigned_slack_user || 'Sem responsável',
  status: row.status || 'Backlog',
  created_at: row.created_at,
  updated_at: row.updated_at
});

export default function App() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [devMode, setDevMode] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.from('tickets').select('*').order('updated_at', { ascending: false });
      if (fetchError) throw fetchError;
      if (data) setTickets(data.map(buildTicket));
    } catch (err: any) {
      setError('Erro ao carregar tickets. Verifique sua conexão.' + (err?.message ? ` ${err.message}` : ''));
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
    supabase.auth.getSession().then((session) => setUser(session.data.session?.user ?? null));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => authListener?.subscription.unsubscribe();
  }, []);

  const signInSlack = async () => {
    setSigningIn(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'slack',
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error('Slack OAuth Error:', err);
      setError('Erro ao conectar com Slack: ' + (err?.message || 'Verifique a configuração do Slack no Supabase'));
      setSigningIn(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleMove = async (id: string, nextStatus: string) => {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: nextStatus, updated_at: new Date().toISOString() } : t)));
    const { error } = await supabase.from('tickets').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) setError('Falha ao atualizar status: ' + error.message);
  };

  const handleAdd = async (status: string) => {
    const payload = {
      title: `Novo ticket ${Date.now()}`,
      client_instance: 'Cliente pendente',
      priority: 'High',
      diagnosis: 'Descreva o problema aqui',
      status
    };
    const { data, error: insertError } = await supabase.from('tickets').insert(payload).select().single();
    if (insertError) {
      setError('Falha ao criar ticket: ' + insertError.message);
      return;
    }
    setTickets((prev) => [buildTicket(data), ...prev]);
  };

  const validDomain = (email: string) => {
    const e = email.toLowerCase();
    return e.endsWith('@gmail.com') || e.endsWith('@seu-dominio-corporativo.com'); // Change to your corporate domain
  };

  if (!user) {
    return (
      <div className="min-h-screen h-screen flex items-center justify-center bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_50%,#0f172a_100%)] text-slate-100 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute top-1/2 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>
        </div>

        {/* Main Card */}
        <div className="relative z-10 w-full max-w-md px-4">
          {/* Premium Glassmorphism Card */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
            {/* Header with Icon */}
            <div className="flex items-center justify-center mb-6">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                <LifeBuoy className="w-8 h-8 text-white" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl font-black tracking-tight text-center mb-2 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Suporte Trelado
            </h1>
            <p className="text-center text-sm text-slate-300 mb-8">Gerenciamento de tickets em tempo real</p>

            {/* Error State */}
            {error && (
              <div className="mb-6 p-4 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-200 text-sm">
                {error}
              </div>
            )}

            {/* CTA Text */}
            <p className="text-center text-slate-200 text-sm mb-6 font-medium">
              Conecte com sua conta Slack para acessar
            </p>

            {/* Slack Login Button */}
            <button
              onClick={signInSlack}
              disabled={signingIn}
              className="w-full group relative flex items-center justify-center gap-3 rounded-xl py-3 px-4 font-semibold text-white transition-all duration-300 mb-4"
              style={{
                background: 'linear-gradient(135deg, #2c2d30 0%, #36362a 100%)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 48px rgba(74, 21, 75, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.1)';
              }}
            >
              {signingIn ? (
                <>
                  <div className="animate-spin">
                    <Zap className="w-5 h-5" />
                  </div>
                  <span>Conectando...</span>
                </>
              ) : (
                <>
                  <Slack className="w-5 h-5" />
                  <span>Entrar com Slack</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </>
              )}
            </button>

            {/* Feature Pills */}
            <div className="grid grid-cols-2 gap-2 mt-6 pt-6 border-t border-white/10">
              <div className="text-xs text-slate-300 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                Realtime
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                Seguro
              </div>
            </div>
          </div>

          {/* Footer Trust Signal */}
          <p className="text-center text-xs text-slate-400 mt-4">
            Seus dados são protegidos por criptografia de ponta a ponta
          </p>
        </div>
      </div>
    );
  }

  if (!validDomain(user.email || user.user_metadata?.email || '')) {
    return (
      <div className="min-h-screen h-screen flex items-center justify-center bg-slate-950 text-slate-50">
        <div className="p-8 rounded-2xl bg-slate-900/75 border border-rose-500">
          <h2 className="text-xl font-semibold">Acesso restrito</h2>
          <p className="mt-2">Use o domínio corporativo correto. Contate TI.</p>
          <button onClick={signOut} className="mt-4 px-4 py-2 rounded-lg bg-rose-500 text-white">
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen bg-[linear-gradient(135deg,#020617_0%,#0f172a_50%,#1e293b_100%)] text-slate-100 overflow-hidden">
      <header className="h-16 px-4 flex items-center justify-between border-b border-slate-800 bg-black/30 backdrop-blur-md fixed top-0 left-0 right-0 z-20">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">Suporte Trelado</h1>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tickets, cliente..."
              className="pl-7 pr-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-100 outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold">Criar</button>
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-full bg-sky-500 flex items-center justify-center text-xs font-bold">M</span>
            <span className="h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
          </div>
        </div>
      </header>

      <main className="pt-20 pb-24 px-3 lg:px-6 overflow-hidden">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-400 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</div>
        )}

        <section className="mb-4 flex items-center justify-between text-sm text-slate-300">
          <div className="flex items-center gap-2">
            <Users size={14} />
            Conectado como <span className="font-semibold text-slate-100">{user.user_metadata?.full_name ?? user.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDevMode((v) => !v)}
              className={`px-3 py-1 rounded-lg ${devMode ? 'bg-blue-500' : 'bg-slate-800'} text-slate-50`}
            >
              Dev Mode: {devMode ? 'Ativo' : 'Off'}
            </button>
            <button onClick={signOut} className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700">
              <LogOut className="inline-block w-4 h-4" />
            </button>
          </div>
        </section>

        <KanbanBoard tickets={tickets} onMove={handleMove} onAdd={handleAdd} search={search} devMode={devMode} />
      </main>

      <footer className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
        <nav className="bg-slate-900/70 border border-slate-700 rounded-full px-4 py-2 flex items-center gap-6 shadow-xl backdrop-blur-md">
          <button className="flex items-center gap-1 text-slate-300 hover:text-white"><Inbox size={14} /> Caixa de Entrada</button>
          <button className="flex items-center gap-1 text-slate-300 hover:text-white"><CalendarDays size={14} /> Planejador</button>
          <button className="flex items-center gap-1 text-blue-300 border-b-2 border-blue-400 pb-0.5"><LayoutGrid size={14} /> Quadro</button>
        </nav>
      </footer>
    </div>
  );
}
