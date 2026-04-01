# 📐 Arquitetura Completa — Suporte chatPro

## Arquitetura Geral

```
React 18 + TypeScript 5 + Vite 5 (Frontend SPA)
        ↕ HTTPS / WebSocket
Supabase (Auth + PostgreSQL + Realtime + Storage)
        ↕
Vercel (Deploy automático branch dev)
```

---

## 1. Build & Tooling

| Ferramenta | Função |
|---|---|
| **Vite 5.1** | Bundler + dev server (HMR) |
| **Tailwind CSS 3** | Utility-first styling |
| **PostCSS** | Pipeline CSS (autoprefixer) |
| **TypeScript 5** | Tipagem estática |

**Code splitting** automático em 3 chunks vendors: `vendor-dnd`, `vendor-motion`, `vendor-supabase`.

**Scripts npm:**
- `dev` → `vite --mode development`
- `build` → `vite build --mode production`
- `prod` → `vite --mode production`

---

## 2. Entry Point & Fluxo de Boot

```
index.html → main.jsx → App.tsx
                           ↓
                    supabase.auth.getSession()
                           ↓
                    ┌─ Login.tsx (se não autenticado)
                    └─ Layout autenticado:
                        ├─ NotificationProvider (context)
                        ├─ ThemeProvider (context)
                        ├─ KanbanBoard (view principal)
                        ├─ InboxView (sidebar esquerda)
                        ├─ PlannerView (sidebar esquerda)
                        └─ BottomNav (navegação)
```

---

## 3. Componentes React

| Componente | Responsabilidade |
|---|---|
| `App.tsx` | Auth, layout, sidebar routing, contexts |
| `KanbanBoard.tsx` | Board DnD com @dnd-kit, colunas, filtros, busca |
| `Card.tsx` | Card visual com cover, tags, prioridade, badges |
| `CardDetailModal.tsx` | Modal completo: comentários, anexos, membros, @menções, etiquetas, logs |
| `InboxView.tsx` | Notificações agrupadas por data, mark read, navegação para card |
| `NotificationContext.tsx` | Context centralizado: realtime, unreadCount, markRead/markAllRead |
| `PlannerView.tsx` | Calendário por due_date |
| `PlannerSidebar.tsx` | Sidebar do planner com filtros |
| `BottomNav.tsx` | Navegação inferior (Inbox/Planner/Board) com badge |
| `Login.tsx` | Google OAuth + email/password |
| `InstanceModal.tsx` | Config de instância externa |

---

## 4. Camada de Serviços — `src/lib/supabase.ts`

**27+ funções exportadas** organizadas por domínio:

| Domínio | Funções |
|---|---|
| **Tickets** | `fetchTickets`, `insertTicket`, `updateTicket`, `deleteTicket` |
| **Comentários** | `fetchComments`, `insertComment` |
| **Anexos** | `fetchAttachments`, `uploadAttachment`, `deleteAttachment` |
| **Activity Log** | `fetchActivityLog`, `insertActivityLog` |
| **User Profiles** | `fetchAllUsers`, `upsertUserProfile`, `updateLastSeen` |
| **Board Labels** | `fetchBoardLabels`, `createBoardLabel`, `updateBoardLabel`, `deleteBoardLabel` |
| **Board Columns** | `fetchBoardColumns`, `upsertBoardColumn`, `deleteBoardColumn` |
| **Notificações** | `fetchNotifications`, `insertNotification`, `markNotificationRead`, `markAllNotificationsRead` |
| **Menções** | `extractMentionNames`, `resolveMentionsToEmails` |
| **Instance** | `fetchInstanceSettings`, `upsertInstanceSettings` |

**Tipos principais:** `Ticket`, `Notification`, `UserProfile`, `BoardLabel`, `Comment`, `Attachment`, `ActivityLog`

---

## 5. Hooks Customizados

### `useKanban(user)` — `src/hooks/useKanban.ts`

- **Estado:** tickets, loading, isConnected, refreshing, onlineUsers, customColumns, columnOrder
- **Realtime:** subscription automática no Supabase
- **Activity logging** em cada operação
- **Toast notifications**

**Constante exportada:**
```typescript
export const COLUMNS = [
  { id: 'backlog',      label: 'Backlog',          color: 'rgba(87,157,255,0.08)',  accent: '#579dff' },
  { id: 'in_progress',  label: 'Em Progresso',     color: 'rgba(87,157,255,0.08)',  accent: '#579dff' },
  { id: 'waiting_devs', label: 'Aguardando Devs',  color: 'rgba(245,166,35,0.08)',  accent: '#f5a623' },
  { id: 'resolved',     label: 'Resolvido',        color: 'rgba(75,206,151,0.08)',  accent: '#4bce97' },
]
```

### `useTheme()` — `src/lib/theme.tsx`

- 4 presets: `dark` (padrão), `darker`, `light`, `greenDark`
- Injeta CSS variables no `:root`
- `setPreset()`, `setCustomColor()`

**Interface:**
```typescript
interface ThemeConfig {
  bgPrimary, bgSecondary, bgCard, bgInput: string
  borderSubtle, textPrimary, textSecondary, textMuted: string
  accent, accentHover: string
}
```

---

## 6. Database (PostgreSQL via Supabase)

**9 tabelas** com RLS e Realtime habilitados:

```
tickets ─────┬──→ comments
             ├──→ attachments
             ├──→ activity_log
             └──→ notifications

user_profiles (autônomo, vinculado por email)
board_labels (autônomo)
board_columns (autônomo, define colunas do kanban)
instance_settings (autônomo, por email)
```

### Tabela: `tickets`

```sql
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'backlog'
    CHECK (status IN ('backlog', 'in_progress', 'waiting_devs', 'resolved')),
  priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  assignee TEXT,
  tags TEXT[] DEFAULT '{}',
  cliente TEXT DEFAULT '',
  instancia TEXT DEFAULT '',
  link_retaguarda TEXT DEFAULT '',
  link_sessao TEXT DEFAULT '',
  observacao TEXT DEFAULT '',
  due_date TEXT,
  cover_image_url TEXT,
  cover_thumb_url TEXT,
  is_completed BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- RLS, Realtime habilitados
-- Trigger: set_updated_at (auto-update updated_at)
```

### Tabela: `comments`

```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS, Realtime habilitados
```

### Tabela: `attachments`

```sql
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT DEFAULT 'file',  -- 'image', 'video', 'file'
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS, Realtime habilitados
-- Storage bucket: 'attachments' (public read)
```

### Tabela: `activity_log`

```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_name TEXT DEFAULT 'Sistema',
  action_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS, Realtime habilitados
```

### Tabela: `user_profiles`

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar_color TEXT DEFAULT '#579dff',  -- 8 cores rotativas
  role TEXT DEFAULT 'member',
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS, Realtime habilitados
```

### Tabela: `board_labels`

```sql
CREATE TABLE board_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#579dff',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- RLS habilitado
-- Trigger: atualiza updated_at automaticamente (v13)
```

### Tabela: `board_columns`

```sql
CREATE TABLE board_columns (
  id TEXT PRIMARY KEY,  -- 'backlog', 'in_progress', 'waiting_devs', 'resolved'
  title TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  dot_color TEXT DEFAULT '#579dff',
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- RLS, Realtime habilitados
-- 4 colunas padrão inseridas via seed
```

### Tabela: `notifications`

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  type TEXT DEFAULT 'mention',  -- 'mention', 'assignment', 'move', 'comment'
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  ticket_title TEXT DEFAULT '',
  message TEXT DEFAULT '',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- Index: (recipient_email, is_read, created_at DESC)
-- RLS, Realtime habilitados
```

### Tabela: `instance_settings`

```sql
CREATE TABLE instance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL UNIQUE,
  instance_code TEXT DEFAULT '',
  access_token TEXT DEFAULT '',
  api_url TEXT DEFAULT '',
  label TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- RLS habilitado
```

---

## 7. Migrations SQL (Ordem de Execução)

| # | Arquivo | Descrição |
|---|---------|-----------|
| 1 | `supabase-schema.sql` | Base: tickets com RLS, realtime, trigger updated_at |
| 2 | `supabase-migration-v2.sql` | comments, attachments, storage bucket |
| 3 | `supabase-migration-v3.sql` | activity_log |
| 4 | `supabase-migration-v4.sql` | Adiciona: cliente, instancia, links, observacao |
| 5 | `supabase-migration-v5.sql` | instance_settings table |
| 6 | `supabase-migration-v6-assignee.sql` | Garante coluna assignee |
| 7 | `supabase-migration-v7-all-columns.sql` | Garante TODAS as colunas de tickets |
| 8 | `supabase-migration-v8-user-profiles.sql` | user_profiles com avatar_color |
| 9a | `supabase-migration-v9-cover-image-url.sql` | Renomeia cover_image → cover_image_url |
| 9b | `supabase-migration-v9-cover-thumb.sql` | Adiciona cover_thumb_url |
| 10a | `supabase-migration-v10-board-labels.sql` | board_labels table |
| 10b | `supabase-migration-v10-is-completed-archived.sql` | Colunas is_completed, is_archived |
| 11 | `supabase-migration-v11-board-columns.sql` | board_columns (customizáveis) |
| 12 | `supabase-migration-v12-fix-board-columns-id.sql` | Corrige IDs para TEXT |
| 13 | `supabase-migration-v13-labels-trigger.sql` | Trigger para updated_at em board_labels |
| — | `supabase-migration-notifications.sql` | notifications table |
| — | `supabase-fix-priority.sql` | Corrige priority check constraint |
| — | `supabase-fix-description.sql` | Garante coluna description |
| — | `supabase-fix-backfill-users.sql` | Popula user_profiles de auth.users |

---

## 8. Estilos — `src/styles.css`

### Tema Dark (Trello Dark Palette)

```css
:root {
  --cp-green: #25D066;
  --cp-green2: #1BAD53;
  --cp-green3: #24FF72;
  --cp-green4: #EEFCF3;
  --cp-black: #000000;
  --cp-gray1: #D1D1D5;
  --cp-gray2: #E6E5E8;
  --cp-gray3: #F1F0F2;

  --bg-app: #1d2125;
  --bg-board: #0c1317;
  --bg-list: #101204;
  --bg-primary: #1d2125;
  --bg-secondary: #0c1317;
  --bg-card: #22272b;
  --bg-input: #22272b;
  --border-subtle: rgba(166, 197, 226, 0.16);
  --text-primary: #b6c2cf;
  --text-secondary: #9fadbc;
  --text-muted: #596773;
  --accent: #579dff;
  --accent-hover: #85b8ff;

  --float-gap: 16px;
  --float-radius: 12px;
  --float-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
```

### Classes principais

| Classe | Propósito |
|--------|-----------|
| `.mesh-bg` | Background com gradiente 135° |
| `.glass-card` | Card com border sutil |
| `.column-glass` | Coluna do kanban |
| `.ticket-card` | Card individual |
| `.inactivity-alert` | Animação pulsante (pulso vermelho) |
| `.dragging-card` | Opacity 0.85, shadow, rotate, scale durante drag |
| `.drag-over-column` | Border + background highlight durante drop |
| `.bottom-bar-outer` | Wrapper da navegação inferior |
| `.bottom-bar` | Flex row com items |
| `.nav-item` | Item de nav (Inbox, Planner, Board) |
| `.inbox-notif-item` | Item de notificação com borda azul (unread) |
| `.inbox-scroll` | Scrollbar customizada 4px |

### Animações

```css
@keyframes pulseRedBorder {
  0%, 100% { border-color: rgba(239,68,68,0.9); outline: 2px solid rgba(239,68,68,0.2); }
  50%      { border-color: rgba(239,68,68,0.4); outline: 2px solid rgba(239,68,68,0); }
}
/* Duração: 1.5s, easing: ease-in-out, infinite */
```

- **Framer Motion** para transições de cards/modais
- **GSAP** disponível mas pouco usado

---

## 9. Ambientes

|  | Desenvolvimento | Produção |
|---|---|---|
| **Branch** | `dev` | `main` |
| **Supabase Project** | `vbxzeyweurzrwppdiluo` | `qacrxpfoamarslxskcyb` |
| **Deploy** | Vercel (automático) | Vercel (automático) |
| **Detecção** | `!URL.includes('qacrx...')` | `URL.includes('qacrx...')` |

### Variáveis de ambiente

```
# .env.development
VITE_SUPABASE_URL=https://vbxzeyweurzrwppdiluo.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_ENV=development

# .env.production
VITE_SUPABASE_URL=https://qacrxpfoamarslxskcyb.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_ENV=production
```

---

## 10. Fluxo de Dados End-to-End

```
┌─────────────────────────────────────────────────────────────┐
│ BROWSER                                                      │
│                                                              │
│  Auth → getSession() → upsertUserProfile()                  │
│       → Render KanbanBoard                                   │
│                                                              │
│  Kanban: fetchTickets() → DnD → updateTicket()              │
│          + insertActivityLog() → Realtime sync               │
│                                                              │
│  Card Modal: comments + @menções + attachments               │
│    → extractMentionNames() → resolveMentionsToEmails()       │
│    → insertNotification() → Realtime → InboxView             │
│                                                              │
│  Images: Canvas compression → uploadAttachment()             │
└─────────────────────────────────────────────────────────────┘
                          ↕ HTTPS + WebSocket
┌─────────────────────────────────────────────────────────────┐
│ SUPABASE (Cloud Backend)                                    │
│                                                              │
│  Auth (Google OAuth) ↔ Database (PostgreSQL) ↔              │
│  Storage (Attachments) ↔ Realtime (Subscriptions)           │
│                                                              │
│  Tables:                                                     │
│  - tickets (main CRUD)                                       │
│  - comments, attachments, activity_log                       │
│  - user_profiles, notifications                              │
│  - board_labels, board_columns                               │
│  - instance_settings                                         │
│                                                              │
│  RLS Policies: All authenticated users read/write            │
│  Realtime: Enabled on all main tables                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Dependências Principais

| Pacote | Versão | Uso |
|---|---|---|
| `react` | 18.2 | UI framework |
| `@supabase/supabase-js` | 2.39 | Backend-as-a-Service |
| `@dnd-kit/core` | 6.1 | Drag and drop (core) |
| `@dnd-kit/sortable` | 8.0 | Drag and drop (sortable) |
| `@dnd-kit/utilities` | 3.2 | Drag and drop (utils) |
| `framer-motion` | 11.0 | Animações |
| `tailwindcss` | 3.4 | Estilos utility |
| `lucide-react` | 0.344 | Ícones SVG |
| `gsap` | 3.12 | Animações avançadas |

---

## 12. Scripts de Automação (PowerShell)

### `run-dev.ps1`
1. Adiciona Node ao PATH
2. Navega para o projeto
3. `npm install --legacy-peer-deps`
4. `npm run dev -- --host`

### `setup-and-run.ps1`
1. Instala Node.js via winget (LTS)
2. Adiciona Node ao PATH do usuário
3. Ajusta ExecutionPolicy
4. `npm install`
5. Renomeia configs para `.cjs` (ESM compat)
6. Inicia Vite dev server

---

## 13. Features Principais

1. **Kanban Board** — DnD com @dnd-kit, 4 colunas padrão + customizáveis
2. **Real-time Sync** — Supabase Realtime subscriptions em todas as tabelas
3. **Inbox/Notifications** — Menções @, assignments, moves — agrupados por data
4. **Planner/Calendar** — Visualização por data de vencimento
5. **Attachments** — Upload de imagens, vídeos, arquivos com compressão
6. **Comments** — Discussão com @menções inline e resolução automática
7. **Activity Log** — Histórico de alterações por card
8. **Theming** — 4 presets (dark, darker, light, greenDark) com CSS variables
9. **User Profiles** — Avatar com cores automáticas rotativas
10. **Instance Config** — Integração com serviços externos
11. **Archived Panel** — Cards/colunas arquivadas para restaurar
12. **Image Optimization** — Compressão com Canvas nativo (cover, thumbnail, attachment)

---

## Resumo Executivo

- **Arquitetura:** React 18 + TypeScript + Supabase + Tailwind + @dnd-kit + Framer Motion
- **Padrões:** Hooks, Context, RLS, Realtime subscriptions, Canvas image compression
- **Data Flow:** Auth → User Profile → Tickets (DnD/CRUD) → Realtime Updates → UI Sync
- **Database:** 9 tabelas normalizadas com RLS, triggers, indexes
- **Performance:** React.memo, useCallback, code splitting, lazy image compression
- **Deploy:** Vercel com auto-deploy por branch (dev → staging, main → production)
