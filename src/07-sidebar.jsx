/* -------------------------------- Sidebar --------------------------------- */
/* Item de navegação (fora do render da Sidebar, como pede o contrato v4). */
function SidebarNavItem({ id, icon: IconC, active, onSelect, badge, badgeTone, children }) {
  const Ic = IconC || I.Grid;
  const badgeCls = badgeTone === "late" ? "bg-red-50 text-red-700" : active ? "bg-white text-brand" : "bg-slate-100 text-slate-500";
  return (
    <button type="button" onClick={() => onSelect(id)} aria-current={active ? "page" : undefined}
      className={"flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition " + (active ? "bg-brand-50 text-brand" : "text-slate-600 hover:bg-slate-100 hover:text-ink")}>
      <Ic size={18} className={active ? "text-brand" : "text-slate-400"} />
      <span className="flex-1 text-left">{children}</span>
      {badge != null && <span className={"rounded-full px-2 py-0.5 text-[11px] font-semibold tnum " + badgeCls}>{badge}</span>}
    </button>
  );
}
/* Dias inteiros desde uma data ISO (null se a data não existir ou for inválida). */
function sidebarDaysSince(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 864e5));
}

function Sidebar({ modules, mod, view, onSwitch, onView, onManage, onSettings, savedAt, className = "", onClose, settings, saveError }) {
  /* Contadores de TODOS os módulos, respeitando o chip "Só meus" (settings.ui.soMeus). */
  const mine = (c) => (settings ? matchesSoMeus(settings, c) : true);
  const everyone = modules.reduce((acc, m) => acc.concat((m.clients || []).filter(mine)), []);
  const overdueAll = everyone.reduce((s, c) => s + overdueTasks(c).length, 0);
  const stuck = settings ? everyone.filter((c) => slaStatus(settings, c).state === "late").length : 0;
  const soMeus = !!(settings && settings.ui && settings.ui.soMeus && settings.usuarioAtual);
  const meName = settings && settings.usuarioAtual ? vendedorNome(settings, settings.usuarioAtual) : "";

  /* Lembrete de backup: só quando já existem clientes reais e o último export tem mais de 7 dias (ou nunca houve). */
  const realCount = countRealClients(modules);
  const lastBackupAt = settings && settings.onboarding ? settings.onboarding.lastBackupAt : "";
  const backupDays = sidebarDaysSince(lastBackupAt);
  const backupDue = realCount > 0 && (backupDays == null || backupDays > 7);

  return (
    <aside className={"fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-slate-200 bg-white " + className}>
      <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
        <Logo />
        {onClose && <IconBtn title="Fechar menu" onClick={onClose}><I.X size={18} /></IconBtn>}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <SectionLabel>Módulos de produto</SectionLabel>
        <div className="space-y-0.5">
          {modules.map((m) => {
            const MIcon = I[m.icon] || I.Grid;
            const active = m.id === mod.id;
            return (
              <button key={m.id} type="button" onClick={() => onSwitch(m.id)}
                className={"flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition " + (active ? "bg-slate-100 font-semibold text-ink" : "text-slate-600 hover:bg-slate-50")}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: m.accent }}><MIcon size={15} /></span>
                <span className="flex-1 truncate">{m.nome}</span>
                <span className="text-xs tnum text-slate-400">{m.clients.length}</span>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onManage} className="mt-1.5 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-brand transition hover:bg-brand-50">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-dashed border-brand/40"><I.Plus size={15} /></span>
          Gerenciar módulos
        </button>

        <div className="mt-6">
          <SectionLabel>Navegação</SectionLabel>
          <div className="space-y-0.5">
            <SidebarNavItem id="dashboard" icon={I.Dash} active={view === "dashboard"} onSelect={onView}>Painel</SidebarNavItem>
            <SidebarNavItem id="agenda" icon={I.ListChecks || I.Calendar} active={view === "agenda"} onSelect={onView}
              badge={overdueAll > 0 ? overdueAll : null} badgeTone="late">Agenda</SidebarNavItem>
            <SidebarNavItem id="clientes" icon={I.List} active={view === "clientes"} onSelect={onView} badge={mod.clients.length}>Clientes</SidebarNavItem>
            <SidebarNavItem id="funil" icon={I.Kanban} active={view === "funil"} onSelect={onView}>Funil de vendas</SidebarNavItem>
            <SidebarNavItem id="relatorios" icon={I.BarChart} active={view === "relatorios"} onSelect={onView}>Relatórios</SidebarNavItem>
          </div>
        </div>

        {(overdueAll > 0 || stuck > 0) && (
          <div className="mt-6 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-800">
            <div className="mb-0.5 flex items-center gap-1.5 font-semibold">
              <I.Alert size={14} /> Precisa de atenção
              {soMeus && <span className="ml-auto rounded-full bg-white/80 px-1.5 py-px text-[10px] font-semibold text-red-700">só meus</span>}
            </div>
            <ul className="space-y-0.5">
              {overdueAll > 0 && (
                <li>
                  <button type="button" onClick={() => onView("agenda")} className="flex items-center gap-1.5 text-left hover:underline">
                    <I.Bell size={12} /> {overdueAll} {overdueAll === 1 ? "tarefa atrasada" : "tarefas atrasadas"}
                  </button>
                </li>
              )}
              {stuck > 0 && (
                <li>
                  <button type="button" onClick={() => onView("dashboard")} className="flex items-center gap-1.5 text-left hover:underline">
                    <I.Timer size={12} /> {stuck} {stuck === 1 ? "cliente parado na etapa" : "clientes parados na etapa"}
                  </button>
                </li>
              )}
            </ul>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <button type="button" onClick={() => onView(overdueAll > 0 ? "agenda" : "dashboard")} className="font-medium underline-offset-2 hover:underline">
                {overdueAll > 0 ? "Ver na agenda" : "Ver no painel"}
              </button>
              {modules.length > 1 && <span className="text-[10.5px] text-red-600/80">todos os módulos</span>}
            </div>
          </div>
        )}

        {backupDue && (
          <button type="button" onClick={() => onSettings("backup")} title="Exportar um backup dos seus dados"
            className="mt-3 flex w-full items-center gap-2.5 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-left text-xs text-amber-800 transition hover:bg-amber-100/70">
            <I.Download size={15} className="shrink-0 text-amber-600" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Backup: {backupDays == null ? "nunca" : "há " + backupDays + (backupDays === 1 ? " dia" : " dias")}</span>
              <span className="block text-[11px] text-amber-700">Exporte uma cópia dos seus dados</span>
            </span>
            <I.ChevR size={14} className="shrink-0 text-amber-400" />
          </button>
        )}
      </div>

      <div className="border-t border-slate-100 px-3 py-3">
        <button type="button" onClick={() => onSettings("equipe")} title="Quem está usando o CRM agora (define o responsável padrão e o autor das notas)"
          className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-slate-100">
          {meName
            ? <>
                <Avatar name={meName} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Você</span>
                  <span className="block truncate text-sm font-semibold text-ink">{meName}</span>
                </span>
              </>
            : <>
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400"><I.User size={15} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Você</span>
                  <span className="block truncate text-sm font-medium text-brand">Definir quem sou eu</span>
                </span>
              </>}
          <I.ChevR size={16} className="text-slate-300" />
        </button>
        <button type="button" onClick={() => onSettings()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-ink">
          <I.Cog size={18} className="text-slate-400" /> Configurações e backup
        </button>
        {saveError
          ? <button type="button" onClick={() => onSettings("backup")} title="O navegador recusou gravar os dados. Exporte um backup para não perder nada."
              className="mt-1 flex w-full items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-left text-[11px] text-red-700 transition hover:bg-red-100/70">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
              <span className="flex-1 font-medium">Não foi possível salvar</span>
              <span className="font-semibold underline underline-offset-2">Fazer backup</span>
            </button>
          : <div className="mt-1 flex items-center gap-2 px-3 py-1.5 text-[11px] text-slate-400" title={savedAt ? "Último salvamento: " + fmtDateTime(new Date(savedAt).toISOString()) : ""}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Salvo automaticamente neste navegador
            </div>}
      </div>
    </aside>
  );
}

function FilterChip({ active, onClick, status, count, children }) {
  return (
    <button type="button" onClick={onClick}
      className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition " + (active ? "border-transparent shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}
      style={active ? (status ? { background: status.soft, color: status.text } : { background: "#1A1A2E", color: "#fff" }) : undefined}>
      {status && <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />}
      {children}
      {count != null && <span className={"tnum " + (active ? "opacity-70" : "text-slate-400")}>{count}</span>}
    </button>
  );
}
