# Suporte chatPro — Kanban de Suporte Interno

Projeto de Kanban para suporte ao cliente, construido com React + TypeScript + Vite + Supabase.

## Setup

1. Instale dependencias:
   ```bash
   npm install
   ```
2. Configure `.env` (copie de `.env.example`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SENTRY_DSN` (opcional)
3. Configure Supabase:
   - Execute as migrations em `supabase/migrations/` no SQL Editor.
   - Ative Realtime para a tabela `tickets`.
   - Habilite Google OAuth em Auth providers.
4. Execute:
   ```bash
   npm run dev
   ```

## Scripts

| Comando | Descricao |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de producao |
| `npm run preview` | Preview do build |
| `npm run lint` | ESLint |
| `npm run type-check` | Verificacao TypeScript |
| `npm test` | Testes (watch) |
| `npm run test:run` | Testes (single run) |
| `npm run test:coverage` | Cobertura de testes |

## Stack

- **Frontend:** React 18 + TypeScript 5 + Vite 5
- **Estilizacao:** Tailwind CSS + CSS custom
- **Animacoes:** Framer Motion
- **Drag & Drop:** dnd-kit
- **Banco de Dados:** Supabase (PostgreSQL)
- **Observabilidade:** Sentry + logger estruturado
- **Testes:** Vitest + React Testing Library
- **CI/CD:** GitHub Actions
- **Deploy:** Vercel

## Estrutura

```
src/
  components/       # Componentes React
    kanban/          # Subcomponentes do Kanban
    __tests__/       # Testes de componentes
  hooks/             # Hooks customizados
    __tests__/       # Testes de hooks
  lib/               # Servicos e utilitarios
    api/             # Modulos de API por dominio
    __tests__/       # Testes de lib
  test/              # Setup de testes e mocks
supabase/
  migrations/        # Migrations SQL
```
