#!/usr/bin/env node
// Remove anexos orfaos de avisos (uploads que nunca foram publicados).
// Uso: node scripts/cleanup-orphan-attachments.mjs [--dry-run] [--hours=24]
// Requer: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('[cleanup] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios')
  process.exit(1)
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const hoursArg = args.find(a => a.startsWith('--hours='))
const olderThanHours = hoursArg ? parseInt(hoursArg.split('=')[1], 10) : 24

if (!Number.isFinite(olderThanHours) || olderThanHours < 1) {
  console.error('[cleanup] --hours deve ser um inteiro >= 1')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  const started = Date.now()
  console.log(`[cleanup] listando orfaos com mais de ${olderThanHours}h (dry-run=${dryRun})`)

  const { data: orphans, error } = await supabase
    .rpc('list_orphan_announcement_attachments', { older_than_hours: olderThanHours })

  if (error) {
    console.error('[cleanup] falha ao listar orfaos:', error.message)
    process.exit(2)
  }

  if (!orphans || orphans.length === 0) {
    console.log('[cleanup] nenhum orfao encontrado')
    return
  }

  const totalBytes = orphans.reduce((acc, o) => acc + Number(o.size_bytes || 0), 0)
  console.log(`[cleanup] encontrados ${orphans.length} orfaos (${formatBytes(totalBytes)})`)
  orphans.slice(0, 10).forEach(o => console.log(`  - ${o.storage_path} (${formatBytes(o.size_bytes)})`))
  if (orphans.length > 10) console.log(`  ... e mais ${orphans.length - 10}`)

  if (dryRun) {
    console.log('[cleanup] dry-run: nada deletado')
    return
  }

  const paths = orphans.map(o => o.storage_path)
  const batchSize = 100
  let deleted = 0

  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize)
    const { error: delError } = await supabase.storage.from('attachments').remove(batch)
    if (delError) {
      console.error(`[cleanup] falha ao deletar batch ${i / batchSize + 1}:`, delError.message)
      continue
    }
    deleted += batch.length
    console.log(`[cleanup] deletados ${deleted}/${paths.length}`)
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`[cleanup] concluido: ${deleted} arquivos removidos em ${elapsed}s`)
}

function formatBytes(bytes) {
  const b = Number(bytes) || 0
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(2)} MB`
}

main().catch(err => {
  console.error('[cleanup] erro inesperado:', err)
  process.exit(3)
})
