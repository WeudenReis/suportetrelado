/**
 * 🔥 STRESS TEST — Suporte chatPro (Browser)
 * 
 * Cole TUDO no Console do DevTools (F12) enquanto estiver logado.
 * Depois chame:
 *   stressTest()     → roda o teste (150 cards + 10 colunas + updates + reads)
 *   stressCleanup()  → apaga todos os dados criados pelo teste
 */

(function() {
  const TEST_PREFIX = '[STRESS-TEST]';
  const STATUSES = ['backlog', 'in_progress', 'waiting_devs', 'resolved'];
  const PRIORITIES = ['low', 'medium', 'high'];
  const CLIENTES = ['Empresa Alpha', 'Beta Corp', 'Gamma LTDA', 'Delta SA', 'Epsilon ME', null];
  const INSTANCIAS = ['chatpro-01', 'chatpro-02', 'chatpro-03', null];
  const TAGS_POOL = ['bug|#ef4444', 'feature|#3b82f6', 'urgente|#f59e0b', 'dúvida|#8b5cf6', 'melhoria|#06b6d4'];

  // Pega o cliente Supabase que o React já criou
  function getSupa() {
    // O import do supabase client está na window via módulos — vamos criar um novo com a sessão existente
    const url = 'https://vbxzeyweurzrwppdiluo.supabase.co';
    const key = 'sb_publishable_03VCMlD83Jf9fsXJB97Ccw_QEYH_4Ps';
    // Reutilizamos a sessão do localStorage que o auth já salvou
    return window.__supabase_stress || (function() {
      const { createClient } = window.__SUPABASE_JS || {};
      // Fallback: usar fetch direto com o token da sessão
      return null;
    })();
  }

  // Buscar o token JWT da sessão autenticada do localStorage
  function getAuthToken() {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          return data?.access_token || data?.currentSession?.access_token || null;
        } catch { /* ignore */ }
      }
    }
    return null;
  }

  const SUPA_URL = 'https://vbxzeyweurzrwppdiluo.supabase.co';
  const SUPA_KEY = 'sb_publishable_03VCMlD83Jf9fsXJB97Ccw_QEYH_4Ps';

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pickN(arr, max) {
    const n = Math.floor(Math.random() * (max + 1));
    return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
  }

  // REST API wrapper com auth
  async function supaRest(method, table, body, params) {
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${token || SUPA_KEY}`,
      'Prefer': method === 'POST' ? 'return=representation' : (method === 'DELETE' ? 'return=minimal' : 'return=representation'),
    };
    let url = `${SUPA_URL}/rest/v1/${table}`;
    if (params) url += '?' + new URLSearchParams(params).toString();

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || err.error || res.statusText);
    }
    if (method === 'DELETE' || res.status === 204) return null;
    return res.json();
  }

  // Métricas
  let ok = 0, fail = 0;
  const errors = [];
  const times = [];

  async function timed(label, fn) {
    const t0 = performance.now();
    try {
      await fn();
      times.push({ label, ms: performance.now() - t0 });
      ok++;
    } catch (err) {
      fail++;
      errors.push({ label, error: err.message || String(err) });
    }
  }

  // ═══════════════════════════════
  // FASE 1 — 150 cards simultâneos
  // ═══════════════════════════════
  async function createCards() {
    console.log('%c🚀 FASE 1 — Criando 150 cards simultâneos...', 'color: #25D066; font-weight: bold; font-size: 14px');
    const promises = [];
    for (let i = 1; i <= 150; i++) {
      const ticket = {
        title: `${TEST_PREFIX} Card #${i} — ${Date.now()}`,
        description: `Descrição de teste #${i}. Stress test chatPro. `.repeat(2),
        status: pick(STATUSES),
        priority: pick(PRIORITIES),
        cliente: pick(CLIENTES),
        instancia: pick(INSTANCIAS),
        tags: pickN(TAGS_POOL, 3),
        observacao: Math.random() > 0.5 ? '☐ Item 1\n☑ Item 2\n☐ Item 3' : null,
      };
      promises.push(timed(`INSERT card #${i}`, () => supaRest('POST', 'tickets', ticket)));
    }
    await Promise.allSettled(promises);
    console.log(`   ✅ Inserts ok: ${ok} | ❌ Falhas: ${fail}`);
  }

  // ═══════════════════════════════
  // FASE 2 — 10 colunas simultâneas
  // ═══════════════════════════════
  async function createColumns() {
    const p0 = ok, f0 = fail;
    console.log('%c🚀 FASE 2 — Criando 10 colunas simultâneas...', 'color: #25D066; font-weight: bold; font-size: 14px');
    const colors = ['#ef4444','#f59e0b','#22c55e','#3b82f6','#8b5cf6','#ec4899','#06b6d4','#f97316','#84cc16','#a855f7'];
    const promises = [];
    for (let i = 1; i <= 10; i++) {
      promises.push(timed(`INSERT coluna #${i}`, () =>
        supaRest('POST', 'board_columns', {
          id: `stress_col_${i}_${Date.now()}`,
          title: `${TEST_PREFIX} Coluna ${i}`,
          position: 100 + i,
          dot_color: colors[i - 1],
          is_archived: false,
        })
      ));
    }
    await Promise.allSettled(promises);
    console.log(`   ✅ ok: ${ok - p0} | ❌ falhas: ${fail - f0}`);
  }

  // ═══════════════════════════════
  // FASE 3 — Updates em massa
  // ═══════════════════════════════
  async function massUpdates() {
    const p0 = ok, f0 = fail;
    console.log('%c🚀 FASE 3 — Updates em massa (mover cards de status)...', 'color: #25D066; font-weight: bold; font-size: 14px');
    const cards = await supaRest('GET', 'tickets', null, { 'title': `like.${TEST_PREFIX}*`, 'select': 'id,status' });
    console.log(`   📦 ${cards.length} cards de teste encontrados`);

    const promises = cards.map((card, i) =>
      timed(`UPDATE card ${i + 1}`, () =>
        supaRest('PATCH', 'tickets', {
          status: pick(STATUSES),
          priority: pick(PRIORITIES),
          updated_at: new Date().toISOString(),
        }, { 'id': `eq.${card.id}` })
      )
    );
    await Promise.allSettled(promises);
    console.log(`   ✅ ok: ${ok - p0} | ❌ falhas: ${fail - f0}`);
  }

  // ═══════════════════════════════
  // FASE 4 — 50 leituras simultâneas
  // ═══════════════════════════════
  async function massReads() {
    const p0 = ok, f0 = fail;
    console.log('%c🚀 FASE 4 — 50 leituras simultâneas (simula 50 usuários)...', 'color: #25D066; font-weight: bold; font-size: 14px');
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(timed(`SELECT tickets #${i + 1}`, () =>
        supaRest('GET', 'tickets', null, { 'is_archived': 'eq.false', 'order': 'created_at.desc' })
      ));
      promises.push(timed(`SELECT columns #${i + 1}`, () =>
        supaRest('GET', 'board_columns', null, { 'is_archived': 'eq.false', 'order': 'position.asc' })
      ));
    }
    await Promise.allSettled(promises);
    console.log(`   ✅ ok: ${ok - p0} | ❌ falhas: ${fail - f0}`);
  }

  // ═══════════════════════════════
  // RELATÓRIO
  // ═══════════════════════════════
  function report() {
    console.log('%c' + '═'.repeat(55), 'color: #25D066');
    console.log('%c📊 RELATÓRIO FINAL', 'color: #25D066; font-weight: bold; font-size: 16px');
    console.log('%c' + '═'.repeat(55), 'color: #25D066');
    console.log(`Total: ${ok + fail} requisições`);
    console.log(`%c✅ Sucesso: ${ok}`, 'color: #22c55e; font-weight: bold');
    console.log(`%c❌ Falhas:  ${fail}`, fail > 0 ? 'color: #ef4444; font-weight: bold' : 'color: gray');

    if (times.length > 0) {
      const sorted = times.map(t => t.ms).sort((a, b) => a - b);
      const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const max = sorted[sorted.length - 1];

      console.log(`\n⏱️ Latência:`);
      console.log(`   Média:  ${avg.toFixed(0)}ms`);
      console.log(`   P50:    ${p50.toFixed(0)}ms`);
      console.log(`   P95:    ${p95.toFixed(0)}ms`);
      console.log(`   P99:    ${p99.toFixed(0)}ms`);
      console.log(`   Máximo: ${max.toFixed(0)}ms`);
    }

    if (errors.length > 0) {
      console.log(`\n%c🔴 Erros (primeiros 10):`, 'color: #ef4444');
      errors.slice(0, 10).forEach(e => console.log(`   • ${e.label}: ${e.error}`));
    }
    console.log('%c' + '═'.repeat(55), 'color: #25D066');
  }

  // ═══════════════════════════════
  // CLEANUP
  // ═══════════════════════════════
  window.stressCleanup = async function() {
    console.log('%c🧹 Limpando dados de teste...', 'color: #f59e0b; font-weight: bold; font-size: 14px');

    try {
      const cards = await supaRest('GET', 'tickets', null, { 'title': `like.${TEST_PREFIX}*`, 'select': 'id' });
      if (cards.length > 0) {
        // Deletar em lotes de 50
        for (let i = 0; i < cards.length; i += 50) {
          const batch = cards.slice(i, i + 50);
          const ids = batch.map(c => c.id);
          await supaRest('DELETE', 'tickets', null, { 'id': `in.(${ids.join(',')})` });
        }
        console.log(`   ✅ ${cards.length} cards removidos`);
      } else {
        console.log('   ℹ️ Nenhum card de teste');
      }
    } catch (e) {
      console.log('   ❌ Erro ao deletar cards:', e.message);
    }

    try {
      const cols = await supaRest('GET', 'board_columns', null, { 'title': `like.${TEST_PREFIX}*`, 'select': 'id' });
      if (cols.length > 0) {
        const ids = cols.map(c => c.id);
        await supaRest('DELETE', 'board_columns', null, { 'id': `in.(${ids.join(',')})` });
        console.log(`   ✅ ${cols.length} colunas removidas`);
      } else {
        console.log('   ℹ️ Nenhuma coluna de teste');
      }
    } catch (e) {
      console.log('   ❌ Erro ao deletar colunas:', e.message);
    }

    console.log('%c✨ Limpeza concluída!', 'color: #25D066; font-weight: bold');
  };

  // ═══════════════════════════════
  // MAIN
  // ═══════════════════════════════
  window.stressTest = async function() {
    const token = getAuthToken();
    if (!token) {
      console.error('❌ Não encontrei token de autenticação. Faça login primeiro!');
      return;
    }

    ok = 0; fail = 0; errors.length = 0; times.length = 0;

    console.log('%c' + '═'.repeat(55), 'color: #25D066');
    console.log('%c🔥 STRESS TEST — chatPro (DEV)', 'color: #25D066; font-weight: bold; font-size: 18px');
    console.log('%c' + '═'.repeat(55), 'color: #25D066');

    const t0 = performance.now();

    await createCards();
    await createColumns();
    await massUpdates();
    await massReads();

    const sec = ((performance.now() - t0) / 1000).toFixed(2);
    console.log(`\n⏱️ Tempo total: ${sec}s`);

    report();

    console.log('\n%c💡 Para limpar: stressCleanup()', 'color: #f59e0b; font-weight: bold');
  };

  console.log('%c🔥 Stress Test carregado!', 'color: #25D066; font-weight: bold; font-size: 14px');
  console.log('   → stressTest()     para rodar');
  console.log('   → stressCleanup()  para limpar');
})();
