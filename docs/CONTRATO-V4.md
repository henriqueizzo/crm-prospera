# Contrato da versão 4 — Próspera CRM

> **Status (29/10/2026):** implementado, montado (`python build.py`) e testado. A parte do agente A foi feita pelo coordenador em 29/10.

Leia o `docs/CONTRATO-V3.md` inteiro antes (modelo de dados, API do core, props de cada componente,
diretrizes de UX). Este documento só traz o que MUDA ou é NOVO na v4. Tudo da v3 que não for citado
aqui continua valendo. Cada agente edita SOMENTE os arquivos de que é dono. Nunca edite arquivo de
outro agente. Se precisar de algo que não está aqui, implemente como função/componente LOCAL dentro
do seu arquivo (prefixe com o nome do componente). Não rode `python build.py` nem mexa em `index.html`:
o coordenador faz a junção, testa no navegador e corrige a integração.

Verifique a sintaxe dos seus arquivos antes de terminar:
`node "C:\Users\4Gamers\.claude\tools\crm-prospera-test\check.js" src/SEU-ARQUIVO.jsx`
(usa o mesmo Babel do navegador; tem que imprimir `OK`).

Regra de escopo (igual à v3): tudo vai num único `<script type="text/babel">`; `function X()` de qualquer
arquivo é visível em todos; `const` de nível superior só pode ser usado DENTRO de funções. Nomes
globais são únicos. Sem `import`/`export`, sem bibliotecas novas. Só React 18, Tailwind CDN e Babel.

## 0. Objetivo da v4 (resumo das melhorias combinadas)

Bugs: etapa trocada pelo formulário furava as regras; erro de gravação silencioso; dado corrompido
sobrescrito; Esc apagava texto digitado; Enter confirmava importação; valor de Adquirência era o TPV;
dois valores para "fechado"; links `mailto:` sem codificar; ids órfãos ao remover vendedor/origem/motivo;
componentes declarados dentro do render; sem `hashchange`; boot removido antes do React renderizar.
Produto: tarefas editáveis/adiáveis com hora e tipo; pergunta "próximo passo?" ao concluir; alerta
"sem próximo passo"; tarefas de TODOS os módulos no Painel + nova tela **Agenda**; "Só meus";
registrar contato (canal × resultado); links WhatsApp/Ligar/E-mail registram no histórico; linha do
tempo única na ficha; editar item no lugar; perfil editável na ficha sem abrir o formulário; ações
rápidas na tabela e no Kanban; exportar a lista filtrada; importar planilha CSV; banner de dados de
exemplo + "Remover exemplos"; checklist de primeiros passos; lembrete de backup; desfazer ao mover
etapa e ao remover nota/item/tarefa; mobile (tabela sem largura mínima, botão Mover no card, toasts
no topo); acessibilidade (foco nos modais, teclado no Kanban).
Termo único: **"Tarefa"** (não use mais "follow-up" nem "lembrete" em textos de tela).

## 1. Arquivos e donos (v4)

| Arquivo | Dono | O que muda |
|---|---|---|
| src/01-core.js, 02-icons.jsx, 03-modules-seed.js, 04-storage.js | **A** | modelo de dados, helpers novos, ícones novos, seed |
| src/05-ui.jsx, 13-modules-ui.jsx, 15-feedback.jsx | **H** | componentes compartilhados novos, foco em modais, Enter no confirm, toasts no topo (mobile), construtor de módulos |
| src/06-app.jsx, 07-sidebar.jsx, 16-stage-modals.jsx, 99-mount.jsx | **B** | fluxos novos do app, sidebar (Agenda, erro de gravação, backup), modais NextStep/ContactLog, ErrorBoundary |
| src/08-dashboard.jsx, 17-reports.jsx, **src/19-agenda.jsx (novo)** | **C** | painel com tarefas de todos os módulos, onboarding, relatórios corrigidos, tela Agenda |
| src/09-table.jsx, 10-funnel.jsx | **D** | mobile, ações rápidas, próxima tarefa, exportar lista, drag/teclado |
| src/11-drawer.jsx | **E** | tarefas, linha do tempo, perfil inline, item editável, contato, foco |
| src/12-form.jsx, 14-settings.jsx, 18-proposal.jsx | **F** | etapa fora do formulário de edição, importar CSV, remover exemplos, backup, proposta no celular |

`_head.html` e `build.py` não mudam (coordenador). O build concatena `NN-*.js(x)` em ordem numérica,
então `19-agenda.jsx` entra automaticamente antes de `99-mount.jsx`.

## 2. Modelo de dados (A implementa em `hydrateClient` / `hydrateModule` / `hydrateSettings`)

### 2.1 Cliente — campos novos
```js
{
  ...tudo da v3,
  demo: false,              // true só nos clientes de exemplo (seed). hydrate: demo: !!c.demo
  tasks: [{ id, titulo, data /* "YYYY-MM-DD" ou "" */, hora: "" /* "HH:MM" ou "" */,
            tipo: "" /* "" | "ligacao" | "whatsapp" | "email" | "reuniao" | "outro" */,
            feito, auto?, feitoEm?: ISO }],
  history: [{ id, at, text,
              tipo?: "" | "cadastro" | "etapa" | "tarefa" | "nota" | "contato" | "mensagem" | "proposta" | "item" | "dados",
              canal?: "ligacao"|"whatsapp"|"email"|"reuniao"|"outro",   // só em tipo "contato"
              resultado?: "" | key de CONTACT_RESULTS }],                  // só em tipo "contato"
}
```
hydrate garante `hora`/`tipo` como string em toda tarefa e `tipo` como string em todo histórico
(entradas antigas ficam com `tipo: ""`). Entradas antigas do histórico cujo texto comece com
"Etapa alterada" / "Tarefa " / "Nota adicionada" / "Cliente cadastrado" / "Mensagem enviada" /
"Proposta gerada" podem ganhar o tipo correspondente na hidratação (A decide; é só para o ícone).

### 2.2 Módulo — campo novo
```js
{ ...v3, valueField: "" }   // id do campo currency que representa o VALOR DO NEGÓCIO
```
`hydrateModule`: se `valueField` vazio ou não apontar para um campo `currency` existente → primeiro
campo `currency` do módulo (ou ""). Migração do módulo nativo `adquirencia` salvo em versões
anteriores: se não tiver o campo `receita`, A o adiciona logo após `tpv` e define `valueField = "receita"`
(itens antigos ficam com receita 0, o usuário preenche).

Seed (03): `benefitsModule.valueField = "valor"`. `acquiringModule.fields` ganha
`{ id: "receita", label: "Receita mensal estimada (R$)", type: "currency" }` logo após `tpv`, e
`valueField = "receita"`. Itens de exemplo de Adquirência ganham `receita` plausível
(≈ 1,5% a 2,5% do TPV). Todos os clientes de exemplo ganham `demo: true`. Tarefas de exemplo ganham
`tipo` (e uma ou duas com `hora`). Pelo menos um cliente de exemplo em negociação fica SEM tarefa
pendente, para mostrar o alerta "Sem próximo passo" (ex.: Patrícia Gomes).

### 2.3 Settings — campos novos
```js
{
  ...v3,
  ui: { soMeus: false },                                   // chip "Só meus" (Painel e Agenda)
  onboarding: { checklistDismissed: false, lastBackupAt: "" },   // lastBackupAt: ISO do último export
}
```

## 3. API nova do core (A implementa em 01-core.js / 04-storage.js; todos usam)

```js
/* tarefas */
TASK_TYPES = [ { key:"ligacao", label:"Ligação", icon:"Phone" }, { key:"whatsapp", label:"WhatsApp", icon:"Chat" },
               { key:"email", label:"E-mail", icon:"Mail" }, { key:"reuniao", label:"Reunião", icon:"Calendar" },
               { key:"outro", label:"Outro", icon:"Flag" } ]
taskTypeMeta(key) -> { key, label, icon } | null
TASK_TONES = { late: {color,soft,text /* vermelho, como SLA_TONES.late */}, today: {/* brand azul */},
               soon: {/* âmbar */}, ok: {/* slate */}, none: {/* slate claro */} }
taskWhen(task) -> { label, tone }
   // sem data: {"sem data","none"} · atrasada: {"atrasada há N dias" | "atrasada desde ontem","late"}
   // hoje: {"hoje" + (hora ? " " + hora : ""), "today"} · amanhã: {"amanhã" (+hora), "soon"}
   // até 7 dias: {"sex 31/10" (dia da semana abreviado + dd/mm) (+hora), "soon"} · depois: {"dd/mm" (+hora), "ok"}
sortTasks(tasks) -> cópia ordenada: data asc (sem data por último), depois hora asc, depois titulo
nextTask(c) -> primeira tarefa pendente de sortTasks(pendingTasks(c)) | null
needsNextStep(c) -> bool   // (status "lead" ou "negociacao") && pendingTasks(c).length === 0
addDaysISO(iso, n) -> "YYYY-MM-DD"   // base = iso válido ou hoje; soma n dias em horário local
isTodayISO(d) -> bool ; isValidISODate(d) -> bool
newTask({ titulo, data, hora, tipo, auto }) -> { id: uid(), titulo, data: data||"", hora: hora||"", tipo: tipo||"", feito: false, auto: !!auto }

/* contato */
CONTACT_RESULTS = [ { key:"falou", label:"Conversou" }, { key:"nao_atendeu", label:"Não atendeu / sem resposta" },
                    { key:"retorno", label:"Ficou de retornar" }, { key:"proposta", label:"Pediu proposta" },
                    { key:"sem_interesse", label:"Sem interesse agora" } ]
contactResultLabel(key) -> string
contactText({ canal, resultado, obs }) -> string   // ex.: "Ligação: não atendeu / sem resposta · obs"
historyEntry(text, extra = {}) -> { id: uid(), at: nowISO(), text, tipo: "", ...extra }

/* valor do negócio */
moduleValueField(mod) -> field | null        // campo apontado por mod.valueField
itemValue(mod, item)                           // AGORA usa moduleValueField(mod); fallback: primeiro currency
dealValue(mod, c) -> number
   // status "fechado" e existe item com status "contratado" → soma só dos itens contratados;
   // caso contrário → clientValue(mod, c). TODAS as telas passam a usar dealValue para dinheiro
   // (tabela, Kanban, KPIs, metas, relatórios, "quem contatar primeiro"). clientValue continua existindo.

/* equipe / filtros */
isKnownVendedor(settings, id) -> bool
matchesSoMeus(settings, c) -> bool   // true se !settings.ui.soMeus || !settings.usuarioAtual || c.responsavel === settings.usuarioAtual
allClients(modules) -> [{ mod, client }]      // na ordem dos módulos

/* exemplo / onboarding */
hasDemoClients(modules) -> bool
removeDemoClients(modules) -> modules          // nova lista sem clientes demo (mantém módulos e settings)
countRealClients(modules) -> int               // clientes com demo === false

/* CSV */
parseCSV(text) -> { headers: [string], rows: [[string]] }   // detecta ";" ou "," ; aspas; BOM; CRLF
CSV_IMPORT_FIELDS = [ { key:"nome", label:"Nome do contato", required:true }, { key:"empresa", label:"Empresa" },
   { key:"telefone", label:"Telefone" }, { key:"email", label:"E-mail" }, { key:"origem", label:"Origem" },
   { key:"responsavel", label:"Responsável" }, { key:"porte", label:"Porte" }, { key:"interesse", label:"Interesse" },
   { key:"status", label:"Etapa" }, { key:"obs", label:"Observações" } ]
csvAutoMap(headers) -> { [fieldKey]: headerIndex }   // casa cabeçalhos por nome normalizado (nome/contato, empresa/razão social, telefone/celular/whatsapp, email/e-mail, etapa/status/fase, responsável/vendedor...)
csvRowToClient(settings, mapping, row) -> objeto parcial de cliente
   // telefone passa por maskPhone; origem/responsavel aceitam id OU label (normalizado, sem acento);
   // porte/interesse/status aceitam key OU label; status inválido → "lead"
clientsToCSV(mod, settings, clients) -> string   // MOVIDO de 14-settings para o core (mesmas colunas da v3 + "Próxima tarefa" e "Prioridade"); separador ";"; BOM; csvCell protege fórmulas (prefixa apóstrofo em células que começam com = + - @)

/* armazenamento */
saveModules(m) -> bool ; saveSettings(s) -> bool            // já existiam; false quando o localStorage falha
takeStorageLoadIssue() -> { kind: "modules"|"settings", backupKey } | null
   // loadModules/loadSettings: se o JSON salvo for ilegível, antes de usar os dados iniciais copiam o texto bruto
   // para a chave `<chave>_corrompido_<timestamp>` e registram o problema; o app lê UMA vez com takeStorageLoadIssue()
daysInStage(c)   // AGORA em dias de calendário (toISODate dos dois lados), não blocos de 24 h
VIEW_HASH ganha agenda: "agenda"
```
Ícones novos em `I` (A, estilo Lucide 24x24 stroke 2): `Move, History, CalendarPlus, ListChecks, Spreadsheet,
More, ExternalLink, UserCheck, Undo, Sun, Hourglass, Megaphone, ClipboardCheck, Repeat, MapPin`.
Já existem (não recrie): Users Trend Check CheckSimple Handshake Search Plus Phone Mail Chat Building X Clock
Calendar Trash Dash Kanban List Pencil Bell ChevR ChevL ChevD ChevU Grid Card Gift Wallet Briefcase Target
Percent Cog Menu Download Upload Alert Info Sort Activity Reset Save Filter Table Inbox Keyboard Note FileText
Zap BarChart Copy Printer Timer User Star Send Sparkles Tag Flame Lightbulb Eye Layers Rocket HelpCircle Flag
ArrowRight TrendingDown Shield Settings2.

## 4. Componentes compartilhados novos/alterados (H, em 05-ui.jsx / 13 / 15)

```jsx
<TaskTypeIcon tipo size={14} className />        // ícone do TASK_TYPES (Flag se vazio)
<TaskWhenBadge task size="sm"|"xs" />            // pill com taskWhen(task).label nas cores de TASK_TONES
<NextTaskLine client size="sm"|"xs" />            // ícone do tipo + título + TaskWhenBadge da nextTask(c); null se não houver
<NextStepBadge client size="sm"|"xs" />          // pill âmbar "Sem próximo passo" quando needsNextStep(c); senão null
<ContactIcons client size="sm"|"xs" onLog(canal) />
   // 3 botões-ícone (WhatsApp wa.me/55+digitos com texto "Olá {primeiro nome}", tel:, mailto: com encodeURIComponent no endereço);
   // desabilitado (sem href, aria-disabled) quando falta telefone/e-mail; ao clicar chama onLog(canal) e NÃO propaga o clique (stopPropagation)
<ModuleChip mod size="xs"|"sm" />                // pill pequena com ícone e nome do módulo (usar em listas cross-módulo)
<StatusMenu value onChange align compact />      // compact: botão-ícone "Mover" (I.Move) com aria-label, em vez da badge; Esc dentro do menu fecha SÓ o menu (stopPropagation)
<ConfirmDialog .../>                               // Enter só confirma se o foco estiver no botão de confirmar (não mais no wrapper); foco inicial continua em Cancelar
<Toasts .../>                                      // em telas < sm ficam no TOPO (top-4), em sm+ continuam embaixo à direita
<Modal .../>                                       // ao montar foca o botão fechar (ou primeiro [data-autofocus]); ao desmontar devolve o foco ao elemento que estava ativo
ModuleBuilder                                      // campo do tipo "status" sempre tem id "status" (único); ids gerados são únicos (contador que pula ids existentes);
                                                   // seletor "Qual campo em R$ é o valor do negócio?" → `valueField` no módulo criado
```

## 5. Props de cada componente (B passa exatamente isto; donos implementam)

```jsx
<Sidebar modules mod view onSwitch onView onManage onSettings(tab?) savedAt className onClose settings
         saveError /* bool */ />
   // nav ganha "Agenda" (view "agenda", hash #agenda) com contador de tarefas atrasadas de TODOS os módulos (respeitando matchesSoMeus);
   // "Precisa de atenção" passa a somar TODOS os módulos; se saveError: ponto vermelho + "Não foi possível salvar" + link "Fazer backup" → onSettings("backup");
   // lembrete de backup: se countRealClients(modules) > 0 e (sem lastBackupAt ou > 7 dias) → linha âmbar "Backup: nunca | há N dias" → onSettings("backup")

<Dashboard mod clients allModules settings onOpen(id) onOpenIn(modId, id) onToggleTask(modId, clientId, taskId)
           onPatchTask(modId, clientId, taskId, patch) onGo(view) onNew() onMove(id, status)
           onSetSoMeus(bool) onRemoveDemo() onDismissChecklist() onOpenSettings(tab) />
   // "Tarefas" (ex-Follow-ups) e "Precisa de atenção" passam a cobrir TODOS os módulos (ModuleChip quando há > 1 módulo),
   // chip "Só meus" (settings.ui.soMeus → onSetSoMeus); linha de tarefa: TaskTypeIcon, título, cliente, TaskWhenBadge,
   // botões concluir / "+1 dia" (onPatchTask com data = addDaysISO(data || hoje, 1)) / abrir;
   // banner "Dados de exemplo" quando hasDemoClients(allModules) → botão "Remover exemplos" (onRemoveDemo);
   // card "Primeiros passos" (some quando tudo feito ou checklistDismissed): 1 Definir quem sou eu (settings.usuarioAtual) → onOpenSettings("equipe");
   // 2 Cadastrar o primeiro cliente (countRealClients > 0) → onNew; 3 Remover os exemplos (!hasDemoClients) → onRemoveDemo;
   // 4 Exportar um backup (onboarding.lastBackupAt) → onOpenSettings("backup"); link "Ocultar" → onDismissChecklist.
   // KPIs/metas/"quem contatar" usam dealValue. KPI "Negócios fechados": sub "R$ X em negócios fechados".

<Agenda allModules settings onOpenIn(modId, id) onToggleTask(modId, clientId, taskId) onPatchTask(modId, clientId, taskId, patch)
        onSetSoMeus(bool) onNew() />                                   // NOVA tela (C, 19-agenda.jsx), view "agenda"
   // tarefas pendentes de todos os módulos agrupadas: Atrasadas / Hoje / Amanhã / Próximos 7 dias / Depois / Sem data;
   // chips: "Só meus" + filtro por tipo (Todas, Ligações, WhatsApp, E-mails, Reuniões, Outras); cabeçalho com contagens;
   // linha: TaskTypeIcon, título, nome do cliente + empresa + ModuleChip + OwnerChip, TaskWhenBadge (+hora),
   // ações: concluir, "+1 dia", "+1 semana", abrir cliente; seção "Concluídas hoje" colapsada; EmptyState amigável.

<Reports mod clients allModules settings onOpen(id) />                  // sem mudança de props
   // período comparando Date (início local do período) com new Date(c.createdAt); setMonth sem transbordar (usar dia 1);
   // nota "Período = data de cadastro"; ids desconhecidos de vendedor/origem/motivo → "Removido"; dinheiro via dealValue

<ClientsTable mod clients total sort onSort onOpen onNew hasFilter onClear settings
              onMove(id, status) onPatch(id, patch, logText) onContactLink(id, canal) />
   // sem min-w abaixo de md (md:min-w-[900px]); coluna "Próxima tarefa" (NextTaskLine | NextStepBadge) hidden lg:table-cell;
   // coluna de ações (ContactIcons + StatusMenu compact → onMove; Select pequeno de responsável → onPatch({responsavel}, "Responsável alterado para X"));
   // rodapé: botão "Exportar esta lista" (clientsToCSV(mod, settings, clients) + downloadFile); Th fora do render; sort.key novo "proximaTarefa" (opcional)

<Funnel mod clients onOpen dragId onDrop onNew settings onMove(id, status) onContactLink(id, canal) />
   // card: NextTaskLine ou NextStepBadge, ContactIcons (xs), StatusMenu compact "Mover" → onMove; dinheiro via dealValue;
   // drag: dataTransfer.setData("text/plain", id) + effectAllowed "move"; onDrop com preventDefault; card com tabIndex=0 role="button", Enter/Espaço abre;
   // Stat fora do render; estado vazio: "Nenhum cliente neste módulo ainda" quando não há filtro, "Nenhum cliente corresponde aos filtros" quando há

<ClientDrawer mod client settings onClose onEdit onDelete patch(patchObj, logText) changeStatus(status) notify
              onProposal() onLog(text, extra?) onOpenSettings(tab)
              onToggleTask(taskId) onContact() onContactLink(canal) initialTab /* "resumo"|"itens"|"tarefas"|"notas" */ />
   // onLog(text, extra) → app grava historyEntry(text, extra) (extra pode trazer tipo/canal/resultado)
   // Tarefas: nova tarefa com título, data, hora, tipo; editar no lugar; "Hoje" / "+1 dia" / "+1 semana"; concluir via onToggleTask;
   //   remover com toast "Desfazer" (notify com action); concluídas numa seção colapsada "Concluídas (n)"
   // Resumo: linha do tempo ÚNICA (comments + history + stageLog) ordenada da mais recente, ícone por tipo, 8 primeiras + "Ver mais";
   //   caixa rápida "Escrever nota" no topo da linha do tempo (aba Notas continua existindo)
   // Perfil: clicar em Origem/Responsável/Porte/Interesse abre um mini-popover com Select/botões e salva via patch(...)+log
   //   (sem abrir o formulário); "Editar" continua abrindo o formulário completo
   // Botões WhatsApp/Ligar/E-mail: href só quando há dado (senão sem href + aria-disabled); mailto com encodeURIComponent; ao clicar → onContactLink(canal)
   // Botão novo "Registrar contato" → onContact()
   // Itens: ItemCard com modo edição (FieldInput por campo) → patch({ items }) + log "Item atualizado: X"; remover com Desfazer
   // Foco: ao abrir foca o botão fechar; ao fechar devolve o foco. Esc global é tratado pelo app (não fecha enquanto digita)

<ClientForm mod initial settings clients requireFor onClose onSave(data) onOpenExisting(id) />
   // EDIÇÃO (initial com id): o seletor "Etapa no funil" some; mostra a etapa atual como badge + dica
   //   "Para mudar a etapa, use a ficha do cliente ou o funil"; `data` enviado em onSave NÃO contém `status`.
   // CADASTRO: seletor continua; data.status vai para o app, que aplica as regras (ver fluxos)

<ProposalModal mod client settings onClose onGenerated({ numero, validade }) />   // CSS da proposta responsivo (< 520px: 1 coluna, assinaturas empilhadas); erro de copiar → notify

<SettingsModal modules mod settings onSaveSettings(next) savedAt onClose onReset onImport({modules, settings}) notify initialTab
               saveError onDetachRef(kind, id) onRemoveDemo() onImportClients(modId, rows, { automations }) />
   // kind: "vendedor" | "origem" | "motivo". Ao remover um item dessas listas, o modal mostra quantos clientes usam
   //   (via modules) e, após confirmar, chama onDetachRef; o app limpa o campo nos clientes de todos os módulos.
   // Backup: ao exportar → onSaveSettings({...settings, onboarding: {...settings.onboarding, lastBackupAt: nowISO()}});
   //   botão "Remover dados de exemplo" (visível se hasDemoClients(modules)) → onRemoveDemo;
   //   NOVO "Importar planilha (CSV)": escolher arquivo → parseCSV → tela de mapeamento (um Select por campo de CSV_IMPORT_FIELDS,
   //   pré-preenchido por csvAutoMap) → prévia das 5 primeiras linhas + total + duplicados (findDuplicates contra mod.clients)
   //   com opção "pular duplicados" + checkbox "criar tarefas automáticas de cadastro" (padrão desligado) → "Importar N clientes"
   //   → onImportClients(mod.id, rows /* objetos de csvRowToClient */, { automations }).
   //   Exportar CSV passa a usar clientsToCSV do core. Indicador "Salvo" respeita saveError.

<NextStepModal client mod settings onPick({ titulo, data, hora, tipo }) onSkip() onCancel() />      // NOVO (B, 16)
   // "Qual o próximo passo com {nome}?" — atalhos: "Ligar amanhã" (ligacao, +1), "Cobrar retorno em 3 dias" (whatsapp, +3),
   // "Reunião em 7 dias" (reuniao, +7) + formulário livre (título, data, hora, tipo); "Sem próximo passo agora" → onSkip
<ContactLogModal client mod settings onConfirm({ canal, resultado, obs, next /* {titulo,data,hora,tipo} | null */ }) onCancel() />   // NOVO (B, 16)
   // canal (TASK_TYPES), resultado (CONTACT_RESULTS), observação, e "Agendar próximo passo" opcional (mesmos atalhos)
```

## 6. Fluxos novos no app (B implementa em 06-app.jsx)

- **Cadastro com etapa ≠ lead**: cria sempre com `status: "lead"` + `stageLog [{lead, at}]` + automação `client_created`.
  Se `data.status !== "lead"`: `missing = missingForStage(...)` → se faltar algo, abre `StageGateModal` para o cliente novo;
  se `perdido`, abre `LossReasonModal`; senão move de verdade (stageLog + automação `enter_stage` + histórico), tudo com o
  objeto recém-criado (não depender do `clients` da closure). `commitMove` passa a aceitar um cliente opcional como fallback.
- **Edição nunca muda a etapa** (o form não manda `status`; mesmo assim o app ignora `data.status` na edição).
- **Desfazer ao mover etapa**: `commitMove` guarda o snapshot `before` e o toast ganha `action: { label: "Desfazer" }`, que
  devolve o snapshot (com `updatedAt` novo) — isso desfaz tarefas automáticas e `stageLog` daquele movimento. Duração 6 s.
- **Histórico tipado**: toda gravação de histórico passa por `historyEntry(text, extra)`. Etapa → `{tipo:"etapa"}` e, para
  perdido, texto "Etapa alterada para Perdido (motivo: X)". Tarefas automáticas → `{tipo:"tarefa"}`. Cadastro → `{tipo:"cadastro"}`.
- **Tarefas cross-módulo**: `toggleTaskIn(modId, clientId, taskId)` (marca `feitoEm`); se a tarefa ficou concluída e
  `needsNextStep(cliente)` → abre `NextStepModal` para `{modId, clientId}`; `onPick` cria tarefa (`newTask`) + histórico
  `{tipo:"tarefa"}` "Tarefa criada: T"; `onSkip` só fecha. `patchTaskIn(modId, clientId, taskId, patch)` grava histórico
  "Tarefa adiada para dd/mm" quando a data muda.
- **Registrar contato**: estado `contactFor` → `ContactLogModal`; `onConfirm` grava `historyEntry(contactText(d), {tipo:"contato", canal, resultado})`,
  cria a tarefa `next` se vier, toast "Contato registrado". `onContactLink(id, canal)` (vindo de drawer/tabela/Kanban) grava
  `{tipo:"contato", canal}` com texto "WhatsApp aberto" / "Ligação iniciada" / "E-mail aberto".
- **Esc enquanto digita**: no handler global, se `isTyping(e.target)` → `e.target.blur()` e retorna (não fecha nada). Segundo Esc fecha.
- **Importar backup**: `askConfirm` com `danger: true`.
- **Erro de gravação**: estado `saveError`; quando `saveModules`/`saveSettings` devolver false → `saveError = true` + toast
  `kind:"error"` (duração 12 s) "Não foi possível salvar neste navegador" com ação "Exportar backup" → `openSettings("backup")`;
  volta a false quando uma gravação seguinte der certo. Passa `saveError` para Sidebar e SettingsModal.
- **Dado corrompido**: no mount, `takeStorageLoadIssue()`; se houver, toast `kind:"warning"` (15 s) "Os dados salvos estavam
  ilegíveis; uma cópia foi guardada" + ação "Ver backup" → `openSettings("backup")`.
- **Refs órfãs**: `detachRef(kind, id)` limpa `responsavel`/`origem`/`motivoPerda` iguais a `id` em todos os clientes de todos
  os módulos. Filtro "Sem responsável" passa a ser `!c.responsavel || !isKnownVendedor(settings, c.responsavel)`.
- **Exemplos**: `removeDemo()` → confirm → `setModules(removeDemoClients(modules))` + toast. `onSetSoMeus(b)` → `settings.ui.soMeus`.
  `dismissChecklist()` → `settings.onboarding.checklistDismissed = true`.
- **Importar CSV**: `importClients(modId, rows, { automations })` → cada row vira `hydrateClient({ ...row, id: uid(), demo: false,
  createdAt, updatedAt, history: [historyEntry("Importado da planilha", {tipo:"cadastro"})], stageLog: [{status, at}] })`;
  se `automations` roda `client_created`; insere no início da lista do módulo; toast "N clientes importados"; vai para `#clientes`.
- **Views**: nova view `"agenda"` (hash `#agenda`); `VIEW_HASH` ganha `agenda: "agenda"` (A adiciona em core).
  `openClientIn(modId, id)`: troca o módulo se preciso (sem zerar filtros à toa) e abre o drawer. `hashchange` → `setView`.
  Título da Agenda: "Agenda" / "Tarefas de todos os módulos". Subtítulo do funil: "Arraste os cards ou use o botão Mover".
  Chips de etapa aparecem em clientes/funil (como antes); não em agenda/relatórios.
- **Drawer `initialTab`**: após cadastrar um cliente novo, abre a ficha na aba "itens".
- **Boot e erros**: `#boot` é removido num `useEffect` do `ProsperaCRM` (primeiro commit), não logo após `render()`.
  `99-mount.jsx` ganha um `ErrorBoundary` (classe React) que chama `window.__crmError(msg)` e mostra uma tela amigável
  com botão "Recarregar" e "Exportar backup" (que baixa o localStorage bruto como .json).
- `NavItem` sai de dentro do render da Sidebar (componente de módulo).

## 7. Diretrizes (todos)

- Mantém tudo da v3 (visual Próspera, `Card`/`btn`/`inputCls`/`Select`/`Tabs`, PT-BR simples, sem `alert()`, sem libs).
- Alvos de toque: botões de ação em listas com no mínimo `h-9 w-9` (36 px) no mobile; círculo de concluir tarefa `h-6 w-6` com área clicável maior (padding).
- Toda ação destrutiva pequena (remover nota/item/tarefa) usa `notify({ kind:"info", action:{ label:"Desfazer", onClick } })`.
- Componentes auxiliares declarados FORA do render (escopo do módulo), com props.
- Botões só com ícone têm `aria-label`. Listas clicáveis respondem a Enter.
- Não quebre: Kanban drag no desktop, backup v2/v3 importável, chaves `prospera_crm_v2` e `prospera_crm_settings_v3`.
- Dinheiro: sempre `dealValue` (nunca somar `itemValue` direto para "valor do negócio", exceto dentro de dealValue/proposta).
