# slack-webhook — Edge Function

Recebe um payload de escalonamento do frontend (`SlackEscalationModal`),
monta a mensagem em **Slack Block Kit** e dispara o **Incoming Webhook**
do canal de suporte.

A URL do webhook é mantida apenas como **secret no Supabase**, nunca exposta ao
browser.

---

## 1) Criar o Incoming Webhook no Slack

1. Abrir https://api.slack.com/apps → **Create New App** → **From scratch**
2. Nome: `Suporte chatPro` · workspace: o seu
3. Menu lateral → **Incoming Webhooks** → ligar o toggle
4. Clicar em **Add New Webhook to Workspace**
5. Selecionar o **canal** que receberá os escalonamentos (ex.: `#suporte-ti`)
6. Copiar a URL gerada (formato `https://hooks.slack.com/services/T.../B.../xxx`)

> Importante: essa URL é uma credencial — qualquer um com ela posta no canal.
> Nunca commitar nem expor no frontend.

---

## 2) Configurar o secret no Supabase

Pelo **Dashboard do Supabase**:

1. Project Settings → **Edge Functions** → **Secrets**
2. Add new secret:
   - Name: `SLACK_WEBHOOK_URL`
   - Value: a URL copiada do passo 1
3. Save

Pela **CLI** (alternativa):

```bash
supabase secrets set SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

---

## 3) Deploy da função

Pré-requisito: ter o [Supabase CLI](https://supabase.com/docs/guides/cli) instalado e logado (`supabase login`).

```bash
# Linkar o projeto local com o ref do Supabase Dev
supabase link --project-ref <SEU_PROJECT_REF_DEV>

# Deploy
supabase functions deploy slack-webhook --no-verify-jwt
```

> `--no-verify-jwt` permite a função ser invocada via `supabase.functions.invoke`
> com a `anon key`. A função em si valida os campos do payload no Deno.

A URL final fica `https://<project-ref>.supabase.co/functions/v1/slack-webhook`,
mas você não precisa dela diretamente — o frontend usa
`supabase.functions.invoke('slack-webhook', { body: payload })`.

---

## 4) Preencher os destinatários

Editar [`src/lib/slackTargets.ts`](../../../src/lib/slackTargets.ts) substituindo
os placeholders pelos IDs reais:

```ts
export const SLACK_TARGETS: SlackTarget[] = [
  { key: 'pedro_saddi', slackId: 'U01ABCD2EFG', label: 'Pedro Saddi', description: 'CTO' },
  { key: 'time_tecnico', slackId: 'S01XYZW3VUT', label: 'Time Técnico', description: 'Grupo @time-tecnico' },
]
```

**Como obter o ID:**

- **Usuário individual** (`U...`): no Slack, abrir o perfil do membro →
  ⋮ (More) → **Copy member ID**
- **User group / grupo** (`S...`): https://app.slack.com/team/groups →
  ⋮ no grupo → **Copy group ID**. A função embrulha em `<!subteam^ID>` automaticamente.
- **Mencionar canal/everyone**: usar `'channel'` ou `'here'` como `slackId`.

---

## 5) Testar localmente (sem deploy)

```bash
# Dentro da pasta do repo, rodar a function localmente
supabase functions serve slack-webhook --env-file .env.local --no-verify-jwt
```

`.env.local` deve conter `SLACK_WEBHOOK_URL=https://hooks.slack.com/...`.

Em outro terminal, dispara um payload de teste:

```bash
curl -X POST http://localhost:54321/functions/v1/slack-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "targetSlackUserId": "channel",
    "targetLabel": "Canal",
    "customer": "Cliente Teste",
    "instance": "chatpro-test-123",
    "backendUrl": "https://exemplo.com/cliente/123",
    "problem": "Teste de integracao via curl",
    "logs": "Error: stack trace de exemplo\n  at line 42",
    "escalatedBy": "agente@empresa.com",
    "ticketTitle": "Ticket #1 — Teste"
  }'
```

A mensagem deve aparecer no canal configurado no webhook.

---

## 6) Testar end-to-end no app

1. `git pull` na branch `dev` e `npm run dev` localmente (ou abrir o Preview do Vercel)
2. Editar `src/lib/slackTargets.ts` com pelo menos 1 ID válido
3. Abrir um ticket → action bar tem o botão amarelo **"Escalonar para TI"**
4. Selecionar destinatário, ajustar campos, clicar **Enviar para o Slack**
5. Conferir:
   - Mensagem chegou no canal com a formatação do Block Kit
   - Na **Timeline** do ticket aparece "X escalou este cartão para Y via Slack"

---

## Estrutura do Block Kit gerado

```
@mention                              ← <@USER> ou <!subteam^GROUP>
[ Cliente: ... ]  [ Instância: ... ]  ← section com fields
[ Retaguarda: <link> ]
*Problema:*
texto do problema
```code block opcional```
👤 quem.escalou@empresa.com  🎫 [link do ticket]   ← context block
```

Limite do Slack: 3000 chars por bloco. Logs são truncados em 2800 chars
com sufixo `...[truncado]`.

---

## Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| `SLACK_WEBHOOK_URL não configurado` | Secret não foi setado no Dashboard | Repetir passo 2 |
| `Slack rejeitou o payload` (502) | Block Kit mal formado | Conferir log do Supabase Functions |
| Mensagem chega sem mencionar ninguém | `slackId` ainda é placeholder em `slackTargets.ts` | Substituir pelos IDs reais |
| Frontend mostra "Falha ao invocar" | Edge Function não foi deployada ou JWT bloqueando | Re-deploy com `--no-verify-jwt` |
