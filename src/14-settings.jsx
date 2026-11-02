/* ------------------------- Configurações e backup -------------------------- */
/* Agente F (v4). Abas: equipe | funil | automacoes | templates | pontuacao | backup.
   Toda alteração chama onSaveSettings(next) na hora (salvamento automático).
   v4: remover vendedor/origem/motivo avisa o app (onDetachRef), backup registra lastBackupAt,
   "Remover dados de exemplo", importação de planilha CSV e indicador que respeita saveError. */
const SETTINGS_TABS = [
  { key: "equipe",     label: "Equipe e metas", icon: "Users",  text: "Vendedores, metas mensais e quem está usando este computador." },
  { key: "funil",      label: "Funil",          icon: "Kanban", text: "Prazos por etapa, campos obrigatórios, motivos de perda e origens." },
  { key: "automacoes", label: "Automações",     icon: "Zap",    text: "Tarefas criadas sozinhas quando algo acontece no funil." },
  { key: "templates",  label: "Mensagens",      icon: "Chat",   text: "Modelos de WhatsApp e e-mail para enviar com um clique." },
  { key: "pontuacao",  label: "Pontuação",      icon: "Flame",  text: "Como a prioridade de cada lead é calculada." },
  { key: "backup",     label: "Backup e dados", icon: "Save",   text: "Exportar, importar, planilha e restaurar exemplo." },
];
const SETTINGS_TEMPLATE_VARS = [
  { key: "{nome}",          hint: "Nome completo do contato" },
  { key: "{primeiro_nome}", hint: "Só o primeiro nome" },
  { key: "{empresa}",       hint: "Empresa do cliente" },
  { key: "{vendedor}",      hint: "Responsável pelo cliente" },
  { key: "{modulo}",        hint: "Módulo (Benefícios, Adquirência…)" },
  { key: "{valor}",         hint: "Valor total dos itens" },
  { key: "{itens}",         hint: "Lista dos itens" },
];

/* ---- helpers locais (prefixo settings) ---- */
function settingsSlug(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
function settingsNewId(nome, existing) {
  const base = settingsSlug(nome) || "item";
  let id = base + "_" + uid().slice(0, 4);
  while ((existing || []).includes(id)) id = base + "_" + uid().slice(0, 4);
  return id;
}
function settingsPlural(n, um, varios) { return n + " " + (n === 1 ? um : varios); }
/* Aviso mostrado na confirmação ao remover vendedor/origem/motivo: quantos clientes ficam sem o campo. */
function settingsRemoveNote(n, campo) { return n ? settingsPlural(n, "cliente fica", "clientes ficam") + " sem " + campo : "Nenhum cliente usa"; }
/* Garante arrays/objetos mesmo se algo vier faltando. */
function settingsSafe(s) {
  s = s || {};
  const sc = s.scoring || {};
  return {
    ...s,
    usuarioAtual: s.usuarioAtual || "",
    vendedores: Array.isArray(s.vendedores) ? s.vendedores : [],
    origens: Array.isArray(s.origens) ? s.origens : [],
    motivosPerda: Array.isArray(s.motivosPerda) ? s.motivosPerda : [],
    sla: s.sla || {},
    required: s.required || {},
    scoring: { porItem: 0, contatoCompleto: 0, ...sc, porte: sc.porte || {}, interesse: sc.interesse || {}, origem: sc.origem || {}, limites: { alta: 60, media: 30, ...(sc.limites || {}) } },
    automations: Array.isArray(s.automations) ? s.automations : [],
    templates: Array.isArray(s.templates) ? s.templates : [],
    ui: { soMeus: false, ...(s.ui || {}) },
    onboarding: { checklistDismissed: false, lastBackupAt: "", ...(s.onboarding || {}) },
  };
}

/* ---- peças visuais locais ---- */
function SettingsSection({ title, text, children, action, className = "" }) {
  return (
    <section className={"rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 " + className}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {text && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{text}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function SettingsInfo({ icon: IconC = I.Info, children }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm leading-relaxed text-slate-700">
      <span className="mt-0.5 shrink-0 text-brand"><IconC size={18} /></span>
      <div>{children}</div>
    </div>
  );
}
/* Botão de remover em duas etapas: clique → "Confirmar?" → clique de novo.
   `note` (opcional) aparece junto da confirmação, ex.: "3 clientes ficam sem responsável". */
function SettingsRemoveBtn({ onConfirm, label = "Remover", note }) {
  const [arm, setArm] = useState(false);
  useEffect(() => { if (!arm) return; const t = setTimeout(() => setArm(false), note ? 6000 : 3500); return () => clearTimeout(t); }, [arm, note]);
  if (arm) {
    return (
      <span className="inline-flex max-w-full flex-wrap items-center justify-end gap-1.5">
        {note && <span className="text-[11px] font-medium leading-tight text-red-700">{note}</span>}
        <button type="button" onClick={onConfirm} className="shrink-0 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700" aria-label={label + " (confirmar)"}>Confirmar?</button>
      </span>
    );
  }
  return <IconBtn title={label} danger onClick={() => setArm(true)} className="h-8 w-8"><I.Trash size={16} /></IconBtn>;
}
function SettingsSwitch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={!!checked} aria-label={label} onClick={() => onChange(!checked)}
      className={"relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition " + (checked ? "bg-brand" : "bg-slate-300")}>
      <span className={"inline-block h-5 w-5 rounded-full bg-white shadow transition-transform " + (checked ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}
/* Input numérico que aceita apagar o campo sem travar em 0. */
function SettingsNumber({ value, onChange, prefix, suffix, min = 0, step = 1, className = "", ariaLabel, small = false }) {
  const [draft, setDraft] = useState(String(value ?? ""));
  useEffect(() => { setDraft((d) => (Number(d) === Number(value) ? d : String(value ?? ""))); }, [value]);
  const commit = (v) => { setDraft(v); if (v !== "" && !isNaN(Number(v))) onChange(Number(v)); };
  const blur = () => { if (draft === "" || isNaN(Number(draft))) { setDraft("0"); onChange(0); } };
  return (
    <div className={"relative " + className}>
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">{prefix}</span>}
      <input type="number" min={min} step={step} value={draft} aria-label={ariaLabel} onChange={(e) => commit(e.target.value)} onBlur={blur}
        className={inputCls + " tnum" + (small ? " py-2 text-sm" : "") + (prefix ? " pl-9" : "") + (suffix ? " pr-12" : "")} />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">{suffix}</span>}
    </div>
  );
}
/* Lista simples editável: [{ id, label }].
   `note(id)` → texto da confirmação ao remover; `onRemove(id)` → avisa o app depois de tirar da lista (limpa referências). */
function SettingsSimpleList({ items, onChange, placeholder, usage, note, onRemove }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const label = draft.trim();
    if (!label) return;
    onChange([...items, { id: settingsNewId(label, items.map((i) => i.id)), label }]);
    setDraft("");
  };
  const remove = (id) => { onChange(items.filter((x) => x.id !== id)); onRemove && onRemove(id); };
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.id} className="flex flex-wrap items-center gap-2">
          <input className={inputCls + " min-w-[140px] flex-1 py-2 text-sm"} value={it.label} aria-label="Nome"
            onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, label: e.target.value } : x)))} />
          {usage && <span className="w-20 shrink-0 text-right text-[11px] text-slate-400 tnum">{usage(it.id)}</span>}
          <SettingsRemoveBtn onConfirm={() => remove(it.id)} note={note ? note(it.id) : undefined} />
        </div>
      ))}
      {items.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-400">Nada cadastrado ainda.</p>}
      <div className="flex items-center gap-2 pt-1">
        <input className={inputCls + " py-2 text-sm"} value={draft} placeholder={placeholder} aria-label={placeholder}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add} disabled={!draft.trim()} className={btn.secondary + " shrink-0 px-3 py-2"}><I.Plus size={15} /> Adicionar</button>
      </div>
    </div>
  );
}
function SettingsScoreRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-slate-700">{label}</span>
      <SettingsNumber className="w-28 shrink-0" value={value} onChange={onChange} suffix="pts" small ariaLabel={label} />
    </div>
  );
}

/* ================================ ABAS ==================================== */
function SettingsEquipe({ s, patch, allClients, onDetachRef }) {
  const [draft, setDraft] = useState({ nome: "", meta: 0 });
  const vendOpts = s.vendedores.map((v) => ({ value: v.id, label: v.nome || "(sem nome)" }));
  const countFor = (id) => allClients.filter((c) => c.responsavel === id).length;
  const updateV = (id, p) => patch({ vendedores: s.vendedores.map((v) => (v.id === id ? { ...v, ...p } : v)) });
  /* Remove da lista (zera "quem sou eu" se era ele) e pede ao app para limpar o responsável nos clientes de todos os módulos. */
  const removeV = (id) => {
    patch({ vendedores: s.vendedores.filter((v) => v.id !== id), usuarioAtual: s.usuarioAtual === id ? "" : s.usuarioAtual });
    onDetachRef && onDetachRef("vendedor", id);
  };
  const addV = () => {
    const nome = draft.nome.trim();
    if (!nome) return;
    const id = settingsNewId(nome, s.vendedores.map((v) => v.id));
    patch({ vendedores: [...s.vendedores, { id, nome, metaMensal: Number(draft.meta) || 0 }] });
    setDraft({ nome: "", meta: 0 });
  };
  const meNome = vendedorNome(s, s.usuarioAtual);
  return (
    <div className="space-y-4">
      <SettingsSection title="Quem está usando este computador" text="Esse vendedor vira o responsável padrão dos novos clientes e o autor das notas que você escrever na ficha.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {meNome
            ? <Avatar name={meNome} size={40} />
            : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400"><I.User size={18} /></span>}
          <Select className="flex-1" value={s.usuarioAtual} onChange={(v) => patch({ usuarioAtual: v })} options={vendOpts} placeholder="Não definido" ariaLabel="Quem está usando este computador" />
        </div>
        {s.vendedores.length === 0 && <p className="mt-2 text-xs text-slate-400">Cadastre um vendedor abaixo para poder escolher.</p>}
      </SettingsSection>

      <SettingsSection title="Vendedores e metas" text="A meta é o valor fechado por mês. O painel mostra o progresso de cada um e o total do time.">
        <div className="space-y-2">
          {s.vendedores.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-2.5">
              <Avatar name={v.nome} size={30} />
              <input className={inputCls + " min-w-[150px] flex-1 py-2 text-sm font-medium"} value={v.nome} aria-label="Nome do vendedor"
                onChange={(e) => updateV(v.id, { nome: e.target.value })} />
              <SettingsNumber className="w-40" value={v.metaMensal} onChange={(n) => updateV(v.id, { metaMensal: n })} prefix="R$" step={1000} small ariaLabel={"Meta mensal de " + v.nome} />
              <span className="w-20 text-right text-[11px] text-slate-400 tnum" title="Clientes sob responsabilidade">{countFor(v.id)} cliente(s)</span>
              <SettingsRemoveBtn onConfirm={() => removeV(v.id)} label="Remover vendedor" note={settingsRemoveNote(countFor(v.id), "responsável")} />
            </div>
          ))}
          {s.vendedores.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">Nenhum vendedor cadastrado. Adicione o primeiro abaixo.</p>}
        </div>
        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center">
          <input className={inputCls + " py-2 text-sm"} placeholder="Nome do vendedor" value={draft.nome} aria-label="Nome do novo vendedor"
            onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addV(); } }} />
          <SettingsNumber className="sm:w-44" value={draft.meta} onChange={(n) => setDraft((d) => ({ ...d, meta: n }))} prefix="R$" step={1000} small ariaLabel="Meta mensal do novo vendedor" />
          <button type="button" onClick={addV} disabled={!draft.nome.trim()} className={btn.primary + " shrink-0 px-3 py-2"}><I.Plus size={15} /> Adicionar</button>
        </div>
      </SettingsSection>
    </div>
  );
}

function SettingsFunil({ s, patch, allClients, onDetachRef }) {
  const slaStages = STATUSES.filter((st) => st.key === "lead" || st.key === "negociacao");
  const reqStages = STATUSES.filter((st) => st.key === "negociacao" || st.key === "fechado");
  const toggleReq = (status, key) => {
    const cur = s.required[status] || [];
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    patch({ required: { ...s.required, [status]: next } });
  };
  const usedOrigem = (id) => allClients.filter((c) => c.origem === id).length;
  const usedMotivo = (id) => allClients.filter((c) => c.motivoPerda === id).length;
  return (
    <div className="space-y-4">
      <SettingsSection title="Prazo em cada etapa (SLA)" text="Quantos dias um cliente pode ficar na etapa. Perto do prazo ele fica amarelo; passando, vermelho e marcado como parado. Use 0 para não ter prazo.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {slaStages.map((st) => (
            <label key={st.key} className="block">
              <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700"><span className="h-2.5 w-2.5 rounded-full" style={{ background: st.color }} />{st.label}</span>
              <SettingsNumber value={s.sla[st.key] ?? 0} onChange={(n) => patch({ sla: { ...s.sla, [st.key]: n } })} suffix="dias" small ariaLabel={"Prazo em " + st.label} />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">Fechado e Perdido não têm prazo.</p>
      </SettingsSection>

      <SettingsSection title="Campos obrigatórios para entrar na etapa" text="Ao mover um cliente, o CRM confere se estes campos estão preenchidos e pede para completar antes.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-sm">
            <thead>
              <tr>
                <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Campo</th>
                {reqStages.map((st) => (
                  <th key={st.key} className="w-32 py-2 text-center text-[11px] font-semibold uppercase tracking-wide" style={{ color: st.text }}>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: st.color }} />{st.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {REQUIRED_FIELD_KEYS.map((f) => (
                <tr key={f.key}>
                  <td className="py-2 text-slate-700">{f.label}</td>
                  {reqStages.map((st) => {
                    const on = (s.required[st.key] || []).includes(f.key);
                    return (
                      <td key={st.key} className="py-2 text-center">
                        <input type="checkbox" checked={on} onChange={() => toggleReq(st.key, f.key)} aria-label={f.label + " obrigatório em " + st.label}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-[#3152E4]" />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SettingsSection title="Motivos de perda" text="Perguntados ao mover um cliente para Perdido. Viram gráfico nos relatórios.">
          <SettingsSimpleList items={s.motivosPerda} onChange={(items) => patch({ motivosPerda: items })} placeholder="Novo motivo"
            usage={(id) => { const n = usedMotivo(id); return n ? n + " uso(s)" : ""; }}
            note={(id) => settingsRemoveNote(usedMotivo(id), "motivo de perda")}
            onRemove={(id) => onDetachRef && onDetachRef("motivo", id)} />
        </SettingsSection>
        <SettingsSection title="Origens do lead" text="De onde o cliente veio. Aparece no cadastro, nos filtros e nos relatórios.">
          <SettingsSimpleList items={s.origens} onChange={(items) => patch({ origens: items })} placeholder="Nova origem"
            usage={(id) => { const n = usedOrigem(id); return n ? n + " cliente(s)" : ""; }}
            note={(id) => settingsRemoveNote(usedOrigem(id), "origem")}
            onRemove={(id) => onDetachRef && onDetachRef("origem", id)} />
        </SettingsSection>
      </div>
    </div>
  );
}

function SettingsAutomacoes({ s, patch }) {
  const triggerOpts = [{ value: "created", label: "Ao cadastrar um cliente" }, ...STATUSES.map((st) => ({ value: "enter:" + st.key, label: "Ao entrar em " + st.label }))];
  const triggerValue = (a) => (a.trigger && a.trigger.type === "client_created" ? "created" : "enter:" + ((a.trigger && a.trigger.status) || "lead"));
  const triggerFrom = (v) => (v === "created" ? { type: "client_created" } : { type: "enter_stage", status: v.slice(6) });
  const update = (id, fn) => patch({ automations: s.automations.map((a) => (a.id === id ? fn(a) : a)) });
  const remove = (id) => patch({ automations: s.automations.filter((a) => a.id !== id) });
  const tasksOf = (a) => (a.action && Array.isArray(a.action.tasks) ? a.action.tasks : []);
  const setTasks = (a, tasks) => ({ ...a, action: { ...(a.action || {}), type: "create_tasks", tasks } });
  const add = () => patch({ automations: [...s.automations, {
    id: uid(), nome: "Nova automação", ativo: true,
    trigger: { type: "enter_stage", status: "negociacao" },
    action: { type: "create_tasks", tasks: [{ titulo: "", dias: 1 }] },
  }] });
  return (
    <div className="space-y-4">
      <SettingsInfo icon={I.Zap}>
        Uma automação é uma regra do tipo <b className="text-ink">"quando X acontecer, crie estas tarefas"</b>. Exemplo: ao fechar um negócio,
        criar o checklist de implantação. As tarefas entram no card do cliente com a data já calculada.
      </SettingsInfo>

      {s.automations.map((a) => (
        <div key={a.id} className={"rounded-2xl border p-4 transition " + (a.ativo ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-75")}>
          <div className="flex flex-wrap items-center gap-3">
            <SettingsSwitch checked={!!a.ativo} onChange={(v) => update(a.id, (x) => ({ ...x, ativo: v }))} label={"Ativar " + (a.nome || "automação")} />
            <input className={inputCls + " min-w-[160px] flex-1 py-2 text-sm font-semibold"} value={a.nome || ""} aria-label="Nome da automação"
              onChange={(e) => update(a.id, (x) => ({ ...x, nome: e.target.value }))} />
            <SettingsRemoveBtn onConfirm={() => remove(a.id)} label="Remover automação" />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[72px_1fr] sm:items-center">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Quando</span>
            <Select value={triggerValue(a)} onChange={(v) => update(a.id, (x) => ({ ...x, trigger: triggerFrom(v) }))} options={triggerOpts} small ariaLabel="Gatilho da automação" />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[72px_1fr] sm:items-start">
            <span className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Criar</span>
            <div>
              <div className="space-y-2">
                {tasksOf(a).map((t, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input className={inputCls + " min-w-[160px] flex-1 py-2 text-sm"} value={t.titulo || ""} placeholder="Título da tarefa" aria-label="Título da tarefa"
                      onChange={(e) => update(a.id, (x) => setTasks(x, tasksOf(x).map((y, j) => (j === i ? { ...y, titulo: e.target.value } : y))))} />
                    <span className="text-xs text-slate-500">em</span>
                    <SettingsNumber className="w-28" value={t.dias ?? 0} suffix="dias" small ariaLabel="Prazo em dias"
                      onChange={(n) => update(a.id, (x) => setTasks(x, tasksOf(x).map((y, j) => (j === i ? { ...y, dias: n } : y))))} />
                    <IconBtn title="Remover tarefa" danger className="h-8 w-8" onClick={() => update(a.id, (x) => setTasks(x, tasksOf(x).filter((_, j) => j !== i)))}><I.X size={15} /></IconBtn>
                  </div>
                ))}
                {tasksOf(a).length === 0 && <p className="text-xs text-slate-400">Nenhuma tarefa. Adicione ao menos uma.</p>}
              </div>
              <button type="button" onClick={() => update(a.id, (x) => setTasks(x, [...tasksOf(x), { titulo: "", dias: 1 }]))}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"><I.Plus size={14} /> Adicionar tarefa</button>
            </div>
          </div>
        </div>
      ))}

      {s.automations.length === 0 && <EmptyState icon={I.Zap} title="Nenhuma automação" text="Crie a primeira regra para o CRM trabalhar por você." />}
      <button type="button" onClick={add}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/30 bg-brand-50/40 py-3 text-sm font-semibold text-brand transition hover:bg-brand-50">
        <I.Plus size={18} /> Nova automação
      </button>
    </div>
  );
}

function SettingsTemplates({ s, patch, mod }) {
  const [selId, setSelId] = useState(() => (s.templates[0] ? s.templates[0].id : null));
  const sel = s.templates.find((t) => t.id === selId) || s.templates[0] || null;
  const textRef = useRef(null);
  const update = (id, p) => patch({ templates: s.templates.map((t) => (t.id === id ? { ...t, ...p } : t)) });
  const remove = (id) => { const left = s.templates.filter((t) => t.id !== id); patch({ templates: left }); setSelId(left[0] ? left[0].id : null); };
  const add = () => {
    const t = { id: uid(), nome: "Novo modelo", canal: "whatsapp", assunto: "", texto: "Olá {primeiro_nome}, aqui é {vendedor}, da Próspera. " };
    patch({ templates: [...s.templates, t] });
    setSelId(t.id);
  };
  const insertVar = (v) => {
    if (!sel) return;
    const el = textRef.current;
    const txt = sel.texto || "";
    if (!el) { update(sel.id, { texto: txt + v }); return; }
    const st = el.selectionStart ?? txt.length, en = el.selectionEnd ?? txt.length;
    update(sel.id, { texto: txt.slice(0, st) + v + txt.slice(en) });
    setTimeout(() => { try { el.focus(); el.setSelectionRange(st + v.length, st + v.length); } catch (e) {} }, 0);
  };
  const sample = (mod.clients && mod.clients[0]) || hydrateClient({ id: "exemplo", nome: "Mariana Costa", empresa: "TechLog Soluções", telefone: "(11) 98888-1234", email: "mariana@techlog.com.br", responsavel: s.usuarioAtual });
  const ctx = templateContext(s, mod, sample);
  const CanalIcon = (t) => (t.canal === "email" ? I.Mail : I.Chat);

  return (
    <div className="space-y-4">
      <SettingsInfo icon={I.Chat}>
        Na ficha do cliente, o botão <b className="text-ink">Mensagens</b> abre o WhatsApp ou o e-mail já com o texto do modelo preenchido.
        Use as variáveis entre chaves para personalizar.
      </SettingsInfo>

      <div className="flex flex-wrap items-center gap-2">
        {s.templates.map((t) => {
          const Ic = CanalIcon(t);
          const active = sel && sel.id === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setSelId(t.id)} aria-pressed={!!active}
              className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition " + (active ? "border-transparent bg-ink text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}>
              <Ic size={13} className={active ? "text-white" : t.canal === "email" ? "text-brand" : "text-emerald-600"} />{t.nome || "(sem nome)"}
            </button>
          );
        })}
        <button type="button" onClick={add} className="inline-flex items-center gap-1 rounded-full border border-dashed border-brand/40 px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand-50">
          <I.Plus size={13} /> Novo modelo
        </button>
      </div>

      {sel ? (
        <SettingsSection title="Editar modelo" action={<SettingsRemoveBtn onConfirm={() => remove(sel.id)} label="Remover modelo" />}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nome do modelo"><input className={inputCls} value={sel.nome || ""} onChange={(e) => update(sel.id, { nome: e.target.value })} placeholder="Ex.: Primeiro contato" /></Field>
            <Field label="Canal">
              <Select value={sel.canal || "whatsapp"} onChange={(v) => update(sel.id, { canal: v })} ariaLabel="Canal do modelo"
                options={[{ value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "E-mail" }]} />
            </Field>
            {sel.canal === "email" && (
              <div className="sm:col-span-2">
                <Field label="Assunto"><input className={inputCls} value={sel.assunto || ""} onChange={(e) => update(sel.id, { assunto: e.target.value })} placeholder="Ex.: Proposta Próspera para {empresa}" /></Field>
              </div>
            )}
            <div className="sm:col-span-2">
              <Field label="Texto" hint="Clique em uma variável para inserir no ponto onde o cursor está.">
                <textarea ref={textRef} className={inputCls + " min-h-[130px] resize-y"} value={sel.texto || ""} onChange={(e) => update(sel.id, { texto: e.target.value })} />
              </Field>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SETTINGS_TEMPLATE_VARS.map((v) => (
                  <button key={v.key} type="button" title={v.hint} onClick={() => insertVar(v.key)}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] font-semibold text-slate-600 transition hover:border-brand hover:text-brand">{v.key}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><I.Eye size={13} /> Prévia com {sample.nome}</div>
            {sel.canal === "email" && sel.assunto && <div className="mb-1 text-sm font-semibold text-ink">{renderTemplate(sel.assunto, ctx)}</div>}
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{renderTemplate(sel.texto || "", ctx) || <span className="text-slate-400">Escreva o texto acima para ver a prévia.</span>}</p>
          </div>
        </SettingsSection>
      ) : (
        <EmptyState icon={I.Chat} title="Nenhum modelo" text="Crie um modelo de WhatsApp ou e-mail para enviar com um clique na ficha do cliente."
          action={<button type="button" onClick={add} className={btn.primary}><I.Plus size={16} /> Novo modelo</button>} />
      )}
    </div>
  );
}

function SettingsPontuacao({ s, patch, mod }) {
  const sc = s.scoring;
  const setSc = (p) => patch({ scoring: { ...sc, ...p } });
  const lim = sc.limites || { alta: 60, media: 30 };
  const sample = (mod.clients && mod.clients[0]) || null;
  return (
    <div className="space-y-4">
      <SettingsInfo icon={I.Flame}>
        Cada cliente ganha pontos pelo que está preenchido. A soma (até 100) vira a <b className="text-ink">prioridade</b>: Alta, Média ou Baixa.
        Serve para decidir quem contatar primeiro.
      </SettingsInfo>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SettingsSection title="Porte da empresa">
          {PORTES.map((p) => <SettingsScoreRow key={p.key} label={p.label} value={sc.porte[p.key] ?? 0} onChange={(n) => setSc({ porte: { ...sc.porte, [p.key]: n } })} />)}
        </SettingsSection>
        <SettingsSection title="Interesse do cliente">
          {INTERESSES.map((p) => <SettingsScoreRow key={p.key} label={p.label} value={sc.interesse[p.key] ?? 0} onChange={(n) => setSc({ interesse: { ...sc.interesse, [p.key]: n } })} />)}
        </SettingsSection>
        <SettingsSection title="Outros critérios">
          <SettingsScoreRow label="Por item de interesse (conta até 3)" value={sc.porItem ?? 0} onChange={(n) => setSc({ porItem: n })} />
          <SettingsScoreRow label="Telefone e e-mail preenchidos" value={sc.contatoCompleto ?? 0} onChange={(n) => setSc({ contatoCompleto: n })} />
        </SettingsSection>
        <SettingsSection title="Bônus por origem" text="Origens que costumam converter mais ganham pontos extras.">
          {s.origens.length === 0 && <p className="text-xs text-slate-400">Cadastre origens na aba Funil.</p>}
          {s.origens.map((o) => <SettingsScoreRow key={o.id} label={o.label} value={sc.origem[o.id] ?? 0} onChange={(n) => setSc({ origem: { ...sc.origem, [o.id]: n } })} />)}
        </SettingsSection>
      </div>
      <SettingsSection title="Limites" text="A partir de quantos pontos a prioridade vira Média e Alta.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700"><I.Flame size={14} className="text-orange-600" /> Alta a partir de</span>
            <SettingsNumber value={lim.alta ?? 60} onChange={(n) => setSc({ limites: { ...lim, alta: n } })} suffix="pts" small ariaLabel="Prioridade alta a partir de" />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Média a partir de</span>
            <SettingsNumber value={lim.media ?? 30} onChange={(n) => setSc({ limites: { ...lim, media: n } })} suffix="pts" small ariaLabel="Prioridade média a partir de" />
          </label>
        </div>
      </SettingsSection>
      <SettingsSection title="Exemplo ao vivo" text="Pontuação do primeiro cliente do módulo atual com as regras acima.">
        {sample ? (
          <div className="flex flex-wrap items-center gap-3">
            <Avatar name={sample.nome} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-ink">{sample.nome}</div>
              <div className="truncate text-xs text-slate-500">{sample.empresa || "Empresa não informada"} · {porteLabel(sample.porte) || "porte não informado"} · interesse {(interesseMeta(sample.interesse) || { label: "não informado" }).label.toLowerCase()}</div>
            </div>
            <ScoreBadge settings={s} mod={mod} client={sample} showPoints />
          </div>
        ) : <p className="text-xs text-slate-400">Cadastre um cliente em {mod.nome} para ver o exemplo.</p>}
      </SettingsSection>
    </div>
  );
}

/* Linha de ação da aba Backup (componente de módulo, fora do render). */
function SettingsBackupRow({ icon: IconC, title, text, children, tone }) {
  const box = tone === "danger" ? "border-red-100 bg-red-50/40" : tone === "warn" ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-white";
  const ic = tone === "danger" ? "bg-red-100 text-red-600" : tone === "warn" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500";
  return (
    <div className={"flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center " + box}>
      <span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " + ic}><IconC size={18} /></span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink">{title}</div>
        <div className="text-xs leading-relaxed text-slate-500">{text}</div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">{children}</div>
    </div>
  );
}

/* Colunas mostradas na prévia da importação. */
const SETTINGS_CSV_PREVIEW = [
  { key: "nome", label: "Nome" }, { key: "empresa", label: "Empresa" }, { key: "telefone", label: "Telefone" }, { key: "email", label: "E-mail" },
  { key: "status", label: "Etapa" }, { key: "origem", label: "Origem" }, { key: "responsavel", label: "Responsável" },
];
/* Sub-tela "Importar planilha": mapeia as colunas do arquivo para os campos do cliente (CSV_IMPORT_FIELDS),
   mostra a prévia das 5 primeiras linhas convertidas (csvRowToClient), conta duplicados (findDuplicates
   contra mod.clients) e chama onImport(rows, { automations }). */
function SettingsCsvImport({ s, mod, csv, onBack, onImport }) {
  const [mapping, setMapping] = useState(() => csvAutoMap(csv.headers) || {});
  const [skipDups, setSkipDups] = useState(true);
  const [automations, setAutomations] = useState(false);
  const colOpts = csv.headers.map((h, i) => ({ value: String(i), label: String(h || "").trim() || "Coluna " + (i + 1) }));
  const setMap = (key, v) => setMapping((m) => { const n = { ...m }; if (v === "") delete n[key]; else n[key] = Number(v); return n; });
  const hasNome = mapping.nome != null && mapping.nome !== "";

  const info = useMemo(() => {
    const rows = [];
    let semNome = 0;
    csv.rows.forEach((raw) => {
      const c = csvRowToClient(s, mapping, raw) || {};
      if (!String(c.nome || "").trim()) { semNome++; return; }
      const dup = (findDuplicates(mod.clients || [], c) || []).length > 0;
      rows.push({ c, dup });
    });
    return { rows, semNome, dups: rows.filter((r) => r.dup).length };
  }, [csv, mapping, s, mod.clients]);
  const toImport = info.rows.filter((r) => !(skipDups && r.dup)).map((r) => r.c);
  const preview = info.rows.slice(0, 5);
  const canImport = hasNome && toImport.length > 0;

  const cell = (key, c) => {
    if (key === "status") return statusMeta(c.status || "lead").label;
    if (key === "origem") return origemLabel(s, c.origem) || c.origem || "";
    if (key === "responsavel") return vendedorNome(s, c.responsavel) || c.responsavel || "";
    return c[key] || "";
  };
  const checkbox = "mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-[#3152E4]";
  const th = "whitespace-nowrap py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBack} className={btn.ghost + " -ml-2 px-3"}><I.ChevL size={16} /> Voltar</button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">Importar planilha para {mod.nome}</div>
          <div className="truncate text-xs text-slate-500">{csv.name} · {settingsPlural(csv.rows.length, "linha", "linhas")} · {settingsPlural(csv.headers.length, "coluna", "colunas")}</div>
        </div>
      </div>

      <SettingsSection title="1. Qual coluna vai em cada campo" text="Já tentamos adivinhar pelo cabeçalho. Só o nome do contato é obrigatório; o resto pode ficar como 'Não importar'.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CSV_IMPORT_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} required={!!f.required} error={f.required && !hasNome ? "Escolha a coluna do nome." : null}>
              <Select small value={mapping[f.key] != null ? String(mapping[f.key]) : ""} onChange={(v) => setMap(f.key, v)} options={colOpts}
                placeholder="Não importar" ariaLabel={"Coluna da planilha para " + f.label} />
            </Field>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="2. Confira a prévia" text="Como as 5 primeiras linhas vão entrar no CRM. Telefone, etapa, origem e responsável são ajustados automaticamente.">
        {preview.length ? (
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr>
                  {SETTINGS_CSV_PREVIEW.map((h) => <th key={h.key} className={th}>{h.label}</th>)}
                  <th className={th}>Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map((r, i) => (
                  <tr key={i} className={r.dup ? "bg-amber-50/60" : ""}>
                    {SETTINGS_CSV_PREVIEW.map((h) => <td key={h.key} className="max-w-[180px] truncate py-2 pr-3 text-slate-700">{cell(h.key, r.c) || <span className="text-slate-300">—</span>}</td>)}
                    <td className="whitespace-nowrap py-2">
                      {r.dup
                        ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Já existe</span>
                        : <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Novo</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
            {hasNome ? "Nenhuma linha com nome preenchido." : "Escolha a coluna do nome para ver a prévia."}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <span><b className="text-ink tnum">{csv.rows.length}</b> linhas no arquivo</span>
          <span><b className="text-ink tnum">{info.rows.length}</b> com nome</span>
          {info.semNome > 0 && <span className="text-amber-700"><b className="tnum">{info.semNome}</b> sem nome (ignoradas)</span>}
          <span className={info.dups ? "text-amber-700" : ""}><b className="tnum">{info.dups}</b> já existem em {mod.nome}</span>
        </div>
      </SettingsSection>

      <SettingsSection title="3. Importar">
        <div className="space-y-2.5">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
            <input type="checkbox" className={checkbox} checked={skipDups} onChange={(e) => setSkipDups(e.target.checked)} />
            <span>Pular duplicados <span className="text-xs text-slate-500">(mesmo telefone, e-mail, empresa ou nome de um cliente que já está em {mod.nome})</span></span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
            <input type="checkbox" className={checkbox} checked={automations} onChange={(e) => setAutomations(e.target.checked)} />
            <span>Criar tarefas automáticas de cadastro <span className="text-xs text-slate-500">(as mesmas da automação "ao cadastrar um cliente", para cada cliente importado)</span></span>
          </label>
        </div>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" onClick={onBack} className={btn.ghost}>Cancelar</button>
          <button type="button" disabled={!canImport} onClick={() => onImport(toImport, { automations })} className={btn.primary}>
            <I.Upload size={16} /> Importar {settingsPlural(toImport.length, "cliente", "clientes")}
          </button>
        </div>
      </SettingsSection>
    </div>
  );
}

function SettingsBackup({ s, modules, mod, savedAt, saveError, patch, onReset, onImport, onRemoveDemo, onImportClients, notify }) {
  const fileRef = useRef(null);
  const csvRef = useRef(null);
  const [csv, setCsv] = useState(null);   // { name, headers, rows } → abre a sub-tela de importação
  const totalClients = modules.reduce((sum, m) => sum + (m.clients || []).length, 0);
  const stamp = todayISO();
  const demo = hasDemoClients(modules);
  const SheetIcon = I.Spreadsheet || I.Table;

  const exportJSON = () => {
    downloadFile("prospera-crm-backup-" + stamp + ".json", serializeBackup(modules, s), "application/json");
    /* Registra o último backup (aviso de backup na sidebar e checklist de primeiros passos). `s` é o settings mais recente. */
    patch({ onboarding: { ...(s.onboarding || {}), lastBackupAt: nowISO() } });
    notify({ title: "Backup exportado", message: "Guarde o arquivo em um lugar seguro." });
  };
  const exportCSV = () => {
    downloadFile("prospera-crm-" + mod.id + "-" + stamp + ".csv", clientsToCSV(mod, s, mod.clients), "text/csv;charset=utf-8");
    notify({ title: "Planilha exportada", message: settingsPlural(mod.clients.length, "cliente", "clientes") + " de " + mod.nome });
  };
  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const result = parseBackup(parsed);
        if (!result || !Array.isArray(result.modules) || result.modules.length === 0) throw new Error("formato");
        onImport({ modules: result.modules, settings: result.settings || null });
      } catch (err) {
        notify({ title: "Arquivo inválido", message: "Escolha um backup .json gerado por este CRM.", kind: "error" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };
  /* Planilha CSV: lê como UTF-8, parseCSV, e abre a sub-tela de mapeamento se houver linhas. */
  const onCsvFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCSV(String(reader.result || ""));
        if (!parsed || !Array.isArray(parsed.rows) || parsed.rows.length === 0) throw new Error("vazio");
        setCsv({ name: file.name, headers: Array.isArray(parsed.headers) ? parsed.headers : [], rows: parsed.rows });
      } catch (err) {
        notify({ kind: "error", title: "Não deu para ler a planilha", message: "Confira se é um .csv com a primeira linha de cabeçalho e ao menos uma linha de dados." });
      }
    };
    reader.onerror = () => notify({ kind: "error", title: "Não deu para abrir o arquivo", message: "Tente escolher a planilha de novo." });
    reader.readAsText(file, "UTF-8");
  };
  const importRows = (rows, opts) => {
    onImportClients(mod.id, rows, { automations: !!(opts && opts.automations) });
    setCsv(null);
  };

  if (csv) return <SettingsCsvImport s={s} mod={mod} csv={csv} onBack={() => setCsv(null)} onImport={importRows} />;

  return (
    <div className="space-y-4">
      {saveError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-800" role="alert">
          <span className="mt-0.5 shrink-0"><I.Alert size={18} /></span>
          <div><b>Não foi possível salvar neste navegador.</b> As últimas alterações podem se perder ao fechar a página. Exporte um backup agora.</div>
        </div>
      )}
      <SettingsInfo>
        <b className="text-ink">Os dados ficam somente neste navegador.</b> Hoje são {modules.length} módulo(s), {totalClients} cliente(s) e as configurações.
        Nada é enviado para servidores, então limpar o histórico do navegador apaga tudo. Exporte um backup de vez em quando.
        {savedAt && <span className="mt-1 block text-xs text-slate-500">Último salvamento automático: {fmtDateTime(new Date(savedAt).toISOString())}</span>}
      </SettingsInfo>

      <div className="space-y-3">
        <SettingsBackupRow icon={I.Download} title="Exportar backup completo" text="Arquivo .json com todos os módulos, clientes e configurações (equipe, automações, modelos). Serve para restaurar em outro computador.">
          <button type="button" onClick={exportJSON} className={btn.primary}><I.Download size={16} /> Exportar</button>
        </SettingsBackupRow>
        <SettingsBackupRow icon={I.Upload} title="Importar backup" text="Substitui os dados atuais pelos do arquivo .json escolhido. Aceita backups da versão anterior.">
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
          <button type="button" onClick={() => fileRef.current && fileRef.current.click()} className={btn.secondary}><I.Upload size={16} /> Escolher arquivo</button>
        </SettingsBackupRow>
        <SettingsBackupRow icon={SheetIcon} title="Importar planilha (CSV)" text={"Traz clientes de uma planilha para " + mod.nome + ". Primeira linha = cabeçalho; separador ; ou ,; exporte do Excel como CSV UTF-8."}>
          <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onCsvFile} aria-label="Escolher planilha CSV" />
          <button type="button" onClick={() => csvRef.current && csvRef.current.click()} className={btn.secondary}><SheetIcon size={16} /> Escolher planilha</button>
        </SettingsBackupRow>
        <SettingsBackupRow icon={I.Table} title={"Exportar planilha de " + mod.nome} text="Arquivo .csv com os clientes do módulo atual (origem, responsável, prioridade, próxima tarefa, dias na etapa…), pronto para o Excel.">
          <button type="button" onClick={exportCSV} className={btn.secondary}><I.Table size={16} /> Exportar CSV</button>
        </SettingsBackupRow>
        {demo && (
          <SettingsBackupRow icon={I.Sparkles} title="Remover dados de exemplo" text="Apaga só os clientes de demonstração que vieram com o CRM. Os seus clientes e as configurações continuam." tone="warn">
            <button type="button" onClick={onRemoveDemo} className={btn.secondary}><I.Trash size={16} /> Remover exemplos</button>
          </SettingsBackupRow>
        )}
        <SettingsBackupRow icon={I.Reset} title="Restaurar dados de exemplo" text="Apaga tudo o que foi salvo (clientes e configurações) e volta aos dados iniciais de demonstração." tone="danger">
          <button type="button" onClick={onReset} className={btn.dangerSoft}><I.Reset size={16} /> Restaurar</button>
        </SettingsBackupRow>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><I.Keyboard size={16} className="text-slate-400" /> Atalhos</div>
        <ul className="grid grid-cols-1 gap-1.5 text-xs text-slate-600 sm:grid-cols-2">
          <li className="flex items-center gap-2"><Kbd>/</Kbd> Ir para a busca</li>
          <li className="flex items-center gap-2"><Kbd>n</Kbd> Novo cliente</li>
          <li className="flex items-center gap-2"><Kbd>Esc</Kbd> Fechar painel ou janela</li>
          <li className="flex items-center gap-2"><Kbd>Enter</Kbd> Salvar formulário</li>
          <li className="flex items-center gap-2 sm:col-span-2">Arrastar um card no funil (ou usar o botão Mover) muda a etapa</li>
        </ul>
      </div>
    </div>
  );
}

/* ================================ MODAL =================================== */
function SettingsModal({ modules, mod, settings, onSaveSettings, savedAt, onClose, onReset, onImport, notify, initialTab,
                         saveError, onDetachRef, onRemoveDemo, onImportClients }) {
  const [tab, setTab] = useState(SETTINGS_TABS.some((t) => t.key === initialTab) ? initialTab : "equipe");
  const [savedTick, setSavedTick] = useState(null);
  useEffect(() => { if (!savedTick) return; const t = setTimeout(() => setSavedTick(null), 2500); return () => clearTimeout(t); }, [savedTick]);

  const s = settingsSafe(settings);
  const patch = (partial) => { onSaveSettings({ ...s, ...partial }); setSavedTick(Date.now()); };
  const allClients = modules.reduce((acc, m) => acc.concat(m.clients || []), []);
  const current = SETTINGS_TABS.find((t) => t.key === tab) || SETTINGS_TABS[0];
  const CurIcon = I[current.icon] || I.Cog;
  const savedLabel = savedAt ? relTime(new Date(savedAt).toISOString()) : "";   // "agora" | "há 5 min" | ...

  /* Indicador de salvamento: vermelho quando o navegador não conseguiu gravar (saveError). */
  const footer = (
    <div className="flex w-full items-center justify-between gap-3">
      {saveError ? (
        <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-red-600" role="status">
          <span className="inline-flex items-center gap-1.5"><I.Alert size={14} /> Não foi possível salvar</span>
          {tab !== "backup" && <button type="button" onClick={() => setTab("backup")} className="font-semibold text-red-700 underline underline-offset-2 hover:text-red-800">Fazer backup</button>}
        </span>
      ) : (
        <span className={"inline-flex items-center gap-1.5 text-xs transition " + (savedTick ? "font-semibold text-emerald-700" : "text-slate-400")} role="status">
          {savedTick
            ? <><I.CheckSimple size={14} /> Salvo</>
            : savedLabel
              ? <><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Salvo {savedLabel}</>
              : <><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> As alterações são salvas automaticamente</>}
        </span>
      )}
      <button type="button" onClick={onClose} className={btn.primary}>Concluir</button>
    </div>
  );

  return (
    <Modal title="Configurações" subtitle="Equipe, funil, automações, mensagens e backup" icon={I.Cog} onClose={onClose} width="max-w-4xl" footer={footer}>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[190px_1fr]">
        <nav className="hidden sm:block" aria-label="Seções das configurações">
          <ul className="sticky top-0 space-y-0.5">
            {SETTINGS_TABS.map((t) => {
              const Ic = I[t.icon] || I.Cog;
              const active = t.key === tab;
              return (
                <li key={t.key}>
                  <button type="button" onClick={() => setTab(t.key)} aria-current={active ? "page" : undefined}
                    className={"flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition " + (active ? "bg-brand-50 text-brand" : "text-slate-600 hover:bg-slate-100 hover:text-ink")}>
                    <Ic size={17} className={active ? "text-brand" : "text-slate-400"} />
                    <span className="flex-1">{t.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="-mt-2 border-b border-slate-100 sm:hidden">
          <Tabs tabs={SETTINGS_TABS.map((t) => ({ key: t.key, label: t.label, icon: I[t.icon] || I.Cog }))} value={tab} onChange={setTab} />
        </div>

        <div className="min-w-0">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><CurIcon size={18} /></span>
            <div>
              <h3 className="text-base font-bold text-ink">{current.label}</h3>
              <p className="text-xs text-slate-500">{current.text}</p>
            </div>
          </div>
          {tab === "equipe" && <SettingsEquipe s={s} patch={patch} allClients={allClients} onDetachRef={onDetachRef} />}
          {tab === "funil" && <SettingsFunil s={s} patch={patch} allClients={allClients} onDetachRef={onDetachRef} />}
          {tab === "automacoes" && <SettingsAutomacoes s={s} patch={patch} />}
          {tab === "templates" && <SettingsTemplates s={s} patch={patch} mod={mod} />}
          {tab === "pontuacao" && <SettingsPontuacao s={s} patch={patch} mod={mod} />}
          {tab === "backup" && (
            <SettingsBackup s={s} modules={modules} mod={mod} savedAt={savedAt} saveError={saveError} patch={patch}
              onReset={onReset} onImport={onImport} onRemoveDemo={onRemoveDemo} onImportClients={onImportClients} notify={notify} />
          )}
        </div>
      </div>
    </Modal>
  );
}
