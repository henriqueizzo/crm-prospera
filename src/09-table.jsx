/* ----------------------------- Tabela de clientes ------------------------- */
/* Cabeçalho ordenável. Fica fora do render (contrato v4 §7): recebe sort/onSort por props. */
function ClientsTableTh({ k, sort, onSort, children, className = "", align = "left" }) {
  const active = sort.key === k;
  return (
    <th className={"whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:px-4 " + className}>
      <button type="button" onClick={() => onSort({ key: k, dir: active && sort.dir === "asc" ? "desc" : "asc" })}
        aria-label={"Ordenar por " + (typeof children === "string" ? children : k)}
        className={"inline-flex items-center gap-1 rounded transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 " + (align === "right" ? "flex-row-reverse" : "") + (active ? " text-ink" : "")}>
        {children}
        <span className={active ? "text-brand" : "text-slate-300"}>{active ? (sort.dir === "asc" ? <I.ChevU size={13} /> : <I.ChevD size={13} />) : <I.Sort size={13} />}</span>
      </button>
    </th>
  );
}

/* Nome de arquivo seguro a partir do nome do módulo (sem acento, só letras/números e hífen). */
function clientsTableSlug(s) {
  const base = coreNormalizeText(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "modulo";
}

/* Uma linha da tabela. Fora do render para a lista não recriar o componente a cada render. */
function ClientsTableRow({ mod, c, settings, vendedores, onOpen, onMove, onPatch, onContactLink }) {
  const od = overdueTasks(c).length;
  const sla = slaStatus(settings, c);
  const days = daysInStage(c);
  const val = dealValue(mod, c);
  const origem = origemLabel(settings, c.origem);
  const nt = nextTask(c);
  const needs = needsNextStep(c);
  const owner = isKnownVendedor(settings, c.responsavel) ? c.responsavel : "";
  const stageDaysCls = sla.state === "late" ? "font-semibold text-red-600" : sla.state === "warn" ? "font-semibold text-amber-700" : sla.state === "ok" ? "text-slate-600" : "text-slate-400";
  const stop = (e) => e.stopPropagation();
  const onKey = (e) => {
    if (e.target !== e.currentTarget) return; /* teclas dentro de botões/selects não abrem a ficha */
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(c.id); }
  };
  const changeOwner = (v) => {
    if (v === owner) return;
    onPatch(c.id, { responsavel: v }, "Responsável alterado para " + (vendedorNome(settings, v) || "sem responsável"));
  };

  return (
    <tr tabIndex={0} onClick={() => onOpen(c.id)} onKeyDown={onKey} aria-label={"Abrir " + c.nome}
      className="group cursor-pointer outline-none transition hover:bg-brand-50/40 focus-visible:bg-brand-50/60">
      {/* Cliente: no celular esta coluna também mostra empresa, etapa e valor */}
      <td className="px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Avatar name={c.nome} size={32} className="sm:hidden" />
          <Avatar name={c.nome} size={36} className="hidden sm:flex" />
          <div className="min-w-0 max-w-[160px] sm:max-w-[200px] 2xl:max-w-[260px]">
            <div className="flex items-center gap-1.5 font-semibold text-ink">
              <span className="truncate">{c.nome}</span>
              {od > 0 && <span className="shrink-0 text-red-500" title={od + (od === 1 ? " tarefa atrasada" : " tarefas atrasadas")}><I.Alert size={14} /></span>}
            </div>
            <div className="hidden truncate text-xs text-slate-500 md:block">{c.email || "sem e-mail"}</div>
            <div className="hidden truncate text-[11px] text-slate-400 md:block 2xl:hidden">{owner ? "Resp.: " + vendedorNome(settings, owner) : "Sem responsável"}</div>
            <div className="truncate text-xs text-slate-500 md:hidden">{c.empresa || c.email || <span className="text-slate-300">sem empresa</span>}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 md:hidden">
              <StatusBadge status={c.status} size="xs" />
              <SlaBadge settings={settings} client={c} size="xs" hideOk />
              <NextStepBadge client={c} size="xs" />
              <span className="text-xs font-semibold text-ink tnum sm:hidden">{val ? BRL(val) : ""}</span>
            </div>
          </div>
        </div>
      </td>
      <td className="hidden px-3 py-3 sm:px-4 md:table-cell">
        <div className="max-w-[150px] truncate text-slate-700 2xl:max-w-[180px]">{c.empresa || <span className="text-slate-300">—</span>}</div>
        {origem && <div className="truncate text-[11px] text-slate-400">via {origem}</div>}
      </td>
      {/* Responsável: select pequeno que salva direto (sem abrir a ficha) */}
      <td className="hidden px-3 py-2 sm:px-4 2xl:table-cell" onClick={stop}>
        <Select small ariaLabel={"Responsável por " + c.nome} className="w-36" value={owner} onChange={changeOwner}
          placeholder="Sem responsável" options={vendedores.map((v) => ({ value: v.id, label: v.nome }))} />
      </td>
      <td className="hidden px-3 py-3 sm:px-4 md:table-cell">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={c.status} />
          <SlaBadge settings={settings} client={c} size="xs" hideOk />
        </div>
      </td>
      <td className="hidden px-3 py-3 sm:px-4 md:table-cell"><ScoreBadge settings={settings} mod={mod} client={c} size="xs" /></td>
      <td className="hidden px-3 py-3 sm:px-4 lg:table-cell">
        <div className="max-w-[200px]">
          {nt ? <NextTaskLine client={c} size="xs" /> : needs ? <NextStepBadge client={c} size="xs" /> : <span className="text-xs text-slate-300">—</span>}
        </div>
      </td>
      <td className="hidden px-3 py-3 text-right text-slate-600 tnum sm:px-4 2xl:table-cell">{c.items.length}</td>
      <td className="hidden px-3 py-3 text-right font-semibold text-ink tnum sm:table-cell sm:px-4">{val ? BRL(val) : <span className="font-normal text-slate-300">—</span>}</td>
      <td className={"hidden px-3 py-3 text-right text-xs tnum sm:px-4 2xl:table-cell " + stageDaysCls} title={sla.label}>
        {days}{days === 1 ? " dia" : " dias"}
      </td>
      <td className="hidden px-3 py-3 text-right text-xs text-slate-400 sm:px-4 2xl:table-cell">{relTime(c.updatedAt)}</td>
      {/* Ações rápidas: WhatsApp / Ligar / E-mail + Mover etapa. Clique aqui não abre a ficha. */}
      <td className="px-1.5 py-2 sm:px-3" onClick={stop}>
        <div className="flex flex-wrap items-center justify-end gap-1 sm:flex-nowrap">
          <ContactIcons client={c} size="xs" onLog={(canal) => onContactLink(c.id, canal)} />
          <StatusMenu compact value={c.status} onChange={(s) => onMove(c.id, s)} align="right" />
        </div>
      </td>
      <td className="hidden pr-3 text-slate-300 group-hover:text-brand md:table-cell"><I.ChevR size={18} /></td>
    </tr>
  );
}

function ClientsTable({ mod, clients, total, sort, onSort, onOpen, onNew, hasFilter, onClear, settings, onMove, onPatch, onContactLink }) {
  const shownValue = clients.reduce((s, c) => s + dealValue(mod, c), 0);
  const stalled = clients.filter((c) => slaStatus(settings, c).state === "late").length;
  const noStep = clients.filter((c) => needsNextStep(c)).length;
  const vendedores = (settings && settings.vendedores) || [];
  const ExportIc = I.Spreadsheet || I.Download;
  const th = { sort, onSort };

  const exportList = () => {
    const csv = clientsToCSV(mod, settings, clients);
    downloadFile("prospera-" + clientsTableSlug(mod.nome) + "-lista-" + todayISO() + ".csv", csv, "text/csv;charset=utf-8");
  };

  return (
    <Card className="overflow-hidden">
      {clients.length === 0 ? (
        hasFilter
          ? <EmptyState icon={I.Search} title="Nenhum cliente encontrado" text="Tente outro termo ou limpe os filtros." action={<button onClick={onClear} className={btn.secondary}>Limpar filtros</button>} />
          : <EmptyState icon={I.Inbox} title={"Nenhum cliente em " + mod.nome} text="Cadastre o primeiro cliente deste módulo." action={<button onClick={onNew} className={btn.primary}><I.Plus size={18} /> Cadastrar cliente</button>} />
      ) : (
        <>
          <div className="overflow-x-auto">
            {/* Sem largura mínima no celular: a tabela se ajusta a 390px. A partir de md volta a ter 900px e rola na horizontal. */}
            <table className="w-full text-sm md:min-w-[900px]">
              <thead className="border-b border-slate-200 bg-slate-50/80">
                <tr>
                  <ClientsTableTh k="nome" {...th}>Cliente</ClientsTableTh>
                  <ClientsTableTh k="empresa" {...th} className="hidden md:table-cell">Empresa</ClientsTableTh>
                  <ClientsTableTh k="responsavel" {...th} className="hidden 2xl:table-cell">Responsável</ClientsTableTh>
                  <ClientsTableTh k="status" {...th} className="hidden md:table-cell">Etapa</ClientsTableTh>
                  <ClientsTableTh k="score" {...th} className="hidden md:table-cell">Prioridade</ClientsTableTh>
                  <ClientsTableTh k="proximaTarefa" {...th} className="hidden lg:table-cell">Próxima tarefa</ClientsTableTh>
                  <ClientsTableTh k="itens" {...th} className="hidden text-right 2xl:table-cell" align="right">{mod.itemLabelPlural.split(" ")[0]}</ClientsTableTh>
                  <ClientsTableTh k="valor" {...th} className="hidden text-right sm:table-cell" align="right">Valor</ClientsTableTh>
                  <ClientsTableTh k="etapaDias" {...th} className="hidden text-right 2xl:table-cell" align="right">Na etapa</ClientsTableTh>
                  <ClientsTableTh k="updatedAt" {...th} className="hidden text-right 2xl:table-cell" align="right">Atualizado</ClientsTableTh>
                  <th className="whitespace-nowrap px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Ações</th>
                  <th className="hidden w-8 md:table-cell" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((c) => (
                  <ClientsTableRow key={c.id} mod={mod} c={c} settings={settings} vendedores={vendedores}
                    onOpen={onOpen} onMove={onMove} onPatch={onPatch} onContactLink={onContactLink} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Mostrando <b className="text-slate-700 tnum">{clients.length}</b> de {total}</span>
              <span>Valor: <b className="text-slate-700 tnum">{BRL(shownValue)}</b></span>
              {stalled > 0 && <span className="inline-flex items-center gap-1 font-semibold text-red-600"><I.Alert size={13} /> {stalled} {stalled === 1 ? "parado na etapa" : "parados na etapa"}</span>}
              {noStep > 0 && <span className="inline-flex items-center gap-1 font-semibold text-amber-700"><I.Flag size={13} /> {noStep} sem próximo passo</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden xl:inline">Clique ou use Enter em uma linha para abrir o cliente</span>
              <button type="button" onClick={exportList} className={btn.secondary + " !py-1.5 !px-3 !text-xs"} title="Baixa um .csv só com os clientes mostrados nesta lista (respeita busca, filtros e ordem)">
                <ExportIc size={14} /> Exportar esta lista
              </button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
