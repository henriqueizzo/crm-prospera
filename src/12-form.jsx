/* ------------------------------- Client form ------------------------------ */
/* Campos do formulário que podem satisfazer uma exigência de etapa (contrato §2.2 required). */
const FORM_REQUIRABLE_KEYS = ["empresa", "telefone", "email", "origem", "responsavel", "porte", "interesse"];
const FORM_DUP_LABEL = { telefone: "mesmo telefone", email: "mesmo e-mail", empresa: "mesma empresa", nome: "mesmo nome" };

function formEmptyClient(settings) {
  return {
    nome: "", telefone: "", email: "", empresa: "", status: "lead", obs: "",
    origem: "", responsavel: (settings && settings.usuarioAtual) || "", porte: "", interesse: "",
  };
}

function ClientForm({ mod, initial, settings, clients, requireFor, onClose, onSave, onOpenExisting }) {
  const st = settings || {};
  /* Edição = veio um cliente com id. Na edição a etapa NÃO é alterada por aqui (ficha do cliente ou funil). */
  const isEdit = !!(initial && initial.id);
  const [form, setForm] = useState(() => initial ? { ...formEmptyClient(st), ...initial } : formEmptyClient(st));
  const [errors, setErrors] = useState({});
  const nameRef = useRef(null);
  useEffect(() => { nameRef.current && nameRef.current.focus(); }, []);

  const set = (k, transform) => (e) => { const v = transform ? transform(e.target.value) : e.target.value; setForm((f) => ({ ...f, [k]: v })); if (errors[k]) setErrors((er) => ({ ...er, [k]: null })); };
  const setVal = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); if (errors[k]) setErrors((er) => ({ ...er, [k]: null })); };

  /* ---- opções dos selects ---- */
  const origemOpts = (st.origens || []).map((o) => ({ value: o.id, label: o.label }));
  const vendedorOpts = (st.vendedores || []).map((v) => ({ value: v.id, label: v.nome }));
  const porteOpts = PORTES.map((p) => ({ value: p.key, label: p.label }));

  /* ---- exigências da etapa de destino (quando veio do "Preencher agora") ---- */
  const reqStage = requireFor ? statusMeta(requireFor) : null;
  const reqKeys = requireFor ? ((st.required && st.required[requireFor]) || []) : [];
  const reqLabels = reqKeys.map((k) => { const f = REQUIRED_FIELD_KEYS.find((x) => x.key === k); return f ? f.label : k; });
  const reqNeedsItems = reqKeys.some((k) => k === "valor" || k === "itens");
  const isReq = (k) => reqKeys.includes(k);

  /* ---- possíveis duplicados (ao vivo) ---- */
  const dups = useMemo(() => {
    if (!clients || !clients.length) return [];
    const q = { nome: form.nome, telefone: form.telefone, email: form.email, empresa: form.empresa };
    if (!(q.nome || "").trim() && !onlyDigits(q.telefone) && !(q.email || "").trim() && !(q.empresa || "").trim()) return [];
    const found = findDuplicates(clients, q, initial && initial.id) || [];
    const byId = new Map();
    found.forEach((d) => {
      if (!d || !d.client) return;
      const cur = byId.get(d.client.id) || { client: d.client, campos: [] };
      if (d.campo && !cur.campos.includes(d.campo)) cur.campos.push(d.campo);
      byId.set(d.client.id, cur);
    });
    return Array.from(byId.values()).slice(0, 3);
  }, [clients, form.nome, form.telefone, form.email, form.empresa, initial && initial.id]);

  const submit = () => {
    const er = {};
    if (!form.nome.trim()) er.nome = "Informe o nome do cliente.";
    if (!isEmail(form.email)) er.email = "Digite um e-mail válido (ex.: nome@empresa.com).";
    const digits = onlyDigits(form.telefone);
    if (digits && digits.length < 10) er.telefone = "Telefone incompleto. Use DDD + número.";
    if (requireFor && reqStage) {
      const asClient = { ...form, items: form.items || [], tasks: form.tasks || [] };
      const missing = missingForStage(st, mod, asClient, requireFor) || [];
      missing.forEach((m) => { if (FORM_REQUIRABLE_KEYS.includes(m.key) && !er[m.key]) er[m.key] = "Obrigatório para mover para " + reqStage.label + "."; });
    }
    if (Object.keys(er).length) { setErrors(er); return; }
    const data = { ...form, nome: form.nome.trim(), email: (form.email || "").trim(), empresa: (form.empresa || "").trim() };
    /* Na edição o objeto salvo não leva `status`: a etapa só muda pela ficha ou pelo funil (com as regras). */
    if (isEdit) delete data.status;
    onSave(data);
  };
  const onKey = (e) => { if (e.key === "Enter" && !["TEXTAREA", "BUTTON", "SELECT"].includes(e.target.tagName)) { e.preventDefault(); submit(); } };

  const reqMark = (k) => (isReq(k) ? <span className="ml-1 rounded bg-brand-50 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-brand">necessário</span> : null);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={isEdit ? "Editar cliente" : "Novo cliente"}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] anim-fade" onClick={onClose} />
      <div className="relative flex max-h-[94vh] w-full max-w-2xl flex-col rounded-t-3xl bg-white shadow-pop anim-pop sm:max-h-[92vh] sm:rounded-2xl" onKeyDown={onKey}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-ink">{isEdit ? "Editar cliente" : "Novo cliente"}</h2>
            <p className="text-xs text-slate-500">Módulo {mod.nome}</p>
          </div>
          <IconBtn title="Fechar (Esc)" onClick={onClose}><I.X size={20} /></IconBtn>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {requireFor && reqStage && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-3.5 text-sm text-slate-700">
              <span className="mt-0.5 shrink-0 text-brand"><I.Info size={18} /></span>
              <div className="min-w-0">
                <div className="font-semibold text-ink">Para mover para <span style={{ color: reqStage.text }}>{reqStage.label}</span> precisamos de:</div>
                <div className="mt-0.5 text-xs text-slate-600">{reqLabels.length ? reqLabels.join(" · ") : "nenhum campo extra"}</div>
                {reqNeedsItems && <div className="mt-1 text-xs text-slate-500">Depois, adicione um {mod.itemLabel.toLowerCase()} com valor na ficha do cliente.</div>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Nome do contato" required error={errors.nome}>
                <input ref={nameRef} className={inputCls + (errors.nome ? inputErrCls : "")} value={form.nome} onChange={set("nome")} placeholder="Ex.: Mariana Costa" autoComplete="off" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label={<>Empresa{reqMark("empresa")}</>} error={errors.empresa}>
                <input className={inputCls + (errors.empresa ? inputErrCls : "")} value={form.empresa} onChange={set("empresa")} placeholder="Ex.: TechLog Soluções" autoComplete="off" />
              </Field>
            </div>
            <Field label={<>Telefone / WhatsApp{reqMark("telefone")}</>} error={errors.telefone}>
              <input className={inputCls + (errors.telefone ? inputErrCls : "")} value={form.telefone} onChange={set("telefone", maskPhone)} placeholder="(11) 99999-9999" inputMode="tel" autoComplete="off" />
            </Field>
            <Field label={<>E-mail{reqMark("email")}</>} error={errors.email}>
              <input className={inputCls + (errors.email ? inputErrCls : "")} value={form.email} onChange={set("email")} placeholder="nome@empresa.com" inputMode="email" autoComplete="off" />
            </Field>

            {dups.length > 0 && (
              <div className="sm:col-span-2">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
                  <div className="flex items-center gap-2 font-semibold"><I.Alert size={16} /> Parece que este cliente já existe</div>
                  <ul className="mt-2 space-y-1.5">
                    {dups.map((d) => (
                      <li key={d.client.id} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                        <span className="min-w-0 truncate text-xs">
                          <b className="text-amber-950">{d.client.nome}</b>{d.client.empresa ? " · " + d.client.empresa : ""}
                          <span className="text-amber-700"> · {d.campos.map((c) => FORM_DUP_LABEL[c] || c).join(", ")}</span>
                        </span>
                        {onOpenExisting && (
                          <button type="button" onClick={() => onOpenExisting(d.client.id)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100">
                            Abrir cadastro existente <I.ChevR size={13} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-amber-700">Você ainda pode salvar, se for mesmo outra pessoa.</p>
                </div>
              </div>
            )}

            <Field label={<>Origem{reqMark("origem")}</>} error={errors.origem} hint="De onde esse cliente veio.">
              <Select value={form.origem} onChange={setVal("origem")} options={origemOpts} placeholder="Selecionar" ariaLabel="Origem do cliente" className={errors.origem ? "[&>select]:border-red-400" : ""} />
            </Field>
            <Field label={<>Responsável{reqMark("responsavel")}</>} error={errors.responsavel} hint="Quem cuida desse cliente.">
              <Select value={form.responsavel} onChange={setVal("responsavel")} options={vendedorOpts} placeholder="Selecionar" ariaLabel="Responsável pelo cliente" className={errors.responsavel ? "[&>select]:border-red-400" : ""} />
            </Field>
            <Field label={<>Porte da empresa{reqMark("porte")}</>} error={errors.porte}>
              <Select value={form.porte} onChange={setVal("porte")} options={porteOpts} placeholder="Selecionar" ariaLabel="Porte da empresa" className={errors.porte ? "[&>select]:border-red-400" : ""} />
            </Field>
            <div>
              <span className="mb-1.5 flex items-center text-sm font-medium text-slate-700">Interesse{reqMark("interesse")}</span>
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Nível de interesse">
                {INTERESSES.map((it) => {
                  const active = form.interesse === it.key;
                  return (
                    <button type="button" key={it.key} role="radio" aria-checked={active}
                      onClick={() => setVal("interesse")(active ? "" : it.key)}
                      className={"inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-semibold transition " + (active ? "border-transparent shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300") + (errors.interesse && !active ? " border-red-300" : "")}
                      style={active ? { background: it.soft, color: it.text, boxShadow: "inset 0 0 0 1px " + it.color + "55" } : undefined}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: it.color }} />{it.label}
                    </button>
                  );
                })}
              </div>
              {errors.interesse ? <span className="mt-1 block text-xs font-medium text-red-600">{errors.interesse}</span> : <span className="mt-1 block text-xs text-slate-400">Ajuda a calcular a prioridade.</span>}
            </div>

            {isEdit ? (
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Etapa no funil</span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                  <StatusBadge status={form.status} />
                  <span className="text-xs text-slate-500">Para mudar a etapa, use a ficha do cliente ou o funil</span>
                </div>
              </div>
            ) : (
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Etapa no funil</span>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {STATUSES.map((s) => {
                    const active = form.status === s.key;
                    return (
                      <button type="button" key={s.key} onClick={() => setForm((f) => ({ ...f, status: s.key }))}
                        className={"inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition " + (active ? "border-transparent shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}
                        style={active ? { background: s.soft, color: s.text, boxShadow: "inset 0 0 0 1px " + s.color + "55" } : undefined}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />{s.label}
                      </button>
                    );
                  })}
                </div>
                {form.status !== "lead" && <span className="mt-1 block text-xs text-slate-400">O cliente entra como Lead e é movido em seguida, respeitando as regras da etapa escolhida.</span>}
              </div>
            )}
            <div className="sm:col-span-2">
              <Field label="Observações" hint={"Os " + mod.itemLabelPlural.toLowerCase() + " são adicionados depois, dentro do card do cliente."}>
                <textarea className={inputCls + " min-h-[96px] resize-y"} value={form.obs} onChange={set("obs")} placeholder="Contexto, histórico, próximos passos…" />
              </Field>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2.5 border-t border-slate-100 px-6 py-4">
          <span className="hidden items-center gap-1.5 text-[11px] text-slate-400 sm:inline-flex"><Kbd>Enter</Kbd> salva · <Kbd>Esc</Kbd> fecha</span>
          <div className="ml-auto flex items-center gap-2.5">
            <button type="button" onClick={onClose} className={btn.ghost}>Cancelar</button>
            <button type="button" onClick={submit} className={btn.primary}>{isEdit ? "Salvar alterações" : "Cadastrar cliente"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
