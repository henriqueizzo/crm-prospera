/* --------------------------------- Funnel --------------------------------- */
/* Pílula de resumo do topo do funil. Fora do render (contrato v4 §7). */
function FunnelStat({ label, value, tone }) {
  return (
    <span className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs " + (tone === "red" ? "border-red-100 bg-red-50 text-red-700" : tone === "amber" ? "border-amber-100 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-500")}>
      {label}<b className={"tnum " + (tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-800" : "text-ink")}>{value}</b>
    </span>
  );
}

/* Card de um cliente no Kanban. Arrastável, abre com clique/Enter/Espaço e tem ações rápidas
   (WhatsApp / Ligar / E-mail / Mover) que NÃO abrem a ficha. */
function FunnelCard({ mod, c, settings, grabbing, dragId, setGrabbing, setOver, onOpen, onMove, onContactLink }) {
  const pend = pendingTasks(c).length, od = overdueTasks(c).length, val = dealValue(mod, c);
  const sla = slaStatus(settings, c);
  const edge = sla.state === "late" ? SLA_TONES.late.color : sla.state === "warn" ? SLA_TONES.warn.color : "#E2E8F0";
  const motivo = c.status === "perdido" ? motivoLabel(settings, c.motivoPerda) : "";
  const nt = nextTask(c);
  const needs = needsNextStep(c);
  const LossIcon = I.TrendingDown || I.Alert;
  const isGrabbing = grabbing === c.id;
  const stop = (e) => e.stopPropagation();
  const onKey = (e) => {
    if (e.target !== e.currentTarget) return; /* teclas dentro dos botões do card não abrem a ficha */
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(c.id); }
  };
  const onDragStart = (e) => {
    try { e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; } catch (err) {}
    if (dragId) dragId.current = c.id;
    setGrabbing(c.id);
  };
  const onDragEnd = () => { setGrabbing(null); setOver(null); };

  return (
    <article draggable tabIndex={0} role="button" aria-label={"Abrir " + c.nome}
      onDragStart={onDragStart} onDragEnd={onDragEnd}
      onClick={() => onOpen(c.id)} onKeyDown={onKey}
      style={{ borderLeftColor: isGrabbing ? undefined : edge }}
      className={"cursor-grab rounded-xl border border-l-[3px] bg-white p-3.5 shadow-card outline-none transition hover:-translate-y-px hover:border-brand/40 hover:shadow-pop focus-visible:ring-4 focus-visible:ring-brand/20 active:cursor-grabbing " + (isGrabbing ? "border-brand opacity-50" : "border-slate-200")}>
      <div className="flex items-start gap-2.5">
        <Avatar name={c.nome} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">{c.nome}</div>
          <div className="truncate text-xs text-slate-500">{c.empresa || "—"}</div>
        </div>
      </div>
      {c.items.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {c.items.slice(0, 3).map((it) => (
            <span key={it.id} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">{itemTitle(mod, it)}</span>
          ))}
          {c.items.length > 3 && <span className="self-center text-[11px] text-slate-400">+{c.items.length - 3}</span>}
        </div>
      )}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <OwnerChip settings={settings} id={c.responsavel} size="xs" className="min-w-0" />
        <ScoreBadge settings={settings} mod={mod} client={c} size="xs" />
      </div>
      {motivo && (
        <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-red-700"><LossIcon size={12} /> <span className="truncate">{motivo}</span></div>
      )}
      {/* Próxima tarefa (ou alerta de "sem próximo passo") */}
      {(nt || needs) && (
        <div className="mt-2 flex min-w-0 items-center">
          {nt ? <NextTaskLine client={c} size="xs" /> : <NextStepBadge client={c} size="xs" />}
        </div>
      )}
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px]">
        <span className="font-semibold text-slate-700 tnum">{val > 0 ? BRL(val) : <span className="font-normal text-slate-300">sem valor</span>}</span>
        <span className="flex items-center gap-1.5">
          <SlaBadge settings={settings} client={c} size="xs" />
          {pend > 0
            ? <span className={"inline-flex items-center gap-1 font-medium " + (od > 0 ? "text-red-600" : "text-slate-500")}>{od > 0 ? <I.Alert size={12} /> : <I.Bell size={12} />} {od > 0 ? od + (od === 1 ? " atrasada" : " atrasadas") : pend + (pend === 1 ? " tarefa" : " tarefas")}</span>
            : <span className="text-slate-400">{relTime(c.updatedAt)}</span>}
        </span>
      </div>
      {/* Ações rápidas: clique aqui não abre a ficha (stopPropagation) */}
      <div className="mt-1.5 flex items-center justify-between gap-1 border-t border-slate-100 pt-1.5" onClick={stop}>
        <ContactIcons client={c} size="xs" onLog={(canal) => onContactLink(c.id, canal)} />
        <StatusMenu compact value={c.status} onChange={(s) => onMove(c.id, s)} align="right" />
      </div>
    </article>
  );
}

function Funnel({ mod, clients, onOpen, dragId, onDrop, onNew, settings, onMove, onContactLink }) {
  const [over, setOver] = useState(null);
  const [grabbing, setGrabbing] = useState(null);
  const sumOf = (list) => list.reduce((s, c) => s + dealValue(mod, c), 0);
  const openValue = sumOf(clients.filter((c) => c.status === "lead" || c.status === "negociacao"));
  const closedValue = sumOf(clients.filter((c) => c.status === "fechado"));
  const stalledTotal = clients.filter((c) => slaStatus(settings, c).state === "late").length;
  const noStepTotal = clients.filter((c) => needsNextStep(c)).length;

  if (clients.length === 0) {
    /* O Funnel recebe a lista já filtrada: se o módulo tem clientes, é filtro; senão, está vazio mesmo. */
    const isFiltered = ((mod && mod.clients) || []).length > 0;
    return (
      <Card>
        <EmptyState icon={I.Kanban}
          title={isFiltered ? "Nenhum cliente corresponde aos filtros" : "Nenhum cliente neste módulo ainda"}
          text={isFiltered ? "Tente outro termo na busca ou limpe os filtros de etapa e responsável." : "Cadastre o primeiro cliente para começar a acompanhar o funil."}
          action={<button onClick={onNew} className={btn.primary}><I.Plus size={18} /> Novo cliente</button>} />
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FunnelStat label="Clientes" value={clients.length} />
        <FunnelStat label="Em aberto" value={BRL(openValue)} />
        <FunnelStat label="Fechado" value={BRL(closedValue)} />
        {stalledTotal > 0 && <FunnelStat label={stalledTotal === 1 ? "Parado" : "Parados"} value={stalledTotal} tone="red" />}
        {noStepTotal > 0 && <FunnelStat label="Sem próximo passo" value={noStepTotal} tone="amber" />}
      </div>
      {/* No celular as colunas rolam na horizontal; a partir de xl viram uma grade de 4 colunas. */}
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:mx-0 xl:grid xl:grid-cols-4 xl:overflow-visible xl:px-0">
        {STATUSES.map((s) => {
          const cards = clients.filter((c) => c.status === s.key);
          const colTotal = sumOf(cards);
          const colStalled = cards.filter((c) => slaStatus(settings, c).state === "late").length;
          const isOver = over === s.key && grabbing;
          return (
            <div key={s.key}
              onDragOver={(e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = "move"; } catch (err) {} setOver(s.key); }}
              onDragLeave={() => setOver((o) => (o === s.key ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                let id = "";
                try { id = e.dataTransfer.getData("text/plain"); } catch (err) {}
                if (id && dragId) dragId.current = id; /* garante o id mesmo se o dragStart não tiver registrado */
                onDrop(s.key); setOver(null); setGrabbing(null);
              }}
              className={"flex w-[290px] shrink-0 flex-col rounded-2xl border transition xl:w-auto " + (isOver ? "border-brand bg-brand-50/60 ring-4 ring-brand/10" : "border-slate-200 bg-slate-100/60")}>
              <div className="px-4 pb-3 pt-3.5">
                <div className="mb-2.5 h-1 w-full rounded-full" style={{ background: s.color }} />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">{s.label}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600 shadow-sm tnum">{cards.length}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500 tnum">{BRL(colTotal)}</span>
                  {colStalled > 0 && <span className="inline-flex items-center gap-1 font-semibold text-red-600 tnum"><I.Alert size={12} /> {colStalled} {colStalled === 1 ? "parado" : "parados"}</span>}
                </div>
              </div>
              <div className="flex min-h-[140px] flex-1 flex-col gap-2.5 px-3 pb-3 xl:max-h-[calc(100vh-330px)] xl:overflow-y-auto">
                {cards.map((c) => (
                  <FunnelCard key={c.id} mod={mod} c={c} settings={settings} grabbing={grabbing} dragId={dragId}
                    setGrabbing={setGrabbing} setOver={setOver} onOpen={onOpen} onMove={onMove} onContactLink={onContactLink} />
                ))}
                {cards.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">Solte um card aqui ou use o botão Mover</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
