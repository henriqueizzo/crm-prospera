/* ------------------------------- Dashboard --------------------------------
   Painel: KPIs e funil do módulo atual; "Tarefas" e "Precisa de atenção"
   cobrem TODOS os módulos (respeitando "Só meus"); banner de dados de
   exemplo e checklist de primeiros passos. Componentes auxiliares ficam
   fora do render, prefixados com "Dash".
--------------------------------------------------------------------------- */
const DASH_TASK_LIMIT = 8; // linhas de tarefa mostradas no painel; o resto vai para a Agenda

function KpiCard({ icon: IconC, label, value, sub, tone = "brand" }) {
  const tones = {
    brand: "bg-brand-50 text-brand", green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", violet: "bg-violet-50 text-violet-700",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-2 truncate text-[26px] font-bold leading-none tracking-tight text-ink tnum">{value}</div>
          {sub && <div className="mt-2 text-xs leading-relaxed text-slate-500">{sub}</div>}
        </div>
        <div className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " + tones[tone]}><IconC size={20} /></div>
      </div>
    </Card>
  );
}

/* Linha clicável reaproveitada pelos cards "atenção" e "contatar primeiro". */
function DashPersonRow({ client, onClick, index, right, children }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-slate-50">
        {index != null && <span className="w-4 shrink-0 text-center text-[11px] font-bold text-slate-300 tnum">{index}</span>}
        <Avatar name={client.nome} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-ink">{client.nome}</div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-400">{children}</div>
        </div>
        {right}
      </button>
    </li>
  );
}

function dashCapitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

/* Chip de filtro (Painel e Agenda). `icon` é um elemento já montado, ex.: <I.User size={13} />. */
function DashChip({ active, onClick, title, icon, children }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-pressed={!!active}
      className={"inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition " + (active ? "border-transparent bg-ink text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}>
      {icon}{children}
    </button>
  );
}

/* Data para adiar uma tarefa em n dias: parte da data dela ou de hoje, o que for
   mais tarde. Assim "+1 dia" numa tarefa atrasada vira "amanhã" (e não "menos atrasada").
   Também usada pela Agenda (19-agenda.jsx). */
function dashPostponeDate(task, n) {
  const hoje = todayISO();
  const base = task && isValidISODate(task.data) && task.data > hoje ? task.data : hoje;
  return addDaysISO(base, n);
}

/* Linha de tarefa do card "Tarefas" (t traz modId, mod e client além dos campos da tarefa). */
function DashTaskRow({ t, multi, onToggleTask, onPatchTask, onOpenIn }) {
  const open = () => onOpenIn(t.modId, t.client.id);
  return (
    <li className="flex flex-wrap items-center gap-x-1 gap-y-1 rounded-xl py-1 pr-1 transition hover:bg-slate-50">
      <button type="button" onClick={() => onToggleTask(t.modId, t.client.id, t.id)} title="Concluir tarefa" aria-label={"Concluir tarefa: " + t.titulo}
        className="group/check flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-300 text-transparent transition group-hover/check:border-emerald-500 group-hover/check:bg-emerald-500 group-hover/check:text-white">
          <I.CheckSimple size={13} />
        </span>
      </button>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><TaskTypeIcon tipo={t.tipo} size={14} /></span>
      <button type="button" onClick={open} className="min-w-0 flex-1 basis-28 text-left">
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <span className="truncate">{t.titulo}</span>
          {t.auto && <span className="shrink-0 text-amber-500" title="Criada por automação"><I.Zap size={12} /></span>}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
          <span className="truncate">{t.client.nome}</span>
          {multi && <ModuleChip mod={t.mod} size="xs" />}
        </span>
      </button>
      <span className="ml-auto flex shrink-0 items-center gap-0.5">
        <TaskWhenBadge task={t} size="xs" />
        <button type="button" onClick={() => onPatchTask(t.modId, t.client.id, t.id, { data: dashPostponeDate(t, 1) })} title="Adiar 1 dia" aria-label="Adiar 1 dia"
          className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-ink">
          <I.CalendarPlus size={14} />+1 dia
        </button>
        <button type="button" onClick={open} title="Abrir cliente" aria-label="Abrir cliente"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-ink">
          <I.ChevR size={16} />
        </button>
      </span>
    </li>
  );
}

function DashTaskGroup({ label, items, shown, tone, ...rowProps }) {
  if (!items.length) return null;
  const cls = tone === "red" ? "text-red-600" : tone === "brand" ? "text-brand" : tone === "amber" ? "text-amber-700" : "text-slate-400";
  return (
    <div>
      <div className={"mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide " + cls}>{label} · <span className="tnum">{items.length}</span></div>
      <ul className="space-y-0.5">{shown.map((t) => <DashTaskRow key={t.modId + ":" + t.client.id + ":" + t.id} t={t} {...rowProps} />)}</ul>
    </div>
  );
}

/* Card "Tarefas": pendentes de todos os módulos, chip "Só meus" e limite de linhas. */
function DashTasksCard({ tasks, multi, settings, onSetSoMeus, onToggleTask, onPatchTask, onOpenIn, onGo, onOpenSettings, className = "" }) {
  const soMeus = !!(settings.ui && settings.ui.soMeus);
  const semUsuario = soMeus && !settings.usuarioAtual;
  const groups = [
    { key: "atrasadas", label: "Atrasadas", items: tasks.g.atrasadas, tone: "red" },
    { key: "hoje", label: "Hoje", items: tasks.g.hoje, tone: "brand" },
    { key: "proximos", label: "Próximos 7 dias", items: tasks.g.proximos, tone: "amber" },
    { key: "depois", label: "Depois", items: tasks.g.depois, tone: "slate" },
  ];
  let left = DASH_TASK_LIMIT;
  const shown = groups.map((g) => { const s = g.items.slice(0, Math.max(0, left)); left -= s.length; return { ...g, shown: s }; });
  const hidden = tasks.list.length - shown.reduce((s, g) => s + g.shown.length, 0);
  const late = tasks.g.atrasadas.length;
  const n = tasks.list.length;
  const subtitle = n
    ? n + (n === 1 ? " pendente" : " pendentes") + (late ? " · " + late + (late === 1 ? " atrasada" : " atrasadas") : "") + (multi ? " · todos os módulos" : "")
    : "Nada pendente" + (multi ? " em nenhum módulo" : "");
  const rowProps = { multi, onToggleTask, onPatchTask, onOpenIn };
  return (
    <Card className={className}>
      <CardHeader title="Tarefas" icon={I.ListChecks} subtitle={subtitle}
        action={
          <div className="flex shrink-0 items-center gap-1.5">
            <DashChip active={soMeus} onClick={() => onSetSoMeus(!soMeus)} icon={<I.UserCheck size={13} />}
              title={settings.usuarioAtual ? "Mostrar só as tarefas dos meus clientes" : "Seu usuário precisa estar vinculado a um vendedor (Usuários) para este filtro funcionar"}>
              Só meus
            </DashChip>
            <button type="button" onClick={() => onGo("agenda")} className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold text-brand transition hover:bg-brand-50">Agenda <I.ChevR size={14} /></button>
          </div>
        } />
      <div className="px-3 pb-4 pt-3">
        {semUsuario && (
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <I.Info size={14} /> O filtro "Só meus" precisa saber quem é você.
            <button type="button" onClick={() => onOpenSettings("equipe")} className="font-semibold underline-offset-2 hover:underline">Definir agora</button>
          </div>
        )}
        {n === 0 ? (
          <EmptyState icon={I.Sun} title={soMeus && settings.usuarioAtual ? "Nada pendente para você" : "Tudo em dia"}
            text="Crie tarefas na ficha de cada cliente (aba Tarefas) e elas aparecem aqui." />
        ) : (
          <div className="space-y-3">
            {shown.map((g) => <DashTaskGroup key={g.key} label={g.label} tone={g.tone} items={g.items} shown={g.shown} {...rowProps} />)}
            {hidden > 0 && (
              <div className="px-1 text-[11px] text-slate-400">
                +{hidden} {hidden === 1 ? "outra" : "outras"} · <button type="button" onClick={() => onGo("agenda")} className="font-semibold text-brand hover:underline">ver tudo na Agenda</button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/* Aviso de dados de exemplo (clientes com demo: true em qualquer módulo). */
function DashDemoBanner({ onRemoveDemo }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm"><I.Sparkles size={18} /></span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-amber-900">Você está vendo dados de exemplo</div>
        <p className="text-xs leading-relaxed text-amber-800">Os clientes de exemplo servem só para conhecer o CRM. Quando quiser começar de verdade, remova-os: suas configurações e os clientes que você cadastrou continuam.</p>
      </div>
      <button type="button" onClick={onRemoveDemo} className={btn.secondary + " shrink-0 whitespace-nowrap"}><I.Trash size={15} /> Remover exemplos</button>
    </div>
  );
}

/* Checklist de primeiros passos (some quando tudo está feito ou foi ocultado). */
function DashChecklist({ steps, onDismiss }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><span className="text-brand"><I.Rocket size={17} /></span>Primeiros passos</h2>
          <p className="mt-0.5 text-xs text-slate-500"><span className="tnum">{done} de {steps.length}</span> concluídos · leva uns 2 minutos</p>
        </div>
        <button type="button" onClick={onDismiss} className="shrink-0 text-xs font-semibold text-slate-500 underline-offset-2 hover:text-ink hover:underline">Ocultar</button>
      </div>
      <div className="px-5 pt-3"><ProgressBar value={done} max={steps.length} color="#047857" height={4} /></div>
      <ol className="grid grid-cols-1 gap-2 px-5 pb-5 pt-4 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.key}>
            <button type="button" onClick={s.onClick}
              className={"flex w-full items-start gap-3 rounded-xl border p-3 text-left transition " + (s.done ? "border-emerald-100 bg-emerald-50/60" : "border-slate-200 bg-white hover:border-brand/40 hover:bg-brand-50/40")}>
              <span className={"flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tnum " + (s.done ? "bg-emerald-600 text-white" : "bg-brand-50 text-brand")}>
                {s.done ? <I.CheckSimple size={13} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={"block text-sm font-medium " + (s.done ? "text-emerald-800 line-through decoration-emerald-300" : "text-ink")}>{s.label}</span>
                <span className="block text-[11px] text-slate-500">{s.done ? "Feito" : s.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Dashboard({ mod, clients, allModules, settings, onOpen, onOpenIn, onToggleTask, onPatchTask, onGo, onNew, onMove, onSetSoMeus, onRemoveDemo, onDismissChecklist, onOpenSettings }) {
  const mods = useMemo(() => (allModules && allModules.length ? allModules : [mod]), [allModules, mod]);
  const multi = mods.length > 1;
  const onboarding = settings.onboarding || {};

  /* KPIs do módulo atual (dinheiro sempre via dealValue). */
  const m = useMemo(() => {
    const total = clients.length;
    const by = Object.fromEntries(STATUSES.map((s) => [s.key, { n: 0, v: 0 }]));
    clients.forEach((c) => { const b = by[c.status] || by.lead; b.n += 1; b.v += dealValue(mod, c); });
    const decididos = by.fechado.n + by.perdido.n;
    const conv = decididos ? Math.round((by.fechado.n / decididos) * 100) : 0;
    const pipeline = by.lead.v + by.negociacao.v;
    return { total, by, conv, pipeline, decididos, ativos: total - by.perdido.n };
  }, [clients, mod]);

  /* Tarefas pendentes de TODOS os módulos, respeitando "Só meus". */
  const tasks = useMemo(() => {
    const list = [];
    allClients(mods).forEach(({ mod: m2, client: c }) => {
      if (!matchesSoMeus(settings, c)) return;
      pendingTasks(c).forEach((t) => list.push({ ...t, modId: m2.id, mod: m2, client: c, d: daysUntil(t.data) }));
    });
    const sorted = sortTasks(list);
    const g = { atrasadas: [], hoje: [], proximos: [], depois: [] };
    sorted.forEach((t) => { if (t.d == null) g.depois.push(t); else if (t.d < 0) g.atrasadas.push(t); else if (t.d === 0) g.hoje.push(t); else if (t.d <= 7) g.proximos.push(t); else g.depois.push(t); });
    return { list: sorted, g };
  }, [mods, settings]);

  const recent = useMemo(() => [...clients].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 5), [clients]);
  const activity = useMemo(() => {
    const list = [];
    clients.forEach((c) => (c.history || []).forEach((h) => list.push({ ...h, cliente: c.nome, clientId: c.id })));
    return list.sort((a, b) => (b.at || "").localeCompare(a.at || "")).slice(0, 8);
  }, [clients]);

  /* Clientes parados além do prazo da etapa (SLA) ou perto dele, em todos os módulos. */
  const attention = useMemo(() => {
    const list = [];
    allClients(mods).forEach(({ mod: m2, client: c }) => {
      if (!matchesSoMeus(settings, c)) return;
      const sla = slaStatus(settings, c);
      if (sla.state === "late" || sla.state === "warn") list.push({ mod: m2, c, sla });
    });
    list.sort((a, b) => b.sla.days - a.sla.days);
    return { list, late: list.filter((x) => x.sla.state === "late").length, warn: list.filter((x) => x.sla.state === "warn").length };
  }, [mods, settings]);

  /* Pontuação dos clientes em aberto do módulo atual: quem merece contato primeiro. */
  const priority = useMemo(() => {
    const open = clients.filter((c) => c.status === "lead" || c.status === "negociacao");
    const scored = open.map((c) => ({ c, s: scoreClient(settings, mod, c), v: dealValue(mod, c) })).sort((a, b) => b.s.points - a.s.points);
    const dist = { alta: 0, media: 0, baixa: 0 };
    scored.forEach((x) => { dist[x.s.level] = (dist[x.s.level] || 0) + 1; });
    return { top: scored.slice(0, 5), dist, total: open.length };
  }, [clients, settings, mod]);

  /* Metas: valor fechado no mês atual por vendedor, somando todos os módulos. */
  const goals = useMemo(() => {
    const vendedores = (settings && settings.vendedores) || [];
    const rows = vendedores.map((v) => {
      let valor = 0, fechados = 0;
      mods.forEach((m2) => (m2.clients || []).forEach((c) => {
        if (c.status !== "fechado" || c.responsavel !== v.id) return;
        const at = closedAt(c);
        if (!at || !isSameMonth(at)) return;
        valor += dealValue(m2, c); fechados += 1;
      }));
      const meta = Number(v.metaMensal) || 0;
      return { v, valor, fechados, meta, pct: meta > 0 ? Math.round((valor / meta) * 100) : 0 };
    });
    const totalValor = rows.reduce((s, r) => s + r.valor, 0), totalMeta = rows.reduce((s, r) => s + r.meta, 0);
    return { rows, totalValor, totalMeta, pct: totalMeta > 0 ? Math.round((totalValor / totalMeta) * 100) : 0 };
  }, [mods, settings]);
  const mesLabel = dashCapitalize(new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));

  /* Onboarding: exemplos e checklist. */
  const hasDemo = hasDemoClients(mods);
  const realCount = countRealClients(mods);
  const steps = [
    { key: "eu", label: "Vincular você a um vendedor", hint: "Vem do seu login: para filtrar o que é seu e assinar as notas", done: !!settings.usuarioAtual, onClick: () => onOpenSettings("equipe") },
    { key: "cliente", label: "Cadastrar o primeiro cliente", hint: "Leva menos de um minuto", done: realCount > 0, onClick: onNew },
    { key: "demo", label: "Remover os exemplos", hint: "Fica só o que é seu", done: !hasDemo, onClick: onRemoveDemo },
    { key: "backup", label: "Exportar um backup", hint: "Uma cópia de segurança dos seus dados", done: !!onboarding.lastBackupAt, onClick: () => onOpenSettings("backup") },
  ];
  const showChecklist = !onboarding.checklistDismissed && steps.some((s) => !s.done);
  const tasksCardProps = { tasks, multi, settings, onSetSoMeus, onToggleTask, onPatchTask, onOpenIn, onGo, onOpenSettings };
  const SCORE_ORDER = ["alta", "media", "baixa"];

  if (clients.length === 0) {
    return (
      <div className="space-y-5">
        {showChecklist && <DashChecklist steps={steps} onDismiss={onDismissChecklist} />}
        {hasDemo && <DashDemoBanner onRemoveDemo={onRemoveDemo} />}
        <Card>
          <EmptyState icon={I.Inbox} title={"Nenhum cliente em " + mod.nome} text="Cadastre o primeiro cliente deste módulo para ver o painel ganhar vida."
            action={<button onClick={onNew} className={btn.primary}><I.Plus size={18} /> Cadastrar cliente</button>} />
        </Card>
        {tasks.list.length > 0 && <DashTasksCard {...tasksCardProps} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {showChecklist && <DashChecklist steps={steps} onDismiss={onDismissChecklist} />}
      {hasDemo && <DashDemoBanner onRemoveDemo={onRemoveDemo} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={I.Users} label="Clientes ativos" value={m.ativos} sub={m.total + " no total · " + m.by.perdido.n + " perdido(s)"} tone="brand" />
        <KpiCard icon={I.Trend} label="Em negociação" value={m.by.negociacao.n} sub={BRL(m.pipeline) + " em pipeline (lead + negociação)"} tone="amber" />
        <KpiCard icon={I.Handshake} label="Negócios fechados" value={m.by.fechado.n} sub={BRL(m.by.fechado.v) + " em negócios fechados"} tone="green" />
        <KpiCard icon={I.Target} label="Taxa de conversão" value={m.conv + "%"} sub={m.by.fechado.n + " fechado(s) de " + m.decididos + " decidido(s)"} tone="violet" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <DashTasksCard {...tasksCardProps} className="lg:col-span-2" />

        <Card>
          <CardHeader title="Funil por etapa" subtitle={"Clientes e valor em cada etapa · " + mod.nome}
            action={<button type="button" onClick={() => onGo("funil")} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand hover:underline">Abrir funil <I.ChevR size={14} /></button>} />
          <div className="px-5 pb-5 pt-4">
            <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Distribuição de clientes por etapa">
              {STATUSES.map((s) => {
                const pct = m.total ? (m.by[s.key].n / m.total) * 100 : 0;
                return pct > 0 ? <div key={s.key} className="h-full rounded-sm transition-all" style={{ width: pct + "%", background: s.color }} title={s.label + ": " + m.by[s.key].n} /> : null;
              })}
            </div>
            <ul className="mt-3 divide-y divide-slate-100">
              {STATUSES.map((s) => {
                const b = m.by[s.key];
                const pct = m.total ? Math.round((b.n / m.total) * 100) : 0;
                return (
                  <li key={s.key} className="py-2.5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{s.label}</span>
                      <span className="w-8 shrink-0 text-right font-semibold text-ink tnum">{b.n}</span>
                      <span className="w-28 shrink-0 text-right text-xs text-slate-500 tnum">{BRL(b.v)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <ProgressBar value={b.n} max={m.total || 1} color={s.color} height={6} />
                      <span className="w-9 shrink-0 text-right text-[11px] text-slate-400 tnum">{pct}%</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Precisa de atenção" icon={I.Timer}
            subtitle={attention.list.length ? attention.late + " além do prazo · " + attention.warn + " perto do limite" + (multi ? " · todos os módulos" : "") : "Ninguém passou do prazo da etapa"} />
          <div className="px-3 pb-4 pt-3">
            {attention.list.length === 0 ? (
              <EmptyState icon={I.Check} title="Ninguém parado" text="Os prazos de cada etapa ficam em Configurações > Funil." />
            ) : (
              <ul className="space-y-0.5">
                {attention.list.slice(0, 6).map(({ mod: m2, c }) => (
                  <DashPersonRow key={m2.id + ":" + c.id} client={c} onClick={() => onOpenIn(m2.id, c.id)} right={<SlaBadge settings={settings} client={c} size="xs" />}>
                    <StatusBadge status={c.status} size="xs" />
                    {c.empresa && <span className="truncate">{c.empresa}</span>}
                    {multi && <ModuleChip mod={m2} size="xs" />}
                  </DashPersonRow>
                ))}
              </ul>
            )}
            {attention.list.length > 6 && (
              <div className="mt-2 px-2 text-[11px] text-slate-400">+{attention.list.length - 6} outro(s) · <button type="button" onClick={() => onGo("clientes")} className="font-semibold text-brand hover:underline">ver na lista</button></div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Quem contatar primeiro" icon={I.Flame}
            subtitle={priority.total ? priority.total + " em aberto em " + mod.nome + ", por pontuação" : "Nenhum cliente em aberto"} />
          <div className="px-3 pb-4 pt-3">
            {priority.total > 0 && (
              <div className="mb-3 px-2">
                <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Distribuição por prioridade">
                  {SCORE_ORDER.map((k) => {
                    const n = priority.dist[k], pct = priority.total ? (n / priority.total) * 100 : 0;
                    return pct > 0 ? <div key={k} className="h-full rounded-sm" style={{ width: pct + "%", background: SCORE_LEVELS[k].color }} title={SCORE_LEVELS[k].label + ": " + n} /> : null;
                  })}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  {SCORE_ORDER.map((k) => (
                    <span key={k} className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: SCORE_LEVELS[k].color }} />{SCORE_LEVELS[k].label} <b className="text-slate-700 tnum">{priority.dist[k]}</b></span>
                  ))}
                </div>
              </div>
            )}
            {priority.top.length === 0 ? (
              <EmptyState icon={I.Users} title="Nada em aberto" text="Cadastre novos leads para ver a prioridade aqui."
                action={<button onClick={onNew} className={btn.secondary}><I.Plus size={16} /> Novo cliente</button>} />
            ) : (
              <ul className="space-y-0.5">
                {priority.top.map(({ c, v }, i) => {
                  const im = interesseMeta(c.interesse);
                  return (
                    <DashPersonRow key={c.id} client={c} onClick={() => onOpen(c.id)} index={i + 1}
                      right={
                        <span className="flex shrink-0 flex-col items-end gap-0.5">
                          <ScoreBadge settings={settings} mod={mod} client={c} size="xs" showPoints />
                          {v > 0 && <span className="text-[11px] text-slate-500 tnum">{BRL(v)}</span>}
                        </span>
                      }>
                      <OwnerChip settings={settings} id={c.responsavel} size="xs" />
                      {im && <span className="shrink-0" style={{ color: im.text }}>· interesse {im.label.toLowerCase()}</span>}
                      <NextStepBadge client={c} size="xs" />
                    </DashPersonRow>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Metas do mês" icon={I.Target} subtitle={mesLabel + " · todos os módulos"} />
          <div className="px-5 pb-5 pt-3">
            {goals.rows.length === 0 ? (
              <EmptyState icon={I.Target} title="Sem metas definidas" text="Cadastre os vendedores e as metas mensais em Configurações > Equipe e metas." />
            ) : (
              <div className="space-y-4">
                {goals.rows.map((r) => {
                  const hit = r.meta > 0 && r.valor >= r.meta;
                  return (
                    <div key={r.v.id}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <OwnerChip settings={settings} id={r.v.id} />
                        <span className="shrink-0 text-xs text-slate-500 tnum"><b className="text-ink">{BRL(r.valor)}</b>{r.meta > 0 ? " de " + BRL(r.meta) : ""}</span>
                      </div>
                      <ProgressBar value={r.valor} max={r.meta || 1} color={hit ? "#047857" : "#3152E4"} height={8} />
                      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400 tnum">
                        <span>{r.fechados} fechado(s) no mês</span>
                        <span className={hit ? "font-semibold text-emerald-700" : ""}>{r.meta > 0 ? (hit ? "Meta batida" : r.pct + "% · faltam " + BRL(r.meta - r.valor)) : "Sem meta definida"}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold text-ink">Equipe</span>
                    <span className="text-xs text-slate-500 tnum"><b className="text-ink">{BRL(goals.totalValor)}</b>{goals.totalMeta > 0 ? " de " + BRL(goals.totalMeta) : ""}</span>
                  </div>
                  <ProgressBar value={goals.totalValor} max={goals.totalMeta || 1} color="#1A1A2E" height={6} className="mt-1.5" />
                  {goals.totalMeta > 0 && <div className="mt-1 text-right text-[11px] text-slate-400 tnum">{goals.pct}% da meta da equipe</div>}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Atualizados recentemente" subtitle={"Os últimos clientes de " + mod.nome + " que tiveram movimentação"}
            action={<button type="button" onClick={() => onGo("clientes")} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand hover:underline">Ver todos <I.ChevR size={14} /></button>} />
          <ul className="mt-3 divide-y divide-slate-100">
            {recent.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onOpen(c.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50">
                  <Avatar name={c.nome} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 truncate text-sm font-semibold text-ink">{c.nome}<SlaBadge settings={settings} client={c} size="xs" hideOk /></div>
                    <div className="truncate text-xs text-slate-500">{c.empresa || "—"}{c.items.length ? " · " + c.items.length + " " + (c.items.length === 1 ? mod.itemLabel.toLowerCase() : mod.itemLabelPlural.toLowerCase()) : ""}</div>
                  </div>
                  <span className="hidden text-xs text-slate-400 sm:block">{relTime(c.updatedAt)}</span>
                  <StatusBadge status={c.status} size="xs" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Atividade recente" icon={I.Activity} />
          <div className="px-5 pb-5 pt-3">
            {activity.length === 0 ? <p className="text-xs text-slate-400">Sem registros ainda.</p> : (
              <ol className="relative ml-1.5 border-l border-slate-200 pl-4">
                {activity.map((h) => (
                  <li key={h.id} className="relative pb-3.5 last:pb-0">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-300" />
                    <button type="button" onClick={() => onOpen(h.clientId)} className="text-left">
                      <span className="block text-xs font-medium leading-snug text-slate-700">{h.text}</span>
                      <span className="block text-[11px] text-slate-400">{h.cliente} · {relTime(h.at)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
