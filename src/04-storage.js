/* ----------------------- PERSISTÊNCIA (localStorage) ----------------------
   Mesma chave da versão anterior, para não perder o que já estava salvo.
   Dados antigos ganham campos novos (v2: createdAt, updatedAt, history;
   v3: origem, responsável, porte, interesse, motivo da perda, stageLog,
   comentários) na carga. As configurações (vendedores, metas, SLA, campos
   obrigatórios, automações, modelos de mensagem, pontuação) ficam em outra
   chave, global para todos os módulos.
--------------------------------------------------------------------------- */
const STORAGE_KEY = "prospera_crm_v2";
const SETTINGS_KEY = "prospera_crm_settings_v3";
const LEGACY_ACCENT = { "#2563EB": "#3152E4" };

/* ------------------------- CONFIGURAÇÕES PADRÃO (v3) ----------------------- */
const DEFAULT_SETTINGS = {
  usuarioAtual: "",
  ui: { soMeus: false },                                        // chip "Só meus" (Painel e Agenda)
  onboarding: { checklistDismissed: false, lastBackupAt: "" },  // primeiros passos e lembrete de backup
  vendedores: [
    { id: "ana", nome: "Ana Ribeiro", metaMensal: 60000 },
    { id: "carlos", nome: "Carlos Mendes", metaMensal: 45000 },
  ],
  origens: [
    { id: "indicacao", label: "Indicação" },
    { id: "site", label: "Site" },
    { id: "instagram", label: "Instagram" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "evento", label: "Evento" },
    { id: "prospeccao", label: "Prospecção ativa" },
    { id: "parceiro", label: "Parceiro" },
    { id: "outro", label: "Outro" },
  ],
  motivosPerda: [
    { id: "preco", label: "Preço" },
    { id: "concorrente", label: "Fechou com concorrente" },
    { id: "sem_resposta", label: "Sem resposta" },
    { id: "sem_orcamento", label: "Sem orçamento" },
    { id: "momento", label: "Momento inadequado" },
    { id: "sem_fit", label: "Não tinha fit" },
    { id: "outro", label: "Outro" },
  ],
  sla: { lead: 7, negociacao: 15, fechado: 0, perdido: 0 },
  required: {
    lead: [],
    negociacao: ["telefone", "responsavel"],
    fechado: ["telefone", "email", "responsavel", "valor"],
    perdido: [],
  },
  scoring: {
    porte: { mei: 5, pequena: 10, media: 20, grande: 30 },
    interesse: { baixo: 0, medio: 15, alto: 30 },
    porItem: 5,
    contatoCompleto: 10,
    origem: { indicacao: 15, parceiro: 10 },
    limites: { alta: 60, media: 30 },
  },
  automations: [
    { id: "auto_cadastro", nome: "Primeiro contato ao cadastrar", ativo: true,
      trigger: { type: "client_created" },
      action: { type: "create_tasks", tasks: [{ titulo: "Fazer primeiro contato", dias: 1 }] } },
    { id: "auto_negociacao", nome: "Cobrar retorno da proposta", ativo: true,
      trigger: { type: "enter_stage", status: "negociacao" },
      action: { type: "create_tasks", tasks: [{ titulo: "Cobrar retorno da proposta", dias: 3 }] } },
    { id: "auto_fechado", nome: "Checklist de implantação", ativo: true,
      trigger: { type: "enter_stage", status: "fechado" },
      action: { type: "create_tasks", tasks: [
        { titulo: "Enviar contrato assinado para o cadastro", dias: 1 },
        { titulo: "Agendar onboarding do cliente", dias: 3 },
        { titulo: "Confirmar primeira utilização", dias: 15 },
      ] } },
  ],
  templates: [
    { id: "tpl_wa_primeiro", nome: "Primeiro contato", canal: "whatsapp", assunto: "",
      texto: "Olá {primeiro_nome}, tudo bem? Aqui é {vendedor}, da Próspera.\n\nVi que a {empresa} tem interesse em {modulo} e gostaria de entender melhor o que vocês precisam hoje.\n\nPosso te ligar ainda hoje ou prefere que eu envie as informações por aqui?" },
    { id: "tpl_wa_followup", nome: "Follow-up da proposta", canal: "whatsapp", assunto: "",
      texto: "Oi {primeiro_nome}! Passando para saber se conseguiu analisar a proposta de {itens} para a {empresa}.\n\nSe precisar ajustar algum ponto ou tirar dúvidas, é só me chamar. Fico à disposição!" },
    { id: "tpl_email_proposta", nome: "Envio de proposta", canal: "email", assunto: "Proposta Próspera — {empresa}",
      texto: "Olá {primeiro_nome},\n\nConforme conversamos, segue a proposta da Próspera para a {empresa}, contemplando {itens}, no valor de {valor}.\n\nQualquer dúvida, é só responder este e-mail ou me chamar no WhatsApp.\n\nAbraço,\n{vendedor}\nPróspera · {modulo}" },
    { id: "tpl_email_boasvindas", nome: "Boas-vindas", canal: "email", assunto: "Bem-vindo à Próspera, {primeiro_nome}!",
      texto: "Olá {primeiro_nome},\n\nSeja muito bem-vindo! É um prazer ter a {empresa} com a gente.\n\nNos próximos dias vamos cuidar da implantação de {itens}. Eu acompanho tudo de perto e, para qualquer necessidade, é só falar comigo.\n\nAbraço,\n{vendedor}\nPróspera" },
  ],
};

const storageClone = (v) => JSON.parse(JSON.stringify(v));
const storageNum = (v, def) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : def; };
const storageStr = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
const storageList = (v, def) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : storageClone(def));

/* Garante que qualquer settings salvo (ou parcial) tenha todos os campos válidos. */
function hydrateSettings(s) {
  const d = DEFAULT_SETTINGS;
  const src = s && typeof s === "object" ? s : {};
  const out = {};
  out.vendedores = storageList(src.vendedores, d.vendedores).map((v) => ({ id: storageStr(v.id) || uid(), nome: storageStr(v.nome), metaMensal: storageNum(v.metaMensal, 0) }));
  out.origens = storageList(src.origens, d.origens).map((o) => ({ id: storageStr(o.id) || uid(), label: storageStr(o.label) }));
  out.motivosPerda = storageList(src.motivosPerda, d.motivosPerda).map((o) => ({ id: storageStr(o.id) || uid(), label: storageStr(o.label) }));
  out.usuarioAtual = storageStr(src.usuarioAtual);
  if (out.usuarioAtual && !out.vendedores.some((v) => v.id === out.usuarioAtual)) out.usuarioAtual = "";

  const sla = src.sla && typeof src.sla === "object" ? src.sla : {};
  out.sla = {};
  STATUSES.forEach((st) => { out.sla[st.key] = storageNum(sla[st.key], d.sla[st.key] || 0); });

  const req = src.required && typeof src.required === "object" ? src.required : {};
  out.required = {};
  STATUSES.forEach((st) => {
    const list = Array.isArray(req[st.key]) ? req[st.key] : d.required[st.key];
    out.required[st.key] = list.map(storageStr).filter((k) => REQUIRED_FIELD_KEYS.some((f) => f.key === k));
  });

  const sc = src.scoring && typeof src.scoring === "object" ? src.scoring : {};
  const scoreMap = (obj, def) => { const o = obj && typeof obj === "object" ? obj : {}; const r = {}; Object.keys({ ...def, ...o }).forEach((k) => { r[k] = storageNum(o[k], def[k] != null ? def[k] : 0); }); return r; };
  out.scoring = {
    porte: scoreMap(sc.porte, d.scoring.porte),
    interesse: scoreMap(sc.interesse, d.scoring.interesse),
    porItem: storageNum(sc.porItem, d.scoring.porItem),
    contatoCompleto: storageNum(sc.contatoCompleto, d.scoring.contatoCompleto),
    origem: scoreMap(sc.origem, d.scoring.origem),
    limites: { alta: storageNum(sc.limites && sc.limites.alta, d.scoring.limites.alta), media: storageNum(sc.limites && sc.limites.media, d.scoring.limites.media) },
  };

  out.automations = storageList(src.automations, d.automations).map((a) => {
    const trig = a.trigger && typeof a.trigger === "object" ? a.trigger : {};
    const act = a.action && typeof a.action === "object" ? a.action : {};
    const type = trig.type === "client_created" ? "client_created" : "enter_stage";
    return {
      id: storageStr(a.id) || uid(), nome: storageStr(a.nome), ativo: a.ativo !== false,
      trigger: type === "enter_stage" ? { type, status: STATUSES.some((st) => st.key === trig.status) ? trig.status : "negociacao" } : { type },
      action: { type: "create_tasks", tasks: (Array.isArray(act.tasks) ? act.tasks : []).filter((t) => t && typeof t === "object").map((t) => ({ titulo: storageStr(t.titulo), dias: storageNum(t.dias, 0) })) },
    };
  });

  out.templates = storageList(src.templates, d.templates).map((t) => ({
    id: storageStr(t.id) || uid(), nome: storageStr(t.nome), canal: t.canal === "email" ? "email" : "whatsapp",
    assunto: storageStr(t.assunto), texto: storageStr(t.texto),
  }));
  const ui = src.ui && typeof src.ui === "object" ? src.ui : {};
  out.ui = { soMeus: !!ui.soMeus };
  const ob = src.onboarding && typeof src.onboarding === "object" ? src.onboarding : {};
  out.onboarding = { checklistDismissed: !!ob.checklistDismissed, lastBackupAt: storageStr(ob.lastBackupAt) };
  return out;
}
/* Se o texto salvo estiver ilegível (JSON quebrado), guardamos uma cópia bruta em outra chave
   antes de voltar ao padrão; o app lê o aviso UMA vez com takeStorageLoadIssue(). */
let storageLoadIssue = null;
function storageKeepCorrupted(kind, key, raw, err) {
  const backupKey = key + "_corrompido_" + Date.now();
  try { window.localStorage.setItem(backupKey, raw); } catch (e) {}
  console.warn("Dados salvos ilegíveis (" + kind + "); cópia guardada em " + backupKey, err);
  if (!storageLoadIssue) storageLoadIssue = { kind, backupKey };
}
function takeStorageLoadIssue() { const i = storageLoadIssue; storageLoadIssue = null; return i; }
function loadSettings() {
  const fallback = () => hydrateSettings(storageClone(DEFAULT_SETTINGS));
  let raw = null;
  try { raw = window.localStorage.getItem(SETTINGS_KEY); } catch (e) { console.warn("Sem acesso ao localStorage; usando padrão.", e); return fallback(); }
  if (!raw) return fallback();
  try { return hydrateSettings(JSON.parse(raw)); }
  catch (e) { storageKeepCorrupted("settings", SETTINGS_KEY, raw, e); return fallback(); }
}
function saveSettings(s) {
  try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); return true; }
  catch (e) { console.warn("Não foi possível salvar as configurações.", e); return false; }
}
function clearSavedSettings() { try { window.localStorage.removeItem(SETTINGS_KEY); } catch (e) {} }

/* ------------------------------ CLIENTES ---------------------------------- */
/* Deduz o tipo de uma entrada antiga do histórico pelo começo do texto (só para o ícone na linha do tempo). */
function storageHistoryTipo(text) {
  const t = coreNormalizeText(text);
  if (/^cliente cadastrado|^importado/.test(t)) return "cadastro";
  if (/^etapa alterada/.test(t)) return "etapa";
  if (/^tarefa/.test(t)) return "tarefa";
  if (/^nota/.test(t)) return "nota";
  if (/^mensagem/.test(t)) return "mensagem";
  if (/^whatsapp aberto|^ligacao iniciada|^e-mail aberto|^ligacao:|^whatsapp:|^e-mail:|^reuniao:|^contato:/.test(t)) return "contato";
  if (/^proposta/.test(t)) return "proposta";
  if (/^dados do cliente|^perfil|^responsavel alterado|alterad[oa] para/.test(t)) return "dados";
  if (/adicionad|removid|atualizad|marcado como/.test(t)) return "item";
  return "";
}
function hydrateClient(c) {
  const now = nowISO();
  const base = {
    items: [], tasks: [], history: [], comments: [], stageLog: [],
    obs: "", empresa: "", telefone: "", email: "", status: "lead",
    origem: "", responsavel: "", porte: "", interesse: "", motivoPerda: "", motivoPerdaObs: "",
    ...c,
  };
  base.demo = !!base.demo;
  base.items = (Array.isArray(base.items) ? base.items : []).filter((x) => x && typeof x === "object");
  /* v4: toda tarefa tem hora e tipo (strings, podem ser vazias); concluídas podem ter feitoEm. */
  base.tasks = (Array.isArray(base.tasks) ? base.tasks : []).filter((t) => t && typeof t === "object").map((t) => {
    const out = { ...t, id: storageStr(t.id) || uid(), titulo: storageStr(t.titulo),
      data: /^\d{4}-\d{2}-\d{2}$/.test(storageStr(t.data)) ? t.data : "",
      hora: /^\d{2}:\d{2}$/.test(storageStr(t.hora)) ? t.hora : "",
      tipo: TASK_TYPES.some((x) => x.key === t.tipo) ? t.tipo : "", feito: !!t.feito, auto: !!t.auto };
    if (!out.feito) delete out.feitoEm; else if (out.feitoEm != null) out.feitoEm = storageStr(out.feitoEm);
    return out;
  });
  /* v4: histórico tipado (entradas antigas ganham o tipo pelo texto, só para o ícone). */
  base.history = (Array.isArray(base.history) ? base.history : []).filter((h) => h && typeof h === "object" && h.text).map((h) => ({
    ...h, id: storageStr(h.id) || uid(), at: storageStr(h.at) || now, text: storageStr(h.text),
    tipo: HISTORY_TIPOS.includes(h.tipo) ? h.tipo : storageHistoryTipo(h.text),
  }));
  base.comments = (Array.isArray(base.comments) ? base.comments : []).filter((x) => x && typeof x === "object" && x.text);
  base.createdAt = base.createdAt || now;
  base.updatedAt = base.updatedAt || base.createdAt;
  if (!STATUSES.some((s) => s.key === base.status)) base.status = "lead";
  ["origem", "responsavel", "porte", "interesse", "motivoPerda", "motivoPerdaObs", "obs", "empresa", "telefone", "email"].forEach((k) => { base[k] = storageStr(base[k]); });
  /* stageLog: cronológico, última entrada = etapa atual. Dados antigos ganham a entrada inicial. */
  base.stageLog = (Array.isArray(base.stageLog) ? base.stageLog : []).filter((e) => e && e.status && e.at);
  if (base.stageLog.length === 0) base.stageLog = [{ status: base.status, at: base.createdAt }];
  const last = base.stageLog[base.stageLog.length - 1];
  if (last.status !== base.status) base.stageLog = [...base.stageLog, { status: base.status, at: base.updatedAt || now }];
  return base;
}
/* Campo em R$ que representa o VALOR DO NEGÓCIO do módulo (v4). */
function moduleValueField(mod) {
  if (!mod || !Array.isArray(mod.fields)) return null;
  return mod.fields.find((f) => f && f.id === mod.valueField && f.type === "currency") || null;
}
function hydrateModule(m) {
  const src = m && typeof m === "object" ? m : {};
  const accent = LEGACY_ACCENT[String(src.accent || "").toUpperCase()] || src.accent || BRAND;
  let fields = (Array.isArray(src.fields) ? src.fields : []).filter((f) => f && typeof f === "object" && f.id);
  let valueField = storageStr(src.valueField);
  /* Migração do módulo nativo de Adquirência salvo por versões anteriores: ganha o campo "receita"
     (logo após o TPV) e passa a usá-lo como valor do negócio. Itens antigos ficam com receita 0. */
  if (src.id === "adquirencia" && !fields.some((f) => f.id === "receita")) {
    const rf = { id: "receita", label: "Receita mensal estimada (R$)", type: "currency" };
    const i = fields.findIndex((f) => f.id === "tpv");
    fields = i >= 0 ? [...fields.slice(0, i + 1), rf, ...fields.slice(i + 1)] : [...fields, rf];
    valueField = "receita";
  }
  if (src.id === "adquirencia" && !valueField) valueField = "receita";
  if (!fields.some((f) => f.id === valueField && f.type === "currency")) {
    const cf = fields.find((f) => f.type === "currency");
    valueField = cf ? cf.id : "";
  }
  return {
    icon: "Grid", options: [], itemLabel: "Item", itemLabelPlural: "Itens", ...src, accent, fields, valueField,
    clients: Array.isArray(src.clients) ? src.clients.filter((c) => c && typeof c === "object").map(hydrateClient) : [],
  };
}
function loadModules() {
  const fallback = () => initialModules.map(hydrateModule);
  let raw = null;
  try { raw = window.localStorage.getItem(STORAGE_KEY); } catch (e) { console.warn("Sem acesso ao localStorage; usando dados iniciais.", e); return fallback(); }
  if (!raw) return fallback();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback();
    return parsed.map(hydrateModule);
  } catch (e) { storageKeepCorrupted("modules", STORAGE_KEY, raw, e); return fallback(); }
}
function saveModules(modules) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(modules)); return true; }
  catch (e) { console.warn("Não foi possível salvar localmente.", e); return false; }
}
function clearSavedModules() { try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) {} }

/* ------------------------------- BACKUP ----------------------------------- */
/* v5: o backup leva também os usuários (com o hash das senhas) e o registro de atividades, quando informados em `extra`. */
function serializeBackup(modules, settings, extra) {
  const ex = extra && typeof extra === "object" ? extra : {};
  const payload = { app: "prospera-crm", version: 5, exportedAt: nowISO(), modules, settings };
  if (Array.isArray(ex.users)) payload.users = ex.users;
  if (Array.isArray(ex.activity)) payload.activity = ex.activity;
  return JSON.stringify(payload, null, 2);
}
/* Aceita o backup antigo (array de módulos, v2), o v3/v4 (modules + settings) e o v5 (+ users + activity). */
function parseBackup(parsed) {
  const validMods = (arr) => Array.isArray(arr) && arr.length > 0 && arr.every((m) => m && typeof m === "object" && m.id && m.nome);
  if (Array.isArray(parsed)) {
    if (!validMods(parsed)) throw new Error("formato");
    return { modules: parsed.map(hydrateModule), settings: null, users: null, activity: null };
  }
  if (parsed && typeof parsed === "object" && validMods(parsed.modules)) {
    return {
      modules: parsed.modules.map(hydrateModule),
      settings: parsed.settings && typeof parsed.settings === "object" ? hydrateSettings(parsed.settings) : null,
      users: Array.isArray(parsed.users) ? hydrateUsers(parsed.users) : null,
      activity: Array.isArray(parsed.activity) ? hydrateActivity(parsed.activity) : null,
    };
  }
  throw new Error("formato");
}

/* --------------------------- cálculos de domínio --------------------------- */
function fieldDefault(f) { return f.type === "status" ? "interesse" : (f.type === "number" || f.type === "currency") ? 0 : ""; }
function newItem(mod) {
  const it = { id: uid() };
  mod.fields.forEach((f) => { it[f.id] = fieldDefault(f); });
  const tf = mod.fields.find((f) => f.fromOptions);
  if (tf && mod.options && mod.options.length) it[tf.id] = mod.options[0];
  return it;
}
function itemTitle(mod, item) {
  const tf = mod.fields.find((f) => f.fromOptions) || mod.fields.find((f) => f.type === "text");
  return tf ? (item[tf.id] || mod.itemLabel) : mod.itemLabel;
}
function itemValue(mod, item) {
  const cf = moduleValueField(mod) || (mod.fields || []).find((f) => f.type === "currency");
  return cf ? (Number(item[cf.id]) || 0) : 0;
}
function clientValue(mod, c) { return (c.items || []).reduce((s, it) => s + itemValue(mod, it), 0); }
/* Valor do negócio para TODAS as telas: cliente fechado com itens contratados conta só os
   contratados; nos demais casos, soma de todos os itens (clientValue). */
function dealValue(mod, c) {
  if (!c) return 0;
  const items = Array.isArray(c.items) ? c.items : [];
  if (c.status === "fechado") {
    const contratados = items.filter((it) => it && it.status === "contratado");
    if (contratados.length) return contratados.reduce((s, it) => s + itemValue(mod, it), 0);
  }
  return clientValue(mod, c);
}
function pendingTasks(c) { return (c.tasks || []).filter((t) => !t.feito); }
function overdueTasks(c) { return pendingTasks(c).filter((t) => isOverdue(t.data)); }

/* ----------------------------- regras v3 ---------------------------------- */
function vendedorNome(settings, id) {
  if (!id || !settings) return "";
  const v = (settings.vendedores || []).find((x) => x.id === id);
  return v ? v.nome : "";
}
function origemLabel(settings, id) {
  if (!id || !settings) return "";
  const o = (settings.origens || []).find((x) => x.id === id);
  return o ? o.label : "";
}
function motivoLabel(settings, id) {
  if (!id || !settings) return "";
  const o = (settings.motivosPerda || []).find((x) => x.id === id);
  return o ? o.label : "";
}

/* Quando o cliente entrou na etapa atual e há quantos dias está nela. */
function stageEnteredAt(c) {
  const log = (c && Array.isArray(c.stageLog)) ? c.stageLog : [];
  return log.length ? log[log.length - 1].at : ((c && c.createdAt) || nowISO());
}
/* Dias de calendário desde a entrada na etapa (entrou ontem à noite = 1 dia, não 0). */
function daysInStage(c) {
  const d = new Date(stageEnteredAt(c));
  if (isNaN(d.getTime())) return 0;
  const a = new Date(toISODate(d) + "T00:00:00"), b = new Date(todayISO() + "T00:00:00");
  return Math.max(0, Math.round((b - a) / 864e5));
}
/* Prazo por etapa (SLA): none = sem prazo ou etapa final; ok / warn (>= 70% do prazo) / late (> prazo). */
function slaStatus(settings, c) {
  const days = daysInStage(c);
  const limit = storageNum(settings && settings.sla && settings.sla[c.status], 0);
  const label = days === 0 ? "Entrou hoje na etapa" : days === 1 ? "1 dia na etapa" : days + " dias na etapa";
  if (!limit || c.status === "fechado" || c.status === "perdido") return { days, limit, state: "none", label };
  const state = days > limit ? "late" : days >= limit * 0.7 ? "warn" : "ok";
  return { days, limit, state, label };
}
/* Pontuação de prioridade do lead (0 a 100) pelas regras de settings.scoring. */
function scoreClient(settings, mod, c) {
  const sc = (settings && settings.scoring) || DEFAULT_SETTINGS.scoring;
  let p = 0;
  p += storageNum((sc.porte || {})[c.porte], 0);
  p += storageNum((sc.interesse || {})[c.interesse], 0);
  p += Math.min(3, (c.items || []).length) * storageNum(sc.porItem, 0);
  if (onlyDigits(c.telefone).length >= 10 && String(c.email || "").trim()) p += storageNum(sc.contatoCompleto, 0);
  p += storageNum((sc.origem || {})[c.origem], 0);
  const points = Math.max(0, Math.min(100, Math.round(p)));
  const lim = sc.limites || {};
  const alta = storageNum(lim.alta, 60), media = storageNum(lim.media, 30);
  const level = points >= alta ? "alta" : points >= media ? "media" : "baixa";
  return { points, level, label: SCORE_LEVELS[level].label };
}
/* O que ainda falta preencher para o cliente poder ir para a etapa informada. */
function missingForStage(settings, mod, c, status) {
  const keys = (settings && settings.required && Array.isArray(settings.required[status])) ? settings.required[status] : [];
  return keys
    .map((k) => REQUIRED_FIELD_KEYS.find((f) => f.key === k) || { key: k, label: k })
    .filter((f) => {
      if (f.key === "valor") return !(clientValue(mod, c) > 0);
      if (f.key === "itens") return !((c.items || []).length > 0);
      if (f.key === "telefone") return onlyDigits(c.telefone).length < 10;
      return !String(c[f.key] || "").trim();
    });
}
/* Possíveis cadastros duplicados: mesmo telefone, e-mail, empresa ou nome. */
function findDuplicates(clients, data, excludeId) {
  const d = data || {};
  const tel = onlyDigits(d.telefone);
  const email = String(d.email || "").trim().toLowerCase();
  const empresa = coreNormalizeText(d.empresa);
  const nome = coreNormalizeText(d.nome);
  const out = [];
  (clients || []).forEach((c) => {
    if (!c || (excludeId && c.id === excludeId)) return;
    let campo = null;
    if (tel.length >= 10 && onlyDigits(c.telefone) === tel) campo = "telefone";
    else if (email && String(c.email || "").trim().toLowerCase() === email) campo = "email";
    else if (empresa && coreNormalizeText(c.empresa) === empresa) campo = "empresa";
    else if (nome && coreNormalizeText(c.nome) === nome) campo = "nome";
    if (campo) out.push({ client: c, campo });
  });
  return out;
}
/* Automações "quando X, faça Y": só cria tarefas (com auto: true), sem duplicar título pendente. */
function runAutomations(settings, mod, client, event) {
  const autos = (settings && Array.isArray(settings.automations)) ? settings.automations : [];
  const ev = event || {};
  const created = [];
  const tasks = [...((client && client.tasks) || [])];
  autos.forEach((a) => {
    if (!a || a.ativo === false || !a.trigger || !a.action) return;
    const t = a.trigger;
    const match = t.type === ev.type && (t.type !== "enter_stage" || t.status === ev.status);
    if (!match || a.action.type !== "create_tasks") return;
    (a.action.tasks || []).forEach((tk) => {
      const titulo = String((tk && tk.titulo) || "").trim();
      if (!titulo) return;
      const dup = tasks.some((x) => !x.feito && coreNormalizeText(x.titulo) === coreNormalizeText(titulo));
      if (dup) return;
      tasks.push(newTask({ titulo, data: daysFromNow(storageNum(tk.dias, 0)), auto: true }));
      created.push(titulo);
    });
  });
  return { client: created.length ? { ...client, tasks } : client, created };
}
/* Variáveis disponíveis nos modelos de mensagem e na proposta. */
function templateContext(settings, mod, c) {
  const nome = String((c && c.nome) || "").trim();
  const vendedor = vendedorNome(settings, c && c.responsavel) || vendedorNome(settings, settings && settings.usuarioAtual) || "Próspera";
  const itens = ((c && c.items) || []).map((it) => itemTitle(mod, it)).filter(Boolean);
  return {
    nome,
    primeiro_nome: nome.split(" ")[0] || "",
    empresa: String((c && c.empresa) || ""),
    vendedor,
    modulo: (mod && mod.nome) || "",
    valor: BRL(dealValue(mod, c || {})),
    itens: itens.length ? itens.join(", ") : "—",
  };
}
function renderTemplate(texto, ctx) {
  return String(texto || "").replace(/\{([a-z_]+)\}/gi, (m, k) => (ctx && Object.prototype.hasOwnProperty.call(ctx, k)) ? String(ctx[k] == null ? "" : ctx[k]) : m);
}
/* Data em que o cliente foi fechado (última entrada "fechado" do stageLog). Só vale se ainda está fechado. */
function closedAt(c) {
  if (!c || c.status !== "fechado") return null;
  const log = Array.isArray(c.stageLog) ? c.stageLog : [];
  for (let i = log.length - 1; i >= 0; i--) if (log[i].status === "fechado") return log[i].at;
  return c.updatedAt || null;
}
/* Quanto tempo o cliente passou em cada etapa (a atual conta até agora). */
function stageDurations(c) {
  const log = (c && Array.isArray(c.stageLog)) ? c.stageLog : [];
  const now = nowISO();
  return log.map((e, i) => {
    const from = e.at, to = i + 1 < log.length ? log[i + 1].at : now;
    const ms = new Date(to).getTime() - new Date(from).getTime();
    const days = isNaN(ms) ? 0 : Math.max(0, Math.round((ms / 864e5) * 10) / 10);
    return { status: e.status, from, to, days };
  });
}

/* ============================ USUÁRIOS E ACESSO (v5) ======================
   Usuários (com hash da senha), sessão (quem está logado neste navegador) e
   registro de atividades ficam em chaves próprias. Nada disso sai do navegador.
============================================================================ */
const USERS_KEY = "prospera_crm_users_v5";
const SESSION_KEY = "prospera_crm_session_v5";
const ACTIVITY_KEY = "prospera_crm_activity_v5";

/* Garante que um usuário salvo (ou parcial) tenha todos os campos válidos. */
function hydrateUser(u) {
  const src = u && typeof u === "object" ? u : {};
  const perfil = src.perfil === "admin" ? "admin" : "usuario";
  const srcAbas = src.abas && typeof src.abas === "object" ? src.abas : null;
  const abas = {};
  PERM_TABS.forEach((t) => { abas[t.key] = srcAbas ? !!srcAbas[t.key] : !!PERM_DEFAULT_USER[t.key]; });
  return {
    id: storageStr(src.id) || uid(),
    nome: storageStr(src.nome).trim(),
    login: authNormalizeLogin(src.login),
    senhaHash: storageStr(src.senhaHash),
    salt: storageStr(src.salt),
    perfil,
    ativo: src.ativo !== false,
    vendedorId: storageStr(src.vendedorId),
    abas,
    criadoEm: storageStr(src.criadoEm) || nowISO(),
    ultimoAcesso: storageStr(src.ultimoAcesso),
    trocarSenha: !!src.trocarSenha,
  };
}
/* Lista limpa: sem login vazio e sem login repetido (fica o primeiro). */
function hydrateUsers(list) {
  const seen = new Set();
  return storageList(list, []).map(hydrateUser).filter((u) => {
    if (!u.login || seen.has(u.login)) return false;
    seen.add(u.login);
    return true;
  });
}
function loadUsers() {
  let raw = null;
  try { raw = window.localStorage.getItem(USERS_KEY); } catch (e) { console.warn("Sem acesso ao localStorage; sem usuários salvos.", e); return []; }
  if (!raw) return [];
  try { return hydrateUsers(JSON.parse(raw)); }
  catch (e) { storageKeepCorrupted("users", USERS_KEY, raw, e); return []; }
}
function saveUsers(users) {
  try { window.localStorage.setItem(USERS_KEY, JSON.stringify(users)); return true; }
  catch (e) { console.warn("Não foi possível salvar os usuários.", e); return false; }
}
/* Sessão: { userId, at } ou null. */
function loadSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p && typeof p === "object" && p.userId ? { userId: String(p.userId), at: storageStr(p.at) } : null;
  } catch (e) { return null; }
}
function saveSession(s) {
  try {
    if (!s) window.localStorage.removeItem(SESSION_KEY);
    else window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    return true;
  } catch (e) { return false; }
}
function hydrateActivity(list) {
  return storageList(list, []).filter((e) => e.at && e.texto).map((e) => ({
    id: storageStr(e.id) || uid(), at: storageStr(e.at), userId: storageStr(e.userId), userNome: storageStr(e.userNome),
    tipo: activityTypeMeta(e.tipo).key, texto: storageStr(e.texto).slice(0, 240),
    modId: storageStr(e.modId), clientId: storageStr(e.clientId), clientNome: storageStr(e.clientNome),
  })).slice(0, ACTIVITY_MAX);
}
function loadActivity() {
  let raw = null;
  try { raw = window.localStorage.getItem(ACTIVITY_KEY); } catch (e) { return []; }
  if (!raw) return [];
  try { return hydrateActivity(JSON.parse(raw)); }
  catch (e) { storageKeepCorrupted("activity", ACTIVITY_KEY, raw, e); return []; }
}
function saveActivity(list) {
  try { window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(list)); return true; }
  catch (e) { console.warn("Não foi possível salvar o registro de atividades.", e); return false; }
}
