/**
 * 🔥 Stress Test — Suporte chatPro
 * 
 * Dispara 150+ requisições simultâneas contra o Supabase DEV
 * para testar a resiliência do board.
 *
 * COMO USAR:
 *   1. Abra o site dev (suportetrelado-git-dev-...vercel.app) no navegador
 *   2. Faça login normalmente
 *   3. Abra o DevTools (F12) → aba Console
 *   4. Cole o conteúdo de stress-test-browser.js e aperte Enter
 *   5. Chame: stressTest()       → roda o teste
 *              stressCleanup()   → limpa os dados de teste
 *
 * Alternativa via Node (requer service_role key):
 *   $env:SUPABASE_SERVICE_KEY="eyJ..."; node stress-test.mjs
 *
 * ⚠️  Sempre aponta para o ambiente DEV. Nunca toca produção.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vbxzeyweurzrwppdiluo.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

if (!SERVICE_KEY) {
  console.error('❌ Defina SUPABASE_SERVICE_KEY para bypass do RLS.')
  console.error('   Ex: $env:SUPABASE_SERVICE_KEY="eyJ..."; node stress-test.mjs')
  console.error('   Pegue em: Supabase Dashboard → Settings → API → service_role (secret)')
  console.error('')
  console.error('💡 Alternativa: use o stress-test-browser.js no console do navegador (já autenticado).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const TEST_PREFIX = '[STRESS-TEST]'
const STATUSES = ['backlog', 'in_progress', 'waiting_devs', 'resolved']
const PRIORITIES = ['low', 'medium', 'high']
const CLIENTES = ['Empresa Alpha', 'Beta Corp', 'Gamma LTDA', 'Delta SA', 'Epsilon ME', 'Zeta Inc', null]
const INSTANCIAS = ['chatpro-01', 'chatpro-02', 'chatpro-03', null]
const TAGS_POOL = ['bug|#ef4444', 'feature|#3b82f6', 'urgente|#f59e0b', 'dúvida|#8b5cf6', 'melhoria|#06b6d4', 'infra|#64748b']

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function pickN(arr, max) {
  const n = Math.floor(Math.random() * (max + 1))
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

// ── Métricas ──
let ok = 0
let fail = 0
const errors = []
const times = []

async function timed(label, fn) {
  const t0 = performance.now()
  try {
    await fn()
    const ms = performance.now() - t0
    times.push({ label, ms })
    ok++
  } catch (err) {
    fail++
    errors.push({ label, error: err.message || err })
  }
}

// ══════════════════════════════════════
// FASE 1 — Criar 150 cards simultâneos
// ══════════════════════════════════════
async function createCards() {
  console.log('\n🚀 FASE 1 — Criando 150 cards simultâneos...')
  const promises = []
  for (let i = 1; i <= 150; i++) {
    const ticket = {
      title: `${TEST_PREFIX} Card #${i} — ${Date.now()}`,
      description: `Descrição de teste #${i}. Lorem ipsum dolor sit amet. `.repeat(3),
      status: pick(STATUSES),
      priority: pick(PRIORITIES),
      cliente: pick(CLIENTES),
      instancia: pick(INSTANCIAS),
      tags: pickN(TAGS_POOL, 3),
      observacao: Math.random() > 0.5 ? '☐ Item 1\n☑ Item 2\n☐ Item 3' : null,
    }
    promises.push(
      timed(`INSERT card #${i}`, () =>
        supabase.from('tickets').insert(ticket).select().single().then(({ error }) => { if (error) throw error })
      )
    )
  }
  await Promise.allSettled(promises)
  console.log(`   ✅ ${ok} ok | ❌ ${fail} falhas`)
}

// ══════════════════════════════════════
// FASE 2 — Criar 10 colunas simultâneas
// ══════════════════════════════════════
async function createColumns() {
  const prevOk = ok
  const prevFail = fail
  console.log('\n🚀 FASE 2 — Criando 10 colunas simultâneas...')
  const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#a855f7']
  const promises = []
  for (let i = 1; i <= 10; i++) {
    const id = `stress_col_${i}_${Date.now()}`
    promises.push(
      timed(`INSERT coluna #${i}`, () =>
        supabase.from('board_columns').insert({
          id,
          title: `${TEST_PREFIX} Coluna ${i}`,
          position: 100 + i,
          dot_color: colors[i - 1],
          is_archived: false,
        }).then(({ error }) => { if (error) throw error })
      )
    )
  }
  await Promise.allSettled(promises)
  console.log(`   ✅ ${ok - prevOk} ok | ❌ ${fail - prevFail} falhas`)
}

// ══════════════════════════════════════
// FASE 3 — Updates em massa (mover todos os cards de status)
// ══════════════════════════════════════
async function massUpdates() {
  const prevOk = ok
  const prevFail = fail
  console.log('\n🚀 FASE 3 — Buscando cards de teste e fazendo updates em massa...')

  const { data: testCards, error } = await supabase
    .from('tickets')
    .select('id, status')
    .like('title', `${TEST_PREFIX}%`)
  
  if (error) { console.log('   ❌ Erro ao buscar cards:', error.message); return }
  console.log(`   📦 ${testCards.length} cards de teste encontrados`)

  const promises = testCards.map((card, i) =>
    timed(`UPDATE card ${i + 1}/${testCards.length}`, () =>
      supabase.from('tickets').update({
        status: pick(STATUSES),
        priority: pick(PRIORITIES),
        updated_at: new Date().toISOString(),
      }).eq('id', card.id).then(({ error }) => { if (error) throw error })
    )
  )
  await Promise.allSettled(promises)
  console.log(`   ✅ ${ok - prevOk} ok | ❌ ${fail - prevFail} falhas`)
}

// ══════════════════════════════════════
// FASE 4 — Reads simultâneos (simular N usuários)
// ══════════════════════════════════════
async function massReads() {
  const prevOk = ok
  const prevFail = fail
  console.log('\n🚀 FASE 4 — 50 leituras simultâneas (simula 50 usuários abrindo o board)...')
  const promises = []
  for (let i = 0; i < 50; i++) {
    promises.push(
      timed(`SELECT tickets #${i + 1}`, () =>
        supabase.from('tickets').select('*').eq('is_archived', false).order('created_at', { ascending: false })
          .then(({ error }) => { if (error) throw error })
      )
    )
    promises.push(
      timed(`SELECT columns #${i + 1}`, () =>
        supabase.from('board_columns').select('*').eq('is_archived', false).order('position', { ascending: true })
          .then(({ error }) => { if (error) throw error })
      )
    )
  }
  await Promise.allSettled(promises)
  console.log(`   ✅ ${ok - prevOk} ok | ❌ ${fail - prevFail} falhas`)
}

// ══════════════════════════════════════
// CLEANUP — Remove todos os dados de teste
// ══════════════════════════════════════
async function cleanup() {
  console.log('\n🧹 CLEANUP — Removendo dados de teste...')

  const { data: cards } = await supabase.from('tickets').select('id').like('title', `${TEST_PREFIX}%`)
  if (cards && cards.length > 0) {
    const { error } = await supabase.from('tickets').delete().like('title', `${TEST_PREFIX}%`)
    console.log(error ? `   ❌ Erro ao deletar cards: ${error.message}` : `   ✅ ${cards.length} cards removidos`)
  } else {
    console.log('   ℹ️  Nenhum card de teste encontrado')
  }

  const { data: cols } = await supabase.from('board_columns').select('id').like('title', `${TEST_PREFIX}%`)
  if (cols && cols.length > 0) {
    const { error } = await supabase.from('board_columns').delete().like('title', `${TEST_PREFIX}%`)
    console.log(error ? `   ❌ Erro ao deletar colunas: ${error.message}` : `   ✅ ${cols.length} colunas removidas`)
  } else {
    console.log('   ℹ️  Nenhuma coluna de teste encontrada')
  }
}

// ══════════════════════════════════════
// RELATÓRIO
// ══════════════════════════════════════
function report() {
  console.log('\n' + '═'.repeat(60))
  console.log('📊 RELATÓRIO FINAL')
  console.log('═'.repeat(60))
  console.log(`Total de requisições: ${ok + fail}`)
  console.log(`✅ Sucesso: ${ok}`)
  console.log(`❌ Falhas:  ${fail}`)

  if (times.length > 0) {
    const sorted = times.map(t => t.ms).sort((a, b) => a - b)
    const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length
    const p50 = sorted[Math.floor(sorted.length * 0.5)]
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    const p99 = sorted[Math.floor(sorted.length * 0.99)]
    const max = sorted[sorted.length - 1]

    console.log(`\n⏱️  Latência (ms):`)
    console.log(`   Média:  ${avg.toFixed(0)}ms`)
    console.log(`   P50:    ${p50.toFixed(0)}ms`)
    console.log(`   P95:    ${p95.toFixed(0)}ms`)
    console.log(`   P99:    ${p99.toFixed(0)}ms`)
    console.log(`   Máximo: ${max.toFixed(0)}ms`)
  }

  if (errors.length > 0) {
    console.log(`\n🔴 Erros (primeiros 10):`)
    errors.slice(0, 10).forEach(e => console.log(`   • ${e.label}: ${e.error}`))
  }

  console.log('═'.repeat(60))
}

// ══════════════════════════════════════
// MAIN
// ══════════════════════════════════════
async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--cleanup')) {
    await cleanup()
    process.exit(0)
  }

  console.log('═'.repeat(60))
  console.log('🔥 STRESS TEST — Suporte chatPro (DEV)')
  console.log(`   Alvo: ${SUPABASE_URL}`)
  console.log('═'.repeat(60))

  const t0 = performance.now()

  await createCards()     // 150 inserts simultâneos
  await createColumns()   // 10 inserts simultâneos
  await massUpdates()     // ~150 updates simultâneos
  await massReads()       // 100 reads simultâneos (50 tickets + 50 columns)

  const totalSec = ((performance.now() - t0) / 1000).toFixed(2)
  console.log(`\n⏱️  Tempo total: ${totalSec}s`)

  report()

  console.log('\n💡 Para limpar os dados de teste: node stress-test.mjs --cleanup')
}

main().catch(console.error)
