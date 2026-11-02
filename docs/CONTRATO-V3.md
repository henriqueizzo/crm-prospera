# Contrato da versão 3 — Próspera CRM

Leia tudo antes de codar. Cada agente edita SOMENTE os arquivos de que é dono.
Nunca edite arquivo de outro agente. Se precisar de algo que não está aqui,
implemente como função/componente LOCAL dentro do seu arquivo, sem mudar o contrato.
Não rode `python build.py` nem mexa em `index.html`: o coordenador faz a junção.

## 1. Arquivos e donos

| Arquivo | Conteúdo | Dono |
|---|---|---|
| src/_head.html | `<head>`, Tailwind config, CSS global | H |
| src/01-core.js | constantes, helpers, REGRAS DE DOMÍNIO v3 | A |
| src/02-icons.jsx | ícones `I.*` | A |
| src/03-modules-seed.js | módulos nativos + dados de exemplo | A |
| src/04-storage.js | persistência (módulos e settings), hydrate, backup, estilos `btn`/`inputCls` | A |
| src/05-ui.jsx | componentes compartilhados (JÁ PRONTOS) | H (só polimento visual; props não mudam) |
| src/06-app.jsx | `ProsperaCRM` (raiz, estado, fluxos) | B |
| src/07-sidebar.jsx | `Sidebar`, `FilterChip` | B |
| src/16-stage-modals.jsx | `StageGateModal`, `LossReasonModal` (NOVO) | B |
| src/08-dashboard.jsx | `KpiCard`, `Dashboard` | C |
| src/17-reports.jsx | `Reports` (NOVO) | C |
| src/09-table.jsx | `ClientsTable` | D |
| src/10-funnel.jsx | `Funnel` | D |
| src/11-drawer.jsx | `ClientDrawer`, `ItemCard`, `FieldInput`, `ContactRow`, `TemplatePicker` | E |
| src/12-form.jsx | `ClientForm` | F |
| src/18-proposal.jsx | `ProposalModal` (NOVO) | F |
| src/13-modules-ui.jsx | `Modal`, `ModuleManager`, `ModuleBuilder` | H |
| src/14-settings.jsx | `SettingsModal` | G |
| src/15-feedback.jsx | `ConfirmDialog`, `Toasts` | H |
| src/99-mount.jsx | montagem | coordenador |

`python build.py` concatena `_head.html` + todos os `NN-*.js(x)` (ordem numérica) dentro de UM
único `<script type="text/babel" data-type="module">` + `_tail.html`. Consequências:
- Tudo compartilha o mesmo escopo: `function X()` declarada em qualquer arquivo é visível em todos.
- `const` de nível superior também é visível, mas só use-a DENTRO de funções/componentes
  (em tempo de execução), nunca no nível superior de um arquivo de número menor.
- Nomes globais são únicos: não redeclare `function`/`const` que já existam em outro arquivo.
  Prefixe helpers locais com o nome do seu componente (ex.: `reportsGroupBy`).
- Não existe `import`/`export`. Não adicione bibliotecas de CDN. Só React 18, Tailwind CDN e Babel.

## 2. Modelo de dados

### 2.1 Cliente (`hydrateClient` garante todos os campos com default)
```js
{
  id, nome, telefone, email, empresa, status /* "lead"|"negociacao"|"fechado"|"perdido" */, obs,
  origem: "",         // id de settings.origens ou ""
  responsavel: "",    // id de settings.vendedores ou ""
  porte: "",          // "" | "mei" | "pequena" | "media" | "grande"
  interesse: "",      // "" | "baixo" | "medio" | "alto"
  motivoPerda: "",    // id de settings.motivosPerda (preenchido ao mover para "perdido")
  motivoPerdaObs: "", // texto livre opcional
  stageLog: [{ status, at /* ISO */ }],  // cronológico; ÚLTIMO = etapa atual. hydrate: [{status: c.status, at: c.createdAt}]
  comments: [{ id, at, text, autor }],   // notas manuais; mais recente primeiro
  items: [...], tasks: [{ id, titulo, data /* "YYYY-MM-DD" ou "" */, feito, auto? }], history: [{ id, at, text }],
  createdAt, updatedAt
}
```
Constantes em core (A):
- `PORTES = [{key:"mei",label:"MEI / autônomo"},{key:"pequena",label:"Pequena (até 50 func.)"},{key:"media",label:"Média (51 a 250)"},{key:"grande",label:"Grande (250+)"}]`
- `INTERESSES = [{key:"baixo",label:"Baixo",color:"#64748B",soft:"#F1F5F9",text:"#475569"},{key:"medio",label:"Médio",color:"#D97706",soft:"#FEF3C7",text:"#92400E"},{key:"alto",label:"Alto",color:"#047857",soft:"#E6F6EE",text:"#065F46"}]`
- `SCORE_LEVELS = { alta:{key:"alta",label:"Alta",color:"#C2410C",soft:"#FFEDD5",text:"#9A3412"}, media:{key:"media",label:"Média",color:"#D97706",soft:"#FEF3C7",text:"#92400E"}, baixa:{key:"baixa",label:"Baixa",color:"#64748B",soft:"#F1F5F9",text:"#475569"} }`
- `SLA_TONES = { ok:{color:"#64748B",soft:"#F1F5F9",text:"#475569"}, warn:{color:"#D97706",soft:"#FEF3C7",text:"#92400E"}, late:{color:"#DC2626",soft:"#FEE2E2",text:"#991B1B"} }`
- `REQUIRED_FIELD_KEYS = [{key:"empresa",label:"Empresa"},{key:"telefone",label:"Telefone"},{key:"email",label:"E-mail"},{key:"origem",label:"Origem"},{key:"responsavel",label:"Responsável"},{key:"porte",label:"Porte"},{key:"interesse",label:"Interesse"},{key:"valor",label:"Valor (ao menos um item com valor)"},{key:"itens",label:"Ao menos um item"}]`
- `VIEW_HASH` ganha `relatorios: "relatorios"`.

### 2.2 Settings (GLOBAL, chave localStorage `prospera_crm_settings_v3`)
```js
{
  usuarioAtual: "",                         // id do vendedor "eu"; "" = não definido
  vendedores: [{ id, nome, metaMensal }],   // metaMensal em R$ (valor fechado no mês)
  origens: [{ id, label }],                 // ids: indicacao, site, instagram, whatsapp, evento, prospeccao, parceiro, outro
  motivosPerda: [{ id, label }],            // ids: preco, concorrente, sem_resposta, sem_orcamento, momento, sem_fit, outro
  sla: { lead: 7, negociacao: 15, fechado: 0, perdido: 0 },   // dias; 0 = sem prazo
  required: { lead: [], negociacao: ["telefone","responsavel"], fechado: ["telefone","email","responsavel","valor"], perdido: [] },
  scoring: { porte: {mei:5,pequena:10,media:20,grande:30}, interesse: {baixo:0,medio:15,alto:30},
             porItem: 5 /* por item, conta no máx. 3 */, contatoCompleto: 10 /* telefone E e-mail */,
             origem: { indicacao: 15, parceiro: 10 }, limites: { alta: 60, media: 30 } },
  automations: [{ id, nome, ativo: true,
                  trigger: { type: "enter_stage", status: "negociacao" } | { type: "client_created" },
                  action: { type: "create_tasks", tasks: [{ titulo, dias }] } }],
  templates: [{ id, nome, canal: "whatsapp"|"email", assunto: "", texto: "" }],
}
```
Defaults (A): vendedores de exemplo `{id:"ana", nome:"Ana Ribeiro", metaMensal:60000}` e `{id:"carlos", nome:"Carlos Mendes", metaMensal:45000}`;
origens e motivos acima; 3 automações (cadastro → "Fazer primeiro contato" em 1 dia; entrar em negociação → "Cobrar retorno da proposta" em 3 dias;
entrar em fechado → checklist de implantação: "Enviar contrato assinado para o cadastro" 1d, "Agendar onboarding do cliente" 3d,
"Confirmar primeira utilização" 15d); 4 modelos (WhatsApp: primeiro contato, follow-up de proposta; e-mail: envio de proposta, boas-vindas).
Variáveis dos modelos: `{nome} {primeiro_nome} {empresa} {vendedor} {modulo} {valor} {itens}`.

## 3. API do core (A implementa; todos usam). Assinaturas são fixas.
```js
DEFAULT_SETTINGS                                  // const
hydrateSettings(s) -> settings                     // merge com defaults, arrays validados
loadSettings() -> settings ; saveSettings(s) -> bool ; clearSavedSettings()
vendedorNome(settings, id) -> string ("" se não achar)
origemLabel(settings, id) -> string ; motivoLabel(settings, id) -> string
porteLabel(key) -> string ; interesseMeta(key) -> {key,label,color,soft,text} | null
stageEnteredAt(c) -> ISO ; daysInStage(c) -> int (>= 0)
slaStatus(settings, c) -> { days, limit, state: "none"|"ok"|"warn"|"late", label }
   // none: limite 0 ou etapa fechado/perdido. warn: days >= limit*0.7. late: days > limit. label ex.: "12 dias na etapa"
scoreClient(settings, mod, c) -> { points /*0..100*/, level: "alta"|"media"|"baixa", label }
missingForStage(settings, mod, c, status) -> [{ key, label }]   // usa settings.required[status]
findDuplicates(clients, { nome, telefone, email, empresa }, excludeId) -> [{ client, campo }]
   // telefone: mesmos dígitos (>=10); email: lowercase; empresa/nome: normalizado (lowercase, sem acento, trim)
runAutomations(settings, mod, client, event) -> { client, created: [titulo] }
   // event: {type:"enter_stage", status} | {type:"client_created"}; adiciona tasks {auto:true}; não duplica título pendente
templateContext(settings, mod, c) -> { nome, primeiro_nome, empresa, vendedor, modulo, valor, itens }
renderTemplate(texto, ctx) -> string
closedAt(c) -> ISO | null ; stageDurations(c) -> [{ status, from, to, days }]  // to = agora para a atual
isSameMonth(iso, ref = new Date()) -> bool
serializeBackup(modules, settings) -> string JSON  { app:"prospera-crm", version:3, exportedAt, modules, settings }
parseBackup(parsed) -> { modules, settings|null }   // aceita array v2 ou objeto v3; lança Error("formato")
// já existentes e mantidos: BRL, uid, todayISO, daysFromNow, nowISO, fmtDate, fmtDateTime, relTime, daysUntil, isOverdue,
// maskPhone, isEmail, onlyDigits, downloadFile, csvCell, initials, avatarColor, statusMeta, STATUSES, clientValue, itemValue,
// itemTitle, newItem, pendingTasks, overdueTasks, hydrateClient, hydrateModule, loadModules, saveModules, clearSavedModules
```
Ícones novos em `I` (A): `Note, FileText, Zap, BarChart, Copy, Printer, Timer, User, Star, Send, Sparkles, Tag, Flame, Lightbulb, Eye, Layers, Rocket, HelpCircle, Flag, ArrowRight, TrendingDown, Shield, Settings2`.
(SVGs estilo Lucide 24x24, stroke 2.)

## 4. Componentes compartilhados (05-ui.jsx, já implementados)
```jsx
<SlaBadge settings client size="sm"|"xs" hideOk />            // null se state none (ou ok com hideOk)
<ScoreBadge settings mod client size="sm"|"xs" showPoints />  // pill Alta/Média/Baixa
<OwnerChip settings id size="sm"|"xs" empty="Sem responsável" />
<Select value onChange(valueString) options=[{value,label}] placeholder small ariaLabel className disabled />
<Tabs tabs=[{key,label,n,alert,icon}] value onChange />
<ProgressBar value max color height className />
// existentes: Logo, Avatar, StatusBadge, StatusMenu, Field, IconBtn, Card, CardHeader, SectionLabel, EmptyState, Kbd
// estilos: inputCls, inputErrCls, btn.primary|secondary|ghost|danger|dangerSoft
```

## 5. Props de cada componente (B passa exatamente isto)
```jsx
<Sidebar modules mod view onSwitch onView onManage onSettings(tab?) savedAt className onClose settings />  // nav ganha "Relatórios" (view "relatorios")
<Dashboard mod clients allModules settings onOpen(id) onToggleTask(clientId, taskId) onGo(view) onNew() onMove(id, status) />
<Reports mod clients allModules settings onOpen(id) />
<ClientsTable mod clients total sort onSort onOpen onNew hasFilter onClear settings />   // sort.key extra: "score" | "responsavel" | "etapaDias" | "origem"
<Funnel mod clients onOpen dragId onDrop onNew settings />
<ClientDrawer mod client settings onClose onEdit onDelete patch(patchObj, logText) changeStatus(status) notify
              onProposal() onLog(text) onOpenSettings(tab) />
<ClientForm mod initial settings clients requireFor onClose onSave(data) onOpenExisting(id) />
<ProposalModal mod client settings onClose onGenerated({ numero, validade }) />
<SettingsModal modules mod settings onSaveSettings(next) savedAt onClose onReset onImport({modules, settings}) notify initialTab />
   // initialTab: "equipe" | "funil" | "automacoes" | "templates" | "pontuacao" | "backup"
<StageGateModal status missing client onFill() onCancel() />
<LossReasonModal settings client onConfirm({ motivoPerda, motivoPerdaObs }) onCancel() />
<Modal title subtitle icon onClose children footer width />   // width ex.: "max-w-2xl" | "max-w-4xl"
<ConfirmDialog title message confirmLabel danger onCancel onConfirm />
<Toasts toasts onDismiss />   // toast: { id, kind: "success"|"info"|"error"|"warning", title, message, action:{label,onClick}, duration }
```

## 6. Fluxos (B implementa no app)
- **Mover etapa** (`requestMove(id, status, {silent})`, usado por StatusMenu do drawer, drag do funil, botão do dashboard):
  1. `missing = missingForStage(...)`; se houver → `StageGateModal` (lista o que falta; "Preencher agora" abre `ClientForm` com `requireFor = status`; ao salvar, tenta mover de novo).
  2. se `status === "perdido"` → `LossReasonModal` (motivo obrigatório + obs) → `commitMove(id, "perdido", { motivoPerda, motivoPerdaObs })`.
  3. senão `commitMove`.
- **commitMove**: atualiza `status`, acrescenta `{status, at}` em `stageLog`, limpa `motivoPerda` se sair de perdido, roda `runAutomations(..., {type:"enter_stage", status})`,
  grava histórico "Etapa alterada para X" + "Tarefa automática criada: T" por tarefa, toast "Movido para X · N tarefas criadas automaticamente".
- **Cadastro**: `saveClient` → `hydrateClient` → `runAutomations(..., {type:"client_created"})` → histórico + toast.
- **Filtro por responsável**: estado `filterOwner` ("todos" | vendedorId | "sem"), `Select` na barra de filtros (ao lado dos chips de etapa), aplica em `filtered`.
- **Notas**: drawer usa `patch({ comments: [...] }, "Nota adicionada")`; autor = `vendedorNome(settings, settings.usuarioAtual) || "Você"`.
- **Mensagens**: drawer abre wa.me / mailto com o texto renderizado e chama `onLog("Mensagem enviada: <modelo>")`.
- **Proposta**: drawer chama `onProposal()`; B abre `ProposalModal`; `onGenerated` → `onLog("Proposta gerada nº ... (validade N dias)")`.
- **Views**: "dashboard" | "clientes" | "funil" | "relatorios" (hash #painel #clientes #funil #relatorios). Chips de etapa aparecem em clientes/funil; em relatorios não.
- **Settings**: `settings` em estado da raiz, `useEffect` salva com `saveSettings`. Import/export usa `serializeBackup`/`parseBackup`. "Restaurar exemplo" também volta `DEFAULT_SETTINGS`.

## 7. Diretrizes de UX (todos)
- Visual Próspera: azul `brand #3152E4`, tinta `ink #1A1A2E`, fundo `canvas #F7F9FA`, Inter. Cantos `rounded-xl/2xl`, bordas `slate-200`, sombras `shadow-card`/`shadow-pop`.
- Reaproveite `Card`, `CardHeader`, `btn.*`, `inputCls`, `Field`, `Select`, `Tabs`, badges. Textos em PT-BR, sem jargão. Tom simples.
- Nada de `alert()`/`confirm()`/`prompt()`: use `notify` e `ConfirmDialog` (via props que B passa). Sem bibliotecas novas.
- Cores de etapa fixas: lead #3152E4, negociação #D97706, fechado #047857, perdido #DC2626. Gráficos: só CSS/SVG inline, essas cores + slate.
- Mobile: tudo funciona em 390px (grid responsivo, overflow-x em tabelas, modais `rounded-t-3xl` embaixo em telas pequenas).
- Acessibilidade: `aria-label` em botões só com ícone, foco visível, `role="dialog"` nos modais, Esc fecha (B cuida do Esc global; modais novos recebem `onClose`/`onCancel`).
- Estados vazios amigáveis (`EmptyState`) com ação. Números com `tnum`. Valores com `BRL`.
- Não quebre nada que existe: Kanban drag, backup v2 (array) continua importável, chave `prospera_crm_v2` continua a mesma.
