## Projeto: Suporte chatPro (Kanban Board)

### Regras Gerais
- Responda sempre em **português brasileiro**
- Commits vão apenas para a branch `dev` — nunca merge para `main` sem autorização
- Use TypeScript com tipos explícitos
- Teste builds com `npx vite build` antes de commitar
- Commits em português com prefixos: feat:, fix:, refactor:, style:, chore:

### Ambientes
- **Produção**: Supabase `qacrxpfoamarslxskcyb`, branch `main`
- **Desenvolvimento**: Supabase `vbxzeyweurzrwppdiluo`, branch `dev`
- Detecção: `VITE_SUPABASE_URL.includes('qacrxpfoamarslxskcyb')` = prod

### Stack
- React 18, TypeScript 5, Vite 5.1
- Supabase (Postgres, Auth Google, Storage, Realtime)
- Tailwind CSS + CSS puro (src/styles.css)
- dnd-kit, GSAP, Framer Motion, Lucide React

### Padrões de código
- Funções Supabase em `src/lib/supabase.ts`
- Componentes em `src/components/`
- Migrations SQL na raiz: `supabase-migration-*.sql`
- Dark theme: #1d2125, #22272b, #579dff, #b6c2cf
