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
const VIEW_HASH = { painel: "dashboard", dashboard: "dashboard", clientes: "clientes", funil: "funil", relatorios: "relatorios", agenda: "agenda" };

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
