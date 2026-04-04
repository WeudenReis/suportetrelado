# Auditoria Completa — Suporte chatPro

**Data:** 04 de Abril de 2026
**Versao:** 1.0
**Branch auditada:** `dev` (commit `935085f`)
**Autor:** Assistente de Engenharia (Claude)

---

## Sumario Executivo

O **Suporte chatPro** e um Kanban board de suporte ao cliente funcional, com visual alinhado a identidade da marca, realtime entre usuarios e drag-and-drop fluido. Porem, o projeto cresceu organicamente sem refatoracao, resultando em problemas estruturais que **impedem o escalonamento seguro para outros departamentos**.

Os pontos mais criticos sao: ausencia total de isolamento de dados entre equipes (multi-tenancy), politicas de seguranca permissivas no banco (`USING (true)`), um componente monolitico de 3.093 linhas, zero testes automatizados e zero configuracao de linting.

| Aspecto              | Score  | Bloqueante para escalonar? |
|----------------------|--------|----------------------------|
| UX / Visual          | 7/10   | Nao                        |
| Funcionalidades      | 7/10   | Nao                        |
| Type Safety          | 4/10   | Sim                        |
| Organizacao de codigo| 3/10   | Sim                        |
| Error Handling       | 3/10   | Sim                        |
| Performance          | 5/10   | Parcial                    |
| Acessibilidade       | 2/10   | Parcial                    |
| Seguranca (RLS/RBAC) | 2/10   | **Sim — Critico**          |
| Testes               | 0/10   | Sim                        |
| Multi-tenancy        | 0/10   | **Sim — Critico**          |
| CI/CD                | 0/10   | Sim                        |

---

## Metricas do Projeto

| Metrica                        | Valor                                      |
|--------------------------------|--------------------------------------------|
| Arquivos `.tsx/.ts`            | 31                                         |
| Total de linhas de codigo      | ~10.870                                    |
| Maior componente               | `KanbanBoard.tsx` — 3.093 linhas           |
| Bundle principal (gzip)        | 229 KB (chunk de 774 KB, limite: 500 KB)   |
| Testes automatizados           | 0                                          |
| ESLint / Prettier              | Nao configurado                            |
| `tsconfig.json`                | Nao existe                                 |
| Uso de `as any`                | 18 ocorrencias                             |
| `catch` vazio ou silencioso    | 4 ocorrencias                              |
| Tabelas no Supabase            | 9                                          |

---

## 1. Bugs Encontrados

### 1.1 Bug Critico: `deleteUsefulLink` nao faz nada

**Arquivo:** `src/lib/supabase.ts` (linhas 484-485)

A funcao tem o corpo vazio. O usuario clica em "excluir link" e nada acontece no banco:

```typescript
export async function deleteUsefulLink(id: string): Promise<void> {
}
```

**Impacto:** Links uteis nao podem ser deletados. O botao de exclusao em `LinksView.tsx:82` chama essa funcao, mas ela simplesmente retorna sem executar nenhuma operacao.

---

### 1.2 Bug: Tipo `Ticket` incompleto

**Arquivo:** `src/lib/supabase.ts` (linhas 23-41)

A interface `Ticket` nao inclui `is_archived`, `is_completed` e `attachment_count`, que sao campos usados extensivamente no codigo. Isso gera 18 castings `as any` espalhados:

| Arquivo                  | Linhas afetadas       |
|--------------------------|-----------------------|
| `Card.tsx`               | 224, 382, 383         |
| `DashboardView.tsx`      | 144, 257, 264         |
| `DashboardExpanded.tsx`  | 123, 162              |
| `KanbanBoard.tsx`        | 343, 347, 769, 1904-1905 |
| `useKanban.ts`           | 65, 69                |
| `CardDetailModal.tsx`    | 189, 660              |

**Impacto:** Type safety comprometida. Erros de digitacao em nomes de campo passam despercebidos pelo compilador.

---

### 1.3 Bug: Tipos duplicados e conflitantes

Existe a interface `Card` em `src/types/index.ts` e `Ticket` em `src/lib/supabase.ts` representando a mesma entidade com campos diferentes. O tipo `Card` de `types/index.ts` nao e importado em nenhum lugar do codigo — e codigo morto.

---

## 2. Seguranca

### 2.1 CRITICO: Chaves de API hardcoded no codigo-fonte

**Arquivo:** `src/lib/supabase.ts` (linhas 6-9)

```typescript
const PROD_URL = 'https://qacrxpfoamarslxskcyb.supabase.co'
const PROD_KEY = 'sb_publishable_Qc_kigRTle0uzM6LAsLHbQ_XuBHWJV3'
const DEV_URL = 'https://vbxzeyweurzrwppdiluo.supabase.co'
const DEV_KEY = 'sb_publishable_03VCMlD83Jf9fsXJB97Ccw_QEYH_4Ps'
```

Embora sejam chaves `anon` (publicas por design do Supabase), a URL de producao e de dev estao expostas no repositorio. O `CLAUDE.md` do proprio projeto determina: *"Nunca hardcode chaves, URLs ou tokens no codigo"*. Essas devem vir de variaveis de ambiente (`.env`).

---

### 2.2 CRITICO: Politicas RLS permissivas

**Arquivo:** `supabase-setup-dev-completo.sql` (linhas 20-34)

```sql
CREATE POLICY "tickets_select" ON public.tickets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "tickets_insert" ON public.tickets
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "tickets_update" ON public.tickets
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "tickets_delete" ON public.tickets
  FOR DELETE TO authenticated USING (true);
```

`USING (true)` significa que **qualquer usuario autenticado pode ler, criar, editar e deletar TODOS os tickets** de todas as equipes. Isso se repete para todas as 9 tabelas.

**Risco:** Se o sistema for escalado para outros departamentos, um usuario do Departamento A vera e podera modificar todos os tickets do Departamento B.

---

### 2.3 ALTO: Zero controle de acesso por role no frontend

O campo `role` existe em `UserProfile` (`src/lib/supabase.ts:290`) mas e **apenas decorativo** — exibido como badge "Admin" no painel de membros (`KanbanBoard.tsx:1277`).

Nao ha nenhum `if (role === 'admin')` protegendo acoes destrutivas como:

- Deletar tickets
- Arquivar colunas inteiras
- Gerenciar etiquetas globais
- Criar/editar avisos (announcements)
- Configurar instancias de API
- Qualquer operacao administrativa

---

### 2.4 MEDIO: Bucket de attachments publico

O bucket `attachments` no Supabase Storage esta configurado como "public read". Qualquer pessoa com a URL pode acessar arquivos anexados aos tickets, sem autenticacao.

**Recomendacao:** Usar URLs assinadas (Signed URLs) com expiracao, ou restringir o bucket com politicas de Storage vinculadas ao RLS.

---

## 3. Arquitetura

### 3.1 CRITICO: KanbanBoard.tsx — Componente "God Object" (3.093 linhas)

Este arquivo sozinho concentra **mais de 60 estados** (`useState`) e pelo menos **18 responsabilidades distintas**:

1. Drag & drop (dnd-kit)
2. CRUD de tickets
3. Gerenciamento de colunas (criar, renomear, arquivar, reordenar)
4. Logica de filtros e busca
5. Operacoes em massa (bulk select, move, archive)
6. Atalhos de teclado
7. Regras automaticas (auto-rules)
8. Gerenciamento de wallpaper
9. Gerenciamento de templates
10. Troca de tema
11. Alternancia de view mode (kanban/lista)
12. Painel de configuracoes
13. Gerenciamento de etiquetas
14. Tracking de presenca (usuarios online)
15. Subscricao realtime
16. Gerenciamento de modais
17. Toast notifications
18. Export CSV/Import

**Impacto:** Qualquer mudanca em qualquer funcionalidade pode causar re-renders do board inteiro. Manutencao e extremamente dificil. Novos desenvolvedores levarao tempo significativo para entender o arquivo.

---

### 3.2 ALTO: Sem camada de servico / separacao de concerns

`src/lib/supabase.ts` e o unico arquivo que faz queries (552 linhas, 27+ funcoes), misturando:

- Definicao de tipos e interfaces
- Criacao do client Supabase
- Funcoes CRUD para 9 tabelas diferentes
- Logica de resolucao de mencoes (@usuario)
- Logica de perfil de usuario
- Logica de deteccao de ambiente

Alem disso, `Card.tsx` faz **chamadas diretas ao Supabase** (linhas 127, 161, 203) duplicando a camada centralizada:

```typescript
// Card.tsx:127 — chamada direta, fora do supabase.ts
const { error } = await supabase
  .from('tickets')
  .update({ is_completed: !card.is_completed })
  .eq('id', card.id)
```

---

### 3.3 ALTO: Sem code-splitting / lazy loading

Todas as views sao importadas estaticamente em `App.tsx` (linhas 10-17):

```typescript
import Login from './components/Login'
import KanbanBoard from './components/KanbanBoard'
import InboxSidebar from './components/InboxView'
import PlannerView from './components/PlannerView'
// ... todas carregadas no bundle inicial
```

Resultado: **774 KB em um unico chunk** (acima do limite recomendado de 500 KB). Nao existe nenhum uso de `React.lazy` ou `Suspense` no projeto.

---

### 3.4 MEDIO: Entry point em `.jsx` dentro de projeto TypeScript

`src/main.jsx` usa extensao `.jsx` em um projeto que usa `.tsx` em todo o resto. Alem disso, **nao existe `tsconfig.json`** na raiz — TypeScript roda com defaults implicitos do Vite, sem `strict: true`, sem `noImplicitAny`.

---

### 3.5 BAIXO: Dois arquivos de client Supabase

Existe `src/supabaseClient.js` (411 bytes) alem do `src/lib/supabase.ts`. Provavel codigo legado morto que deve ser removido.

---

### 3.6 MEDIO: Templates e auto-rules no localStorage

Regras automaticas e templates de tickets sao salvos no `localStorage` do navegador (`KanbanBoard.tsx:129-158`):

```typescript
function loadTemplates(): TicketTemplate[] {
  const raw = localStorage.getItem('chatpro-templates')
  return raw ? JSON.parse(raw) : []
}
```

**Impacto:** Esses dados ficam apenas na maquina do usuario. Se ele trocar de computador ou limpar o cache, perde tudo. Outros membros da equipe nao tem acesso as mesmas regras/templates.

---

## 4. Qualidade de Codigo

### 4.1 TypeScript sem configuracao

Sem `tsconfig.json`, nao ha `strict: true`, `noImplicitAny`, nem `strictNullChecks`. Isso permite que `as any` e erros de tipo passem sem aviso durante o build.

---

### 4.2 Zero testes automatizados

Nenhum arquivo `.test.ts`, `.test.tsx`, `.spec.ts` encontrado no projeto. O `CLAUDE.md` menciona Vitest + React Testing Library + Playwright, mas nada foi implementado.

**Risco:** Qualquer refatoracao (especialmente a decomposicao do KanbanBoard) pode introduzir regressoes sem deteccao.

---

### 4.3 Zero linting

Sem `.eslintrc`, `.prettierrc`, ou qualquer ferramenta de qualidade de codigo configurada. Nao ha padrao de formatacao enforced.

---

### 4.4 Catch blocks problematicos

| Tipo                        | Ocorrencias | Arquivos                              |
|-----------------------------|-------------|---------------------------------------|
| `catch (err: any)`          | 3           | KanbanBoard.tsx:715,728; InstanceModal.tsx:139 |
| `.catch(() => {})`          | 2           | KanbanBoard.tsx:693, 1576             |
| `catch { /* ignore */ }`    | 1           | supabase.ts:259                       |
| `.catch(console.error)` sem feedback | 6+ | Varios arquivos                       |

**Impacto:** Erros sao silenciados. O usuario clica em algo, nada acontece, e nao recebe nenhum feedback sobre o que deu errado.

---

### 4.5 Estilos inconsistentes (4 abordagens diferentes)

| Abordagem      | Uso estimado | Exemplos                                |
|----------------|--------------|----------------------------------------|
| Inline styles  | ~80%         | App.tsx (toast inteiro), NotificationCard |
| Tailwind CSS   | ~10%         | Classes utilitarias esparsas            |
| CSS Modules    | ~5%          | Card.module.css, ArchivedPanel.module.css |
| CSS Global     | ~5%          | styles.css (42.647 linhas)              |

A cor `#25D066` aparece **100+ vezes hardcoded** em inline styles ao inves de usar a CSS variable `--accent` ou similar.

Border-radius inconsistente: 6px, 8px, 10px, 12px, 14px e 16px sao usados sem um padrao definido.

---

## 5. UI/UX — Analise de Usabilidade

### 5.1 Pontos Positivos

- Navegacao bottom-nav com animacoes GSAP suaves e intuitivas
- Dark theme bem aplicado com a identidade visual chatPro
- Toast de notificacoes com feedback visual imediato
- Drag & drop funcional e responsivo com dnd-kit
- Realtime via Supabase (mudancas refletem entre usuarios)
- Empty states informativos na Inbox (por tipo de filtro)
- Badges animados com contagem de notificacoes
- Grouping de notificacoes por data (Hoje, Ontem, Esta semana)

---

### 5.2 Problemas de Usabilidade

| Problema | Impacto | Local |
|----------|---------|-------|
| KanbanBoard concentra todas as config em dropdowns aninhados | Usuario se perde em menus dentro de menus | KanbanBoard.tsx settings |
| Sem onboarding / tutorial para novos usuarios | Novos departamentos nao saberao usar a ferramenta | Global |
| Sidebar fixa em 520px | Em telas menores que 1200px, esmaga o board | App.tsx:130 |
| Sem feedback de loading nos saves | Usuario nao sabe se a acao foi processada | Todas as mutacoes |
| Busca apenas por titulo | Deveria buscar por descricao, cliente, instancia | KanbanBoard.tsx |
| Filtros nao persistem | Ao trocar de aba e voltar, filtros resetam | KanbanBoard.tsx |
| Sem paginacao | `fetchTickets()` busca TODOS os tickets nao-arquivados | supabase.ts:127-135 |
| Dashboard nao e responsivo | Grid de 2 colunas fixo, sem media queries | DashboardView.tsx:391 |
| Planner nao e mobile-friendly | Calendario com celulas fixas, texto 12px | PlannerView.tsx:99 |
| Touch targets pequenos | Alguns botoes menores que 28x28px (minimo recomendado: 44x44px) | Varios |

---

### 5.3 Estados Faltantes por Componente

| Componente        | Loading          | Empty              | Error            |
|-------------------|------------------|--------------------|------------------|
| InboxView         | Clock + texto    | EmptyState por filtro | Nao tem        |
| DashboardView     | Spinner          | Mostra metricas zeradas | Console.log  |
| AnnouncementsView | Spinner          | Icone + mensagem   | Nao tem          |
| LinksView         | Spinner          | Icone + mensagem   | Nao tem          |
| PlannerSidebar    | Nao tem          | Texto simples      | Nao tem          |
| ArchivedPanel     | Texto simples    | Texto simples      | Nao tem          |
| KanbanBoard       | Nao tem skeleton | N/A                | Toast generico   |
| CardDetailModal   | Nao tem          | N/A                | Parcial          |

---

## 6. Acessibilidade (WCAG 2.1 AA)

### 6.1 Problemas Criticos

| Categoria                    | Qtd  | Exemplos                                    |
|------------------------------|------|---------------------------------------------|
| `aria-label` ausente         | 20+  | Botoes de icone no header do KanbanBoard    |
| `role` ausente               | 15+  | Dropdowns, modais, paineis                  |
| Focus trap ausente em modais | 5+   | CardDetailModal, InstanceModal, PlannerEvent|
| Indicacao apenas por cor     | 3+   | Badges de prioridade, status de coluna      |
| Labels de formulario ausentes| 8+   | Campos de input em modais                   |
| Navegacao por teclado        | 10+  | Selecoes em dropdowns nao navegaveis        |

### 6.2 Problemas Moderados

- Contraste insuficiente em algumas combinacoes (texto cinza sobre fundo escuro)
- Animacoes em todas as notificacoes sem suporte a `prefers-reduced-motion`
- Elementos interativos usando `<div>` ao inves de `<button>` ou `<a>`
- Tabs da Inbox sem `aria-selected` no tab ativo

### 6.3 Problemas Menores

- Icones SVG sem `<title>` em alguns componentes
- Labels flutuantes com tamanho de fonte inconsistente

---

## 7. Performance

### 7.1 Bundle Size

| Chunk                  | Tamanho | Gzip    |
|------------------------|---------|---------|
| `index` (principal)    | 774 KB  | 229 KB  |
| `html2canvas`          | 201 KB  | 48 KB   |
| `vendor-supabase`      | 193 KB  | 50 KB   |
| `vendor-dnd`           | 183 KB  | 59 KB   |
| `vendor-motion`        | 122 KB  | 40 KB   |
| `index.es`             | 150 KB  | 51 KB   |
| CSS                    | 57 KB   | 12 KB   |

**Observacao:** Duas bibliotecas de animacao (Framer Motion + GSAP) fazendo trabalho similar, contribuindo para o bloat do bundle.

### 7.2 Problemas de Render

| Problema | Local | Impacto |
|----------|-------|---------|
| 60+ `useState` em KanbanBoard | linhas 170-229 | Board inteiro re-renderiza em qualquer mudanca |
| Sem `useMemo` para listas computadas | linhas 498-521 | Calculo O(n^2) a cada render |
| Updates realtime nao agrupados | linhas 331-353 | Cada update dispara render completo |
| Modal remonta a cada ticket selecionado | CardDetailModal | Perde scroll position |
| Sem debounce na busca | KanbanBoard.tsx | Re-render a cada caractere digitado |

### 7.3 Problemas de Rede

| Problema | Impacto |
|----------|---------|
| 3 requests separados ao abrir modal (comments + attachments + activity_log) | Waterfall de requests |
| `fetchTickets()` busca TODOS os registros sem paginacao | Lentidao com volume alto |
| `fetchAttachmentCounts()` busca todos os attachment IDs para contar no cliente | Deveria usar COUNT no banco |
| Subscricao realtime sem filtro — recebe TODAS as mudancas de tickets | Bandwidth desnecessaria |

### 7.4 Indexes Ausentes no Banco

| Coluna                        | Tabela        | Operacao      |
|-------------------------------|---------------|---------------|
| `status`                      | tickets       | Filtro        |
| `created_at`                  | tickets       | Ordenacao     |
| `is_archived`                 | tickets       | Filtro        |
| `recipient_email`             | notifications | Filtro        |
| `ticket_id`                   | comments      | Join/Filtro   |
| `ticket_id`                   | attachments   | Join/Filtro   |
| `card_id`                     | activity_log  | Join/Filtro   |

---

## 8. Escalabilidade — Barreiras para Multi-departamento

### 8.1 O que Falta

| Requisito                    | Estado Atual                                          |
|------------------------------|-------------------------------------------------------|
| Multi-tenancy / Departamentos| Inexistente (campo `instancia` existe mas nao filtra) |
| RLS no Supabase              | Politicas `USING (true)` — sem isolamento             |
| RBAC (Role-Based Access)     | Campo `role` decorativo, sem enforcement              |
| Paginacao                    | Busca todos os registros sem limite                   |
| Code-splitting               | Zero — bundle monolitico                              |
| Testes                       | Zero cobertura                                        |
| CI/CD pipeline               | Sem GitHub Actions, lint ou checks automatizados      |
| Internacionalizacao          | Strings hardcoded em portugues                        |
| Audit trail controlado       | `activity_log` existe mas sem controle de quem ve     |
| Rate limiting                | Sem protecao contra spam de requests                  |
| API middleware                | Frontend chama Supabase diretamente                   |

### 8.2 Modelo de Dados Atual vs Necessario

**Atual:**
```
tickets: id, title, status, priority, assignee, instancia (texto livre)
user_profiles: id, email, name, role (string generico)
```

**Necessario para multi-departamento:**
```
organizations: id, name, slug
departments: id, organization_id, name
user_profiles: id, email, name, role, department_id (FK)
tickets: id, title, status, priority, assignee, department_id (FK)
-- Todas as tabelas com department_id para isolamento via RLS
```

---

## 9. Roadmap — Proximas Etapas

### Fase 1 — Fundacao (Corrigir antes de escalonar)

| # | Tarefa | Prioridade |
|---|--------|------------|
| 1 | Corrigir bug `deleteUsefulLink` — corpo vazio | Critica |
| 2 | Completar tipo `Ticket` — adicionar `is_archived`, `is_completed`, `attachment_count` e eliminar todos `as any` | Critica |
| 3 | Criar `tsconfig.json` com `strict: true` | Critica |
| 4 | Mover chaves para `.env` — remover hardcode de URLs/keys | Critica |
| 5 | Configurar ESLint + Prettier | Alta |
| 6 | Remover codigo morto — `types/index.ts` (Card), `supabaseClient.js`, renomear `main.jsx` para `main.tsx` | Media |

### Fase 2 — Arquitetura (Preparar para escala)

| # | Tarefa | Prioridade |
|---|--------|------------|
| 7 | Decompor `KanbanBoard.tsx` em 8-10 componentes focados | Critica |
| 8 | Implementar code-splitting com `React.lazy` + `Suspense` | Alta |
| 9 | Separar `supabase.ts` em modulos: `api/tickets.ts`, `api/labels.ts`, etc. | Alta |
| 10 | Mover templates e auto-rules para o banco (sair do localStorage) | Media |
| 11 | Centralizar chamadas diretas do Supabase em `Card.tsx` | Media |
| 12 | Padronizar estilos — migrar para uma abordagem unica (Tailwind + design tokens) | Media |

### Fase 3 — Seguranca e Multi-tenancy

| # | Tarefa | Prioridade |
|---|--------|------------|
| 13 | Criar tabelas `organizations` e `departments` | Critica |
| 14 | Adicionar `department_id` em todas as tabelas de negocio | Critica |
| 15 | Implementar RLS no Supabase com isolamento por departamento | Critica |
| 16 | Implementar RBAC — `admin`, `supervisor`, `agent` com permissoes | Critica |
| 17 | Adicionar paginacao em `fetchTickets` e `fetchNotifications` | Alta |
| 18 | Restringir bucket de attachments — URLs assinadas | Alta |
| 19 | Adicionar indexes nas colunas de consulta frequente | Alta |
| 20 | Filtrar subscricoes realtime por departamento | Media |

### Fase 4 — Qualidade e Produtizacao

| # | Tarefa | Prioridade |
|---|--------|------------|
| 21 | Escrever testes — comecar pelos fluxos criticos (criar, mover, arquivar ticket) | Alta |
| 22 | Configurar CI/CD — GitHub Actions com lint + type-check + tests + build | Alta |
| 23 | Adicionar Error Boundaries globais | Alta |
| 24 | Implementar feedback de loading em todas as mutacoes | Media |
| 25 | Adicionar onboarding — tooltip tour para novos usuarios | Media |
| 26 | Implementar busca avançada — full-text search no Supabase | Media |
| 27 | Adicionar `prefers-reduced-motion` nas animacoes | Media |
| 28 | Adicionar atributos ARIA e navegacao por teclado | Media |
| 29 | Implementar metricas e observabilidade (Sentry, logging estruturado) | Media |
| 30 | Remover GSAP ou Framer Motion (manter apenas uma biblioteca de animacao) | Baixa |

---

## Apendice A — Arquivos Criticos Referenciados

| Arquivo | Linhas | Funcao |
|---------|--------|--------|
| `src/components/KanbanBoard.tsx` | 3.093 | Core do Kanban (God Component) |
| `src/components/CardDetailModal.tsx` | 1.137 | Modal de edicao de tickets |
| `src/components/DashboardExpanded.tsx` | 774 | Dashboard expandido |
| `src/components/DashboardView.tsx` | 733 | Dashboard principal |
| `src/lib/supabase.ts` | 552 | Camada de dados (27+ funcoes) |
| `src/components/PlannerSidebar.tsx` | 474 | Planejador com calendario |
| `src/components/AnnouncementsView.tsx` | 464 | Painel de avisos |
| `src/components/Card.tsx` | 461 | Componente de card individual |
| `src/styles.css` | 42.647 | Estilos globais |
| `src/App.tsx` | 377 | Root, auth, routing |

## Apendice B — Dependencias do Projeto

| Pacote | Versao | Necessidade | Observacao |
|--------|--------|-------------|------------|
| `react` | 18.2 | Essencial | Framework principal |
| `@supabase/supabase-js` | 2.39 | Essencial | Backend |
| `@dnd-kit/*` | 6.1/8.0/3.2 | Essencial | Drag & drop |
| `framer-motion` | 11.0 | Alta | Animacoes (duplica com GSAP) |
| `gsap` | 3.14.2 | Baixa | Usado apenas para sidebar slide |
| `lucide-react` | 0.344 | Alta | Icones |
| `tailwindcss` | 3.4.1 | Alta | Estilos (subutilizado) |
| `jspdf` | 4.2.1 | Media | Export PDF no dashboard |
| `clsx` | 2.1 | Media | Merge de classes |
| `tailwind-merge` | 2.2 | Baixa | Merge de classes Tailwind |
| `sharp` | 0.34.5 | Baixa | Compressao de imagem (dev only) |

---

*Documento gerado a partir de auditoria automatizada do codigo-fonte, migrations SQL e configuracoes do projeto.*
