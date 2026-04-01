# Suporte chatPro — Instruções para o Assistente

Você está trabalhando no projeto **Suporte chatPro**, um Kanban board de suporte ao cliente desenvolvido com React + TypeScript + Vite, com banco de dados no Supabase e deploy na Vercel.

---

## 🚀 Stack Principal
- **Frontend:** React 18 + TypeScript 5 + Vite 5.1
- **Estilização:** Tailwind CSS + CSS puro (`src/styles.css`)
- **Animações:** Framer Motion + GSAP
- **Drag & Drop:** dnd-kit
- **Ícones:** Phosphor Icons (peso: Regular)
- **Banco de Dados:** Supabase (PostgreSQL)
- **Deploy:** Vercel

---

## 🗂️ Estrutura Crítica do Projeto
- `src/App.tsx` — Root, roteamento por tabs, provedores de contexto/auth
- `src/components/KanbanBoard.tsx` — Core: colunas, cards, dnd-kit
- `src/components/CardDetailModal.tsx` — Visualização e edição de cards
- `src/components/InboxView.tsx` — Notificações e sidebar
- `src/lib/supabase.ts` — Client do banco, queries e mutações
- `src/lib/boardColumns.ts` — Regras de negócio de colunas
- `src/styles.css` — Estilos globais complementares ao Tailwind

---

## 🎨 Identidade Visual chatPro (OBRIGATÓRIO)
- **Verde Principal:** `#25D066` — Use em CTAs, botões primários e destaques
- **Verde Hover:** `#1BAD53`
- **Verde Neon:** `#24FF72`
- **Preto:** `#000000`
- **Cinzas:** `#D1D1D5`, `#E6E5E8`, `#F1F0F2`
- **Fundo Dark Kanban:** `#1d2125` (primário), `#22272b` (secundário), `#2c333a` (cards)
- **Tipografia:** `Paytone One` (títulos) · `Space Grotesk` (textos)
- **Nome do produto:** sempre **"chatPro"** (c minúsculo, P maiúsculo)
- **Tom de voz:** Simples, Prático e Intuitivo. Sem jargões. Sem pronomes neutros.

---

## 🌿 Regras de Git e Deploy (CRÍTICO)

> **NUNCA faça commit ou push direto para a `main` sem autorização explícita do usuário.**

- **Branch de trabalho:** sempre `dev`
- **Repositório:** https://github.com/WeudenReis/suportetrelado
- **Produção (`main`):** Vercel Production — ambiente restrito
- **Preview (`dev`):** Vercel Preview — ambiente de testes diários
- **Padrão de commits (Conventional Commits em português):**
  - `feat: adiciona nova coluna ao kanban`
  - `fix: corrige intercepção de cliques no dnd-kit`
  - `style: ajusta espaçamento do card`
  - `chore: atualiza dependências`
  - `docs: documenta fluxo de autenticação`
- **Fluxo de push:** `git add -A` → `git commit -m "..."` → `git push origin dev`
- **Nunca use `git push --force`** sem autorização explícita

---

## 🔒 Variáveis de Ambiente
- `VITE_SUPABASE_URL` — Produção
- `VITE_SUPABASE_URL_DEV` — Preview/Dev
- **Detecção de produção:** `url.includes('qacrxpfoamarslxskcyb')`
- **Nunca hardcode** chaves, URLs ou tokens no código

---

## ✅ Checklist Antes de Qualquer Push
1. `npx vite build` — deve compilar sem erros de TypeScript ou ESLint
2. Verificar que não há `any` no TypeScript
3. Verificar que não há secrets hardcoded
4. Confirmar que o push é para `dev`, nunca para `main`

---

## 🐛 Problemas Comuns (Verificar Primeiro)
- **Tela branca:** Verificar import do React faltando em JSX fora de componentes padrão
- **Tabela não existe:** Verificar se a migration do Supabase foi executada
- **Cliques não funcionam no drag:** Evento `onPointerDown` interceptando botões no dnd-kit
- **Deploy falhou na Vercel:** Verificar variáveis de ambiente com escopo errado (Production vs Preview) ou concatenadas

---

## 🧪 Testes
- **Unitários/Integração:** Vitest + React Testing Library
- **E2E:** Playwright ou Cypress
- **Rodar testes:** `npx vitest run`
- Escreva testes em português nos blocos `describe` e `it`
- Nunca deixe blocos `catch` vazios — sempre use `console.error('[Módulo] Falha ao...', error)`

---

## 🏗️ Padrões de Código Sênior
- **TypeScript estrito:** sem `any`, tipos/interfaces sempre explícitos
- **SOLID:** separe controllers, services e repositories
- **Inputs validados:** use Zod ou Joi para dados externos
- **Respostas de erro:** genéricas para o cliente, detalhadas nos logs do servidor
- **Performance:** evite re-renders desnecessários (`useCallback`, `useMemo`, `memo`)
- **Acessibilidade:** Mobile First, feedback visual em todos os estados interativos (hover, focus, active, disabled)
