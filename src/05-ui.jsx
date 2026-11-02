/* ------------------------------ estilos base ------------------------------ */
const inputCls = "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:bg-slate-50";
const inputErrCls = " border-red-400 focus:border-red-500 focus:ring-red-100";
const btn = {
  primary: "inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none",
  secondary: "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[.98]",
  ghost: "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100",
  danger: "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-[.98]",
  dangerSoft: "inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50",
};

/* Tamanhos das "pílulas" (badges). Mesmas medidas da SlaBadge, para tudo
   ficar alinhado nas listas: sm = padrão, xs = cards do funil / linhas densas. */
const uiPillCls = (size) => "inline-flex shrink-0 items-center gap-1 rounded-full font-semibold tnum " + (size === "xs" ? "px-1.5 py-0.5 text-[10.5px]" : "px-2 py-0.5 text-[11px]");
const uiPillIcon = (size) => (size === "xs" ? 11 : 12);

/* ------------------------------- UI básicos ------------------------------- */
function Logo({ height = 26 }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="flex items-center gap-2.5 select-none">
      {!broken
        ? <img src="assets/logo.png" alt="Próspera" style={{ height }} className="w-auto" onError={() => setBroken(true)} />
        : <span className="text-[22px] font-bold lowercase tracking-tight text-ink">próspera</span>}
      <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">CRM</span>
    </div>
  );
}
function Avatar({ name, size = 40, className = "" }) {
  return (
    <div className={"flex shrink-0 items-center justify-center rounded-full font-bold text-white " + className}
      style={{ width: size, height: size, background: avatarColor(name), fontSize: Math.round(size * 0.36) }} aria-hidden="true">
      {initials(name)}
    </div>
  );
}
function StatusBadge({ status, size = "sm" }) {
  const m = statusMeta(status);
  return (
    <span className={"inline-flex items-center gap-1.5 rounded-full font-semibold " + (size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs")}
      style={{ background: m.soft, color: m.text }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />{m.label}
    </span>
  );
}

/* Onde abrir o menu de etapas: fixo na tela (via portal), logo abaixo do botão;
   se não couber embaixo, abre para cima. Assim ele não é cortado pelo
   overflow das colunas do funil nem da tabela. */
const STATUS_MENU_W = 240, STATUS_MENU_H = 262;
function statusMenuPosition(rect, align) {
  if (!rect) return { top: 8, left: 8 };
  const vw = window.innerWidth, vh = window.innerHeight, gap = 6, pad = 8;
  let left = align === "right" ? rect.right - STATUS_MENU_W : rect.left;
  left = Math.max(pad, Math.min(left, vw - STATUS_MENU_W - pad));
  const below = rect.bottom + gap;
  const top = below + STATUS_MENU_H <= vh - pad ? below : Math.max(pad, rect.top - gap - STATUS_MENU_H);
  return { top, left };
}
/* Menu "Mover para": badge da etapa atual (padrão) ou, em `compact`, só um
   botão-ícone "Mover etapa" (listas e cards). Cliques e Enter/Espaço não
   sobem para a linha/card que o contém; Esc dentro do menu fecha SÓ o menu;
   setas ↑/↓ andam pelas opções. */
function StatusMenu({ value, onChange, align = "right", compact = false }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 8, left: 8 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const m = statusMeta(value);
  const MoveIc = I.Move || I.ArrowRight;

  const close = (refocus) => {
    setOpen(false);
    if (refocus && btnRef.current) { try { btnRef.current.focus({ preventScroll: true }); } catch (e) { btnRef.current.focus(); } }
  };
  const toggle = () => {
    if (open) { close(true); return; }
    setPos(statusMenuPosition(btnRef.current ? btnRef.current.getBoundingClientRect() : null, align));
    setOpen(true);
  };
  const pick = (key) => { close(true); onChange(key); };

  useEffect(() => {
    if (!open) return;
    const el = menuRef.current;
    if (el) {
      const cur = el.querySelector('[role="option"][aria-selected="true"]') || el.querySelector('[role="option"]');
      if (cur) { try { cur.focus({ preventScroll: true }); } catch (e) { cur.focus(); } }
    }
    const onMove = (e) => { if (e && e.type === "scroll" && e.target && menuRef.current && menuRef.current.contains(e.target)) return; setOpen(false); };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => { window.removeEventListener("scroll", onMove, true); window.removeEventListener("resize", onMove); };
  }, [open]);

  const onMenuKey = (e) => {
    if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); close(true); return; }
    if (e.key === "Tab") { close(false); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    const opts = Array.from((menuRef.current && menuRef.current.querySelectorAll('[role="option"]')) || []);
    if (!opts.length) return;
    const i = opts.indexOf(document.activeElement);
    let next = 0;
    if (e.key === "ArrowDown") next = i < 0 || i >= opts.length - 1 ? 0 : i + 1;
    else if (e.key === "ArrowUp") next = i <= 0 ? opts.length - 1 : i - 1;
    else if (e.key === "End") next = opts.length - 1;
    opts[next].focus();
  };
  const onWrapKey = (e) => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); };

  const menu = open && typeof ReactDOM !== "undefined" && ReactDOM.createPortal ? ReactDOM.createPortal(
    <div className="fixed inset-0 z-[60]" onClick={(e) => { e.stopPropagation(); close(true); }}>
      <div ref={menuRef} role="listbox" aria-label="Mover para" onKeyDown={onMenuKey} onClick={(e) => e.stopPropagation()}
        className="fixed rounded-2xl border border-slate-200 bg-white p-1.5 shadow-pop anim-pop" style={{ top: pos.top, left: pos.left, width: STATUS_MENU_W, maxHeight: "calc(100vh - 16px)", overflowY: "auto" }}>
        <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Mover para</div>
        {STATUSES.map((s) => (
          <button key={s.key} type="button" role="option" aria-selected={s.key === value} tabIndex={-1}
            onClick={() => pick(s.key)}
            className={"flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none " + (s.key === value ? "bg-slate-50" : "")}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="flex-1"><span className="block font-medium text-ink">{s.label}</span><span className="block text-xs text-slate-500">{s.hint}</span></span>
            {s.key === value && <span className="text-brand"><I.CheckSimple size={16} /></span>}
          </button>
        ))}
      </div>
    </div>, document.body) : null;

  return (
    <div className="relative inline-flex" onClick={(e) => e.stopPropagation()} onKeyDown={onWrapKey}>
      {compact ? (
        <button ref={btnRef} type="button" onClick={toggle} aria-haspopup="listbox" aria-expanded={open} aria-label="Mover etapa" title={"Mover etapa (" + m.label + ")"}
          className={"flex h-9 w-9 items-center justify-center rounded-lg transition sm:h-8 sm:w-8 " + (open ? "bg-brand-50 text-brand" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700")}>
          <MoveIc size={17} />
        </button>
      ) : (
        <button ref={btnRef} type="button" onClick={toggle} aria-haspopup="listbox" aria-expanded={open} aria-label={"Etapa: " + m.label + ". Mover etapa"}
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:brightness-[.97]"
          style={{ background: m.soft, color: m.text, borderColor: m.color + "40" }}>
          <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />{m.label}<I.ChevD size={14} />
        </button>
      )}
      {menu}
    </div>
  );
}
function Field({ label, hint, error, children, required }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-slate-700">{label}{required && <span className="text-red-500">*</span>}</span>
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}
/* innerRef: permite ao Modal focar o botão de fechar ao abrir. */
function IconBtn({ children, onClick, title, danger, className = "", innerRef }) {
  return (
    <button ref={innerRef} type="button" title={title} aria-label={title} onClick={onClick}
      className={"flex h-9 w-9 items-center justify-center rounded-lg transition " + (danger ? "text-slate-400 hover:bg-red-50 hover:text-red-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700") + " " + className}>
      {children}
    </button>
  );
}
function Card({ children, className = "" }) {
  return <div className={"rounded-2xl border border-slate-200 bg-white shadow-card " + className}>{children}</div>;
}
function CardHeader({ title, subtitle, action, icon: IconC }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">{IconC && <span className="text-slate-400"><IconC size={17} /></span>}{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
function SectionLabel({ children }) {
  return <div className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{children}</div>;
}
/* Estado vazio: ilustração leve (anel tracejado + ícone) e uma ação sugerida. */
function EmptyState({ icon: IconC, title, text, action }) {
  const Ic = IconC || I.Inbox;
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="relative mb-4 flex h-20 w-20 items-center justify-center" aria-hidden="true">
        <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full text-slate-200">
          <circle cx="40" cy="40" r="37" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 6" strokeLinecap="round" />
          <circle cx="40" cy="40" r="26" fill="#F1F5F9" />
          <circle cx="66" cy="18" r="3.5" fill="#EFF4FF" stroke="#BFDBFE" strokeWidth="1.5" />
          <circle cx="14" cy="60" r="2.5" fill="#FEF3C7" />
        </svg>
        <span className="relative text-slate-400"><Ic size={24} /></span>
      </div>
      <div className="text-sm font-semibold text-ink">{title}</div>
      {text && <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
function Kbd({ children }) {
  return <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-slate-500">{children}</kbd>;
}

/* ----------------------- Compartilhados v3 (contrato §4) ------------------ */
/* Prazo na etapa (SLA): usa slaStatus() do core. */
function SlaBadge({ settings, client, size = "sm", hideOk = false, className = "" }) {
  const s = slaStatus(settings, client);
  if (s.state === "none" || (s.state === "ok" && hideOk)) return null;
  const t = SLA_TONES[s.state] || SLA_TONES.ok;
  const Ic = s.state === "late" ? I.Alert : s.state === "warn" ? I.Timer : I.Clock;
  return (
    <span title={s.label + (s.limit ? " · prazo " + s.limit + " dias" : "")}
      className={uiPillCls(size) + " " + className}
      style={{ background: t.soft, color: t.text }}>
      <Ic size={uiPillIcon(size)} />{s.days}d{s.state === "late" ? " · parado" : ""}
    </span>
  );
}
/* Prioridade (pontuação do lead): usa scoreClient() do core. */
function ScoreBadge({ settings, mod, client, size = "sm", showPoints = false, className = "" }) {
  const s = scoreClient(settings, mod, client);
  const t = SCORE_LEVELS[s.level] || SCORE_LEVELS.baixa;
  return (
    <span title={"Prioridade " + t.label.toLowerCase() + " · " + s.points + " pontos"}
      className={"inline-flex shrink-0 items-center gap-1 rounded-full font-semibold " + (size === "xs" ? "px-1.5 py-0.5 text-[10.5px]" : "px-2 py-0.5 text-[11px]") + " " + className}
      style={{ background: t.soft, color: t.text }}>
      {s.level === "alta" ? <I.Flame size={uiPillIcon(size)} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />}
      {t.label}{showPoints && <span className="tnum opacity-70">· {s.points}</span>}
    </span>
  );
}
/* Responsável pelo cliente (vendedor). */
function OwnerChip({ settings, id, size = "sm", empty = "Sem responsável", className = "" }) {
  const nome = vendedorNome(settings, id);
  if (!nome) return <span className={"inline-flex items-center gap-1 text-slate-400 " + (size === "xs" ? "text-[11px]" : "text-xs") + " " + className}><I.User size={size === "xs" ? 12 : 13} /> {empty}</span>;
  return (
    <span className={"inline-flex max-w-full items-center gap-1.5 " + (size === "xs" ? "text-[11px]" : "text-xs") + " font-medium text-slate-700 " + className} title={"Responsável: " + nome}>
      <Avatar name={nome} size={size === "xs" ? 16 : 20} />
      <span className="truncate">{nome}</span>
    </span>
  );
}
/* Select estilizado. onChange recebe o valor (string), não o evento. */
function Select({ value, onChange, options = [], placeholder, small = false, ariaLabel, className = "", disabled = false }) {
  return (
    <div className={"relative " + className}>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel} disabled={disabled}
        className={inputCls + " appearance-none pr-9 " + (small ? "py-2 text-xs" : "") + ((value ?? "") === "" ? " text-slate-400" : "")}>
        {placeholder != null && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><I.ChevD size={15} /></span>
    </div>
  );
}
/* Abas horizontais (estilo do drawer). */
function Tabs({ tabs, value, onChange, className = "" }) {
  return (
    <nav className={"-mb-px flex gap-1 overflow-x-auto " + className} role="tablist">
      {tabs.map((t) => {
        const Ic = t.icon;
        const active = value === t.key;
        return (
          <button key={t.key} type="button" role="tab" aria-selected={active} onClick={() => onChange(t.key)}
            className={"inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition " + (active ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-ink")}>
            {Ic && <Ic size={15} />}{t.label}
            {t.n != null && <span className={"rounded-full px-1.5 py-0.5 text-[11px] font-semibold tnum " + (t.alert ? "bg-red-50 text-red-700" : active ? "bg-brand-50 text-brand" : "bg-slate-100 text-slate-500")}>{t.n}</span>}
          </button>
        );
      })}
    </nav>
  );
}
/* Barra de progresso simples (metas, relatórios). */
function ProgressBar({ value = 0, max = 100, color = "#3152E4", height = 8, className = "" }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={"w-full overflow-hidden rounded-full bg-slate-100 " + className} style={{ height }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin="0" aria-valuemax="100">
      <div className="h-full rounded-full transition-all" style={{ width: pct + "%", background: color }} />
    </div>
  );
}

/* ----------------------- Compartilhados v4 (contrato §4) ------------------ */
/* Ícone do tipo da tarefa (ligação, WhatsApp, e-mail, reunião, outro). Sem tipo: bandeira. */
function TaskTypeIcon({ tipo, size = 14, className = "" }) {
  const meta = taskTypeMeta(tipo);
  const Ic = (meta && I[meta.icon]) || I.Flag;
  const label = meta ? meta.label : "Tarefa";
  return (
    <span className={"inline-flex shrink-0 items-center justify-center " + className} title={label} role="img" aria-label={label}>
      <Ic size={size} />
    </span>
  );
}
/* "Quando" da tarefa (atrasada / hoje / amanhã / sex 31/10 / sem data), nas cores de TASK_TONES. */
function TaskWhenBadge({ task, size = "sm", className = "" }) {
  const w = taskWhen(task || {});
  const t = TASK_TONES[w.tone] || TASK_TONES.ok || SLA_TONES.ok;
  const Ic = w.tone === "late" ? I.Alert : w.tone === "today" ? (I.Sun || I.Clock) : w.tone === "soon" ? I.Clock : I.Calendar;
  const title = task && task.data ? fmtDate(task.data) + (task.hora ? " às " + task.hora : "") : "Sem data definida";
  return (
    <span title={title} className={uiPillCls(size) + " " + className} style={{ background: t.soft, color: t.text }}>
      <Ic size={uiPillIcon(size)} />{w.label}
    </span>
  );
}
/* Próxima tarefa pendente do cliente: ícone do tipo + título + quando. Null se não houver. */
function NextTaskLine({ client, size = "sm", className = "" }) {
  const t = nextTask(client);
  if (!t) return null;
  return (
    <span className={"inline-flex min-w-0 max-w-full items-center gap-1.5 text-slate-600 " + (size === "xs" ? "text-[11px]" : "text-xs") + " " + className} title={t.titulo}>
      <TaskTypeIcon tipo={t.tipo} size={size === "xs" ? 12 : 13} className="text-slate-400" />
      <span className="min-w-0 truncate">{t.titulo}</span>
      <TaskWhenBadge task={t} size={size} />
    </span>
  );
}
/* Alerta âmbar "Sem próximo passo": lead/negociação sem nenhuma tarefa pendente. */
function NextStepBadge({ client, size = "sm", className = "" }) {
  if (!needsNextStep(client)) return null;
  const t = SLA_TONES.warn;
  return (
    <span title="Este cliente não tem nenhuma tarefa pendente. Combine o próximo passo."
      className={uiPillCls(size) + " " + className} style={{ background: t.soft, color: t.text }}>
      <I.Alert size={uiPillIcon(size)} />Sem próximo passo
    </span>
  );
}
/* Três atalhos de contato (WhatsApp, ligar, e-mail). Sem telefone/e-mail o botão
   fica apagado (sem link, aria-disabled). O clique não sobe para a linha/card e
   avisa onLog(canal) para o app registrar no histórico. Alvo de 36 px no celular. */
function ContactIcons({ client, size = "sm", onLog, className = "" }) {
  const c = client || {};
  const digits = onlyDigits(c.telefone);
  const email = String(c.email || "").trim();
  const canPhone = digits.length >= 10;
  const canMail = !!email;
  const first = String(c.nome || "").trim().split(" ")[0] || "";
  const links = [
    { canal: "whatsapp", label: "WhatsApp", Ic: I.Chat, ok: canPhone, missing: "Sem telefone",
      href: "https://wa.me/55" + digits + "?text=" + encodeURIComponent("Olá" + (first ? " " + first : "")), blank: true,
      hover: "hover:bg-emerald-50 hover:text-emerald-600" },
    { canal: "ligacao", label: "Ligar", Ic: I.Phone, ok: canPhone, missing: "Sem telefone", href: "tel:+55" + digits, blank: false,
      hover: "hover:bg-brand-50 hover:text-brand" },
    { canal: "email", label: "E-mail", Ic: I.Mail, ok: canMail, missing: "Sem e-mail", href: "mailto:" + encodeURIComponent(email), blank: false,
      hover: "hover:bg-brand-50 hover:text-brand" },
  ];
  const box = "flex shrink-0 items-center justify-center rounded-lg transition " + (size === "xs" ? "h-9 w-9 sm:h-7 sm:w-7" : "h-9 w-9");
  const icon = size === "xs" ? 14 : 16;
  const stop = (e) => e.stopPropagation();
  const stopKeys = (e) => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); };
  return (
    <span className={"inline-flex items-center " + (size === "xs" ? "gap-0" : "gap-0.5") + " " + className} onClick={stop}>
      {links.map((l) => l.ok ? (
        <a key={l.canal} href={l.href} target={l.blank ? "_blank" : undefined} rel={l.blank ? "noopener noreferrer" : undefined} draggable="false"
          title={l.label + (c.nome ? " · " + c.nome : "")} aria-label={l.label + (c.nome ? " para " + c.nome : "")}
          onClick={(e) => { e.stopPropagation(); onLog && onLog(l.canal); }} onKeyDown={stopKeys}
          className={box + " text-slate-400 " + l.hover}>
          <l.Ic size={icon} />
        </a>
      ) : (
        <span key={l.canal} role="link" aria-disabled="true" title={l.missing} aria-label={l.label + " · " + l.missing} onClick={stop}
          className={box + " cursor-not-allowed text-slate-200"}>
          <l.Ic size={icon} />
        </span>
      ))}
    </span>
  );
}
/* Pílula com ícone e nome do módulo (listas que misturam módulos: painel, agenda). */
function ModuleChip({ mod, size = "xs", className = "" }) {
  if (!mod) return null;
  const Ic = I[mod.icon] || I.Grid;
  const accent = mod.accent || "#3152E4";
  return (
    <span title={"Módulo: " + mod.nome} className={uiPillCls(size) + " max-w-[160px] " + className} style={{ background: accent + "1A", color: accent }}>
      <Ic size={uiPillIcon(size)} /><span className="truncate">{mod.nome}</span>
    </span>
  );
}
