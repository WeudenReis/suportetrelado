# CHANGES.md — Registro de Alterações

## BUG 1 — Botão "Adicionar Cartão" sempre visível
- Layout das colunas corrigido com `flex-direction: column` e `max-height` usando `calc(100vh - 140px)`
- Área de cards usa `flex: 1 1 auto; overflow-y: auto` com scrollbar fina
- Footer (botão "Adicionar um cartão") usa `flex: 0 0 auto` — nunca é empurrado para fora da tela
- Classes CSS: `.trello-col`, `.trello-col__cards`, `.trello-col__footer`

## BUG 2 — Painel de Aparência: Remover Tema, Manter Apenas Fundos
- Seção de temas (presets de cores) removida do painel de configurações
- Mantidas apenas 4 opções de fundo de tela (wallpaper):
  - Oceano (gradiente azul)
  - Grafite (gradiente cinza escuro)
  - Floresta (verde sólido)
  - Vinho (vermelho escuro sólido)
- Upload de imagem personalizada e input de URL mantidos

## BUG 3 — Performance
- Componente `Card` envolvido com `React.memo` para evitar re-renders desnecessários
- Removido `framer-motion` (`<motion.div>`) do componente Card — agora usa `<div>` simples
- Removida animação staggered (escalonada) de entrada das colunas — colunas renderizam instantaneamente
- `AnimatePresence` removido da lista de cards dentro das colunas
- Botões `motion.button` substituídos por `<button>` padrão
- `transition: all` substituído por propriedades específicas (`border-color`, `box-shadow`) no CSS
- `handleCardClick` envolvido com `useCallback` para estabilidade de referência

## BUG 4 — Remover Integração com Slack
- Função `sendToSlack` removida de `src/lib/supabase.ts`
- Botão "Enviar para Slack" removido do componente Card
- Props `onSendToSlack` e `slackSending` removidas da interface do Card
- Login com Slack (OAuth) removido de `src/components/Login.tsx` (componente SlackLogo, handler, botão, estado)
- 'Slack' removido do array INTEGRATIONS em `src/components/Sidebar.tsx`
- Referências a Slack removidas de `KanbanBoard.tsx` (handler, estado, import)
- Arquivos deletados: `diagnose-slack.js`, `test-slack.js`
- Arquivos legados deletados: `src/App.jsx`, `src/Card.tsx`, `src/KanbanBoard.tsx`, `src/ui-components.jsx`

## BUG 5 — Drag and Drop: Indicador Visual
- Adicionado indicador visual azul (linha de 2px) que aparece entre os cards durante o arrasto
- Estado `overCardId` adicionado para rastrear qual card está sendo sobrevoado
- Classe CSS `.dnd-drop-indicator` com cor `#3b82f6`, `box-shadow` brilhante e bordas arredondadas
- Indicador é exibido apenas quando o card arrastado está sobre outro card diferente

## FEATURE — Imagem de Capa nos Cartões
- Campo `cover_image?: string | null` adicionado à interface `Ticket` em `supabase.ts`
- Componente Card renderiza imagem de capa no topo (`<div className="card-cover">`)
- CSS `.card-cover` com altura fixa de 160px, `object-fit: cover`, bordas arredondadas no topo
- CardDetailModal: banner de capa exibido no topo do modal quando imagem existe
- Botões "Alterar capa" e "Remover" sobrepostos na capa
- Botão "Capa" adicionado à barra de ações quando não há capa
- Upload de capa reutiliza `uploadAttachment` do Supabase Storage
- Remoção de capa salva `cover_image: null` no banco
