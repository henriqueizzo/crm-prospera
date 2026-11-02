/* ---------------------------------- Agenda --------------------------------
   Tela "Agenda": tarefas pendentes de TODOS os módulos, agrupadas por prazo
   (Atrasadas / Hoje / Amanhã / Próximos 7 dias / Depois / Sem data), com
   chips "Só meus" e filtro por tipo, e uma seção colapsada "Concluídas hoje".
   Componentes auxiliares fora do render, prefixados com "Agenda". Reaproveita
   DashChip e dashPostponeDate de 08-dashboard.jsx (mesmo escopo global).
--------------------------------------------------------------------------- */
const AGENDA_TYPE_FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "ligacao", label: "Ligações" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "E-mails" },
  { key: "reuniao", label: "Reuniões" },
  { key: "outro", label: "Outras" },
];
const AGENDA_GROUPS = [
  { key: "atrasadas", label: "Atrasadas", cls: "text-red-600" },
  { key: "hoje", label: "Hoje", cls: "text-brand" },
  { key: "amanha", label: "Amanhã", cls: "text-amber-700" },
  { key: "proximos", label: "Próximos 7 dias", cls: "text-amber-700" },
  { key: "depois", label: "Depois", cls: "text-slate-400" },
  { key: "semData", label: "Sem data", cls: "text-slate-400" },
];
const AGENDA_ACTION_CLS = "inline-flex h-9 shrink-0 items-center rounded-lg px-2.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-ink";

/* Em qual grupo a tarefa cai, a partir de daysUntil(data). */
function agendaGroupKey(d) {
  if (d == null) return "semData";
  if (d < 0) return "atrasadas";
  if (d === 0) return "hoje";
  if (d === 1) return "amanha";
  if (d <= 7) return "proximos";
  return "depois";
}
/* "Outras" = tipo "outro" ou sem tipo. */
function agendaMatchesType(t, key) {
  if (key === "todas") return true;
  if (key === "outro") return !t.tipo || t.tipo === "outro";
  return t.tipo === key;
}
function agendaDoneToday(t) {
  if (!t.feito || !t.feitoEm) return false;
  const d = new Date(t.feitoEm);
  return !isNaN(d.getTime()) && isTodayISO(toISODate(d));
}
function agendaTime(iso) {
  const d = new Date(iso || "");
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/* Mini-indicador do cabeçalho (atrasadas / hoje / esta semana). */
function AgendaStat({ icon: IconC, label, value, tone }) {
  const tones = { red: "bg-red-50 text-red-700", brand: "bg-brand-50 text-brand", amber: "bg-amber-50 text-amber-700" };
  return (
    <Card className="flex items-center gap-3 p-3 sm:p-4">
      <span className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " + tones[tone]}><IconC size={18} /></span>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-xl font-bold leading-tight tracking-tight text-ink tnum">{value}</div>
      </div>
    </Card>
  );
}

/* Linha de tarefa pendente (t traz modId, mod e client além dos campos da tarefa). */
function AgendaTaskRow({ t, multi, settings, onToggleTask, onPatchTask, onOpenIn }) {
  const open = () => onOpenIn(t.modId, t.client.id);
  const postpone = (n) => onPatchTask(t.modId, t.client.id, t.id, { data: dashPostponeDate(t, n) });
  const tipo = taskTypeMeta(t.tipo);
  return (
    <li className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-xl py-1.5 pr-1 transition hover:bg-slate-50">
      <button type="button" onClick={() => onToggleTask(t.modId, t.client.id, t.id)} title="Concluir tarefa" aria-label={"Concluir tarefa: " + t.titulo}
        className="group/check flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-300 text-transparent transition group-hover/check:border-emerald-500 group-hover/check:bg-emerald-500 group-hover/check:text-white">
          <I.CheckSimple size={13} />
        </span>
      </button>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500" title={tipo ? tipo.label : "Sem tipo"}>
        <TaskTypeIcon tipo={t.tipo} size={15} />
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <button type="button" onClick={open} className="block max-w-full text-left">
          <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <span className="truncate">{t.titulo}</span>
            {t.auto && <span className="shrink-0 text-amber-500" title="Criada por automação"><I.Zap size={12} /></span>}
          </span>
        </button>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
          <span className="truncate font-medium text-slate-700">{t.client.nome}</span>
          {t.client.empresa && <span className="truncate">· {t.client.empresa}</span>}
          {multi && <ModuleChip mod={t.mod} size="xs" />}
          <OwnerChip settings={settings} id={t.client.responsavel} size="xs" />
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <TaskWhenBadge task={t} size="sm" />
        <button type="button" onClick={() => postpone(1)} title="Adiar 1 dia" aria-label="Adiar 1 dia" className={AGENDA_ACTION_CLS}>+1 dia</button>
        <button type="button" onClick={() => postpone(7)} title="Adiar 1 semana" aria-label="Adiar 1 semana" className={AGENDA_ACTION_CLS}>+1 sem</button>
        <button type="button" onClick={open} title="Abrir cliente" aria-label="Abrir cliente"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-ink">
          <I.ExternalLink size={16} />
        </button>
      </div>
    </li>
  );
}

function AgendaGroup({ group, items, ...rowProps }) {
  if (!items.length) return null;
  return (
    <section aria-label={group.label}>
      <div className={"mb-1 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide " + group.cls}>
        {group.label}
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 tnum">{items.length}</span>
      </div>
      <ul className="space-y-0.5">{items.map((t) => <AgendaTaskRow key={t.modId + ":" + t.client.id + ":" + t.id} t={t} {...rowProps} />)}</ul>
    </section>
  );
}

/* Linha de tarefa concluída hoje (pode ser reaberta). */
function AgendaDoneRow({ t, multi, onToggleTask, onOpenIn }) {
  return (
    <li className="flex items-center gap-1.5 rounded-xl py-1 pr-1">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center" aria-hidden="true">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white"><I.CheckSimple size={13} /></span>
      </span>
      <button type="button" onClick={() => onOpenIn(t.modId, t.client.id)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm text-slate-500 line-through decoration-slate-300">{t.titulo}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-400"><span className="truncate">{t.client.nome}</span>{multi && <ModuleChip mod={t.mod} size="xs" />}</span>
      </button>
      <span className="shrink-0 text-[11px] text-slate-400 tnum">{agendaTime(t.feitoEm)}</span>
      <button type="button" onClick={() => onToggleTask(t.modId, t.client.id, t.id)} title="Reabrir tarefa" aria-label={"Reabrir tarefa: " + t.titulo}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-ink">
        <I.Undo size={16} />
      </button>
    </li>
  );
}

function Agenda({ allModules, settings, onOpenIn, onToggleTask, onPatchTask, onSetSoMeus, onNew }) {
  const [tipo, setTipo] = useState("todas");
  const [showDone, setShowDone] = useState(false);
  const mods = useMemo(() => allModules || [], [allModules]);
  const multi = mods.length > 1;
  const soMeus = !!(settings.ui && settings.ui.soMeus);
  const semUsuario = soMeus && !settings.usuarioAtual;

  /* Todas as tarefas (pendentes e concluídas hoje) de todos os módulos, respeitando "Só meus". */
  const all = useMemo(() => {
    const pend = [], done = [];
    allClients(mods).forEach(({ mod, client: c }) => {
      if (!matchesSoMeus(settings, c)) return;
      (c.tasks || []).forEach((t) => {
        const row = { ...t, modId: mod.id, mod, client: c, d: daysUntil(t.data) };
        if (!t.feito) pend.push(row);
        else if (agendaDoneToday(t)) done.push(row);
      });
    });
    done.sort((a, b) => (b.feitoEm || "").localeCompare(a.feitoEm || ""));
    return { pend: sortTasks(pend), done };
  }, [mods, settings]);

  const typeCounts = useMemo(() => {
    const out = {};
    AGENDA_TYPE_FILTERS.forEach((f) => { out[f.key] = all.pend.filter((t) => agendaMatchesType(t, f.key)).length; });
    return out;
  }, [all]);

  /* Lista filtrada por tipo e agrupada por prazo. */
  const view = useMemo(() => {
    const list = all.pend.filter((t) => agendaMatchesType(t, tipo));
    const g = {};
    AGENDA_GROUPS.forEach((x) => { g[x.key] = []; });
    list.forEach((t) => g[agendaGroupKey(t.d)].push(t));
    return { list, g, atrasadas: g.atrasadas.length, hoje: g.hoje.length, semana: g.hoje.length + g.amanha.length + g.proximos.length };
  }, [all, tipo]);

  const rowProps = { multi, settings, onToggleTask, onPatchTask, onOpenIn };
  const n = view.list.length;
  const subtitle = n
    ? n + (n === 1 ? " pendente" : " pendentes") + (multi ? " · todos os módulos" : "") + (soMeus ? " · só meus" : "") + (tipo !== "todas" ? " · " + (AGENDA_TYPE_FILTERS.find((f) => f.key === tipo) || {}).label.toLowerCase() : "")
    : "Nada pendente";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <DashChip active={soMeus} onClick={() => onSetSoMeus(!soMeus)} icon={<I.UserCheck size={13} />}
          title={settings.usuarioAtual ? "Mostrar só as tarefas dos meus clientes" : "Defina quem é você em Configurações > Equipe para este filtro funcionar"}>
          Só meus
        </DashChip>
        <span className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden="true" />
        <span className="hidden items-center gap-1 text-xs font-medium text-slate-400 sm:inline-flex"><I.Filter size={13} /> Tipo</span>
        {AGENDA_TYPE_FILTERS.map((f) => (
          <DashChip key={f.key} active={tipo === f.key} onClick={() => setTipo(f.key)}
            icon={f.key === "todas" ? <I.ListChecks size={13} /> : <TaskTypeIcon tipo={f.key} size={13} />}>
            {f.label} <span className={"tnum " + (tipo === f.key ? "opacity-70" : "text-slate-400")}>{typeCounts[f.key]}</span>
          </DashChip>
        ))}
      </div>
      {semUsuario && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <I.Info size={14} /> O filtro "Só meus" precisa saber quem é você: defina em Configurações &gt; Equipe e metas.
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <AgendaStat icon={I.Alert} label="Atrasadas" value={view.atrasadas} tone="red" />
        <AgendaStat icon={I.Sun} label="Hoje" value={view.hoje} tone="brand" />
        <AgendaStat icon={I.Calendar} label="Esta semana" value={view.semana} tone="amber" />
      </div>

      <Card>
        <CardHeader title="Tarefas pendentes" icon={I.ListChecks} subtitle={subtitle} />
        <div className="px-3 pb-4 pt-3">
          {all.pend.length === 0 ? (
            soMeus && settings.usuarioAtual ? (
              <EmptyState icon={I.Sun} title="Nada pendente para você" text="Nenhuma tarefa nos seus clientes. Você pode ver as da equipe ou cadastrar um cliente novo."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={() => onSetSoMeus(false)} className={btn.secondary}>Ver da equipe</button>
                    <button type="button" onClick={onNew} className={btn.primary}><I.Plus size={18} /> Novo cliente</button>
                  </div>
                } />
            ) : (
              <EmptyState icon={I.Sun} title="Agenda livre" text="Nenhuma tarefa pendente. Cadastre um cliente ou crie tarefas na ficha de cada um (aba Tarefas)."
                action={<button type="button" onClick={onNew} className={btn.primary}><I.Plus size={18} /> Novo cliente</button>} />
            )
          ) : n === 0 ? (
            <EmptyState icon={I.Filter} title="Nenhuma tarefa deste tipo" text="Troque o filtro para ver as outras tarefas pendentes."
              action={<button type="button" onClick={() => setTipo("todas")} className={btn.secondary}>Ver todas</button>} />
          ) : (
            <div className="space-y-4">
              {AGENDA_GROUPS.map((gr) => <AgendaGroup key={gr.key} group={gr} items={view.g[gr.key]} {...rowProps} />)}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <button type="button" onClick={() => setShowDone((s) => !s)} aria-expanded={showDone}
          className="flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left transition hover:bg-slate-50">
          <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <span className="text-emerald-600"><I.ClipboardCheck size={17} /></span>Concluídas hoje
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 tnum">{all.done.length}</span>
          </span>
          <I.ChevD size={18} className={"shrink-0 text-slate-400 transition " + (showDone ? "rotate-180" : "")} />
        </button>
        {showDone && (
          <div className="border-t border-slate-100 px-3 pb-3 pt-2">
            {all.done.length === 0
              ? <p className="px-2 py-3 text-xs text-slate-400">Nenhuma tarefa concluída hoje ainda. Ao concluir uma tarefa, ela aparece aqui.</p>
              : <ul className="space-y-0.5">{all.done.map((t) => <AgendaDoneRow key={t.modId + ":" + t.client.id + ":" + t.id} t={t} multi={multi} onToggleTask={onToggleTask} onOpenIn={onOpenIn} />)}</ul>}
          </div>
        )}
      </Card>
    </div>
  );
}
