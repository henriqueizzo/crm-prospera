const { useState, useMemo, useRef, useEffect, useCallback } = React;

/* ============================================================================
   Próspera CRM — arquivo HTML único, dados salvos no navegador (localStorage).
   Módulos independentes (Benefícios, Adquirência + criados pelo usuário), cada
   um com sua lista de clientes e seu esquema de campos.
============================================================================ */
const BRAND = "#3152E4";

/* Cores das etapas: usadas em pontos, barras e bordas; o texto nunca fica
   branco sobre elas (badges usam fundo suave + texto escuro). */
const STATUSES = [
  { key: "lead",       label: "Lead",          color: "#3152E4", soft: "#EFF4FF", text: "#2541B8", hint: "Primeiro contato" },
  { key: "negociacao", label: "Em negociação", color: "#D97706", soft: "#FEF3C7", text: "#92400E", hint: "Proposta em andamento" },
  { key: "fechado",    label: "Fechado",       color: "#047857", soft: "#E6F6EE", text: "#065F46", hint: "Contrato assinado" },
  { key: "perdido",    label: "Perdido",       color: "#DC2626", soft: "#FEE2E2", text: "#991B1B", hint: "Não avançou" },
];
const statusMeta = (k) => STATUSES.find((s) => s.key === k) || STATUSES[0];

const ITEM_STATUS = [
  { key: "interesse", label: "De interesse" },
  { key: "contratado", label: "Contratado" },
];

const FIELD_TYPES = [
  { key: "text", label: "Texto" },
  { key: "number", label: "Número" },
  { key: "currency", label: "Valor (R$)" },
  { key: "status", label: "Status (interesse/contratado)" },
];

/* -------------------------------- helpers --------------------------------- */
const BRL = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const onlyDigits = (s) => (s || "").replace(/\D/g, "");
const uid = () => Math.random().toString(36).slice(2, 10);
const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
const todayISO = () => toISODate(new Date());
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toISODate(d); };
const nowISO = () => new Date().toISOString();
const hoursAgo = (h) => new Date(Date.now() - h * 3600e3).toISOString();

function fmtDate(d) { if (!d) return "sem data"; const [y, m, day] = d.split("-"); return day + "/" + m + "/" + y; }
function isOverdue(d) { return !!d && d < todayISO(); }
function daysUntil(d) {
  if (!d) return null;
  const a = new Date(d + "T00:00:00"), b = new Date(todayISO() + "T00:00:00");
  return Math.round((a - b) / 864e5);
}
function relTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return "há " + m + " min";
  const h = Math.floor(m / 60);
  if (h < 24) return "há " + h + " h";
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 30) return "há " + d + " dias";
  return new Date(iso).toLocaleDateString("pt-BR");
}
function fmtDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function greeting() { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; }
function longToday() {
  const s = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function initials(name) { return (name || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join(""); }
const AVATAR_COLORS = ["#3152E4", "#7C3AED", "#047857", "#B45309", "#BE185D", "#0E7490", "#4338CA", "#9F1239"];
function avatarColor(name) {
  let h = 0;
  for (const ch of (name || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function maskPhone(v) {
  const d = onlyDigits(v).slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return "(" + d;
  if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
  if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
  return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
}
const isEmail = (s) => !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/* Célula de CSV: protege contra fórmulas (= + - @ no início viram texto) e escapa aspas/quebras de linha. */
const csvCell = (v) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const isTyping = (el) => !!el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable);
const VIEW_HASH = { painel: "dashboard", dashboard: "dashboard", clientes: "clientes", funil: "funil", relatorios: "relatorios", agenda: "agenda", usuarios: "usuarios", atividades: "atividades" };

/* ----------------------------- constantes v3 ------------------------------ */
/* Porte da empresa e interesse do cliente (entram na pontuação de prioridade). */
const PORTES = [
  { key: "mei",     label: "MEI / autônomo" },
  { key: "pequena", label: "Pequena (até 50 func.)" },
  { key: "media",   label: "Média (51 a 250)" },
  { key: "grande",  label: "Grande (250+)" },
];
const INTERESSES = [
  { key: "baixo", label: "Baixo", color: "#64748B", soft: "#F1F5F9", text: "#475569" },
  { key: "medio", label: "Médio", color: "#D97706", soft: "#FEF3C7", text: "#92400E" },
  { key: "alto",  label: "Alto",  color: "#047857", soft: "#E6F6EE", text: "#065F46" },
];
/* Níveis de prioridade (resultado de scoreClient) e tons do prazo na etapa (slaStatus). */
const SCORE_LEVELS = {
  alta:  { key: "alta",  label: "Alta",  color: "#C2410C", soft: "#FFEDD5", text: "#9A3412" },
  media: { key: "media", label: "Média", color: "#D97706", soft: "#FEF3C7", text: "#92400E" },
  baixa: { key: "baixa", label: "Baixa", color: "#64748B", soft: "#F1F5F9", text: "#475569" },
};
const SLA_TONES = {
  ok:   { color: "#64748B", soft: "#F1F5F9", text: "#475569" },
  warn: { color: "#D97706", soft: "#FEF3C7", text: "#92400E" },
  late: { color: "#DC2626", soft: "#FEE2E2", text: "#991B1B" },
};
/* Campos que podem ser exigidos para mover um cliente para uma etapa. */
const REQUIRED_FIELD_KEYS = [
  { key: "empresa",     label: "Empresa" },
  { key: "telefone",    label: "Telefone" },
  { key: "email",       label: "E-mail" },
  { key: "origem",      label: "Origem" },
  { key: "responsavel", label: "Responsável" },
  { key: "porte",       label: "Porte" },
  { key: "interesse",   label: "Interesse" },
  { key: "valor",       label: "Valor (ao menos um item com valor)" },
  { key: "itens",       label: "Ao menos um item" },
];

/* Texto normalizado para comparar nomes/empresas (minúsculo, sem acento, sem espaços extras). */
function coreNormalizeText(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}
/* Mesmo mês/ano de uma data ISO em relação a uma data de referência (padrão: hoje). */
function isSameMonth(iso, ref = new Date()) {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const r = ref instanceof Date ? ref : new Date(ref);
  return d.getFullYear() === r.getFullYear() && d.getMonth() === r.getMonth();
}
function porteLabel(key) { const p = PORTES.find((x) => x.key === key); return p ? p.label : ""; }
function interesseMeta(key) { return INTERESSES.find((x) => x.key === key) || null; }

/* ============================== NOVIDADES v4 ==============================
   Tarefas com hora e tipo, registro de contato, histórico tipado, "Só meus",
   clientes de exemplo (demo), importação/exportação de planilha (CSV).
   As funções abaixo usam helpers de 04-storage.js (pendingTasks, scoreClient...)
   só em tempo de execução, por isso podem ficar aqui.
============================================================================ */

/* ------------------------------- tarefas --------------------------------- */
const TASK_TYPES = [
  { key: "ligacao",  label: "Ligação",  icon: "Phone" },
  { key: "whatsapp", label: "WhatsApp", icon: "Chat" },
  { key: "email",    label: "E-mail",   icon: "Mail" },
  { key: "reuniao",  label: "Reunião",  icon: "Calendar" },
  { key: "outro",    label: "Outro",    icon: "Flag" },
];
function taskTypeMeta(key) { return TASK_TYPES.find((t) => t.key === key) || null; }
/* Tons do "quando" da tarefa: atrasada (vermelho), hoje (azul Próspera), em breve (âmbar), depois (cinza), sem data (cinza claro). */
const TASK_TONES = {
  late:  { color: "#DC2626", soft: "#FEE2E2", text: "#991B1B" },
  today: { color: "#3152E4", soft: "#EFF4FF", text: "#2541B8" },
  soon:  { color: "#D97706", soft: "#FEF3C7", text: "#92400E" },
  ok:    { color: "#64748B", soft: "#F1F5F9", text: "#475569" },
  none:  { color: "#94A3B8", soft: "#F8FAFC", text: "#64748B" },
};
const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const isValidHora = (h) => typeof h === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
function isValidISODate(d) {
  if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const dt = new Date(d + "T00:00:00");
  return !isNaN(dt.getTime()) && toISODate(dt) === d;
}
function isTodayISO(d) { return isValidISODate(d) && d === todayISO(); }
/* Soma n dias (em horário local) a uma data ISO; base inválida = hoje. */
function addDaysISO(iso, n) {
  const base = new Date((isValidISODate(iso) ? iso : todayISO()) + "T00:00:00");
  base.setDate(base.getDate() + (Number(n) || 0));
  return toISODate(base);
}
/* Texto curto de "quando" a tarefa vence + tom de cor (ver TASK_TONES). */
function taskWhen(task) {
  const t = task || {};
  const hora = isValidHora(t.hora) ? " " + t.hora : "";
  if (t.feito) return { label: "concluída", tone: "ok" };
  if (!isValidISODate(t.data)) return { label: "sem data", tone: "none" };
  const diff = daysUntil(t.data);
  if (diff < 0) return { label: diff === -1 ? "atrasada desde ontem" : "atrasada há " + (-diff) + " dias", tone: "late" };
  if (diff === 0) return { label: "hoje" + hora, tone: "today" };
  if (diff === 1) return { label: "amanhã" + hora, tone: "soon" };
  const parts = t.data.split("-");
  const dm = parts[2] + "/" + parts[1];
  if (diff <= 7) return { label: WEEKDAYS_SHORT[new Date(t.data + "T00:00:00").getDay()] + " " + dm + hora, tone: "soon" };
  return { label: dm + hora, tone: "ok" };
}
/* Cópia ordenada: data (sem data por último), depois hora, depois título. */
function sortTasks(tasks) {
  const key = (t) => (isValidISODate(t.data) ? t.data : "9999-12-31") + " " + (isValidHora(t.hora) ? t.hora : "99:99") + " " + coreNormalizeText(t.titulo);
  return [...(tasks || [])].filter((t) => t && typeof t === "object").sort((a, b) => key(a).localeCompare(key(b)));
}
function nextTask(c) { const list = sortTasks(pendingTasks(c || {})); return list.length ? list[0] : null; }
/* Lead ou negociação sem nenhuma tarefa pendente = ninguém combinou o próximo passo. */
function needsNextStep(c) { return !!c && (c.status === "lead" || c.status === "negociacao") && pendingTasks(c).length === 0; }
function newTask(t) {
  const o = t || {};
  return {
    id: uid(), titulo: String(o.titulo || "").trim(),
    data: isValidISODate(o.data) ? o.data : "", hora: isValidHora(o.hora) ? o.hora : "",
    tipo: taskTypeMeta(o.tipo) ? o.tipo : "", feito: false, auto: !!o.auto,
  };
}

/* ------------------------------- contato --------------------------------- */
const CONTACT_RESULTS = [
  { key: "falou",         label: "Conversou" },
  { key: "nao_atendeu",   label: "Não atendeu / sem resposta" },
  { key: "retorno",       label: "Ficou de retornar" },
  { key: "proposta",      label: "Pediu proposta" },
  { key: "sem_interesse", label: "Sem interesse agora" },
];
function contactResultLabel(key) { const r = CONTACT_RESULTS.find((x) => x.key === key); return r ? r.label : ""; }
/* Ex.: "Ligação: não atendeu / sem resposta · obs" */
function contactText(d) {
  const o = d || {};
  const canal = taskTypeMeta(o.canal);
  const base = canal ? canal.label : "Contato";
  const res = contactResultLabel(o.resultado);
  const obs = String(o.obs || "").trim();
  let s = res ? base + ": " + res.charAt(0).toLowerCase() + res.slice(1) : base + ": contato registrado";
  if (obs) s += " · " + obs;
  return s;
}
const HISTORY_TIPOS = ["cadastro", "etapa", "tarefa", "nota", "contato", "mensagem", "proposta", "item", "dados"];
function historyEntry(text, extra) {
  return { id: uid(), at: nowISO(), text: String(text == null ? "" : text), tipo: "", ...(extra && typeof extra === "object" ? extra : {}) };
}

/* --------------------------- equipe / filtros ----------------------------- */
function isKnownVendedor(settings, id) { return !!id && !!settings && (settings.vendedores || []).some((v) => v.id === id); }
/* Chip "Só meus": só filtra quando está ligado E há um "quem está usando" definido. */
function matchesSoMeus(settings, c) {
  if (!settings || !settings.ui || !settings.ui.soMeus || !settings.usuarioAtual) return true;
  return !!c && c.responsavel === settings.usuarioAtual;
}
function allClients(modules) {
  const out = [];
  (modules || []).forEach((mod) => { ((mod && mod.clients) || []).forEach((client) => out.push({ mod, client })); });
  return out;
}

/* --------------------------- exemplo / onboarding ------------------------- */
function hasDemoClients(modules) { return (modules || []).some((m) => ((m && m.clients) || []).some((c) => c && c.demo)); }
function removeDemoClients(modules) { return (modules || []).map((m) => ({ ...m, clients: (m.clients || []).filter((c) => !(c && c.demo)) })); }
function countRealClients(modules) { return (modules || []).reduce((n, m) => n + ((m && m.clients) || []).filter((c) => c && !c.demo).length, 0); }

/* ------------------------------ planilha CSV ------------------------------ */
/* Lê um CSV (";" ou "," ou tab; aspas; BOM; CRLF). Primeira linha = cabeçalho. Linhas vazias são ignoradas. */
function parseCSV(text) {
  let s = String(text || "");
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  s = s.replace(/\r\n?/g, "\n");
  const first = s.split("\n")[0] || "";
  let sc = 0, cc = 0, tc = 0, q = false;
  for (const ch of first) { if (ch === '"') q = !q; else if (!q) { if (ch === ";") sc++; else if (ch === ",") cc++; else if (ch === "\t") tc++; } }
  const delim = sc >= cc && sc >= tc ? ";" : cc >= tc ? "," : "\t";
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter((r) => r.some((c) => String(c).trim() !== ""));
  if (!clean.length) return { headers: [], rows: [] };
  const headers = clean[0].map((h) => String(h).trim());
  const body = clean.slice(1).map((r) => headers.map((_, i) => (r[i] == null ? "" : String(r[i]).trim())));
  return { headers, rows: body };
}
const CSV_IMPORT_FIELDS = [
  { key: "nome",        label: "Nome do contato", required: true },
  { key: "empresa",     label: "Empresa" },
  { key: "telefone",    label: "Telefone" },
  { key: "email",       label: "E-mail" },
  { key: "origem",      label: "Origem" },
  { key: "responsavel", label: "Responsável" },
  { key: "porte",       label: "Porte" },
  { key: "interesse",   label: "Interesse" },
  { key: "status",      label: "Etapa" },
  { key: "obs",         label: "Observações" },
];
/* Ordem importa: os padrões mais específicos vêm antes de "nome" (que casaria "nome da empresa"). */
const CSV_HEADER_PATTERNS = [
  ["email",       /mail/],
  ["telefone",    /telefone|celular|whatsapp|fone|\btel\b/],
  ["empresa",     /empresa|razao social|companhia|organizacao|loja|negocio|cnpj/],
  ["responsavel", /responsavel|vendedor|consultor|atendente|owner/],
  ["origem",      /origem|canal|fonte|como chegou/],
  ["porte",       /porte|tamanho|funcionarios/],
  ["interesse",   /interesse|temperatura/],
  ["status",      /etapa|status|fase|estagio|situacao/],
  ["obs",         /observa|\bobs\b|nota|coment|anota/],
  ["nome",        /nome|contato|cliente|lead/],
];
/* Tenta adivinhar qual coluna vai em cada campo pelo nome do cabeçalho. */
function csvAutoMap(headers) {
  const norm = (headers || []).map((h) => coreNormalizeText(h));
  const map = {};
  const used = new Set();
  CSV_HEADER_PATTERNS.forEach(([key, re]) => {
    if (map[key] != null) return;
    const i = norm.findIndex((h, idx) => !used.has(idx) && h && re.test(h));
    if (i >= 0) { map[key] = i; used.add(i); }
  });
  return map;
}
/* Casa um valor de planilha com uma opção (por id/key ou pelo rótulo, sem acento). loose: aceita começo do rótulo. */
function csvMatchOption(list, value, keyProp, labelProp, loose) {
  const v = coreNormalizeText(value);
  if (!v) return "";
  const L = list || [];
  const hit = L.find((o) => coreNormalizeText(o[keyProp]) === v)
    || L.find((o) => coreNormalizeText(o[labelProp]) === v)
    || (loose ? L.find((o) => coreNormalizeText(o[labelProp]).startsWith(v) || v.startsWith(coreNormalizeText(o[keyProp]))) : null);
  return hit ? hit[keyProp] : "";
}
function csvRowToClient(settings, mapping, row) {
  const m = mapping || {};
  const r = Array.isArray(row) ? row : [];
  const get = (k) => (m[k] == null || m[k] === "" ? "" : String(r[Number(m[k])] == null ? "" : r[Number(m[k])]).trim());
  const s = settings || {};
  let tel = onlyDigits(get("telefone"));
  if ((tel.length === 12 || tel.length === 13) && tel.startsWith("55")) tel = tel.slice(2);
  return {
    nome: get("nome"), empresa: get("empresa"), telefone: maskPhone(tel), email: get("email"), obs: get("obs"),
    origem: csvMatchOption(s.origens, get("origem"), "id", "label", false),
    responsavel: csvMatchOption(s.vendedores, get("responsavel"), "id", "nome", false),
    porte: csvMatchOption(PORTES, get("porte"), "key", "label", true),
    interesse: csvMatchOption(INTERESSES, get("interesse"), "key", "label", true),
    status: csvMatchOption(STATUSES, get("status"), "key", "label", true) || "lead",
  };
}
/* Exporta a lista de clientes de um módulo (mesmas colunas da v3 + Prioridade e Próxima tarefa). */
function clientsToCSV(mod, settings, clients) {
  const s = settings || {};
  const vf = moduleValueField(mod);
  const head = ["Nome", "Empresa", "Telefone", "E-mail", "Etapa", "Origem", "Responsável", "Porte", "Interesse", "Prioridade", "Pontos",
    "Dias na etapa", "Próxima tarefa", "Motivo da perda", mod.itemLabelPlural, "Qtd. itens", "Valor do negócio", "Observações", "Cadastrado em", "Atualizado em"];
  const rows = (clients || []).map((c) => {
    const im = interesseMeta(c.interesse);
    const score = scoreClient(s, mod, c);
    const nt = nextTask(c);
    const prox = nt ? nt.titulo + (nt.data ? " (" + fmtDate(nt.data) + (nt.hora ? " " + nt.hora : "") + ")" : "") : (needsNextStep(c) ? "Sem próximo passo" : "");
    return [
      c.nome, c.empresa, c.telefone, c.email, statusMeta(c.status).label,
      origemLabel(s, c.origem), vendedorNome(s, c.responsavel), porteLabel(c.porte), im ? im.label : "",
      score.label, score.points, daysInStage(c), prox, c.status === "perdido" ? motivoLabel(s, c.motivoPerda) : "",
      (c.items || []).map((it) => itemTitle(mod, it) + (vf ? " (" + BRL(itemValue(mod, it)) + ")" : "")).join(" | "),
      (c.items || []).length, dealValue(mod, c).toFixed(2).replace(".", ","), c.obs, fmtDateTime(c.createdAt), fmtDateTime(c.updatedAt),
    ];
  });
  return "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
}

/* ============================== NOVIDADES v5 ==============================
   Usuários com senha, perfis (administrador / usuário), abas visíveis por
   usuário e registro de atividades. Aqui ficam só helpers puros (sem React e
   sem localStorage); a persistência está em 04-storage.js.
============================================================================ */

/* ------------------------------ perfis / abas ----------------------------- */
const USER_PERFIS = [
  { key: "admin",   label: "Administrador", hint: "Vê tudo, gerencia usuários e acompanha as atividades." },
  { key: "usuario", label: "Usuário",       hint: "Vê só as abas liberadas pelo administrador." },
];
function perfilLabel(key) { const p = USER_PERFIS.find((x) => x.key === key); return p ? p.label : "Usuário"; }
/* Abas/áreas que um administrador pode liberar ou esconder para cada usuário. */
const PERM_TABS = [
  { key: "dashboard",     label: "Painel",                 icon: "Dash",       hint: "Indicadores, tarefas do dia e metas" },
  { key: "agenda",        label: "Agenda",                 icon: "ListChecks", hint: "Tarefas de todos os módulos" },
  { key: "clientes",      label: "Clientes",               icon: "List",       hint: "Lista e ficha dos clientes" },
  { key: "funil",         label: "Funil de vendas",        icon: "Kanban",     hint: "Kanban por etapa" },
  { key: "relatorios",    label: "Relatórios",             icon: "BarChart",   hint: "Conversão, tempos e desempenho" },
  { key: "configuracoes", label: "Configurações e backup", icon: "Cog",        hint: "Equipe, funil, automações, mensagens, backup e planilhas" },
  { key: "modulos",       label: "Gerenciar módulos",      icon: "Layers",     hint: "Criar e excluir módulos de produto" },
];
const PERM_DEFAULT_USER = { dashboard: true, agenda: true, clientes: true, funil: true, relatorios: true, configuracoes: false, modulos: false };
/* Áreas só de administrador (nunca aparecem na lista de abas liberáveis). */
const ADMIN_VIEWS = ["usuarios", "atividades"];
const MAIN_VIEWS = ["dashboard", "agenda", "clientes", "funil", "relatorios"];
function permDefaults(all) { const o = {}; PERM_TABS.forEach((t) => { o[t.key] = all ? true : !!PERM_DEFAULT_USER[t.key]; }); return o; }
function permTabLabel(key) { const t = PERM_TABS.find((x) => x.key === key); return t ? t.label : key; }
function isAdmin(user) { return !!user && user.perfil === "admin"; }
/* O usuário pode ver esta aba/área? Administrador vê tudo; "usuarios" e "atividades" são só de administrador. */
function userCan(user, key) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (ADMIN_VIEWS.includes(key)) return false;
  return !!(user.abas && user.abas[key]);
}
function userAllowedViews(user) { return MAIN_VIEWS.concat(ADMIN_VIEWS).filter((v) => userCan(user, v)); }
function firstAllowedView(user) { const v = userAllowedViews(user); return v.length ? v[0] : null; }
/* Resumo das abas liberadas, para listas: ["Painel", "Agenda", ...]. */
function userTabLabels(user) {
  if (!user) return [];
  if (isAdmin(user)) return PERM_TABS.map((t) => t.label);
  return PERM_TABS.filter((t) => user.abas && user.abas[t.key]).map((t) => t.label);
}

/* --------------------------------- senha ---------------------------------- */
const authNormalizeLogin = (s) => String(s || "").trim().toLowerCase();
function authValidatePassword(p) {
  const s = String(p || "");
  if (s.length < 6) return "A senha precisa ter pelo menos 6 caracteres.";
  if (s.length > 72) return "A senha é longa demais (máximo 72 caracteres).";
  return "";
}
/* Texto → bytes UTF-8 (sem TextEncoder, para rodar também nos testes em Node). */
function authUtf8Bytes(str) {
  const out = [];
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return out;
}
/* SHA-256 em JavaScript puro (sem bibliotecas). Devolve 64 caracteres hexadecimais. */
const AUTH_SHA_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
function authSha256Hex(message) {
  const bytes = authUtf8Bytes(message);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 0x100000000), lo = bitLen >>> 0;
  bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
  let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const W = new Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + AUTH_SHA_K[i] + W[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H = [(H[0] + a) | 0, (H[1] + b) | 0, (H[2] + c) | 0, (H[3] + d) | 0, (H[4] + e) | 0, (H[5] + f) | 0, (H[6] + g) | 0, (H[7] + h) | 0];
  }
  return H.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}
/* Sal aleatório (24 hex). Usa o gerador criptográfico do navegador quando existe. */
function authNewSalt() {
  try {
    const a = new Uint8Array(12);
    (window.crypto || crypto).getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    return (Math.random().toString(16).slice(2, 14) + Math.random().toString(16).slice(2, 14)).slice(0, 24);
  }
}
/* Hash da senha com sal e várias rodadas (a senha em si nunca é guardada). */
const AUTH_ROUNDS = 1500;
function authHash(senha, salt) {
  let h = authSha256Hex(String(salt || "") + ":" + String(senha == null ? "" : senha));
  for (let i = 1; i < AUTH_ROUNDS; i++) h = authSha256Hex(h + String(salt || ""));
  return h;
}
function authVerify(user, senha) { return !!user && !!user.senhaHash && authHash(senha, user.salt || "") === user.senhaHash; }
/* Confere login + senha na lista de usuários: { ok, user, erro: "login" | "inativo" | "senha" }. */
function authCheck(users, login, senha) {
  const l = authNormalizeLogin(login);
  const u = (users || []).find((x) => x && authNormalizeLogin(x.login) === l) || null;
  if (!u) return { ok: false, erro: "login", user: null };
  if (!u.ativo) return { ok: false, erro: "inativo", user: u };
  if (!authVerify(u, senha)) return { ok: false, erro: "senha", user: u };
  return { ok: true, user: u, erro: "" };
}
/* Login já usado por outro usuário? */
function authLoginTaken(users, login, excludeId) {
  const l = authNormalizeLogin(login);
  return !!l && (users || []).some((u) => u && u.id !== excludeId && authNormalizeLogin(u.login) === l);
}
/* Administradores ativos (para não deixar o CRM sem nenhum). */
function activeAdmins(users) { return (users || []).filter((u) => u && u.ativo && u.perfil === "admin"); }

/* ------------------------------ atividades -------------------------------- */
const ACTIVITY_TYPES = [
  { key: "acesso",   label: "Acesso",         icon: "UserCheck",  color: "#64748B", soft: "#F1F5F9", text: "#475569" },
  { key: "cliente",  label: "Clientes",       icon: "Users",      color: "#3152E4", soft: "#EFF4FF", text: "#2541B8" },
  { key: "etapa",    label: "Etapas",         icon: "Kanban",     color: "#D97706", soft: "#FEF3C7", text: "#92400E" },
  { key: "tarefa",   label: "Tarefas",        icon: "ListChecks", color: "#047857", soft: "#E6F6EE", text: "#065F46" },
  { key: "contato",  label: "Contatos",       icon: "Phone",      color: "#0E7490", soft: "#ECFEFF", text: "#155E75" },
  { key: "nota",     label: "Notas",          icon: "Note",       color: "#7C3AED", soft: "#F5F3FF", text: "#5B21B6" },
  { key: "proposta", label: "Propostas",      icon: "FileText",   color: "#BE185D", soft: "#FDF2F8", text: "#9D174D" },
  { key: "dados",    label: "Backup e dados", icon: "Save",       color: "#B45309", soft: "#FFF7ED", text: "#9A3412" },
  { key: "config",   label: "Configurações",  icon: "Cog",        color: "#475569", soft: "#F1F5F9", text: "#334155" },
  { key: "usuarios", label: "Usuários",       icon: "Shield",     color: "#4338CA", soft: "#EEF2FF", text: "#3730A3" },
];
function activityTypeMeta(key) { return ACTIVITY_TYPES.find((t) => t.key === key) || ACTIVITY_TYPES[1]; }
/* Tipo da linha do tempo do cliente (HISTORY_TIPOS) → tipo de atividade. */
const ACTIVITY_FROM_HISTORY = { cadastro: "cliente", etapa: "etapa", tarefa: "tarefa", nota: "nota", contato: "contato", mensagem: "contato", proposta: "proposta", item: "cliente", dados: "cliente" };
const ACTIVITY_MAX = 2000;
const ACTIVITY_DEDUPE_MS = 120000;
function activityEntry(user, tipo, texto, ref) {
  const r = ref && typeof ref === "object" ? ref : {};
  return {
    id: uid(), at: nowISO(), userId: user ? String(user.id || "") : "", userNome: user ? String(user.nome || "") : "",
    tipo: activityTypeMeta(tipo).key, texto: String(texto == null ? "" : texto).slice(0, 240),
    modId: String(r.modId || ""), clientId: String(r.clientId || ""), clientNome: String(r.clientNome || ""),
  };
}
/* Nova lista com a entrada na frente. Repetição igual (mesmo usuário, tipo, texto e cliente) em menos de 2 min é ignorada. */
function appendActivity(list, entry) {
  const L = Array.isArray(list) ? list : [];
  const last = L[0];
  if (last && last.userId === entry.userId && last.tipo === entry.tipo && last.texto === entry.texto && last.clientId === entry.clientId
      && Math.abs(new Date(entry.at).getTime() - new Date(last.at).getTime()) < ACTIVITY_DEDUPE_MS) return L;
  return [entry, ...L].slice(0, ACTIVITY_MAX);
}
/* Entradas dos últimos N dias (0 = todas). */
function activityInDays(list, days) {
  const L = Array.isArray(list) ? list : [];
  if (!days) return L;
  const since = Date.now() - days * 864e5;
  return L.filter((e) => new Date(e.at).getTime() >= since);
}
/* Resumo por usuário: eventos, último evento e contagem por tipo. */
function activitySummary(list, users) {
  const by = {};
  (users || []).forEach((u) => { by[u.id] = { userId: u.id, nome: u.nome, ativo: u.ativo !== false, perfil: u.perfil, ultimoAcesso: u.ultimoAcesso || "", total: 0, ultimo: "", porTipo: {} }; });
  (list || []).forEach((e) => {
    const k = e.userId || "";
    if (!by[k]) by[k] = { userId: k, nome: e.userNome || "Usuário removido", ativo: false, perfil: "", ultimoAcesso: "", total: 0, ultimo: "", porTipo: {}, removido: true };
    const s = by[k];
    s.total += 1;
    if (!s.ultimo || e.at > s.ultimo) s.ultimo = e.at;
    s.porTipo[e.tipo] = (s.porTipo[e.tipo] || 0) + 1;
  });
  return Object.values(by).sort((a, b) => (b.ultimo || "").localeCompare(a.ultimo || "") || a.nome.localeCompare(b.nome));
}
function activityToCSV(list) {
  const head = ["Quando", "Usuário", "Tipo", "O que aconteceu", "Cliente", "Módulo"];
  const rows = (list || []).map((e) => [fmtDateTime(e.at), e.userNome, activityTypeMeta(e.tipo).label, e.texto, e.clientNome, e.modId]);
  return "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
}
