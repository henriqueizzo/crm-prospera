/* -------------------------------- Relatórios ------------------------------
   Tela "Relatórios": conversão, tempos, motivos de perda, origens, vendedores
   e prioridade. Só CSS para os gráficos; helpers locais prefixados com "reports".
   Período = data de cadastro (createdAt). Dinheiro sempre via dealValue.
--------------------------------------------------------------------------- */
const REPORTS_PERIODS = [
  { key: "mes", label: "Este mês", desc: "neste mês" },
  { key: "3m", label: "3 meses", desc: "nos últimos 3 meses" },
  { key: "12m", label: "12 meses", desc: "nos últimos 12 meses" },
  { key: "tudo", label: "Tudo", desc: "em qualquer data" },
];

/* Início do período escolhido como Date LOCAL (00:00 do dia 1 do mês); null = sem corte.
   "3 meses"/"12 meses" partem do dia 1 do mês, então nunca transbordam (ex.: 31/03 - 1 mês). */
function reportsSince(key) {
  const d = new Date();
  if (key === "mes") return new Date(d.getFullYear(), d.getMonth(), 1);
  if (key === "3m") return new Date(d.getFullYear(), d.getMonth() - 3, 1);
  if (key === "12m") return new Date(d.getFullYear(), d.getMonth() - 12, 1);
  return null;
}
function reportsPct(n, d) { return d > 0 ? Math.round((n / d) * 100) : 0; }
function reportsAvg(arr) { return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null; }
function reportsFmtDays(v) { return v == null ? "—" : (Math.round(v * 10) / 10).toLocaleString("pt-BR") + (v === 1 ? " dia" : " dias"); }
function reportsReachedNegotiation(c) {
  if (c.status === "negociacao" || c.status === "fechado") return true;
  return (c.stageLog || []).some((s) => s.status === "negociacao" || s.status === "fechado");
}
/* Chave e rótulo de um id de lista (origem/motivo): vazio → "sem", desconhecido → "removido" (agrupa num só). */
function reportsBucket(id, label, emptyLabel) {
  if (!id) return { key: "sem", label: emptyLabel };
  return label ? { key: id, label } : { key: "removido", label: "Removido" };
}

function ReportsChip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={!!active}
      className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition " + (active ? "border-transparent bg-ink text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}>
      {children}
    </button>
  );
}

/* Linha de gráfico de barras horizontal. */
function ReportsBarRow({ label, value, max, color, right, sub }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <li className="flex items-center gap-3 py-2 text-sm">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <div className="w-36 min-w-0 shrink-0 sm:w-44">
        <div className="truncate font-medium text-slate-700">{label}</div>
        {sub && <div className="truncate text-[11px] text-slate-400">{sub}</div>}
      </div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all" style={{ width: pct + "%", background: color }} /></div>
      <span className="w-24 shrink-0 text-right text-xs text-slate-500 tnum">{right}</span>
    </li>
  );
}

function ReportsBigNumber({ label, value, sub, tone = "brand" }) {
  const tones = { brand: "bg-brand-50 text-brand", green: "bg-emerald-50 text-emerald-800", amber: "bg-amber-50 text-amber-800", slate: "bg-slate-50 text-slate-700" };
  return (
    <div className={"rounded-2xl p-4 " + tones[tone]}>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-bold leading-none tracking-tight tnum">{value}</div>
      {sub && <div className="mt-1.5 text-xs opacity-70">{sub}</div>}
    </div>
  );
}

function Reports({ mod, clients, allModules, settings, onOpen }) {
  const [period, setPeriod] = useState("3m");
  const [allMods, setAllMods] = useState(false);

  /* Linhas da análise: { c, mod, valor }. Com "todos os módulos" ligado, o valor
     é calculado pelos campos do módulo de cada cliente. Período = data de cadastro. */
  const rows = useMemo(() => {
    const since = reportsSince(period);
    const source = allMods && allModules && allModules.length ? allModules : [mod];
    const list = [];
    source.forEach((m2) => (m2.clients || []).forEach((c) => {
      if (since) {
        const created = new Date(c.createdAt || "");
        if (isNaN(created.getTime()) || created < since) return;
      }
      list.push({ c, mod: m2, valor: dealValue(m2, c) });
    }));
    return list;
  }, [period, allMods, mod, allModules]);

  const data = useMemo(() => {
    const total = rows.length;
    const fechados = rows.filter((r) => r.c.status === "fechado");
    const perdidos = rows.filter((r) => r.c.status === "perdido");
    const abertos = rows.filter((r) => r.c.status === "lead" || r.c.status === "negociacao");
    const reached = rows.filter((r) => reportsReachedNegotiation(r.c)).length;

    /* 1. conversão em degraus */
    const steps = [
      { key: "cad", label: "Cadastrados", n: total, color: "#3152E4" },
      { key: "neg", label: "Chegaram a negociação", n: reached, color: "#D97706" },
      { key: "fec", label: "Fechados", n: fechados.length, color: "#047857" },
    ];

    /* 2. tempo médio por etapa (lead e negociação) + ciclo médio */
    const perStage = { lead: [], negociacao: [] };
    rows.forEach((r) => stageDurations(r.c).forEach((d) => { if (perStage[d.status]) perStage[d.status].push(d.days); }));
    const stageAvg = [
      { key: "lead", label: "Lead", avg: reportsAvg(perStage.lead), n: perStage.lead.length, color: "#3152E4" },
      { key: "negociacao", label: "Em negociação", avg: reportsAvg(perStage.negociacao), n: perStage.negociacao.length, color: "#D97706" },
    ];
    const cycles = fechados.map((r) => { const at = closedAt(r.c); return at ? Math.max(0, (new Date(at) - new Date(r.c.createdAt)) / 864e5) : null; }).filter((x) => x != null && !isNaN(x));
    const cycleAvg = reportsAvg(cycles);

    /* 3. motivos de perda (id removido das configurações → "Removido") */
    const lossMap = {};
    perdidos.forEach((r) => {
      const k = r.c.motivoPerda || "";
      const b = reportsBucket(k, motivoLabel(settings, k), "Sem motivo informado");
      if (!lossMap[b.key]) lossMap[b.key] = { key: b.key, label: b.label, n: 0, valor: 0 };
      lossMap[b.key].n += 1; lossMap[b.key].valor += r.valor;
    });
    const losses = Object.values(lossMap).sort((a, b) => b.n - a.n);

    /* 4. origens (id removido → "Removido") */
    const origMap = {};
    rows.forEach((r) => {
      const k = r.c.origem || "";
      const b = reportsBucket(k, origemLabel(settings, k), "Não informada");
      if (!origMap[b.key]) origMap[b.key] = { key: b.key, label: b.label, n: 0, fechados: 0, perdidos: 0, valor: 0 };
      origMap[b.key].n += 1;
      if (r.c.status === "fechado") { origMap[b.key].fechados += 1; origMap[b.key].valor += r.valor; }
      if (r.c.status === "perdido") origMap[b.key].perdidos += 1;
    });
    const origins = Object.values(origMap).sort((a, b) => b.n - a.n);

    /* 5. vendedores (kind: "vendedor" | "removido" | "sem") */
    const vendedores = (settings && settings.vendedores) || [];
    const mkRow = (id, nome, kind, meta) => ({ id, nome, kind, meta, n: 0, abertos: 0, fechados: 0, perdidos: 0, valor: 0, valorMes: 0 });
    const sellerRows = vendedores.map((v) => mkRow(v.id, v.nome, "vendedor", Number(v.metaMensal) || 0));
    const removido = mkRow("__removido", "Removido", "removido", 0);
    const semResp = mkRow("", "Sem responsável", "sem", 0);
    rows.forEach((r) => {
      const rid = r.c.responsavel || "";
      const row = !rid ? semResp : (sellerRows.find((s) => s.id === rid) || removido);
      row.n += 1;
      if (r.c.status === "lead" || r.c.status === "negociacao") row.abertos += 1;
      if (r.c.status === "perdido") row.perdidos += 1;
      if (r.c.status === "fechado") {
        row.fechados += 1; row.valor += r.valor;
        const at = closedAt(r.c);
        if (at && isSameMonth(at)) row.valorMes += r.valor;
      }
    });
    const sellers = [...sellerRows, ...(removido.n > 0 ? [removido] : []), ...(semResp.n > 0 ? [semResp] : [])];

    /* 6. prioridade da carteira em aberto */
    const scored = abertos.map((r) => ({ ...r, s: scoreClient(settings, r.mod, r.c) })).sort((a, b) => b.s.points - a.s.points);
    const dist = { alta: 0, media: 0, baixa: 0 };
    scored.forEach((x) => { dist[x.s.level] = (dist[x.s.level] || 0) + 1; });

    return { total, fechados, perdidos, abertos, steps, stageAvg, cycleAvg, cycles, losses, origins, sellers, scored, dist,
      valorFechado: fechados.reduce((s, r) => s + r.valor, 0), valorPerdido: perdidos.reduce((s, r) => s + r.valor, 0) };
  }, [rows, settings]);

  const canOpen = (r) => r.mod.id === mod.id;
  const periodMeta = REPORTS_PERIODS.find((p) => p.key === period) || REPORTS_PERIODS[0];
  const maxStageAvg = Math.max(0, ...data.stageAvg.map((s) => s.avg || 0));
  const maxLoss = Math.max(0, ...data.losses.map((l) => l.n));
  const maxOrig = Math.max(0, ...data.origins.map((o) => o.n));
  const SCORE_ORDER = ["alta", "media", "baixa"];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 hidden items-center gap-1 text-xs font-medium text-slate-400 sm:inline-flex"><I.Calendar size={13} /> Período</span>
        {REPORTS_PERIODS.map((p) => <ReportsChip key={p.key} active={period === p.key} onClick={() => setPeriod(p.key)}>{p.label}</ReportsChip>)}
        {allModules && allModules.length > 1 && (
          <label className="ml-1 inline-flex cursor-pointer select-none items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
            <span className={"relative inline-flex h-4 w-7 items-center rounded-full transition " + (allMods ? "bg-brand" : "bg-slate-300")}>
              <span className={"absolute h-3 w-3 rounded-full bg-white shadow transition " + (allMods ? "left-3.5" : "left-0.5")} />
            </span>
            <input type="checkbox" className="sr-only" checked={allMods} onChange={(e) => setAllMods(e.target.checked)} />
            Todos os módulos
          </label>
        )}
        <span className="text-xs text-slate-500 sm:ml-auto">
          <b className="text-ink tnum">{data.total}</b> {data.total === 1 ? "cliente" : "clientes"} na análise · {allMods && allModules && allModules.length > 1 ? "todos os módulos" : mod.nome} · cadastrados {periodMeta.desc}
          <span className="ml-1 text-[11px] text-slate-400">(período = data de cadastro)</span>
        </span>
      </div>

      {data.total === 0 ? (
        <Card>
          <EmptyState icon={I.BarChart} title="Sem dados no período" text="Nenhum cliente foi cadastrado nesse intervalo. Experimente um período maior ou ligue “Todos os módulos”."
            action={<button onClick={() => setPeriod("tudo")} className={btn.secondary}>Ver tudo</button>} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Conversão por etapa" icon={I.Trend} subtitle="De cada 100 clientes cadastrados, quantos avançaram e quantos fecharam" />
              <div className="px-5 pb-5 pt-4">
                <div className="space-y-3">
                  {data.steps.map((s, i) => (
                    <div key={s.key}>
                      {i > 0 && (
                        <div className="mb-1 flex items-center gap-1 pl-1 text-[11px] text-slate-400">
                          <I.ChevD size={12} /> {reportsPct(s.n, data.steps[i - 1].n)}% dos anteriores
                        </div>
                      )}
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                        <span className="w-44 shrink-0 text-sm font-medium text-slate-700">{s.label}</span>
                        <div className="flex flex-1 items-center gap-3">
                          <div className="h-6 flex-1 overflow-hidden rounded-lg bg-slate-100">
                            <div className="h-full rounded-lg transition-all" style={{ width: reportsPct(s.n, data.total) + "%", background: s.color }} />
                          </div>
                          <span className="w-8 shrink-0 text-right text-sm font-bold text-ink tnum">{s.n}</span>
                          <span className="w-10 shrink-0 text-right text-xs text-slate-400 tnum">{reportsPct(s.n, data.total)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#DC2626" }} />Perdidos: <b className="text-ink tnum">{data.perdidos.length}</b> ({reportsPct(data.perdidos.length, data.total)}%)</span>
                  <span>Em aberto: <b className="text-ink tnum">{data.abertos.length}</b></span>
                  <span>Valor fechado: <b className="text-ink tnum">{BRL(data.valorFechado)}</b></span>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Tempo médio em cada etapa" icon={I.Timer} subtitle="Quantos dias um cliente costuma ficar parado em cada etapa" />
              <div className="px-5 pb-5 pt-4">
                <ReportsBigNumber label="Ciclo médio de venda" value={reportsFmtDays(data.cycleAvg)} sub={data.cycles.length ? "do cadastro ao fechamento · " + data.cycles.length + " negócio(s)" : "Nenhum negócio fechado no período"} tone="green" />
                <ul className="mt-3 divide-y divide-slate-100">
                  {data.stageAvg.map((s) => (
                    <ReportsBarRow key={s.key} label={s.label} value={s.avg || 0} max={maxStageAvg} color={s.color} right={reportsFmtDays(s.avg)} sub={s.n ? s.n + " passagem(ns)" : "sem dados"} />
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-slate-400">A etapa atual de cada cliente conta até hoje.</p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Por que perdemos" icon={I.TrendingDown} subtitle="Motivos informados ao marcar um cliente como perdido" />
              <div className="px-5 pb-5 pt-3">
                {data.losses.length === 0 ? (
                  <EmptyState icon={I.Check} title="Nenhuma perda no período" text="Quando um cliente for marcado como perdido, o motivo aparece aqui." />
                ) : (
                  <>
                    <ul className="divide-y divide-slate-100">
                      {data.losses.map((l) => (
                        <ReportsBarRow key={l.key} label={l.label} value={l.n} max={maxLoss} color="#DC2626"
                          right={<span><b className="text-ink">{l.n}</b> · {reportsPct(l.n, data.perdidos.length)}%</span>} sub={l.valor ? BRL(l.valor) : null} />
                      ))}
                    </ul>
                    <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      {data.perdidos.length} perdido(s) · {BRL(data.valorPerdido)} em valor que não fechou
                    </div>
                  </>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="De onde vêm os clientes" icon={I.Flag} subtitle="Origem informada no cadastro e quantos fecharam de cada uma" />
              <div className="px-5 pb-5 pt-3">
                <ul className="divide-y divide-slate-100">
                  {data.origins.map((o) => (
                    <ReportsBarRow key={o.key} label={o.label} value={o.n} max={maxOrig} color="#3152E4"
                      right={<span><b className="text-ink">{o.n}</b> · {o.fechados} fech.</span>}
                      sub={(o.fechados + o.perdidos) > 0 ? "converte " + reportsPct(o.fechados, o.fechados + o.perdidos) + "%" : "ainda sem decisão"} />
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-slate-400">Conversão = fechados ÷ (fechados + perdidos) daquela origem. "Removido" = origem apagada das configurações.</p>
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader title="Desempenho por vendedor" icon={I.Users} subtitle={"Carteira, fechamentos e meta de " + new Date().toLocaleDateString("pt-BR", { month: "long" })} />
            <div className="mt-3 overflow-x-auto">
              {data.sellers.length === 0 ? (
                <EmptyState icon={I.User} title="Nenhum vendedor cadastrado" text="Cadastre a equipe em Configurações > Equipe e metas para ver o desempenho aqui." />
              ) : (
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="border-y border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-2.5 text-left">Vendedor</th>
                      <th className="px-3 py-2.5 text-right">Clientes</th>
                      <th className="px-3 py-2.5 text-right">Em aberto</th>
                      <th className="px-3 py-2.5 text-right">Fechados</th>
                      <th className="px-3 py-2.5 text-right">Valor fechado</th>
                      <th className="px-3 py-2.5 text-left">Meta do mês</th>
                      <th className="px-5 py-2.5 text-right">Conversão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.sellers.map((s) => {
                      const decididos = s.fechados + s.perdidos;
                      const hit = s.meta > 0 && s.valorMes >= s.meta;
                      return (
                        <tr key={s.id || "sem"} className={s.kind === "vendedor" ? "" : "bg-slate-50/50"}>
                          <td className="px-5 py-3">
                            {s.kind === "vendedor"
                              ? <OwnerChip settings={settings} id={s.id} />
                              : s.kind === "removido"
                                ? <span className="text-xs text-slate-500" title="Vendedor apagado das configurações; os clientes continuam com a referência antiga">Removido</span>
                                : <span className="text-xs text-slate-400">Sem responsável</span>}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-700 tnum">{s.n}</td>
                          <td className="px-3 py-3 text-right text-slate-700 tnum">{s.abertos}</td>
                          <td className="px-3 py-3 text-right font-semibold text-ink tnum">{s.fechados}</td>
                          <td className="px-3 py-3 text-right font-semibold text-ink tnum">{s.valor ? BRL(s.valor) : <span className="font-normal text-slate-300">—</span>}</td>
                          <td className="px-3 py-3">
                            {s.kind === "vendedor" && s.meta > 0 ? (
                              <div className="min-w-[160px]">
                                <div className="mb-1 flex justify-between text-[11px] tnum"><span className={hit ? "font-semibold text-emerald-700" : "text-slate-500"}>{BRL(s.valorMes)}</span><span className="text-slate-400">{reportsPct(s.valorMes, s.meta)}%</span></div>
                                <ProgressBar value={s.valorMes} max={s.meta} color={hit ? "#047857" : "#3152E4"} height={6} />
                              </div>
                            ) : <span className="text-xs text-slate-300">—</span>}
                          </td>
                          <td className="px-5 py-3 text-right tnum">{decididos ? <b className="text-ink">{reportsPct(s.fechados, decididos)}%</b> : <span className="text-slate-300">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Prioridade da carteira em aberto" icon={I.Flame} subtitle="Pontuação dos clientes em lead e negociação (porte, interesse, itens, contato e origem)" />
            <div className="grid grid-cols-1 gap-5 px-5 pb-5 pt-3 lg:grid-cols-2">
              <div>
                {data.abertos.length === 0 ? <p className="text-xs text-slate-400">Nenhum cliente em aberto no período.</p> : (
                  <ul className="divide-y divide-slate-100">
                    {SCORE_ORDER.map((k) => (
                      <ReportsBarRow key={k} label={"Prioridade " + SCORE_LEVELS[k].label.toLowerCase()} value={data.dist[k]} max={data.abertos.length} color={SCORE_LEVELS[k].color}
                        right={<span><b className="text-ink">{data.dist[k]}</b> · {reportsPct(data.dist[k], data.abertos.length)}%</span>} />
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Os 3 melhores para contatar</div>
                {data.scored.length === 0 ? <p className="text-xs text-slate-400">Sem clientes em aberto.</p> : (
                  <ul className="space-y-1">
                    {data.scored.slice(0, 3).map((r, i) => {
                      const inner = (
                        <>
                          <span className="w-4 shrink-0 text-center text-[11px] font-bold text-slate-300 tnum">{i + 1}</span>
                          <Avatar name={r.c.nome} size={32} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-ink">{r.c.nome}</div>
                            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-400">
                              <span className="truncate">{r.c.empresa || "—"}{!canOpen(r) ? " · " + r.mod.nome : ""}</span>
                              {r.valor > 0 && <span className="tnum">· {BRL(r.valor)}</span>}
                              <NextStepBadge client={r.c} size="xs" />
                            </div>
                          </div>
                          <ScoreBadge settings={settings} mod={r.mod} client={r.c} size="xs" showPoints />
                        </>
                      );
                      return (
                        <li key={r.mod.id + ":" + r.c.id}>
                          {canOpen(r)
                            ? <button type="button" onClick={() => onOpen(r.c.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-slate-50">{inner}</button>
                            : <div className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left opacity-80" title={"Está no módulo " + r.mod.nome}>{inner}</div>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
