/* ------------------------------ Client drawer ----------------------------- */
/* Ficha lateral do cliente (v4): cabeçalho com etapa, prazo, prioridade e
   responsável; abas Resumo / Itens / Tarefas / Notas; perfil editável no
   lugar (mini-popover); tarefas com hora e tipo, editáveis e adiáveis; linha
   do tempo única (notas + histórico + etapas) com caixa rápida de nota;
   registro de contato; itens editáveis; foco acessível ao abrir/fechar. */

/* Ícones com fallback, caso algum ainda não exista em I. */
const drawerIc = (name, fallback) => I[name] || I[fallback] || I.Info;
const DRAWER_TABS = ["resumo", "itens", "tarefas", "notas"];
const DRAWER_TL_PAGE = 8;
/* Ícone e cor de cada tipo de entrada da linha do tempo. */
const DRAWER_TL_META = {
  cadastro: { icon: "Sparkles", fb: "Plus", color: "#3152E4" },
  etapa:    { icon: "ArrowRight", fb: "ChevR", color: "#3152E4" },
  tarefa:   { icon: "ListChecks", fb: "Check", color: "#047857" },
  nota:     { icon: "Note", fb: "Pencil", color: "#D97706" },
  contato:  { icon: "UserCheck", fb: "Phone", color: "#3152E4" },
  mensagem: { icon: "Send", fb: "Chat", color: "#3152E4" },
  proposta: { icon: "FileText", fb: "Card", color: "#7C3AED" },
  item:     { icon: "Layers", fb: "Building", color: "#0E7490" },
  dados:    { icon: "Pencil", fb: "Cog", color: "#64748B" },
  "":       { icon: "History", fb: "Clock", color: "#94A3B8" },
};

function drawerCopyFallback(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", "");
    ta.style.position = "fixed"; ta.style.opacity = "0"; ta.style.top = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch (e) { return false; }
}
function drawerCopyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => drawerCopyFallback(text));
  }
  return Promise.resolve(drawerCopyFallback(text));
}
const drawerDays = (n) => { if (n < 1) return "menos de 1 dia"; const r = Math.round(n); return r + (r === 1 ? " dia" : " dias"); };
/* "YYYY-MM-DD" → "dd/mm" (texto curto do histórico de adiamento). */
const drawerShortDate = (iso) => (iso && iso.length >= 10) ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "";
const drawerEscRe = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/* Textarea de 1 linha que cresce conforme o texto. */
function drawerAutoGrow(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
}
/* Tipo de uma entrada do histórico: usa h.tipo (v4) ou deduz pelo texto (dados antigos). */
function drawerHistoryTipo(h, mod) {
  if (h && h.tipo) return h.tipo;
  const t = (h && h.text) || "";
  if (/^Etapa alterada/i.test(t)) return "etapa";
  if (/^Tarefa/i.test(t)) return "tarefa";
  if (/^Nota/i.test(t)) return "nota";
  if (/^(Cliente cadastrado|Importad)/i.test(t)) return "cadastro";
  if (/^Mensagem/i.test(t)) return "mensagem";
  if (/^Proposta/i.test(t)) return "proposta";
  if (/^(WhatsApp aberto|Ligação iniciada|E-mail aberto|Ligação:|WhatsApp:|E-mail:|Reunião:|Contato)/i.test(t)) return "contato";
  if (/^(Dados do cliente|Origem |Responsável |Porte |Interesse )/i.test(t)) return "dados";
  const label = mod && mod.itemLabel ? drawerEscRe(mod.itemLabel) : "Item";
  if (new RegExp("^(Item|" + label + ") ", "i").test(t) || /marcado como (contratado|de interesse)/i.test(t)) return "item";
  return "";
}

function ClientDrawer({ mod, client, settings, onClose, onEdit, onDelete, patch, changeStatus, notify, onProposal, onLog, onOpenSettings,
                        onToggleTask, onContact, onContactLink, initialTab }) {
  const startTab = DRAWER_TABS.includes(initialTab) ? initialTab : "resumo";
  const [tab, setTab] = useState(startTab);
  const [draft, setDraft] = useState(() => newItem(mod));
  const [taskDraft, setTaskDraft] = useState({ titulo: "", data: "", hora: "", tipo: "" });
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [doneOpen, setDoneOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [tlLimit, setTlLimit] = useState(DRAWER_TL_PAGE);
  const [profileOpen, setProfileOpen] = useState(null); // "origem" | "responsavel" | "porte" | "interesse" | null
  const [msgOpen, setMsgOpen] = useState(false);
  const msgRef = useRef(null);
  const quickRef = useRef(null);
  const closeRef = useRef(null);
  const prevFocusRef = useRef(null);
  /* Sempre aponta para o cliente mais recente (usado nos "Desfazer", que rodam depois). */
  const clientRef = useRef(client);
  clientRef.current = client;

  const comments = client.comments || [];
  const hasStatus = mod.fields.some((f) => f.type === "status");
  const totalInteresse = client.items.filter((it) => !hasStatus || it.status === "interesse").reduce((s, it) => s + itemValue(mod, it), 0);
  const totalContratado = client.items.filter((it) => it.status === "contratado").reduce((s, it) => s + itemValue(mod, it), 0);
  const first = (client.nome || "").split(" ")[0];
  const digits = onlyDigits(client.telefone);
  const canWa = digits.length >= 10, canMail = !!(client.email || "").trim();
  const vendedorAtual = vendedorNome(settings, settings.usuarioAtual);
  const waText = "Olá " + first + ", aqui é " + (vendedorAtual ? vendedorAtual + " da Próspera." : "da Próspera.");
  const waLink = canWa ? "https://wa.me/55" + digits + "?text=" + encodeURIComponent(waText) : null;
  const telLink = canWa ? "tel:+55" + digits : null;
  const mailLink = canMail
    ? "mailto:" + encodeURIComponent(client.email.trim()) + "?subject=" + encodeURIComponent("Próspera — " + mod.nome) + "&body=" + encodeURIComponent("Olá " + first + ",\n\n")
    : null;
  const autor = vendedorAtual || "Você";
  const interesse = interesseMeta(client.interesse);
  const stages = stageDurations(client);

  /* Foco: ao abrir vai para o botão fechar; ao fechar volta para onde estava. */
  useEffect(() => {
    prevFocusRef.current = document.activeElement;
    if (closeRef.current) closeRef.current.focus();
    return () => {
      const el = prevFocusRef.current;
      if (el && typeof el.focus === "function" && document.contains(el)) { try { el.focus(); } catch (e) {} }
    };
  }, []);
  /* Trocou de cliente com a ficha aberta: limpa estados de edição e volta para a aba inicial. */
  useEffect(() => {
    setTab(DRAWER_TABS.includes(initialTab) ? initialTab : "resumo");
    setEditingTaskId(null); setProfileOpen(null); setMsgOpen(false); setDoneOpen(false);
    setTlLimit(DRAWER_TL_PAGE); setQuickNote(""); setNoteDraft("");
    setTaskDraft({ titulo: "", data: "", hora: "", tipo: "" }); setDraft(newItem(mod));
  }, [client.id]);
  useEffect(() => { if (msgOpen && msgRef.current) msgRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgOpen]);
  const goTab = (k) => { setTab(k); setMsgOpen(false); setProfileOpen(null); };

  /* Remove um registro de uma lista (tasks/items/comments) com toast "Desfazer" que o devolve na mesma posição. */
  const removeFromList = (key, id, { title, message, removed, restored }) => {
    const list = clientRef.current[key] || [];
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const entry = list[idx];
    patch({ [key]: list.filter((x) => x.id !== id) }, removed);
    let undone = false;
    notify({ kind: "info", title, message, duration: 6000, action: { label: "Desfazer", onClick: () => {
      if (undone) return; undone = true;
      const cur = clientRef.current[key] || [];
      if (cur.some((x) => x.id === id)) return;
      const next = [...cur]; next.splice(Math.min(idx, next.length), 0, entry);
      patch({ [key]: next }, restored);
    } } });
  };

  /* ---- itens ---- */
  const addItem = () => {
    const it = { ...draft, id: uid() };
    patch({ items: [...client.items, it] }, mod.itemLabel + " adicionado: " + itemTitle(mod, it));
    setDraft(newItem(mod));
    notify({ title: mod.itemLabel + " adicionado", message: itemTitle(mod, it), duration: 2500 });
  };
  const removeItem = (id) => {
    const it = client.items.find((x) => x.id === id);
    const t = it ? itemTitle(mod, it) : "";
    removeFromList("items", id, { title: mod.itemLabel + " removido", message: t, removed: mod.itemLabel + " removido: " + t, restored: mod.itemLabel + " restaurado: " + t });
  };
  const toggleItemStatus = (id) => {
    const it = client.items.find((x) => x.id === id);
    const next = it && it.status === "interesse" ? "contratado" : "interesse";
    patch({ items: client.items.map((x) => x.id === id ? { ...x, status: next } : x) }, it ? itemTitle(mod, it) + " marcado como " + (next === "contratado" ? "contratado" : "de interesse") : null);
  };
  const updateItem = (id, data) => {
    const items = clientRef.current.items || [];
    const next = { ...data, id };
    patch({ items: items.map((x) => x.id === id ? next : x) }, "Item atualizado: " + itemTitle(mod, next));
  };
  const setDraftField = (fid, val) => setDraft((d) => ({ ...d, [fid]: val }));

  /* ---- tarefas ---- */
  const addTask = () => {
    const titulo = taskDraft.titulo.trim();
    if (!titulo) return;
    const t = newTask({ titulo, data: taskDraft.data, hora: taskDraft.hora, tipo: taskDraft.tipo });
    patch({ tasks: [...(client.tasks || []), t] }, "Tarefa criada: " + titulo);
    setTaskDraft({ titulo: "", data: "", hora: "", tipo: "" });
  };
  const toggleTask = (id) => {
    if (onToggleTask) { onToggleTask(id); return; }
    /* Reserva (sem o app v4): alterna direto. */
    const t = (client.tasks || []).find((x) => x.id === id);
    patch({ tasks: client.tasks.map((x) => x.id === id ? { ...x, feito: !x.feito, feitoEm: !x.feito ? nowISO() : "" } : x) }, t && !t.feito ? "Tarefa concluída: " + t.titulo : null);
  };
  const saveTask = (id, d) => {
    const titulo = (d.titulo || "").trim();
    if (!titulo) return;
    const tasks = clientRef.current.tasks || [];
    patch({ tasks: tasks.map((x) => x.id === id ? { ...x, titulo, data: d.data || "", hora: d.hora || "", tipo: d.tipo || "" } : x) }, "Tarefa atualizada: " + titulo);
    setEditingTaskId(null);
  };
  /* n = 0 → hoje; n > 0 → soma dias a partir da data da tarefa (ou de hoje, se ela já passou ou não tem data). */
  const postponeTask = (id, n) => {
    const tasks = clientRef.current.tasks || [];
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const hoje = todayISO();
    const base = t.data && t.data > hoje ? t.data : hoje;
    const data = n === 0 ? hoje : addDaysISO(base, n);
    if (data === t.data) return;
    patch({ tasks: tasks.map((x) => x.id === id ? { ...x, data } : x) }, "Tarefa adiada para " + drawerShortDate(data));
  };
  const removeTask = (id) => {
    const t = (clientRef.current.tasks || []).find((x) => x.id === id);
    if (!t) return;
    if (editingTaskId === id) setEditingTaskId(null);
    removeFromList("tasks", id, { title: "Tarefa removida", message: t.titulo, removed: "Tarefa removida: " + t.titulo, restored: "Tarefa restaurada: " + t.titulo });
  };

  /* ---- notas ---- */
  const saveNote = (raw) => {
    const text = (raw || "").trim();
    if (!text) return false;
    patch({ comments: [{ id: uid(), at: nowISO(), text, autor }, ...(clientRef.current.comments || [])] }, "Nota adicionada");
    return true;
  };
  const addNote = () => { if (saveNote(noteDraft)) { setNoteDraft(""); notify({ title: "Nota adicionada", duration: 2000 }); } };
  const addQuickNote = () => {
    if (saveNote(quickNote)) {
      setQuickNote("");
      if (quickRef.current) { quickRef.current.style.height = "auto"; quickRef.current.focus(); }
    }
  };
  const removeNote = (id) => removeFromList("comments", id, { title: "Nota removida", removed: "Nota removida", restored: "Nota restaurada" });

  /* ---- perfil (edição rápida) ---- */
  const saveProfile = (key, value) => {
    const v = value || "";
    setProfileOpen(null);
    if (v === (client[key] || "")) return;
    const texts = {
      origem: "Origem alterada para " + (origemLabel(settings, v) || "não informada"),
      responsavel: v ? "Responsável alterado para " + (vendedorNome(settings, v) || v) : "Responsável removido",
      porte: "Porte alterado para " + (porteLabel(v) || "não informado"),
      interesse: "Interesse alterado para " + (interesseMeta(v) ? interesseMeta(v).label : "não informado"),
    };
    patch({ [key]: v }, texts[key] || null);
  };
  const contactLink = (canal) => { if (onContactLink) onContactLink(canal); };

  /* ---- linha do tempo única: notas + histórico + etapas (mais recente primeiro) ---- */
  const timeline = useMemo(() => {
    const out = [];
    comments.forEach((n) => out.push({ id: "n_" + n.id, at: n.at, kind: "nota", text: n.text, autor: n.autor, noteId: n.id }));
    const hist = (client.history || [])
      .map((h) => ({ id: "h_" + h.id, at: h.at, kind: drawerHistoryTipo(h, mod), text: h.text, canal: h.canal || "" }))
      .filter((h) => !/^Nota adicionada/i.test(h.text || "")); // a própria nota já aparece
    hist.forEach((h) => out.push(h));
    /* Entradas do stageLog só quando o histórico não registrou a mesma mudança (± 2 min). */
    const marks = hist.filter((h) => h.kind === "etapa" || h.kind === "cadastro").map((h) => new Date(h.at).getTime());
    (client.stageLog || []).forEach((s, i) => {
      const t = new Date(s.at).getTime();
      if (!isNaN(t) && marks.some((m) => Math.abs(m - t) < 120000)) return;
      out.push({ id: "s_" + i + "_" + s.at, at: s.at, kind: "etapa", text: "Entrou em " + statusMeta(s.status).label, status: s.status });
    });
    return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [comments, client.history, client.stageLog, mod]);
  const tlVisible = timeline.slice(0, tlLimit);

  const pendingSorted = sortTasks(pendingTasks(client));
  const doneTasks = (client.tasks || []).filter((t) => t.feito).sort((a, b) => String(b.feitoEm || "").localeCompare(String(a.feitoEm || "")));
  const pend = pendingSorted.length, od = overdueTasks(client).length;
  const tabs = [
    { key: "resumo", label: "Resumo" },
    { key: "itens", label: mod.itemLabelPlural.split(" ")[0], n: client.items.length },
    { key: "tarefas", label: "Tarefas", n: pend, alert: od > 0 },
    { key: "notas", label: "Notas", n: comments.length },
  ];
  const IcSend = drawerIc("Send", "Chat"), IcFile = drawerIc("FileText", "Card");
  const IcArrow = drawerIc("ArrowRight", "ChevR"), IcTag = drawerIc("Tag", "Flag"), IcUser = drawerIc("User", "Users");
  const IcLayers = drawerIc("Layers", "Building"), IcFlame = drawerIc("Flame", "Star"), IcNote = drawerIc("Note", "Pencil");
  const IcContact = drawerIc("ClipboardCheck", "UserCheck"), IcHistory = drawerIc("History", "Clock"), IcUndo = drawerIc("Undo", "Reset");
  const vendedores = settings.vendedores || [];

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={"Cliente " + client.nome}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] anim-fade" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-[640px] flex-col bg-white shadow-pop anim-slide-right">
        {/* ---------- cabeçalho ---------- */}
        <div className="border-b border-slate-100 px-4 pb-0 pt-5 sm:px-6">
          <div className="flex items-start gap-3.5">
            <Avatar name={client.nome} size={48} />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold leading-tight text-ink">{client.nome}</h2>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-slate-500"><I.Building size={14} /> {client.empresa || "Empresa não informada"}</p>
            </div>
            <div className="flex items-center gap-0.5">
              <IconBtn title="Editar cliente" onClick={onEdit}><I.Pencil size={18} /></IconBtn>
              <IconBtn title="Excluir cliente" onClick={onDelete} danger><I.Trash size={18} /></IconBtn>
              <button ref={closeRef} type="button" title="Fechar (Esc)" aria-label="Fechar (Esc)" onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <I.X size={20} />
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <StatusMenu value={client.status} onChange={changeStatus} align="left" />
            <SlaBadge settings={settings} client={client} />
            <ScoreBadge settings={settings} mod={mod} client={client} showPoints />
            <OwnerChip settings={settings} id={client.responsavel} size="xs" className="ml-0.5" />
          </div>
          <Tabs tabs={tabs} value={tab} onChange={goTab} className="mt-4" />
        </div>

        {/* ---------- conteúdo ---------- */}
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {tab === "resumo" && (
            <div className="space-y-6">
              {client.status === "perdido" && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <span className="mt-0.5 shrink-0 text-red-600"><I.Alert size={18} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-red-800">Perdido · motivo: {motivoLabel(settings, client.motivoPerda) || "não informado"}</div>
                      {client.motivoPerdaObs && <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-red-700/90">{client.motivoPerdaObs}</p>}
                    </div>
                    <button type="button" onClick={() => changeStatus("lead")} className={btn.secondary + " shrink-0 px-3 py-1.5 text-xs"}><I.Reset size={14} /> Reabrir como lead</button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <ContactRow icon={I.Phone} label="Telefone" value={client.telefone} />
                <ContactRow icon={I.Mail} label="E-mail" value={client.email} />
              </div>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Perfil</h3>
                  <button type="button" onClick={onEdit} className="text-xs font-semibold text-brand hover:underline">Editar</button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <DrawerProfileCell icon={IcTag} label="Origem" value={origemLabel(settings, client.origem)}
                    open={profileOpen === "origem"} onOpen={() => setProfileOpen("origem")} onClose={() => setProfileOpen(null)}
                    popover={<Select small ariaLabel="Origem" value={client.origem} onChange={(v) => saveProfile("origem", v)} placeholder="Não informada"
                      options={(settings.origens || []).map((o) => ({ value: o.id, label: o.label }))} />} />
                  <DrawerProfileCell icon={IcUser} label="Responsável"
                    open={profileOpen === "responsavel"} onOpen={() => setProfileOpen("responsavel")} onClose={() => setProfileOpen(null)}
                    popover={vendedores.length
                      ? <Select small ariaLabel="Responsável" value={client.responsavel} onChange={(v) => saveProfile("responsavel", v)} placeholder="Sem responsável"
                          options={vendedores.map((v) => ({ value: v.id, label: v.nome }))} />
                      : <div className="text-xs text-slate-500">Nenhum vendedor cadastrado. <button type="button" onClick={() => onOpenSettings("equipe")} className="font-semibold text-brand hover:underline">Cadastrar equipe</button></div>}>
                    <OwnerChip settings={settings} id={client.responsavel} size="xs" empty="Definir" />
                  </DrawerProfileCell>
                  <DrawerProfileCell icon={IcLayers} label="Porte" value={porteLabel(client.porte)}
                    open={profileOpen === "porte"} onOpen={() => setProfileOpen("porte")} onClose={() => setProfileOpen(null)}
                    popover={<Select small ariaLabel="Porte" value={client.porte} onChange={(v) => saveProfile("porte", v)} placeholder="Não informado"
                      options={PORTES.map((p) => ({ value: p.key, label: p.label }))} />} />
                  <DrawerProfileCell icon={IcFlame} label="Interesse"
                    open={profileOpen === "interesse"} onOpen={() => setProfileOpen("interesse")} onClose={() => setProfileOpen(null)}
                    popover={
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Interesse">
                        {INTERESSES.map((m) => {
                          const on = client.interesse === m.key;
                          return (
                            <button key={m.key} type="button" aria-pressed={on} onClick={() => saveProfile("interesse", m.key)}
                              className={"inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition " + (on ? "border-transparent" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}
                              style={on ? { background: m.soft, color: m.text, boxShadow: "inset 0 0 0 1px " + m.color } : undefined}>
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />{m.label}
                            </button>
                          );
                        })}
                        {client.interesse && <button type="button" onClick={() => saveProfile("interesse", "")} className="inline-flex h-9 items-center rounded-full px-3 text-xs font-semibold text-slate-500 hover:bg-slate-100">Limpar</button>}
                      </div>
                    }>
                    {interesse
                      ? <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: interesse.soft, color: interesse.text }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: interesse.color }} />{interesse.label}</span>
                      : <span className="text-sm text-slate-300">não informado</span>}
                  </DrawerProfileCell>
                </div>
              </section>

              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <DrawerLinkBtn href={waLink} external icon={I.Chat} label="WhatsApp" hint={canWa ? "Abrir conversa no WhatsApp" : "Cadastre um telefone para usar o WhatsApp"}
                    onClick={() => contactLink("whatsapp")} className="text-white hover:brightness-110" style={{ background: "#25D366" }} />
                  <DrawerLinkBtn href={telLink} icon={I.Phone} label="Ligar" hint={canWa ? "Ligar para " + client.telefone : "Cadastre um telefone para ligar"}
                    onClick={() => contactLink("ligacao")} className={btn.secondary + " px-3"} />
                  <DrawerLinkBtn href={mailLink} icon={I.Mail} label="E-mail" hint={canMail ? "Escrever para " + client.email : "Cadastre um e-mail para escrever"}
                    onClick={() => contactLink("email")} className={btn.secondary + " px-3"} />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <button type="button" onClick={() => onContact && onContact()} className={btn.secondary + " px-3"} title="Anotar uma ligação, conversa ou reunião que aconteceu"><IcContact size={17} /> Registrar contato</button>
                  <button type="button" onClick={() => setMsgOpen((o) => !o)} aria-expanded={msgOpen}
                    className={btn.secondary + " px-3 " + (msgOpen ? "border-brand bg-brand-50 text-brand" : "")}><IcSend size={17} /> Mensagens</button>
                  <button type="button" onClick={onProposal} className={btn.primary + " col-span-2 px-3 sm:col-span-1"}><IcFile size={17} /> Gerar proposta</button>
                </div>
              </div>

              {msgOpen && (
                <div ref={msgRef}>
                  <TemplatePicker mod={mod} client={client} settings={settings} notify={notify} onLog={onLog} onOpenSettings={onOpenSettings} onClose={() => setMsgOpen(false)} />
                </div>
              )}

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Observações</h3>
                  <button type="button" onClick={onEdit} className="text-xs font-semibold text-brand hover:underline">Editar</button>
                </div>
                {client.obs
                  ? <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">{client.obs}</p>
                  : <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">Nenhuma observação. Anote contexto, histórico e próximos passos.</p>}
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{mod.itemLabelPlural}</h3>
                  <button type="button" onClick={() => goTab("itens")} className="text-xs font-semibold text-brand hover:underline">Gerenciar</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {hasStatus && <div className="rounded-xl border border-slate-200 p-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">De interesse</div><div className="mt-1 text-base font-bold text-ink tnum">{BRL(totalInteresse)}</div></div>}
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{hasStatus ? "Contratado" : "Total"}</div><div className="mt-1 text-base font-bold text-emerald-800 tnum">{BRL(hasStatus ? totalContratado : totalInteresse)}</div></div>
                </div>
                {client.items.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {client.items.map((it) => (
                      <span key={it.id} className={"rounded-md px-2 py-1 text-xs font-medium " + (it.status === "contratado" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600")}>{itemTitle(mod, it)}</span>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Tempo por etapa</h3>
                {stages.length === 0 ? <p className="text-xs text-slate-400">Sem registros.</p> : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {stages.map((s, i) => {
                      const m = statusMeta(s.status);
                      const last = i === stages.length - 1;
                      return (
                        <React.Fragment key={i}>
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" title={fmtDateTime(s.from) + (s.to && !last ? " → " + fmtDateTime(s.to) : "")}
                            style={{ background: m.soft, color: m.text, boxShadow: last ? "inset 0 0 0 1px " + m.color + "66" : undefined }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />{m.label}
                            <span className="font-normal opacity-70 tnum">· {drawerDays(s.days)}{last ? " (atual)" : ""}</span>
                          </span>
                          {!last && <span className="text-slate-300"><IcArrow size={14} /></span>}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><IcHistory size={13} /> Linha do tempo</h3>
                  <span className="text-[11px] text-slate-400 tnum">{timeline.length} {timeline.length === 1 ? "registro" : "registros"}</span>
                </div>
                {/* caixa rápida de nota */}
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-2 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
                  <Avatar name={autor} size={28} className="mt-1" />
                  <textarea ref={quickRef} rows={1} value={quickNote}
                    onChange={(e) => { setQuickNote(e.target.value); drawerAutoGrow(e.target); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addQuickNote(); } }}
                    placeholder="Escrever nota… (Enter salva, Shift+Enter quebra a linha)"
                    className="min-h-[36px] flex-1 resize-none bg-transparent px-1 py-2 text-sm text-ink outline-none placeholder:text-slate-400" aria-label="Escrever nota" />
                  <button type="button" onClick={addQuickNote} disabled={!quickNote.trim()} className={btn.primary + " h-9 shrink-0 px-3 py-0 text-xs"} title="Salvar nota"><IcNote size={14} /> <span className="hidden sm:inline">Salvar</span></button>
                </div>
                {timeline.length === 0 ? (
                  <p className="text-xs text-slate-400">Nada registrado ainda. Escreva uma nota, registre um contato ou crie uma tarefa.</p>
                ) : (
                  <ol className="relative ml-3 border-l border-slate-200 pl-6">
                    {tlVisible.map((e) => <DrawerTimelineItem key={e.id} entry={e} onRemoveNote={removeNote} />)}
                  </ol>
                )}
                {timeline.length > tlLimit && (
                  <button type="button" onClick={() => setTlLimit((l) => l + 10)} className={btn.secondary + " mt-3 w-full px-3 py-2 text-xs"}>
                    <I.ChevD size={14} /> Ver mais ({timeline.length - tlLimit} {timeline.length - tlLimit === 1 ? "restante" : "restantes"})
                  </button>
                )}
                {timeline.length > DRAWER_TL_PAGE && tlLimit >= timeline.length && (
                  <button type="button" onClick={() => setTlLimit(DRAWER_TL_PAGE)} className={btn.ghost + " mt-2 w-full px-3 py-2 text-xs"}><I.ChevU size={14} /> Ver menos</button>
                )}
                <p className="mt-3 text-[11px] text-slate-400">Cadastrado em {fmtDateTime(client.createdAt)}</p>
              </section>
            </div>
          )}

          {tab === "itens" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-500">{client.items.length} {client.items.length === 1 ? mod.itemLabel.toLowerCase() : mod.itemLabelPlural.toLowerCase()}</div>
                <div className="text-right text-xs text-slate-500">
                  {hasStatus && <div>Interesse: <span className="font-semibold text-slate-700 tnum">{BRL(totalInteresse)}</span></div>}
                  <div>{hasStatus ? "Contratado: " : "Total: "}<span className="font-semibold text-emerald-700 tnum">{BRL(hasStatus ? totalContratado : totalInteresse)}</span></div>
                </div>
              </div>
              <div className="space-y-2">
                {client.items.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-400">Nenhum {mod.itemLabel.toLowerCase()} registrado. Use o formulário abaixo.</p>}
                {client.items.map((it) => <ItemCard key={it.id} mod={mod} item={it} onToggleStatus={() => toggleItemStatus(it.id)} onRemove={() => removeItem(it.id)} onSave={(data) => updateItem(it.id, data)} />)}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 text-sm font-semibold text-ink">Adicionar {mod.itemLabel.toLowerCase()}</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {mod.fields.map((f) => (
                    <div key={f.id} className={(f.type === "text" || f.fromOptions) ? "sm:col-span-2" : ""}>
                      <FieldInput mod={mod} field={f} value={draft[f.id]} onChange={(v) => setDraftField(f.id, v)} small />
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addItem} className={btn.primary + " mt-3 w-full"}><I.Plus size={16} /> Adicionar {mod.itemLabel.toLowerCase()}</button>
              </div>
            </div>
          )}

          {tab === "tarefas" && (
            <div className="space-y-5">
              {needsNextStep(client) && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                  <span className="mt-px shrink-0"><I.Alert size={14} /></span>
                  <span><span className="font-semibold">Sem próximo passo.</span> Crie uma tarefa para não perder este cliente de vista.</span>
                </div>
              )}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 text-sm font-semibold text-ink">Nova tarefa</div>
                <DrawerTaskFields draft={taskDraft} onChange={setTaskDraft} onSubmit={addTask} />
                <button type="button" onClick={addTask} disabled={!taskDraft.titulo.trim()} className={btn.primary + " mt-3 w-full sm:w-auto"}><I.Plus size={16} /> Adicionar tarefa</button>
              </div>
              <div className="space-y-2">
                {pendingSorted.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-400">Nenhuma tarefa pendente para este cliente.</p>}
                {pendingSorted.map((t) => editingTaskId === t.id
                  ? <DrawerTaskEditor key={t.id} task={t} onSave={(d) => saveTask(t.id, d)} onCancel={() => setEditingTaskId(null)} />
                  : <DrawerTaskRow key={t.id} task={t} onToggle={() => toggleTask(t.id)} onEdit={() => setEditingTaskId(t.id)} onPostpone={(n) => postponeTask(t.id, n)} onRemove={() => removeTask(t.id)} />)}
              </div>
              {doneTasks.length > 0 && (
                <div className="rounded-xl border border-slate-200">
                  <button type="button" onClick={() => setDoneOpen((o) => !o)} aria-expanded={doneOpen}
                    className="flex h-10 w-full items-center justify-between rounded-xl px-3.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                    <span className="inline-flex items-center gap-1.5"><I.Check size={14} /> Concluídas ({doneTasks.length})</span>
                    {doneOpen ? <I.ChevU size={15} /> : <I.ChevD size={15} />}
                  </button>
                  {doneOpen && (
                    <ul className="divide-y divide-slate-100 border-t border-slate-100">
                      {doneTasks.map((t) => (
                        <li key={t.id} className="flex items-center gap-2.5 px-3.5 py-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white" aria-hidden="true"><I.CheckSimple size={12} /></span>
                          <span className="shrink-0 text-slate-400"><TaskTypeIcon tipo={t.tipo} size={13} /></span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm text-slate-500 line-through">{t.titulo}</div>
                            <div className="text-[11px] text-slate-400">{t.feitoEm ? "Concluída " + relTime(t.feitoEm) : t.data ? "Era para " + fmtDate(t.data) : "Concluída"}</div>
                          </div>
                          <button type="button" onClick={() => toggleTask(t.id)} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-brand" title="Voltar para pendente"><IcUndo size={12} /> Reabrir</button>
                          <IconBtn title="Remover tarefa" onClick={() => removeTask(t.id)} danger><I.X size={15} /></IconBtn>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "notas" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold text-ink">Nova nota</div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400"><Avatar name={autor} size={16} /> {autor}</span>
                </div>
                <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addNote(); } }}
                  placeholder="Ex.: Ligou pedindo desconto; prometeu resposta até sexta." className={inputCls + " min-h-[84px] resize-y"} aria-label="Texto da nota" />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="hidden text-[11px] text-slate-400 sm:inline-flex sm:items-center sm:gap-1"><Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> adiciona</span>
                  <button type="button" onClick={addNote} disabled={!noteDraft.trim()} className={btn.primary + " ml-auto"}><IcNote size={16} /> Adicionar nota</button>
                </div>
              </div>
              {comments.length === 0 ? (
                <EmptyState icon={IcNote} title="Nenhuma nota ainda" text="Registre aqui o que foi conversado, combinado ou prometido. As notas também aparecem na linha do tempo do Resumo." />
              ) : (
                <ul className="space-y-2">
                  {comments.map((n) => (
                    <li key={n.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <Avatar name={n.autor || "?"} size={30} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                          <span className="font-semibold text-ink">{n.autor || "Sem autor"}</span>
                          <span className="text-slate-400" title={fmtDateTime(n.at)}>{relTime(n.at)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{n.text}</p>
                      </div>
                      <IconBtn title="Remover nota" onClick={() => removeNote(n.id)} danger><I.X size={15} /></IconBtn>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400 sm:px-6">
          <span>Atualizado {relTime(client.updatedAt)}</span>
          <span className="hidden sm:inline-flex items-center gap-1.5"><Kbd>Esc</Kbd> fecha</span>
        </div>
      </div>
    </div>
  );
}

/* Link de contato (WhatsApp / Ligar / E-mail): só tem href quando há dado; senão fica desabilitado. */
function DrawerLinkBtn({ href, external, onClick, icon: IconC, label, hint, className = "", style }) {
  const enabled = !!href;
  const base = "inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ";
  return (
    <a href={enabled ? href : undefined} target={enabled && external ? "_blank" : undefined} rel={enabled && external ? "noreferrer" : undefined}
      aria-disabled={!enabled} tabIndex={enabled ? undefined : -1} title={hint}
      onClick={(e) => { if (!enabled) { e.preventDefault(); return; } onClick && onClick(); }}
      className={base + className + (enabled ? "" : " cursor-not-allowed opacity-40 hover:brightness-100")} style={style}>
      <IconC size={17} /> {label}
    </a>
  );
}

/* Célula do bloco "Perfil" (origem, responsável, porte, interesse) com mini-popover de edição. */
function DrawerProfileCell({ icon: IconC, label, value, children, open, onOpen, onClose, popover }) {
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", onDown);
    const el = wrapRef.current && wrapRef.current.querySelector("[data-popover] select, [data-popover] button, [data-popover] input");
    if (el) { try { el.focus(); } catch (e) {} }
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const closeAndRefocus = () => { onClose(); if (btnRef.current) btnRef.current.focus(); };
  return (
    <div ref={wrapRef} className="relative">
      <button ref={btnRef} type="button" onClick={() => (open ? closeAndRefocus() : onOpen())} title="Clique para alterar"
        aria-haspopup="dialog" aria-expanded={open}
        className={"flex w-full min-w-0 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition " + (open ? "border-brand bg-brand-50/40" : "border-slate-200 hover:border-brand/40 hover:bg-brand-50/40")}>
        <span className="shrink-0 text-slate-400"><IconC size={16} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
          {children
            ? <div className="mt-0.5 flex min-w-0 items-center">{children}</div>
            : <div className={"truncate text-sm " + (value ? "text-ink" : "text-slate-300")}>{value || "não informado"}</div>}
        </div>
        <span className="shrink-0 text-slate-300"><I.ChevD size={14} /></span>
      </button>
      {open && (
        <div data-popover role="dialog" aria-label={"Alterar " + label.toLowerCase()}
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); closeAndRefocus(); } }}
          className="absolute left-0 top-full z-20 mt-1 w-full min-w-[240px] rounded-2xl border border-slate-200 bg-white p-3 shadow-pop anim-pop">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
            <button type="button" onClick={closeAndRefocus} aria-label="Fechar" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100"><I.X size={14} /></button>
          </div>
          {popover}
        </div>
      )}
    </div>
  );
}

/* Uma entrada da linha do tempo (nota, histórico ou etapa). */
function DrawerTimelineItem({ entry: e, onRemoveNote }) {
  const meta = DRAWER_TL_META[e.kind] || DRAWER_TL_META[""];
  const color = e.kind === "etapa" && e.status ? statusMeta(e.status).color : meta.color;
  const Ic = drawerIc(meta.icon, meta.fb);
  return (
    <li className="relative pb-4 last:pb-0">
      <span className="absolute -left-[37px] top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white" style={{ background: color + "1F", color }} aria-hidden="true">
        {e.kind === "contato" && e.canal ? <TaskTypeIcon tipo={e.canal} size={12} /> : <Ic size={12} />}
      </span>
      {e.kind === "nota" ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50/40 px-3 py-2">
          <div className="flex items-baseline gap-2 text-[11px]">
            <span className="font-semibold text-ink">{e.autor || "Sem autor"}</span>
            <span className="text-slate-400" title={fmtDateTime(e.at)}>{relTime(e.at)}</span>
            <button type="button" onClick={() => onRemoveNote(e.noteId)} aria-label="Remover nota" title="Remover nota"
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"><I.X size={13} /></button>
          </div>
          <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{e.text}</p>
        </div>
      ) : (
        <div className="pt-0.5">
          <div className="text-xs font-medium text-slate-700">{e.text}</div>
          <div className="text-[11px] text-slate-400" title={fmtDateTime(e.at)}>{relTime(e.at)}</div>
        </div>
      )}
    </li>
  );
}

/* Botões pequenos para escolher o tipo da tarefa (ligação, WhatsApp, e-mail, reunião, outro). */
function DrawerTaskTypePicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo da tarefa">
      {TASK_TYPES.map((tt) => {
        const on = value === tt.key;
        return (
          <button key={tt.key} type="button" aria-pressed={on} onClick={() => onChange(on ? "" : tt.key)}
            className={"inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition " + (on ? "border-brand bg-brand text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-brand/50 hover:text-brand")}>
            <TaskTypeIcon tipo={tt.key} size={13} /> {tt.label}
          </button>
        );
      })}
    </div>
  );
}

/* Campos de uma tarefa (título, data, hora, tipo). draft = { titulo, data, hora, tipo }. */
function DrawerTaskFields({ draft, onChange, onSubmit, autoFocus }) {
  const set = (k, v) => onChange({ ...draft, [k]: v });
  return (
    <div className="space-y-2">
      <input value={draft.titulo} onChange={(e) => set("titulo", e.target.value)} autoFocus={autoFocus}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSubmit && onSubmit(); } }}
        placeholder="Ex.: Ligar para confirmar a proposta" className={inputCls} aria-label="Título da tarefa" />
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <input type="date" value={draft.data} onChange={(e) => set("data", e.target.value)} className={inputCls + " min-w-0 sm:w-44"} aria-label="Data da tarefa" />
        <input type="time" value={draft.hora} onChange={(e) => set("hora", e.target.value)} className={inputCls + " min-w-0 sm:w-32"} aria-label="Hora da tarefa" />
      </div>
      <DrawerTaskTypePicker value={draft.tipo} onChange={(v) => set("tipo", v)} />
    </div>
  );
}

/* Edição de uma tarefa no lugar (substitui a linha da tarefa enquanto edita). */
function DrawerTaskEditor({ task, onSave, onCancel }) {
  const [d, setD] = useState({ titulo: task.titulo || "", data: task.data || "", hora: task.hora || "", tipo: task.tipo || "" });
  const submit = () => { if (d.titulo.trim()) onSave(d); };
  return (
    <div className="rounded-xl border border-brand/40 bg-brand-50/30 p-3 anim-pop"
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onCancel(); } }}>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Editar tarefa</div>
      <DrawerTaskFields draft={d} onChange={setD} onSubmit={submit} autoFocus />
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className={btn.ghost + " px-3"}>Cancelar</button>
        <button type="button" onClick={submit} disabled={!d.titulo.trim()} className={btn.primary + " px-3"}><I.Save size={15} /> Salvar</button>
      </div>
    </div>
  );
}

/* Linha de uma tarefa pendente: concluir, título (clique edita), prazo, adiar, remover. */
function DrawerTaskRow({ task: t, onToggle, onEdit, onPostpone, onRemove }) {
  const w = taskWhen(t);
  const late = w.tone === "late";
  const IcZap = drawerIc("Zap", "Bell"), IcSun = drawerIc("Sun", "Calendar"), IcCalPlus = drawerIc("CalendarPlus", "Calendar");
  const pb = "inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-brand/50 hover:text-brand";
  return (
    <div className={"rounded-xl border px-3 py-2.5 transition " + (late ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-white")}>
      <div className="flex items-start gap-2">
        <button type="button" onClick={onToggle} aria-label="Concluir tarefa" title="Concluir tarefa"
          className="-ml-1.5 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-300 text-transparent transition hover:border-emerald-500 hover:text-emerald-500"><I.CheckSimple size={13} /></span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="shrink-0 text-slate-400"><TaskTypeIcon tipo={t.tipo} size={14} /></span>
            <button type="button" onClick={onEdit} title="Clique para editar" className="min-w-0 max-w-full truncate text-left text-sm font-medium text-ink transition hover:text-brand hover:underline">{t.titulo}</button>
            <TaskWhenBadge task={t} size="xs" />
            {t.auto && <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand" title="Criada por uma automação"><IcZap size={10} /> automática</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => onPostpone(0)} className={pb} title="Marcar para hoje"><IcSun size={12} /> Hoje</button>
            <button type="button" onClick={() => onPostpone(1)} className={pb} title="Adiar 1 dia"><IcCalPlus size={12} /> +1 dia</button>
            <button type="button" onClick={() => onPostpone(7)} className={pb} title="Adiar 1 semana"><IcCalPlus size={12} /> +1 semana</button>
          </div>
        </div>
        <IconBtn title="Remover tarefa" onClick={onRemove} danger className="-mr-1 -mt-1"><I.X size={15} /></IconBtn>
      </div>
    </div>
  );
}

/* ---------------------- Mensagens por modelo (templates) ------------------ */
function TemplatePicker({ mod, client, settings, notify, onLog, onOpenSettings, onClose }) {
  const templates = settings.templates || [];
  const [selId, setSelId] = useState(null);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const digits = onlyDigits(client.telefone);
  const canWa = digits.length >= 10, canMail = !!(client.email || "").trim();
  const sel = templates.find((t) => t.id === selId) || null;
  const IcSend = drawerIc("Send", "Chat"), IcCopy = drawerIc("Copy", "Card"), IcCog = drawerIc("Settings2", "Cog");

  const choose = (t) => {
    const ctx = templateContext(settings, mod, client);
    setSelId(t.id);
    setText(renderTemplate(t.texto || "", ctx));
    setSubject(renderTemplate(t.assunto || "", ctx));
  };
  const copy = () => {
    drawerCopyText(text).then((ok) => {
      if (ok) { notify({ title: "Texto copiado", message: "Cole no WhatsApp, e-mail ou onde preferir.", duration: 2500 }); if (sel) onLog("Mensagem copiada: " + sel.nome, { tipo: "mensagem" }); }
      else notify({ title: "Não foi possível copiar", message: "Selecione o texto e copie manualmente.", kind: "error" });
    });
  };
  const waHref = "https://wa.me/55" + digits + "?text=" + encodeURIComponent(text);
  const mailHref = "mailto:" + encodeURIComponent((client.email || "").trim()) + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(text);
  const canSend = sel && (sel.canal === "email" ? canMail : canWa);
  const logSent = () => { if (canSend) onLog("Mensagem enviada: " + sel.nome, { tipo: "mensagem", canal: sel.canal === "email" ? "email" : "whatsapp" }); };
  const groups = [
    { canal: "whatsapp", label: "WhatsApp", ok: canWa, aviso: "Cadastre um telefone para enviar por WhatsApp.", list: templates.filter((t) => t.canal !== "email") },
    { canal: "email", label: "E-mail", ok: canMail, aviso: "Cadastre um e-mail para enviar por e-mail.", list: templates.filter((t) => t.canal === "email") },
  ];

  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4 anim-pop" role="region" aria-label="Enviar mensagem por modelo">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink"><span className="text-brand"><IcSend size={16} /></span> Enviar mensagem</div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onOpenSettings("templates")} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-brand hover:bg-brand-50"><IcCog size={13} /> Gerenciar modelos</button>
          <IconBtn title="Fechar mensagens" onClick={onClose}><I.X size={16} /></IconBtn>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white">
          <EmptyState icon={IcSend} title="Nenhum modelo de mensagem" text="Crie modelos de WhatsApp e e-mail com variáveis como {primeiro_nome} e {empresa} para enviar em um clique."
            action={<button type="button" onClick={() => onOpenSettings("templates")} className={btn.primary}><I.Plus size={16} /> Criar modelo</button>} />
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => g.list.length === 0 ? null : (
            <div key={g.canal}>
              <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {g.canal === "email" ? <I.Mail size={12} /> : <I.Chat size={12} />} {g.label}
                {!g.ok && <span className="normal-case tracking-normal text-amber-700">· {g.aviso}</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.list.map((t) => (
                  <button key={t.id} type="button" onClick={() => choose(t)} aria-pressed={selId === t.id}
                    className={"inline-flex h-9 items-center rounded-full border px-3 text-xs font-semibold transition " + (selId === t.id ? "border-brand bg-brand text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-brand/50 hover:text-brand")}>
                    {t.nome}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {sel ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              {sel.canal === "email" && (
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto" className={inputCls + " mb-2 py-2 text-sm"} aria-label="Assunto do e-mail" />
              )}
              <textarea value={text} onChange={(e) => setText(e.target.value)} className={inputCls + " min-h-[120px] resize-y text-sm"} aria-label="Texto da mensagem" />
              <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                <button type="button" onClick={copy} className={btn.secondary + " px-3 py-2 text-xs"}><IcCopy size={14} /> Copiar texto</button>
                {sel.canal === "email" ? (
                  <a href={canSend ? mailHref : undefined} aria-disabled={!canSend} tabIndex={canSend ? undefined : -1} onClick={logSent}
                    className={btn.primary + " px-3 py-2 text-xs " + (canSend ? "" : "pointer-events-none opacity-40")}><I.Mail size={14} /> Abrir e-mail</a>
                ) : (
                  <a href={canSend ? waHref : undefined} target="_blank" rel="noreferrer" aria-disabled={!canSend} tabIndex={canSend ? undefined : -1} onClick={logSent}
                    className={"inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 " + (canSend ? "" : "pointer-events-none opacity-40")} style={{ background: "#25D366" }}>
                    <I.Chat size={14} /> Abrir no WhatsApp</a>
                )}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Você pode ajustar o texto antes de enviar. O envio abre o WhatsApp ou seu programa de e-mail.</p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Escolha um modelo acima para ver a mensagem já preenchida com os dados do cliente.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* Card de um item do módulo, com modo de edição no lugar (lápis). */
function ItemCard({ mod, item, onToggleStatus, onRemove, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item);
  const hasStatus = mod.fields.some((f) => f.type === "status");
  const detailFields = mod.fields.filter((f) => f.type !== "status" && !f.fromOptions && f.type !== "currency");
  const currencyField = mod.fields.find((f) => f.type === "currency");
  const done = item.status === "contratado";
  const startEdit = () => { setDraft({ ...item }); setEditing(true); };
  const cancel = () => setEditing(false);
  const save = () => { if (onSave) onSave({ ...draft, id: item.id }); setEditing(false); };

  if (editing) {
    return (
      <div className="rounded-xl border border-brand/40 bg-brand-50/30 p-3 anim-pop"
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); cancel(); } }}>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Editar {mod.itemLabel.toLowerCase()}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {mod.fields.map((f, i) => (
            <div key={f.id} className={(f.type === "text" || f.fromOptions) ? "sm:col-span-2" : ""}>
              <FieldInput mod={mod} field={f} value={draft[f.id] ?? fieldDefault(f)} onChange={(v) => setDraft((d) => ({ ...d, [f.id]: v }))} small autoFocus={i === 0} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={cancel} className={btn.ghost + " px-3"}>Cancelar</button>
          <button type="button" onClick={save} className={btn.primary + " px-3"}><I.Save size={15} /> Salvar</button>
        </div>
      </div>
    );
  }
  return (
    <div className={"rounded-xl border px-4 py-3 transition " + (done ? "border-emerald-100 bg-emerald-50/40" : "border-slate-200 bg-white")}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">{itemTitle(mod, item)}</div>
          {hasStatus && (
            <button type="button" onClick={onToggleStatus} title="Clique para alternar"
              className={"mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition hover:brightness-95 " + (done ? "bg-emerald-100 text-emerald-800" : "bg-amber-50 text-amber-800")}>
              <span className={"h-1.5 w-1.5 rounded-full " + (done ? "bg-emerald-600" : "bg-amber-500")} />{done ? "Contratado" : "De interesse"}
            </button>
          )}
        </div>
        {currencyField && <div className="text-sm font-semibold text-ink tnum">{BRL(item[currencyField.id])}</div>}
        <IconBtn title={"Editar " + mod.itemLabel.toLowerCase()} onClick={startEdit}><I.Pencil size={15} /></IconBtn>
        <IconBtn title={"Remover " + mod.itemLabel.toLowerCase()} onClick={onRemove} danger><I.X size={15} /></IconBtn>
      </div>
      {detailFields.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {detailFields.map((f) => {
            const v = item[f.id];
            if (v === "" || v === undefined || v === null || (f.type === "number" && !v)) return null;
            return <span key={f.id} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"><span className="text-slate-400">{f.label}:</span> <span className="font-medium">{/%/.test(f.label) ? v + "%" : v}</span></span>;
          })}
        </div>
      )}
    </div>
  );
}

function FieldInput({ mod, field, value, onChange, small, autoFocus }) {
  const cls = inputCls + (small ? " py-2" : "");
  const labelCls = small ? "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500" : "mb-1.5 block text-sm font-medium text-slate-700";
  if (field.fromOptions && mod.options && mod.options.length) {
    return (
      <label className="block"><span className={labelCls}>{field.label}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)} className={cls} autoFocus={autoFocus}>
          {mod.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    );
  }
  if (field.type === "status") {
    return (
      <label className="block"><span className={labelCls}>{field.label}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)} className={cls} autoFocus={autoFocus}>
          {ITEM_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </label>
    );
  }
  if (field.type === "number" || field.type === "currency") {
    const isCur = field.type === "currency", isPct = /%/.test(field.label);
    return (
      <label className="block"><span className={labelCls}>{field.label.replace(/\s*\(%.*\)/, "")}</span>
        <div className="relative">
          {isCur && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">R$</span>}
          <input type="number" min="0" step={isCur ? "0.01" : "any"} value={value} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            className={cls + (isCur ? " pl-9" : "") + (isPct ? " pr-8" : "")} placeholder="0" autoFocus={autoFocus} />
          {isPct && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">%</span>}
        </div>
      </label>
    );
  }
  return (
    <label className="block"><span className={labelCls}>{field.label}</span>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={cls} placeholder={field.label} autoFocus={autoFocus} />
    </label>
  );
}

function ContactRow({ icon: IconC, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5">
      <span className="shrink-0 text-slate-400"><IconC size={16} /></span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        <div className={"truncate text-sm " + (value ? "text-ink" : "text-slate-300")}>{value || "não informado"}</div>
      </div>
    </div>
  );
}
