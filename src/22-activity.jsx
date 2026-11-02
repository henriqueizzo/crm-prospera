/* ----------------------------- Atividades (v5) ---------------------------- */
/* Tela "Atividades" (só administrador): resumo de uso por usuário e o registro
   de tudo o que foi feito no CRM (entradas, clientes, etapas, tarefas, contatos,
   notas, propostas, backup/dados, configurações e gestão de usuários). */

const ACTIVITY_PERIODS = [{ days: 7, label: "7 dias" }, { days: 30, label: "30 dias" }, { days: 90, label: "90 dias" }, { days: 0, label: "Tudo" }];
const ACTIVITY_PAGE = 80;

function ActivityTypeBadge({ tipo, size = "xs" }) {
  const m = activityTypeMeta(tipo);
  const Ic = I[m.icon] || I.Activity;
  return <span className={uiPillCls(size)} style={{ background: m.soft, color: m.text }}><Ic size={uiPillIcon(size)} />{m.label}</span>;
}
/* "Hoje", "Ontem" ou "seg, 20/10". */
function activityDayLabel(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Sem data";
  const day = toISODate(d);
  if (day === todayISO()) return "Hoje";
  if (day === addDaysISO(todayISO(), -1)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");
}
function activityTime(iso) { const d = new Date(iso); return isNaN(d.getTime()) ? "" : pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }

function ActivityView({ activity, users, modules, onOpenIn, notify }) {
  const [days, setDays] = useState(30);
  const [userId, setUserId] = useState("");
  const [tipo, setTipo] = useState("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(ACTIVITY_PAGE);

  const inPeriod = useMemo(() => activityInDays(activity, days), [activity, days]);
  const summary = useMemo(() => activitySummary(inPeriod, users), [inPeriod, users]);
  const filtered = useMemo(() => {
    const qq = coreNormalizeText(q);
    return inPeriod.filter((e) =>
      (!userId || e.userId === userId) && (!tipo || e.tipo === tipo) &&
      (!qq || coreNormalizeText(e.texto + " " + e.clientNome + " " + e.userNome).includes(qq)));
  }, [inPeriod, userId, tipo, q]);
  useEffect(() => { setLimit(ACTIVITY_PAGE); }, [days, userId, tipo, q]);
  const shown = filtered.slice(0, limit);

  /* Agrupa por dia (a lista já vem da mais recente para a mais antiga). */
  const groups = [];
  shown.forEach((e) => {
    const label = activityDayLabel(e.at);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(e); else groups.push({ label, items: [e] });
  });
  const modName = (id) => { const m = (modules || []).find((x) => x.id === id); return m ? m.nome : ""; };
  const clientExists = (e) => { const m = (modules || []).find((x) => x.id === e.modId); return !!(m && (m.clients || []).some((c) => c.id === e.clientId)); };
  const exportCSV = () => {
    downloadFile("prospera-crm-atividades-" + todayISO() + ".csv", activityToCSV(filtered), "text/csv;charset=utf-8");
    notify && notify({ title: "Atividades exportadas", message: filtered.length + (filtered.length === 1 ? " registro" : " registros") });
  };
  const userOpts = users.map((u) => ({ value: u.id, label: u.nome }));
  const tipoOpts = ACTIVITY_TYPES.map((t) => ({ value: t.key, label: t.label }));
  const periodLabel = (ACTIVITY_PERIODS.find((p) => p.days === days) || ACTIVITY_PERIODS[1]).label;
  const hasFilter = !!(userId || tipo || q);

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5" role="tablist" aria-label="Período">
            {ACTIVITY_PERIODS.map((p) => (
              <button key={p.days} type="button" role="tab" aria-selected={days === p.days} onClick={() => setDays(p.days)}
                className={"rounded-lg px-3 py-1.5 text-xs font-semibold transition " + (days === p.days ? "bg-ink text-white" : "text-slate-600 hover:bg-slate-100")}>
                {p.label}
              </button>
            ))}
          </div>
          <Select small className="w-full sm:w-48" value={userId} onChange={setUserId} options={userOpts} placeholder="Todos os usuários" ariaLabel="Filtrar por usuário" />
          <Select small className="w-full sm:w-44" value={tipo} onChange={setTipo} options={tipoOpts} placeholder="Todos os tipos" ariaLabel="Filtrar por tipo" />
          <div className="relative min-w-[200px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><I.Search size={15} /></span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no registro…" className={inputCls + " py-2 pl-9 text-xs"} aria-label="Buscar nas atividades" />
          </div>
          {hasFilter && (
            <button type="button" onClick={() => { setUserId(""); setTipo(""); setQ(""); }} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-ink"><I.X size={13} /> Limpar</button>
          )}
          <button type="button" onClick={exportCSV} disabled={!filtered.length} className={btn.secondary + " px-3 py-2 text-xs disabled:opacity-40"}><I.Table size={14} /> Exportar CSV</button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Uso por usuário" subtitle={"Ações registradas · " + (days ? "últimos " + periodLabel : "todo o período") + ". Clique em alguém para filtrar o registro."} icon={I.Users} />
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {summary.map((s) => {
            const sel = userId === s.userId;
            const top = Object.entries(s.porTipo).sort((a, b) => b[1] - a[1]).slice(0, 3);
            return (
              <button key={s.userId || "sem"} type="button" onClick={() => setUserId(sel ? "" : s.userId)} aria-pressed={sel}
                className={"card-hover flex items-start gap-3 rounded-xl border p-3.5 text-left transition " + (sel ? "border-brand bg-brand-50/50" : "border-slate-200 bg-white")}>
                <Avatar name={s.nome} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-ink">{s.nome}</span>
                    {s.removido ? <span className="text-[11px] text-slate-400">(removido)</span> : !s.ativo && <span className="text-[11px] font-medium text-red-600">desativado</span>}
                  </span>
                  <span className="block text-[11px] text-slate-500 tnum">{s.total} {s.total === 1 ? "ação" : "ações"}{s.ultimo ? " · última " + relTime(s.ultimo) : ""}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {top.map(([k, n]) => <span key={k} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600 tnum">{activityTypeMeta(k).label} · {n}</span>)}
                    {!top.length && <span className="text-[11px] text-slate-400">Sem atividade no período</span>}
                  </span>
                </span>
              </button>
            );
          })}
          {summary.length === 0 && <p className="text-xs text-slate-400 sm:col-span-2 xl:col-span-3">Nenhum usuário cadastrado.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Registro" icon={I.History}
          subtitle={filtered.length ? filtered.length + (filtered.length === 1 ? " registro" : " registros") + (filtered.length > shown.length ? " · mostrando " + shown.length : "") : "Nada registrado com esses filtros"} />
        {groups.length === 0 ? (
          <EmptyState icon={I.History} title="Nenhuma atividade"
            text="Conforme o time usa o CRM, tudo o que acontece aparece aqui: entradas, clientes, etapas, tarefas, contatos, notas e configurações." />
        ) : (
          <div className="px-5 pb-5 pt-3">
            {groups.map((g) => (
              <div key={g.label} className="mb-4 last:mb-0">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.label}</div>
                <ul className="divide-y divide-slate-100">
                  {g.items.map((e) => {
                    const canOpen = !!e.clientId && clientExists(e);
                    const mn = e.modId ? modName(e.modId) : "";
                    return (
                      <li key={e.id} className="flex items-start gap-3 py-2.5">
                        <span className="w-11 shrink-0 pt-0.5 text-xs tnum text-slate-400">{activityTime(e.at)}</span>
                        <Avatar name={e.userNome || "?"} size={26} className="mt-px" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-semibold text-ink">{e.userNome || "Usuário removido"}</span>
                            <ActivityTypeBadge tipo={e.tipo} />
                            {mn && <span className="text-[11px] text-slate-400">{mn}</span>}
                          </div>
                          <div className="mt-0.5 text-sm text-slate-700">
                            {e.texto}
                            {e.clientNome && (
                              <> · {canOpen
                                ? <button type="button" onClick={() => onOpenIn(e.modId, e.clientId)} className="font-medium text-brand hover:underline">{e.clientNome}</button>
                                : <span className="font-medium text-slate-500" title="Cliente não existe mais">{e.clientNome}</span>}</>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {filtered.length > shown.length && (
              <div className="pt-2 text-center"><button type="button" onClick={() => setLimit((l) => l + ACTIVITY_PAGE)} className={btn.secondary}>Mostrar mais</button></div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
