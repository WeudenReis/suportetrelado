# Suporte Trelado Kanban (Internal SaaS)

Projeto de Kanban técnico, com React + Tailwind + Supabase + Slack OAuth.

## Setup

1. Instale dependências:
   - `npm install`
2. Configure `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Configure Supabase:
   - Crie tabela usando `supabase-schema.sql`.
   - Ative Realtime para tabela `tickets`.
   - Habilite Slack OAuth em Auth providers.
4. Execute:
   - `npm run dev`

## Arquitetura de dados

Tabela `tickets` com campos:
- id, title, client_instance, priority, links (json), diagnosis, evidence_storage_url, assigned_to, status, created_at, updated_at.

## Funcionalidades implementadas

- Drag-and-drop Kanban (`Backlog`, `In Progress`, `Waiting for Devs`, `Resolved`).
- Supabase Realtime subscribe para INSERT/UPDATE/DELETE.
- Card com borda pulsante e badge `Urgent` quando inatividade &gt; 120 min.
- Dev Mode (toggle): view focada em `Waiting for Devs`.
- Slack OAuth (botão único) + validação de domínio `@company.com`.
