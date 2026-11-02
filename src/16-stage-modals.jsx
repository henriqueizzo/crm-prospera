/* --------------------- Modais de etapa (gate e motivo de perda) -------------- */
/* Abre quando faltam campos obrigatórios para a etapa de destino (settings.required). */
function StageGateModal({ status, missing = [], client, onFill, onCancel }) {
  const ref = useRef(null);
  useEffect(() => { ref.current && ref.current.focus(); }, []);
  const m = statusMeta(status);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={"Faltam informações para mover para " + m.label}>
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px] anim-fade" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-pop anim-sheet sm:rounded-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><I.Alert size={22} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-ink">Faltam informações para mover para <span style={{ color: m.text }}>{m.label}</span></h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Para <b className="text-ink">{client ? client.nome : "este cliente"}</b> avançar, complete o cadastro:
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-1.5 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
          {missing.map((f) => (
            <li key={f.key} className="flex items-center gap-2 text-sm text-amber-900">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-amber-300 text-transparent"><I.CheckSimple size={11} /></span>
              {f.label}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-400">Você pode mudar o que é obrigatório em cada etapa em Configurações → Funil.</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2.5">
          <button type="button" onClick={onCancel} className={btn.secondary}>Agora não</button>
          <button ref={ref} type="button" onClick={onFill} className={btn.primary}><I.Pencil size={16} /> Preencher agora</button>
        </div>
      </div>
    </div>
  );
}

/* Pede o motivo quando um cliente é marcado como perdido. */
function LossReasonModal({ settings, client, onConfirm, onCancel }) {
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  const firstRef = useRef(null);
  useEffect(() => { firstRef.current && firstRef.current.focus(); }, []);
  const motivos = (settings && settings.motivosPerda) || [];
  const m = statusMeta("perdido");
  const confirm = () => { if (motivo) onConfirm({ motivoPerda: motivo, motivoPerdaObs: obs.trim() }); };
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={"Por que " + (client ? client.nome : "o cliente") + " foi perdido?"}>
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px] anim-fade" onClick={onCancel} />
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-pop anim-sheet sm:rounded-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: m.soft, color: m.text }}><I.TrendingDown size={22} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-ink">Por que {client ? client.nome : "o cliente"} foi perdido?</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">O motivo entra nos relatórios e ajuda a entender onde o funil está perdendo negócios.</p>
          </div>
        </div>

        {motivos.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">Nenhum motivo cadastrado. Adicione motivos em Configurações → Funil.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label="Motivo da perda">
            {motivos.map((r, i) => {
              const active = motivo === r.id;
              return (
                <button key={r.id} type="button" role="radio" aria-checked={active} ref={i === 0 ? firstRef : null}
                  onClick={() => setMotivo(r.id)}
                  className={"flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition " + (active ? "border-red-300 bg-red-50 text-red-900 ring-4 ring-red-100" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50")}>
                  <span className={"flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 " + (active ? "border-red-500" : "border-slate-300")}>
                    {active && <span className="h-2 w-2 rounded-full bg-red-500" />}
                  </span>
                  <span className="truncate">{r.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4">
          <Field label="Detalhes (opcional)">
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} className={inputCls + " min-h-[72px] resize-y"} placeholder="Ex.: fechou com o concorrente por R$ 300 a menos no mês." />
          </Field>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2.5">
          <button type="button" onClick={onCancel} className={btn.secondary}>Cancelar</button>
          <button type="button" onClick={confirm} disabled={!motivo} className={btn.danger + " disabled:opacity-50 disabled:pointer-events-none"}><I.TrendingDown size={16} /> Marcar como perdido</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------ Próximo passo e registro de contato (v4) ---------------- */
/* Atalhos de tarefa usados nos dois modais. O título usa o primeiro nome do cliente. */
const STAGE_QUICK_STEPS = [
  { key: "ligar",   label: "Ligar amanhã",             tipo: "ligacao",  dias: 1, titulo: (n) => "Ligar para " + n },
  { key: "cobrar",  label: "Cobrar retorno em 3 dias", tipo: "whatsapp", dias: 3, titulo: (n) => "Cobrar retorno de " + n },
  { key: "reuniao", label: "Reunião em 7 dias",        tipo: "reuniao",  dias: 7, titulo: (n) => "Reunião com " + n },
];
const stageFirstName = (client) => ((client && client.nome) || "").trim().split(" ")[0] || "o cliente";
const stageEmptyTask = () => ({ titulo: "", data: "", hora: "", tipo: "" });
function stageQuickTask(q, client) {
  return { titulo: q.titulo(stageFirstName(client)), data: addDaysISO(todayISO(), q.dias), hora: "", tipo: q.tipo };
}
function stageWhenLabel(task) { return taskWhen({ feito: false, hora: "", ...task }).label; }

/* Três atalhos de próximo passo. Em "selected" (opcional) o atalho fica marcado em vez de disparar na hora. */
function StageQuickSteps({ client, selected, onSelect, firstRef }) {
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
      {STAGE_QUICK_STEPS.map((q, i) => {
        const task = stageQuickTask(q, client);
        const active = selected === q.key;
        return (
          <button key={q.key} type="button" ref={i === 0 ? firstRef : null} onClick={() => onSelect(q.key, task)} aria-pressed={selected !== undefined ? active : undefined}
            className={"flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition sm:flex-col sm:items-start sm:gap-2 " + (active ? "border-brand bg-brand-50 text-brand ring-4 ring-brand/10" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50")}>
            <span className={"flex h-8 w-8 shrink-0 items-center justify-center rounded-lg " + (active ? "bg-white text-brand" : "bg-slate-100 text-slate-500")}><TaskTypeIcon tipo={q.tipo} size={15} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{q.label}</span>
              <span className="block truncate text-[11px] font-normal text-slate-500">{task.titulo} · {stageWhenLabel(task)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* Formulário livre de tarefa: título, data, hora e tipo. Enter no título envia. */
function StageTaskForm({ value, onChange, onSubmit }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const tipoOpts = TASK_TYPES.map((t) => ({ value: t.key, label: t.label }));
  const onKey = (e) => { if (e.key === "Enter" && !["BUTTON", "SELECT", "TEXTAREA"].includes(e.target.tagName)) { e.preventDefault(); if ((value.titulo || "").trim()) onSubmit(); } };
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-6" onKeyDown={onKey}>
      <div className="col-span-2 sm:col-span-6">
        <Field label="Tarefa">
          <input className={inputCls} value={value.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex.: Enviar proposta revisada" autoComplete="off" />
        </Field>
      </div>
      <Field label="Data"><input type="date" className={inputCls} value={value.data} onChange={(e) => set("data", e.target.value)} /></Field>
      <Field label="Hora"><input type="time" className={inputCls} value={value.hora} onChange={(e) => set("hora", e.target.value)} /></Field>
      <div className="col-span-2">
        <Field label="Tipo"><Select value={value.tipo} onChange={(v) => set("tipo", v)} options={tipoOpts} placeholder="Tipo da tarefa" ariaLabel="Tipo da tarefa" /></Field>
      </div>
    </div>
  );
}

/* Pergunta o próximo passo quando a última tarefa pendente de um lead/negociação é concluída. */
function NextStepModal({ client, mod, settings, onPick, onSkip, onCancel }) {
  const firstRef = useRef(null);
  useEffect(() => { firstRef.current && firstRef.current.focus(); }, []);
  const [form, setForm] = useState(stageEmptyTask);
  const nome = client ? client.nome : "o cliente";
  const first = stageFirstName(client);
  const canSubmit = !!(form.titulo || "").trim();
  const submit = () => { if (canSubmit) onPick({ titulo: form.titulo.trim(), data: form.data || "", hora: form.hora || "", tipo: form.tipo || "" }); };
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={"Qual o próximo passo com " + nome + "?"}>
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px] anim-fade" onClick={onCancel} />
      <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-3xl bg-white shadow-pop anim-sheet sm:rounded-2xl">
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex shrink-0 items-start gap-4 px-6 pt-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><I.ArrowRight size={22} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-ink">Qual o próximo passo com {nome}?</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">Tarefa concluída. Sem uma próxima tarefa, {first} some do seu radar{mod ? " em " + mod.nome : ""}.</p>
          </div>
          <IconBtn title="Fechar (Esc)" onClick={onCancel} className="-mr-2 -mt-1"><I.X size={18} /></IconBtn>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <StageQuickSteps client={client} onSelect={(key, task) => onPick(task)} firstRef={firstRef} />
          <div className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <span className="h-px flex-1 bg-slate-100" />ou escreva a tarefa<span className="h-px flex-1 bg-slate-100" />
          </div>
          <StageTaskForm value={form} onChange={setForm} onSubmit={submit} />
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end sm:gap-2.5">
          <button type="button" onClick={onSkip} className={btn.ghost}>Sem próximo passo agora</button>
          <button type="button" onClick={submit} disabled={!canSubmit} className={btn.primary}><I.Plus size={16} /> Criar tarefa</button>
        </div>
      </div>
    </div>
  );
}

/* Registra um contato feito (canal × resultado), com observação e próximo passo opcional. */
function ContactLogModal({ client, mod, settings, onConfirm, onCancel }) {
  const firstRef = useRef(null);
  useEffect(() => { firstRef.current && firstRef.current.focus(); }, []);
  const [canal, setCanal] = useState("");
  const [resultado, setResultado] = useState("");
  const [obs, setObs] = useState("");
  const [agendar, setAgendar] = useState(false);
  const [quick, setQuick] = useState(null);           // atalho escolhido (key) ou null
  const [form, setForm] = useState(stageEmptyTask);
  const nome = client ? client.nome : "o cliente";

  const quickDef = quick ? STAGE_QUICK_STEPS.find((q) => q.key === quick) : null;
  const next = !agendar ? null
    : quickDef ? stageQuickTask(quickDef, client)
    : (form.titulo || "").trim() ? { titulo: form.titulo.trim(), data: form.data || "", hora: form.hora || "", tipo: form.tipo || "" }
    : null;
  const canSubmit = !!canal && !!resultado;
  const submit = () => { if (canSubmit) onConfirm({ canal, resultado, obs: obs.trim(), next }); };
  const pickQuick = (key) => { setQuick((q) => (q === key ? null : key)); };
  const changeForm = (v) => { setForm(v); if (quick) setQuick(null); };

  const choiceCls = (active) => "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition " +
    (active ? "border-brand bg-brand-50 text-brand ring-4 ring-brand/10" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50");

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={"Registrar contato com " + nome}>
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px] anim-fade" onClick={onCancel} />
      <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-3xl bg-white shadow-pop anim-sheet sm:rounded-2xl">
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex shrink-0 items-start gap-4 px-6 pt-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><I.Phone size={22} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-ink">Registrar contato com {nome}</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">Fica na linha do tempo da ficha{mod ? " em " + mod.nome : ""}. Leva dez segundos.</p>
          </div>
          <IconBtn title="Fechar (Esc)" onClick={onCancel} className="-mr-2 -mt-1"><I.X size={18} /></IconBtn>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-1.5 text-sm font-medium text-slate-700">Como foi o contato?</div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Canal do contato">
            {TASK_TYPES.map((t, i) => {
              const active = canal === t.key;
              return (
                <button key={t.key} type="button" role="radio" aria-checked={active} ref={i === 0 ? firstRef : null} onClick={() => setCanal(t.key)}
                  className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition " + (active ? "border-brand bg-brand-50 text-brand ring-4 ring-brand/10" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50")}>
                  <TaskTypeIcon tipo={t.key} size={14} /> {t.label}
                </button>
              );
            })}
          </div>

          <div className="mb-1.5 mt-4 text-sm font-medium text-slate-700">Qual foi o resultado?</div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label="Resultado do contato">
            {CONTACT_RESULTS.map((r) => {
              const active = resultado === r.key;
              return (
                <button key={r.key} type="button" role="radio" aria-checked={active} onClick={() => setResultado(r.key)} className={choiceCls(active)}>
                  <span className={"flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 " + (active ? "border-brand" : "border-slate-300")}>
                    {active && <span className="h-2 w-2 rounded-full bg-brand" />}
                  </span>
                  <span className="truncate">{r.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <Field label="Observação (opcional)">
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} className={inputCls + " min-h-[64px] resize-y"} placeholder="Ex.: pediu para ligar depois do dia 10, quando fecha o orçamento." />
            </Field>
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            <input type="checkbox" checked={agendar} onChange={(e) => setAgendar(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#3152E4]" />
            <span className="flex-1">Agendar próximo passo</span>
            <I.CalendarPlus size={16} className="text-slate-400" />
          </label>
          {agendar && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
              <StageQuickSteps client={client} selected={quick} onSelect={pickQuick} />
              <div className="my-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />ou escreva a tarefa<span className="h-px flex-1 bg-slate-200" />
              </div>
              <StageTaskForm value={form} onChange={changeForm} onSubmit={submit} />
              {next && <p className="mt-2 text-xs text-slate-500">Próximo passo: <b className="text-ink">{next.titulo}</b> · {stageWhenLabel(next)}</p>}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end sm:gap-2.5">
          <button type="button" onClick={onCancel} className={btn.secondary}>Cancelar</button>
          <button type="button" onClick={submit} disabled={!canSubmit} className={btn.primary}><I.Check size={16} /> Registrar contato</button>
        </div>
      </div>
    </div>
  );
}
