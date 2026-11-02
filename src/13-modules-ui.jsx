/* --------------------------- Module Manager ------------------------------- */
const MODULE_COLORS = ["#3152E4", "#7C3AED", "#0E7490", "#047857", "#D97706", "#DC2626", "#BE185D", "#0D9488"];

/* Janela modal genérica. No celular sobe como uma "folha" de baixo para cima
   (até 92% da altura); no desktop fica centralizada. Cabeçalho e rodapé ficam
   fixos; só o conteúdo rola.
   Foco: ao abrir, vai para o primeiro elemento com [data-autofocus] dentro da
   janela ou, se não houver, para o botão "Fechar" (a menos que algo dentro já
   esteja focado, ex.: input com autoFocus). Ao fechar, devolve o foco para o
   elemento que estava ativo antes (o botão que abriu a janela). */
function Modal({ title, subtitle, icon: IconC, onClose, children, footer, width = "max-w-2xl" }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const panel = panelRef.current;
    const already = panel && document.activeElement && document.activeElement !== document.body && panel.contains(document.activeElement);
    if (!already) {
      const target = (panel && panel.querySelector("[data-autofocus]")) || closeRef.current;
      if (target && target.focus) { try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); } }
    }
    return () => {
      if (prev && prev.focus && document.contains(prev)) { try { prev.focus({ preventScroll: true }); } catch (e) {} }
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] anim-fade" onClick={onClose} />
      <div ref={panelRef} className={"relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-pop anim-sheet sm:max-h-[88vh] sm:rounded-2xl " + width}>
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {IconC && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><IconC size={18} /></span>}
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold leading-tight text-ink">{title}</h2>
              {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <IconBtn innerRef={closeRef} title="Fechar (Esc)" onClick={onClose} className="-mr-1.5"><I.X size={20} /></IconBtn>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5 sm:rounded-b-2xl sm:px-6">{footer}</div>}
      </div>
    </div>
  );
}

function ModuleManager({ modules, onClose, onAdd, onDelete }) {
  const [creating, setCreating] = useState(false);
  return (
    <Modal title={creating ? "Novo módulo de produto" : "Módulos de produto"} subtitle={creating ? "Defina o nome, a cor e os campos de cada item" : "Cada módulo tem sua própria carteira de clientes e campos"} icon={I.Grid} onClose={onClose}>
      {!creating ? (
        <>
          <p className="mb-4 text-sm leading-relaxed text-slate-500">
            Um módulo é uma linha de produto (ex.: Benefícios, Adquirência). Cada um tem sua própria lista de clientes,
            seus itens e seus campos. As configurações de equipe, funil e automações valem para todos.
          </p>
          <div className="space-y-2">
            {modules.map((m) => {
              const MIcon = I[m.icon] || I.Grid;
              const vf = (m.fields || []).find((f) => f.id === m.valueField && f.type === "currency");
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: m.accent }}><MIcon size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-ink">{m.nome}</div>
                    <div className="truncate text-xs text-slate-500">
                      <span className="tnum">{m.clients.length}</span> {m.clients.length === 1 ? "cliente" : "clientes"} · <span className="tnum">{m.fields.length}</span> {m.fields.length === 1 ? "campo" : "campos"} por {m.itemLabel.toLowerCase()}{m.options.length ? " · " + m.options.length + " opções" : ""}{vf ? " · valor: " + vf.label : ""}
                    </div>
                  </div>
                  {modules.length > 1
                    ? <IconBtn title="Excluir módulo" onClick={() => onDelete(m.id)} danger><I.Trash size={18} /></IconBtn>
                    : <span className="text-[11px] text-slate-400" title="O último módulo não pode ser excluído">único</span>}
                </div>
              );
            })}
          </div>
          <button onClick={() => setCreating(true)}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/30 bg-brand-50/40 py-3 text-sm font-semibold text-brand transition hover:border-brand/50 hover:bg-brand-50">
            <I.Plus size={18} /> Criar novo módulo de produto
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-400">Excluir um módulo apaga os clientes dele. Faça um backup antes em Configurações.</p>
        </>
      ) : (
        <ModuleBuilder onCancel={() => setCreating(false)} onCreate={onAdd} existingIds={modules.map((m) => m.id)} />
      )}
    </Modal>
  );
}

/* Próximo id livre para um campo novo ("campo4", "campo5"...): pula os que já
   existem na lista, mesmo depois de remover campos no meio. */
function moduleBuilderNextId(fields, from) {
  const used = new Set(fields.map((f) => f.id));
  let n = Math.max(1, from || 1);
  while (used.has("campo" + n)) n++;
  return "campo" + n;
}
/* Id final seguro: minúsculo, só letras/números/_, único na lista (sufixo _2, _3...). */
function moduleBuilderSafeId(raw, taken) {
  let base = String(raw || "").toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "") || "campo";
  let id = base, n = 1;
  while (taken.has(id)) id = base + "_" + (++n);
  taken.add(id);
  return id;
}

function ModuleBuilder({ onCancel, onCreate, existingIds }) {
  const [nome, setNome] = useState("");
  const [itemLabel, setItemLabel] = useState("Item");
  const [accent, setAccent] = useState(MODULE_COLORS[2]);
  const [icon, setIcon] = useState("Grid");
  const [options, setOptions] = useState("");
  const [fields, setFields] = useState([
    { id: "tipo", label: "Tipo", type: "text", fromOptions: true },
    { id: "status", label: "Status", type: "status" },
    { id: "valor", label: "Valor", type: "currency" },
  ]);
  const [valueField, setValueField] = useState("valor");   // qual campo em R$ é o valor do negócio
  const [err, setErr] = useState("");
  const seq = useRef(4);   // contador de ids gerados; só cresce e pula ids já usados

  const addField = () => setFields((fs) => {
    const id = moduleBuilderNextId(fs, seq.current);
    seq.current = Number(id.replace("campo", "")) + 1;
    return [...fs, { id, label: "", type: "text" }];
  });
  const updateField = (i, patch) => setFields((fs) => fs.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  /* Troca de tipo com as regras do status: o campo de status é único e sempre tem
     id "status"; se ele virar outro tipo, ganha um id novo (o id "status" é reservado). */
  const setFieldType = (i, type) => {
    if (type === "status" && fields.some((f, idx) => idx !== i && f.type === "status")) { setErr("Só pode existir um campo de status por item."); return; }
    let newId = null;
    if (type === "status") newId = "status";
    else if (fields[i] && fields[i].id === "status") { newId = moduleBuilderNextId(fields, seq.current); seq.current = Number(newId.replace("campo", "")) + 1; }
    setFields((fs) => fs.map((f, idx) => idx === i ? { ...f, id: newId || f.id, type, fromOptions: type === "text" ? !!f.fromOptions : false } : f));
    if (err) setErr("");
  };
  const removeField = (i) => setFields((fs) => fs.filter((_, idx) => idx !== i));

  const currencyFields = fields.filter((f) => f.type === "currency");
  const hasStatus = fields.some((f) => f.type === "status");
  const effectiveValueField = currencyFields.some((f) => f.id === valueField) ? valueField : (currencyFields[0] ? currencyFields[0].id : "");

  const create = () => {
    if (!nome.trim()) { setErr("Dê um nome ao módulo."); return; }
    const validFields = fields.filter((f) => f.label.trim());
    if (validFields.length === 0) { setErr("Adicione ao menos um campo."); return; }
    if (validFields.filter((f) => f.type === "status").length > 1) { setErr("Só pode existir um campo de status por item."); return; }
    let base = nome.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    let id = base || "modulo"; let n = 1;
    while (existingIds.includes(id)) { id = base + "_" + (++n); }
    /* ids finais: status sempre "status"; os demais limpos e únicos. */
    const taken = new Set(validFields.some((f) => f.type === "status") ? ["status"] : []);
    const idMap = {};
    const finalFields = validFields.map((f, i) => {
      const fid = f.type === "status" ? "status" : moduleBuilderSafeId(f.id || "campo_" + (i + 1), taken);
      idMap[f.id] = fid;
      return { id: fid, label: f.label.trim(), type: f.type, fromOptions: !!f.fromOptions && f.type === "text" };
    });
    const firstCurrency = finalFields.find((f) => f.type === "currency");
    const chosen = effectiveValueField && idMap[effectiveValueField] && finalFields.some((f) => f.id === idMap[effectiveValueField] && f.type === "currency") ? idMap[effectiveValueField] : (firstCurrency ? firstCurrency.id : "");
    const opts = options.split("\n").map((o) => o.trim()).filter(Boolean);
    onCreate({ id, nome: nome.trim(), icon, accent, itemLabel: itemLabel.trim() || "Item", itemLabelPlural: (itemLabel.trim() || "Item") + "s", options: opts, fields: finalFields, valueField: chosen });
  };

  const PreviewIcon = I[icon] || I.Grid;
  return (
    <div>
      {/* Prévia de como o módulo aparece na barra lateral */}
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm" style={{ background: accent }}><PreviewIcon size={17} /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">{nome.trim() || "Nome do módulo"}</div>
          <div className="truncate text-xs text-slate-500">Cada cliente terá seus {((itemLabel.trim() || "Item") + "s").toLowerCase()}</div>
        </div>
        <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 shadow-sm">prévia</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nome do módulo" required><input className={inputCls} value={nome} onChange={(e) => { setNome(e.target.value); if (err) setErr(""); }} placeholder="Ex.: Crédito, Seguros, Energia" autoFocus data-autofocus /></Field>
        <Field label="Como chamar cada item" hint="Ex.: Produto, Plano, Contrato"><input className={inputCls} value={itemLabel} onChange={(e) => setItemLabel(e.target.value)} /></Field>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Cor</span>
          <div className="flex flex-wrap gap-2">
            {MODULE_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setAccent(c)} aria-label={"Cor " + c}
                className={"h-8 w-8 rounded-lg transition " + (accent === c ? "ring-2 ring-offset-2 ring-ink" : "hover:scale-105")} style={{ background: c }} />
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Ícone</span>
          <div className="flex flex-wrap gap-2">
            {ICON_CHOICES.map((k) => { const Ic = I[k]; return (
              <button key={k} type="button" onClick={() => setIcon(k)} aria-label={"Ícone " + k}
                className={"flex h-8 w-8 items-center justify-center rounded-lg border transition " + (icon === k ? "border-transparent text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300")}
                style={icon === k ? { background: accent } : undefined}><Ic size={16} /></button>
            ); })}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Field label="Opções pré-definidas (uma por linha, opcional)" hint='Usadas no campo marcado como "lista".'>
          <textarea className={inputCls + " min-h-[72px] resize-y"} value={options} onChange={(e) => setOptions(e.target.value)} placeholder={"Empréstimo pessoal\nCapital de giro\nFinanciamento"} />
        </Field>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Campos por {(itemLabel || "item").toLowerCase()}</span>
          <button type="button" onClick={addField} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"><I.Plus size={14} /> Adicionar campo</button>
        </div>
        <div className="space-y-2">
          {fields.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 px-3 py-5 text-center text-xs text-slate-400">
              Nenhum campo. <button type="button" onClick={addField} className="font-semibold text-brand hover:underline">Adicionar o primeiro campo</button>
            </div>
          )}
          {fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2">
              <input className={inputCls + " col-span-12 py-2 text-xs sm:col-span-5"} value={f.label} onChange={(e) => { updateField(i, { label: e.target.value }); if (err) setErr(""); }} placeholder="Nome do campo (ex.: Valor mensal)" aria-label="Nome do campo" />
              <select className={inputCls + " col-span-7 py-2 text-xs sm:col-span-4"} value={f.type} onChange={(e) => setFieldType(i, e.target.value)} aria-label="Tipo do campo">
                {FIELD_TYPES.map((t) => (
                  <option key={t.key} value={t.key} disabled={t.key === "status" && f.type !== "status" && hasStatus}>
                    {t.label}{t.key === "status" && f.type !== "status" && hasStatus ? " (já existe)" : ""}
                  </option>
                ))}
              </select>
              <label className={"col-span-4 flex items-center gap-1.5 text-[11px] sm:col-span-2 " + (f.type !== "text" ? "text-slate-300" : "text-slate-600")} title="Preencher a partir da lista de opções">
                <input type="checkbox" className="accent-[#3152E4]" checked={!!f.fromOptions} disabled={f.type !== "text"} onChange={(e) => updateField(i, { fromOptions: e.target.checked })} /> lista
              </label>
              <button type="button" onClick={() => removeField(i)} className="col-span-1 flex h-8 w-8 items-center justify-center justify-self-end rounded-md text-slate-300 transition hover:bg-red-50 hover:text-red-500" aria-label="Remover campo"><I.X size={15} /></button>
            </div>
          ))}
        </div>

        {/* Qual campo em R$ representa o valor do negócio (soma no funil, painel e relatórios) */}
        <div className="mt-3">
          {currencyFields.length > 0 ? (
            <Field label="Qual campo em R$ é o valor do negócio?" hint="É o valor que soma no funil, no painel, nas metas e nos relatórios.">
              <Select value={effectiveValueField} onChange={setValueField} ariaLabel="Campo do valor do negócio"
                options={currencyFields.map((f, idx) => ({ value: f.id, label: f.label.trim() || ("Campo em R$ " + (idx + 1) + " (sem nome)") }))} />
            </Field>
          ) : (
            <p className="flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <I.Info size={14} className="mt-0.5 shrink-0" /> Sem nenhum campo do tipo "Valor (R$)", o funil e o painel não vão somar o valor dos negócios deste módulo.
            </p>
          )}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">Tipos: texto, número, valor (R$) e status (interesse/contratado, um por item). Marque "lista" para um campo de texto puxar das opções acima.</p>
      </div>

      {err && <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-red-600"><I.Alert size={15} /> {err}</p>}
      <div className="mt-5 flex justify-end gap-2.5">
        <button type="button" onClick={onCancel} className={btn.ghost}><I.ChevL size={16} /> Voltar</button>
        <button type="button" onClick={create} className={btn.primary}>Criar módulo</button>
      </div>
    </div>
  );
}
