/* --------------------------------- App ------------------------------------ */
/* Limite de entradas guardadas na linha do tempo de cada cliente. */
const APP_HISTORY_MAX = 120;
/* Texto gravado no histórico quando o usuário abre um link de contato (ContactIcons / drawer). */
const APP_CONTACT_LINK_TEXT = { whatsapp: "WhatsApp aberto", ligacao: "Ligação iniciada", email: "E-mail aberto" };

/* Tipo do histórico deduzido pelo texto, quando quem grava não informa (só muda o ícone na linha do tempo). */
function appHistoryTipo(text) {
  const t = String(text || "").toLowerCase();
  if (/^etapa alterada/.test(t)) return "etapa";
  if (/^tarefa/.test(t)) return "tarefa";
  if (/^nota/.test(t)) return "nota";
  if (/^cliente cadastrado|^importad/.test(t)) return "cadastro";
  if (/^mensagem/.test(t)) return "mensagem";
  if (/^proposta/.test(t)) return "proposta";
  if (/^dados do cliente|alterad[oa] para|^perfil/.test(t)) return "dados";
  if (/adicionad|removid|atualizad|marcado como/.test(t)) return "item";
  return "";
}
/* Toda gravação de histórico do app passa por aqui (historyEntry do core + tipo deduzido). */
function appHistoryEntry(text, extra) {
  const ex = extra && typeof extra === "object" ? extra : {};
  return historyEntry(text, { ...ex, tipo: ex.tipo || appHistoryTipo(text) });
}
const appShortDate = (iso) => { if (!iso) return "sem data"; const p = String(iso).split("-"); return p.length === 3 ? p[2] + "/" + p[1] : iso; };
const appContactCanal = (canal) => (canal === "tel" || canal === "phone" ? "ligacao" : canal === "mail" ? "email" : canal || "outro");

function ProsperaCRM() {
  const [modules, setModules] = useState(loadModules);
  const [activeModId, setActiveModId] = useState(() => (modules[0] || initialModules[0]).id);
  const [savedAt, setSavedAt] = useState(null);
  const [settings, setSettings] = useState(loadSettings);
  const [users, setUsers] = useState(loadUsers);
  const [session, setSession] = useState(loadSession);
  const [activity, setActivity] = useState(loadActivity);
  const [accountOpen, setAccountOpen] = useState(false);   // false | true (trocar senha) | "forcada" (admin redefiniu)
  const [saveError, setSaveError] = useState(false);
  const saveFail = useRef({ modules: false, settings: false, users: false });
  /* Usuário logado (sessão + lista). Null = tela de login. A ref permite registrar atividades de dentro de callbacks. */
  const currentUser = useMemo(() => users.find((u) => u.id === (session && session.userId) && u.ativo) || null, [users, session]);
  const currentUserRef = useRef(null);
  currentUserRef.current = currentUser;
  const can = (key) => userCan(currentUser, key);

  /* A tela atual vai na URL (#painel, #clientes, #funil, #agenda, #relatorios) para poder favoritar ou compartilhar o link. */
  const [view, setView] = useState(() => { const h = (window.location.hash || "").replace("#", ""); return VIEW_HASH[h] || "dashboard"; });
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterOwner, setFilterOwner] = useState("todos");
  const [sort, setSort] = useState({ key: "updatedAt", dir: "desc" });
  const [openId, setOpenId] = useState(null);
  const [openTab, setOpenTab] = useState("resumo");   // aba inicial da ficha ("itens" logo após cadastrar)
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [requireFor, setRequireFor] = useState(null);
  const [moduleManagerOpen, setModuleManagerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [gate, setGate] = useState(null);          // { clientId, status, missing, client? }
  const [loss, setLoss] = useState(null);          // { clientId, status, client? }
  const [proposalFor, setProposalFor] = useState(null); // clientId
  const [nextStepFor, setNextStepFor] = useState(null); // { modId, clientId }
  const [contactFor, setContactFor] = useState(null);   // { modId, clientId }
  const [toasts, setToasts] = useState([]);
  const dragId = useRef(null);
  const searchRef = useRef(null);

  const mod = modules.find((m) => m.id === activeModId) || modules[0];
  const clients = mod.clients;
  const allModules = modules;
  const openClient = clients.find((c) => c.id === openId) || null;
  const gateClient = gate ? clients.find((c) => c.id === gate.clientId) || gate.client || null : null;
  const lossClient = loss ? clients.find((c) => c.id === loss.clientId) || loss.client || null : null;
  const proposalClient = proposalFor ? clients.find((c) => c.id === proposalFor) || null : null;
  const findIn = (ref) => {
    if (!ref) return { mod: null, client: null };
    const m = modules.find((x) => x.id === ref.modId) || null;
    return { mod: m, client: m ? m.clients.find((x) => x.id === ref.clientId) || null : null };
  };
  const nextStepCtx = findIn(nextStepFor);
  const contactCtx = findIn(contactFor);

  /* ---- feedback ---- */
  const notify = useCallback((t) => {
    const id = uid();
    setToasts((ts) => [...ts, { id, kind: "success", ...t }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), t.duration || 4500);
  }, []);
  const dismissToast = (id) => setToasts((ts) => ts.filter((x) => x.id !== id));
  const askConfirm = (opts) => setConfirmState(opts);
  const openSettings = useCallback((tab) => {
    if (!userCan(currentUserRef.current, "configuracoes")) { notify({ kind: "warning", title: "Área não liberada", message: "Peça a um administrador para liberar Configurações e backup para você." }); return; }
    setSettingsTab(typeof tab === "string" ? tab : null); setSettingsOpen(true); setSidebarOpen(false);
  }, [notify]);
  const plural = (n, um, varios) => n + " " + (n === 1 ? um : varios);

  /* ---- salvamento (com aviso quando o navegador recusa gravar) ---- */
  const reportSave = useCallback((kind, ok) => {
    const f = saveFail.current;
    if (ok) {
      if (f[kind]) { f[kind] = false; setSaveError(!!(f.modules || f.settings || f.users)); }
      return;
    }
    const wasFailing = f.modules || f.settings || f.users;
    f[kind] = true;
    setSaveError(true);
    if (!wasFailing) {
      notify({ kind: "error", duration: 12000, title: "Não foi possível salvar neste navegador",
        message: "O espaço pode estar cheio ou bloqueado. Exporte um backup para não perder nada.",
        action: { label: "Exportar backup", onClick: () => openSettings("backup") } });
    }
  }, [notify, openSettings]);
  useEffect(() => { const ok = saveModules(modules); if (ok) setSavedAt(Date.now()); reportSave("modules", ok); }, [modules]);
  useEffect(() => { reportSave("settings", saveSettings(settings)); }, [settings]);
  useEffect(() => { reportSave("users", saveUsers(users)); }, [users]);
  useEffect(() => { saveActivity(activity); }, [activity]);
  useEffect(() => { saveSession(session); }, [session]);

  /* ---- registro de atividades (v5): quem fez, o quê e em qual cliente. Nunca quebra a ação principal. ---- */
  const act = useCallback((tipo, texto, ref) => {
    const u = currentUserRef.current;
    if (!u) return;
    try { setActivity((list) => appendActivity(list, activityEntry(u, tipo, texto, ref))); } catch (e) { console.warn("Falha ao registrar atividade", e); }
  }, []);
  const saveSettingsNow = (next) => setSettings(next);

  /* ---- primeiro commit: tira a tela de carregamento e avisa se algum dado salvo estava ilegível ---- */
  useEffect(() => {
    const boot = document.getElementById("boot");
    if (boot) boot.remove();
    let issue = null;
    try { issue = takeStorageLoadIssue(); } catch (e) { issue = null; }
    if (issue) {
      notify({ kind: "warning", duration: 15000, title: "Os dados salvos estavam ilegíveis; uma cópia foi guardada",
        message: (issue.kind === "settings" ? "As configurações" : "Os clientes") + " voltaram ao padrão. A cópia bruta ficou em " + (issue.backupKey || "uma chave de backup") + ".",
        action: { label: "Ver backup", onClick: () => openSettings("backup") } });
    }
  }, []);

  /* ---- URL: mantém o hash em dia e responde ao voltar/avançar do navegador ---- */
  useEffect(() => { try { window.history.replaceState(null, "", "#" + (view === "dashboard" ? "painel" : view)); } catch (e) {} }, [view]);
  useEffect(() => {
    const onHash = () => { const h = (window.location.hash || "").replace("#", ""); const v = VIEW_HASH[h]; if (v) setView(v); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  /* ---- senha redefinida pelo administrador: pede a troca assim que a pessoa entra (ou reabre o CRM já logada) ---- */
  useEffect(() => {
    if (currentUser && currentUser.trocarSenha) setAccountOpen("forcada");
  }, [currentUser && currentUser.id, currentUser && currentUser.trocarSenha]);
  /* ---- permissões: se a tela atual não está liberada para o usuário, vai para a primeira liberada ---- */
  useEffect(() => {
    if (!currentUser) return;
    if (!userCan(currentUser, view)) { const f = firstAllowedView(currentUser); if (f) setView(f); }
  }, [currentUser, view]);

  /* ---- mutações ---- */
  const setModuleClients = (updater, modId = mod.id) =>
    setModules((ms) => ms.map((m) => (m.id === modId ? { ...m, clients: typeof updater === "function" ? updater(m.clients) : updater } : m)));

  /* Aplica updatedAt + entrada de histórico (texto ou { text, extra }). */
  const touch = (c, log, extra) => {
    const entry = log == null ? null
      : typeof log === "string" ? (log ? { text: log, extra } : null)
      : (log.text ? { text: log.text, extra: log.extra || extra } : null);
    return {
      ...c, updatedAt: nowISO(),
      history: entry ? [appHistoryEntry(entry.text, entry.extra), ...(c.history || [])].slice(0, APP_HISTORY_MAX) : (c.history || []),
    };
  };
  /* Registra em "Atividades" uma ação sobre um cliente (mesmo texto da linha do tempo da ficha). */
  const actClient = (modId, clientId, texto, histTipo, client) => {
    const m = modules.find((x) => x.id === modId);
    const c = client || (m ? m.clients.find((x) => x.id === clientId) : null);
    act(ACTIVITY_FROM_HISTORY[histTipo || appHistoryTipo(texto)] || "cliente", texto, { modId, clientId, clientNome: c ? c.nome : "" });
  };
  const updateClientIn = (modId, id, fn, log, extra) => {
    const logText = typeof log === "string" ? log : (log && typeof log === "object" && log.text) ? log.text : "";
    if (logText) actClient(modId, id, logText, (extra && extra.tipo) || (log && log.extra && log.extra.tipo) || "");
    setModules((ms) => ms.map((m) => (m.id !== modId ? m : { ...m, clients: m.clients.map((c) => {
      if (c.id !== id) return c;
      const next = fn(c);
      return touch(next, typeof log === "function" ? log(c, next) : log, extra);
    }) })));
  };
  const updateClient = (id, fn, log, extra) => updateClientIn(mod.id, id, fn, log, extra);
  const logClientIn = (modId, id, text, extra) => updateClientIn(modId, id, (c) => c, text, extra);
  const logClient = (id, text, extra) => logClientIn(mod.id, id, text, extra);
  const patchClient = (id, patch, log) => updateClient(id, (c) => ({ ...c, ...patch }), log);

  /* Move de etapa de verdade (já passou pelas validações). Roda as automações, grava o histórico e oferece Desfazer.
     opts.client: cliente recém-criado (ainda fora do estado na closure); opts.modId: módulo (padrão: o ativo). */
  const commitMove = (id, status, extra = {}, opts = {}) => {
    const modId = opts.modId || mod.id;
    const m = modules.find((x) => x.id === modId) || mod;
    const before = m.clients.find((x) => x.id === id) || opts.client || null;
    if (!before || before.status === status) return;
    const label = statusMeta(status).label;
    /* Prévia (fora do updater) só para montar o aviso; o estado real é calculado dentro do updater. */
    const preview = runAutomations(settings, m, { ...before, ...extra, status }, { type: "enter_stage", status });
    const snapshot = before;
    setModuleClients((cs) => cs.map((x) => {
      if (x.id !== id || x.status === status) return x;
      const at = nowISO();
      let next = { ...x, ...extra, status, stageLog: [...(x.stageLog || []), { status, at }] };
      if (x.status === "perdido" && status !== "perdido") { next.motivoPerda = ""; next.motivoPerdaObs = ""; }
      const r = runAutomations(settings, m, next, { type: "enter_stage", status });
      next = r.client;
      const motivo = status === "perdido" && extra.motivoPerda ? (motivoLabel(settings, extra.motivoPerda) || extra.motivoPerda) : "";
      const entries = [
        ...r.created.map((t) => appHistoryEntry("Tarefa automática criada: " + t, { tipo: "tarefa" })),
        appHistoryEntry("Etapa alterada para " + label + (motivo ? " (motivo: " + motivo + ")" : ""), { tipo: "etapa" }),
      ];
      return { ...next, updatedAt: at, history: [...entries, ...(x.history || [])].slice(0, APP_HISTORY_MAX) };
    }), modId);
    const motivoTxt = status === "perdido" && extra.motivoPerda ? " (motivo: " + (motivoLabel(settings, extra.motivoPerda) || extra.motivoPerda) + ")" : "";
    actClient(modId, id, "Etapa alterada para " + label + motivoTxt, "etapa", before);
    const n = preview.created.length;
    const undo = () => {
      setModuleClients((cs) => cs.map((x) => (x.id === id ? { ...snapshot, updatedAt: nowISO() } : x)), modId);
      actClient(modId, id, "Mudança de etapa desfeita: voltou para " + statusMeta(snapshot.status).label, "etapa", snapshot);
      notify({ title: "Movimento desfeito", message: snapshot.nome + " voltou para " + statusMeta(snapshot.status).label, kind: "info", duration: 2500 });
    };
    notify({ title: before.nome + " movido para " + label, kind: "info", duration: 6000,
      message: n ? plural(n, "tarefa criada automaticamente", "tarefas criadas automaticamente") : undefined,
      action: { label: "Desfazer", onClick: undo } });
  };

  /* Pedido de mover etapa: valida campos obrigatórios e pede motivo de perda antes de mover. */
  const requestMove = (id, status, opts = {}) => {
    const c = clients.find((x) => x.id === id);
    if (!c || c.status === status) return;
    const missing = missingForStage(settings, mod, c, status);
    if (missing.length) { setGate({ clientId: id, status, missing }); return; }
    if (status === "perdido") { setLoss({ clientId: id, status }); return; }
    commitMove(id, status, {}, opts);
  };
  const gateFill = () => {
    if (!gate || !gateClient) { setGate(null); return; }
    const { status } = gate;
    setGate(null);
    setEditing(gateClient); setRequireFor(status); setFormOpen(true);
  };
  const lossConfirm = ({ motivoPerda, motivoPerdaObs }) => {
    if (!loss) return;
    const { clientId, client } = loss;
    setLoss(null);
    commitMove(clientId, "perdido", { motivoPerda: motivoPerda || "", motivoPerdaObs: (motivoPerdaObs || "").trim() }, { client });
  };

  const saveClient = (data) => {
    const { status: wantedStatus, ...rest } = data || {};
    if (rest.id) {
      /* Edição nunca muda a etapa: o status vem da ficha/funil, nunca do formulário. */
      const current = clients.find((x) => x.id === rest.id);
      updateClient(rest.id, (c) => ({ ...c, ...rest }), "Dados do cliente atualizados", { tipo: "dados" });
      notify({ title: "Cliente atualizado", message: rest.nome });
      setFormOpen(false); setEditing(null); setRequireFor(null);
      if (requireFor && current) {
        /* Veio do "Preencher agora": tenta mover de novo com os dados já preenchidos. */
        const merged = { ...current, ...rest };
        const missing = missingForStage(settings, mod, merged, requireFor);
        if (missing.length) {
          notify({ kind: "warning", title: "Ainda falta para mover para " + statusMeta(requireFor).label, duration: 6000,
            message: missing.map((m) => m.label).join(", ") });
        } else if (requireFor === "perdido") {
          setLoss({ clientId: rest.id, status: "perdido", client: merged });
        } else {
          commitMove(rest.id, requireFor, {}, { client: merged });
        }
      }
      return;
    }

    /* Cadastro: nasce sempre como lead; se o formulário pediu outra etapa, passa pelas mesmas regras do funil. */
    const at = nowISO();
    let c = hydrateClient({ ...rest, status: "lead", id: uid(), demo: false, createdAt: at, updatedAt: at, history: [], stageLog: [{ status: "lead", at }] });
    const r = runAutomations(settings, mod, c, { type: "client_created" });
    c = r.client;
    c.history = [
      ...r.created.map((t) => appHistoryEntry("Tarefa automática criada: " + t, { tipo: "tarefa" })),
      appHistoryEntry("Cliente cadastrado", { tipo: "cadastro" }),
    ];
    setModuleClients((cs) => [c, ...cs]);
    actClient(mod.id, c.id, "Cliente cadastrado", "cadastro", c);
    const n = r.created.length;
    notify({ title: "Cliente cadastrado", message: (n ? plural(n, "tarefa criada automaticamente", "tarefas criadas automaticamente") + ". " : "") + "Agora adicione os " + mod.itemLabelPlural.toLowerCase() + " dele." });
    setFormOpen(false); setEditing(null); setRequireFor(null);
    openClientIn(mod.id, c.id, "itens");
    const wanted = wantedStatus && wantedStatus !== "lead" && STATUSES.some((s) => s.key === wantedStatus) ? wantedStatus : null;
    if (wanted) {
      const missing = missingForStage(settings, mod, c, wanted);
      if (missing.length) setGate({ clientId: c.id, status: wanted, missing, client: c });
      else if (wanted === "perdido") setLoss({ clientId: c.id, status: "perdido", client: c });
      else commitMove(c.id, wanted, {}, { client: c });
    }
  };
  const closeForm = () => { setFormOpen(false); setEditing(null); setRequireFor(null); };
  const openExisting = (id) => { closeForm(); openClientIn(mod.id, id); };

  const removeClient = (id) => {
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    const idx = clients.indexOf(c);
    const modId = mod.id;
    askConfirm({
      title: "Excluir " + c.nome + "?",
      message: "O cliente e todos os seus " + mod.itemLabelPlural.toLowerCase() + ", tarefas e notas serão removidos. Você pode desfazer logo em seguida.",
      confirmLabel: "Excluir cliente", danger: true,
      onConfirm: () => {
        setModuleClients((cs) => cs.filter((x) => x.id !== id), modId);
        actClient(modId, id, "Cliente excluído", "cadastro", c);
        if (openId === id) setOpenId(null);
        if (proposalFor === id) setProposalFor(null);
        if (nextStepFor && nextStepFor.clientId === id) setNextStepFor(null);
        if (contactFor && contactFor.clientId === id) setContactFor(null);
        notify({ title: "Cliente excluído", message: c.nome, kind: "info", duration: 7000,
          action: { label: "Desfazer", onClick: () => { setModuleClients((cs) => { const n = [...cs]; n.splice(Math.min(idx, n.length), 0, c); return n; }, modId); actClient(modId, id, "Exclusão desfeita", "cadastro", c); } } });
      },
    });
  };

  const onDrop = (status, id) => {
    const cid = typeof id === "string" ? id : dragId.current;
    dragId.current = null;
    if (cid) requestMove(cid, status);
  };

  /* ---- tarefas (de qualquer módulo) ---- */
  const toggleTaskIn = (modId, clientId, taskId) => {
    const m = modules.find((x) => x.id === modId);
    const c = m ? m.clients.find((x) => x.id === clientId) : null;
    const t = c ? (c.tasks || []).find((x) => x.id === taskId) : null;
    if (!t) return;
    const done = !t.feito;
    const mark = (k) => (k.id === taskId ? { ...k, feito: done, feitoEm: done ? nowISO() : "" } : k);
    updateClientIn(modId, clientId, (x) => ({ ...x, tasks: (x.tasks || []).map(mark) }), done ? "Tarefa concluída: " + t.titulo : null, { tipo: "tarefa" });
    if (done && needsNextStep({ ...c, tasks: (c.tasks || []).map(mark) })) setNextStepFor({ modId, clientId });
  };
  const patchTaskIn = (modId, clientId, taskId, patch) => {
    const p = patch && typeof patch === "object" ? patch : {};
    const mm = modules.find((x) => x.id === modId);
    const cc = mm ? mm.clients.find((x) => x.id === clientId) : null;
    const tt = cc ? (cc.tasks || []).find((x) => x.id === taskId) : null;
    if (tt && p.data !== undefined && p.data !== tt.data) actClient(modId, clientId, p.data ? "Tarefa adiada para " + appShortDate(p.data) + ": " + tt.titulo : "Tarefa sem data: " + tt.titulo, "tarefa", cc);
    updateClientIn(modId, clientId, (c) => ({ ...c, tasks: (c.tasks || []).map((t) => (t.id === taskId ? { ...t, ...p } : t)) }),
      (c) => {
        const t = (c.tasks || []).find((x) => x.id === taskId);
        if (!t || p.data === undefined || p.data === t.data) return null;
        return p.data ? "Tarefa adiada para " + appShortDate(p.data) + ": " + t.titulo : "Tarefa sem data: " + t.titulo;
      }, { tipo: "tarefa" });
  };
  const addTaskIn = (modId, clientId, task) => {
    const t = newTask(task || {});
    t.titulo = String(t.titulo || "").trim();
    if (!t.titulo) return null;
    updateClientIn(modId, clientId, (c) => ({ ...c, tasks: [...(c.tasks || []), t] }), "Tarefa criada: " + t.titulo, { tipo: "tarefa" });
    return t;
  };
  const nextStepPick = (task) => {
    if (!nextStepFor) return;
    const { modId, clientId } = nextStepFor;
    const t = addTaskIn(modId, clientId, task);
    setNextStepFor(null);
    if (t) notify({ title: "Tarefa criada", message: t.titulo + (t.data ? " · " + taskWhen(t).label : ""), duration: 3000 });
  };

  /* ---- contato ---- */
  const contactConfirm = (d) => {
    if (!contactFor) return;
    const { modId, clientId } = contactFor;
    const data = d || {};
    logClientIn(modId, clientId, contactText(data), { tipo: "contato", canal: data.canal || "", resultado: data.resultado || "" });
    const t = data.next && data.next.titulo ? addTaskIn(modId, clientId, data.next) : null;
    setContactFor(null);
    notify({ title: "Contato registrado", duration: 3500,
      message: t ? "Próximo passo: " + t.titulo + (t.data ? " · " + taskWhen(t).label : "") : (contactResultLabel(data.resultado) || undefined) });
  };
  const contactLink = (id, canal) => {
    const key = appContactCanal(canal);
    logClient(id, APP_CONTACT_LINK_TEXT[key] || ("Contato aberto: " + key), { tipo: "contato", canal: key });
  };

  /* ---- módulos ---- */
  const addModule = (newMod) => {
    setModules((ms) => [...ms, { ...newMod, clients: [] }]);
    act("config", "Módulo criado: " + newMod.nome);
    setActiveModId(newMod.id); setModuleManagerOpen(false); setView(can("dashboard") ? "dashboard" : firstAllowedView(currentUser) || "dashboard");
    notify({ title: "Módulo criado", message: newMod.nome });
  };
  const deleteModule = (id) => {
    const m = modules.find((x) => x.id === id);
    askConfirm({
      title: "Excluir o módulo " + (m ? m.nome : "") + "?",
      message: "Todos os " + (m ? m.clients.length : 0) + " cliente(s) deste módulo serão apagados. Faça um backup antes, se precisar.",
      confirmLabel: "Excluir módulo", danger: true,
      onConfirm: () => {
        setModules((ms) => {
          const left = ms.filter((x) => x.id !== id);
          if (left.length === 0) return ms;
          if (id === activeModId) setActiveModId(left[0].id);
          return left;
        });
        act("config", "Módulo excluído: " + (m ? m.nome : "") + " (" + (m ? m.clients.length : 0) + " cliente(s))");
        notify({ title: "Módulo excluído", kind: "info" });
      },
    });
  };
  const switchModule = (id) => { setActiveModId(id); setOpenId(null); setQuery(""); setFilterStatus("todos"); setFilterOwner("todos"); setSidebarOpen(false); };
  /* Abre a ficha de um cliente de qualquer módulo (troca o módulo se preciso, sem zerar os filtros). */
  const openClientIn = (modId, id, tab) => {
    if (modId && modId !== activeModId && modules.some((m) => m.id === modId)) setActiveModId(modId);
    setOpenTab(tab || "resumo");
    setOpenId(id);
    setSidebarOpen(false);
  };
  const openClientHere = (id) => openClientIn(mod.id, id);

  const freshSettings = () => hydrateSettings(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
  const resetData = () => askConfirm({
    title: "Restaurar dados de exemplo?",
    message: "Isso apaga tudo o que foi salvo neste navegador (clientes e configurações) e volta aos dados iniciais de demonstração.",
    confirmLabel: "Restaurar", danger: true,
    onConfirm: () => {
      clearSavedModules(); clearSavedSettings();
      setModules(initialModules); setActiveModId(initialModules[0].id); setSettings(freshSettings());
      setOpenId(null); setSettingsOpen(false);
      act("dados", "Dados de exemplo restaurados (clientes e configurações apagados)");
      notify({ title: "Dados de exemplo restaurados", kind: "info" });
    },
  });
  const importData = (payload) => {
    const data = Array.isArray(payload) ? { modules: payload, settings: null } : (payload || {});
    const mods = (data.modules || []).map(hydrateModule);
    if (!mods.length) { notify({ title: "Arquivo sem módulos", message: "Nada para importar.", kind: "error" }); return; }
    const nextSettings = data.settings ? hydrateSettings(data.settings) : null;
    const nextUsers = Array.isArray(data.users) && data.users.length ? hydrateUsers(data.users) : null;
    const nextActivity = Array.isArray(data.activity) ? hydrateActivity(data.activity) : null;
    const nClients = mods.reduce((s, m) => s + m.clients.length, 0);
    askConfirm({
      title: "Importar backup?",
      message: "Os dados atuais serão substituídos por " + mods.length + " módulo(s) e " + nClients + " cliente(s) do arquivo" + (nextSettings ? ", incluindo as configurações" : "") + (nextUsers ? " e " + nextUsers.length + " usuário(s)" : "") + ".",
      confirmLabel: "Importar", danger: true,
      onConfirm: () => {
        setModules(mods); setActiveModId(mods[0].id); setOpenId(null);
        if (nextSettings) setSettings(nextSettings);
        if (nextUsers) {
          /* Quem está importando continua com acesso: pelo mesmo login do arquivo ou mantendo o próprio usuário de agora. */
          let list = nextUsers;
          const me = currentUserRef.current;
          if (me) {
            const same = list.find((u) => u.login === me.login);
            if (!same) list = [...list, me];
            setSession({ userId: (same || me).id, at: nowISO() });
          }
          setUsers(list);
        }
        if (nextActivity) setActivity(nextActivity);
        setSettingsOpen(false);
        act("dados", "Backup importado: " + mods.length + " módulo(s), " + nClients + " cliente(s)" + (nextUsers ? ", " + nextUsers.length + " usuário(s)" : ""));
        notify({ title: "Backup importado", message: (nextSettings ? "Clientes e configurações restaurados." : "Clientes restaurados.") + (nextUsers ? " Usuários restaurados." : "") });
      },
    });
  };

  /* ---- equipe / exemplos / onboarding / planilha ---- */
  const detachRef = (kind, id) => {
    if (!id) return;
    const key = kind === "vendedor" ? "responsavel" : kind === "origem" ? "origem" : kind === "motivo" ? "motivoPerda" : null;
    if (!key) return;
    setModules((ms) => ms.map((m) => ({ ...m, clients: m.clients.map((c) => (c[key] === id ? { ...c, [key]: "" } : c)) })));
    if (key === "responsavel" && filterOwner === id) setFilterOwner("todos");
  };
  const removeDemo = () => {
    const n = modules.reduce((s, m) => s + m.clients.filter((c) => c.demo).length, 0);
    if (!n) { notify({ title: "Nenhum dado de exemplo para remover", kind: "info", duration: 2500 }); return; }
    askConfirm({
      title: "Remover os dados de exemplo?",
      message: plural(n, "cliente de exemplo será apagado", "clientes de exemplo serão apagados") + " de todos os módulos. Seus clientes reais e as configurações continuam.",
      confirmLabel: "Remover exemplos", danger: true,
      onConfirm: () => {
        setModules((ms) => removeDemoClients(ms));
        act("dados", "Exemplos removidos: " + plural(n, "cliente de exemplo", "clientes de exemplo"));
        if (openClient && openClient.demo) setOpenId(null);
        setSettingsOpen(false);
        notify({ title: "Exemplos removidos", message: plural(n, "cliente de exemplo apagado", "clientes de exemplo apagados"), kind: "info" });
      },
    });
  };
  const setSoMeus = (b) => setSettings((s) => ({ ...s, ui: { ...(s.ui || {}), soMeus: !!b } }));
  const dismissChecklist = () => setSettings((s) => ({ ...s, onboarding: { ...(s.onboarding || {}), checklistDismissed: true } }));
  const importClients = (modId, rows, opts = {}) => {
    const m = modules.find((x) => x.id === modId) || mod;
    const at = nowISO();
    const list = (Array.isArray(rows) ? rows : []).filter((row) => row && typeof row === "object").map((row) => {
      const status = STATUSES.some((s) => s.key === row.status) ? row.status : "lead";
      let c = hydrateClient({ ...row, status, id: uid(), demo: false, createdAt: at, updatedAt: at,
        history: [appHistoryEntry("Importado da planilha", { tipo: "cadastro" })], stageLog: [{ status, at }] });
      if (opts.automations) {
        const r = runAutomations(settings, m, c, { type: "client_created" });
        c = r.client;
        if (r.created.length) c.history = [...r.created.map((t) => appHistoryEntry("Tarefa automática criada: " + t, { tipo: "tarefa" })), ...c.history];
      }
      return c;
    });
    if (!list.length) { notify({ title: "Nenhum cliente para importar", kind: "warning" }); return; }
    setModuleClients((cs) => [...list, ...cs], m.id);
    act("dados", "Planilha importada: " + plural(list.length, "cliente", "clientes") + " em " + m.nome);
    if (m.id !== activeModId) setActiveModId(m.id);
    setSettingsOpen(false); setOpenId(null);
    setView("clientes");
    notify({ title: plural(list.length, "cliente importado", "clientes importados"), message: "Adicionados em " + m.nome + "." });
  };

  /* ---- acesso e usuários (v5) ---- */
  /* Vendedor na equipe para um usuário: "__novo__" cria um com o mesmo nome; id existente é mantido; "" = nenhum. */
  const resolveVendedor = (s, nome, vendedorId) => {
    if (vendedorId === "__novo__") {
      const id = settingsNewId(nome, (s.vendedores || []).map((v) => v.id));
      return { settings: { ...s, vendedores: [...(s.vendedores || []), { id, nome, metaMensal: 0 }] }, vendedorId: id };
    }
    return { settings: s, vendedorId: isKnownVendedor(s, vendedorId) ? vendedorId : "" };
  };
  /* Entra como o usuário: sessão, "quem sou eu" = vendedor vinculado, registro e, se preciso, troca de senha obrigatória. */
  const enterAs = (user) => {
    const at = nowISO();
    setUsers((us) => us.map((u) => (u.id === user.id ? { ...u, ultimoAcesso: at } : u)));
    setSession({ userId: user.id, at });
    setSettings((s) => ({ ...s, usuarioAtual: isKnownVendedor(s, user.vendedorId) ? user.vendedorId : "" }));
    currentUserRef.current = user;
    act("acesso", "Entrou no CRM");
    if (!userCan(user, view)) setView(firstAllowedView(user) || "dashboard");
  };
  const doSetup = ({ nome, login, senha, vendedorId }) => {
    const r = resolveVendedor(settings, nome, vendedorId);
    const salt = authNewSalt();
    const u = hydrateUser({ id: uid(), nome, login, salt, senhaHash: authHash(senha, salt), perfil: "admin", ativo: true, vendedorId: r.vendedorId, abas: permDefaults(true), criadoEm: nowISO() });
    setSettings({ ...r.settings, usuarioAtual: r.vendedorId });
    setUsers([u]);
    currentUserRef.current = u;
    act("usuarios", "Primeiro administrador criado: " + nome);
    enterAs(u);
    notify({ title: "Bem-vindo, " + nome.split(" ")[0] + "!", message: "Você é o administrador. Cadastre o time em Usuários e escolha o que cada um vê.", duration: 7000 });
  };
  const doLogout = () => {
    act("acesso", "Saiu do CRM");
    setSession(null); setAccountOpen(false); setSettingsOpen(false); setModuleManagerOpen(false);
    setOpenId(null); setFormOpen(false); setEditing(null); setSidebarOpen(false); setConfirmState(null);
    setGate(null); setLoss(null); setProposalFor(null); setNextStepFor(null); setContactFor(null);
  };
  const changeOwnPassword = (nova) => {
    const me = currentUser;
    if (!me) return;
    const salt = authNewSalt();
    setUsers((us) => us.map((u) => (u.id === me.id ? { ...u, salt, senhaHash: authHash(nova, salt), trocarSenha: false } : u)));
    setAccountOpen(false);
    act("acesso", "Trocou a própria senha");
    notify({ title: "Senha alterada", message: "Use a nova senha no próximo acesso." });
  };
  const createUser = (data) => {
    const r = resolveVendedor(settings, data.nome, data.vendedorId);
    if (r.settings !== settings) setSettings(r.settings);
    const salt = authNewSalt();
    const u = hydrateUser({ id: uid(), nome: data.nome, login: data.login, salt, senhaHash: authHash(data.senha, salt), perfil: data.perfil, ativo: true,
      vendedorId: r.vendedorId, abas: data.abas, criadoEm: nowISO(), trocarSenha: !!data.trocarSenha });
    setUsers((us) => [...us, u]);
    act("usuarios", "Usuário criado: " + u.nome + " (" + perfilLabel(u.perfil) + ")");
    notify({ title: "Usuário criado", message: u.nome + " já pode entrar com o login " + u.login + "." });
  };
  const updateUser = (id, data) => {
    const cur = users.find((u) => u.id === id);
    if (!cur) return;
    if (cur.perfil === "admin" && cur.ativo && data.perfil !== "admin" && activeAdmins(users).filter((u) => u.id !== id).length === 0) {
      notify({ kind: "error", title: "O CRM precisa de ao menos um administrador ativo" }); return;
    }
    const r = resolveVendedor(settings, data.nome, data.vendedorId);
    if (r.settings !== settings) setSettings(r.settings);
    const next = hydrateUser({ ...cur, nome: data.nome, login: data.login, perfil: data.perfil, vendedorId: r.vendedorId, abas: data.abas });
    setUsers((us) => us.map((u) => (u.id === id ? next : u)));
    if (currentUser && currentUser.id === id) setSettings((s) => ({ ...s, usuarioAtual: isKnownVendedor(s, next.vendedorId) ? next.vendedorId : "" }));
    act("usuarios", "Usuário editado: " + next.nome + " (" + perfilLabel(next.perfil) + (isAdmin(next) ? "" : " · abas: " + (userTabLabels(next).join(", ") || "nenhuma")) + ")");
    notify({ title: "Usuário atualizado", message: next.nome });
  };
  const resetUserPassword = (id, senha) => {
    const u = users.find((x) => x.id === id);
    if (!u) return;
    const self = !!currentUser && u.id === currentUser.id;
    const salt = authNewSalt();
    setUsers((us) => us.map((x) => (x.id === id ? { ...x, salt, senhaHash: authHash(senha, salt), trocarSenha: !self } : x)));
    act("usuarios", self ? "Redefiniu a própria senha" : "Senha redefinida: " + u.nome);
    notify({ title: "Senha redefinida", message: self ? "Sua senha foi alterada." : u.nome + " deve trocar a senha no próximo acesso." });
  };
  const toggleUserActive = (id) => {
    const u = users.find((x) => x.id === id);
    if (!u) return;
    if (currentUser && u.id === currentUser.id) { notify({ kind: "warning", title: "Você não pode desativar o seu próprio usuário" }); return; }
    if (u.ativo && isAdmin(u) && activeAdmins(users).length <= 1) { notify({ kind: "warning", title: "Único administrador ativo", message: "Torne outra pessoa administradora antes de desativar." }); return; }
    const apply = () => {
      setUsers((us) => us.map((x) => (x.id === id ? { ...x, ativo: !x.ativo } : x)));
      act("usuarios", (u.ativo ? "Acesso desativado: " : "Acesso reativado: ") + u.nome);
      notify({ title: u.ativo ? "Acesso desativado" : "Acesso reativado", message: u.nome, kind: "info" });
    };
    if (u.ativo) askConfirm({ title: "Desativar o acesso de " + u.nome + "?", message: "A pessoa não consegue mais entrar até ser reativada. Os clientes e os registros dela continuam.", confirmLabel: "Desativar", danger: true, onConfirm: apply });
    else apply();
  };
  const deleteUser = (id) => {
    const u = users.find((x) => x.id === id);
    if (!u) return;
    if (currentUser && u.id === currentUser.id) { notify({ kind: "warning", title: "Você não pode excluir o seu próprio usuário" }); return; }
    if (isAdmin(u) && u.ativo && activeAdmins(users).length <= 1) { notify({ kind: "warning", title: "Único administrador ativo", message: "Torne outra pessoa administradora antes de excluir." }); return; }
    askConfirm({
      title: "Excluir o usuário " + u.nome + "?",
      message: "O login deixa de existir. O vendedor na equipe, os clientes e o registro de atividades continuam. Se a pessoa pode voltar, prefira desativar.",
      confirmLabel: "Excluir usuário", danger: true,
      onConfirm: () => {
        setUsers((us) => us.filter((x) => x.id !== id));
        act("usuarios", "Usuário excluído: " + u.nome + " (" + u.login + ")");
        notify({ title: "Usuário excluído", message: u.nome, kind: "info" });
      },
    });
  };

  /* ---- derivados ---- */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      const matchQ = !q || [c.nome, c.empresa, c.email, c.telefone].some((v) => (v || "").toLowerCase().includes(q));
      const matchS = filterStatus === "todos" || c.status === filterStatus;
      const matchO = filterOwner === "todos" || (filterOwner === "sem" ? (!c.responsavel || !isKnownVendedor(settings, c.responsavel)) : c.responsavel === filterOwner);
      return matchQ && matchS && matchO;
    });
  }, [clients, query, filterStatus, filterOwner, settings]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const val = (c) => {
      switch (sort.key) {
        case "nome": return (c.nome || "").toLowerCase();
        case "empresa": return (c.empresa || "").toLowerCase();
        case "status": return STATUSES.findIndex((s) => s.key === c.status);
        case "valor": return dealValue(mod, c);
        case "itens": return c.items.length;
        case "score": return scoreClient(settings, mod, c).points;
        case "responsavel": return (vendedorNome(settings, c.responsavel) || "").toLowerCase();
        case "etapaDias": return daysInStage(c);
        case "origem": return (origemLabel(settings, c.origem) || "").toLowerCase();
        case "proximaTarefa": { const t = nextTask(c); return t ? (t.data || "9999-12-30") + " " + (t.hora || "") : "9999-12-31 ~"; }
        default: return c.updatedAt || "";
      }
    };
    return [...filtered].sort((a, b) => { const x = val(a), y = val(b); return x < y ? -dir : x > y ? dir : 0; });
  }, [filtered, sort, mod, settings]);

  const hasFilter = !!query || filterStatus !== "todos" || filterOwner !== "todos";
  const clearFilters = () => { setQuery(""); setFilterStatus("todos"); setFilterOwner("todos"); };
  const isListView = view === "clientes" || view === "funil";

  /* ---- teclado e scroll ---- */
  const anyOverlay = !!(openId || formOpen || moduleManagerOpen || settingsOpen || confirmState || sidebarOpen || gate || loss || proposalFor || nextStepFor || contactFor || accountOpen);
  useEffect(() => { document.body.style.overflow = anyOverlay ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [anyOverlay]);
  useEffect(() => {
    const onKey = (e) => {
      if (!currentUserRef.current) return;   // telas de login / primeiro acesso não usam os atalhos
      if (e.key === "Escape") {
        /* Esc enquanto digita só tira o foco do campo (não apaga nada nem fecha a janela). O segundo Esc fecha. */
        if (isTyping(e.target)) { e.target.blur(); return; }
        if (confirmState) setConfirmState(null);
        else if (accountOpen) { if (accountOpen !== "forcada") setAccountOpen(false); }
        else if (nextStepFor) setNextStepFor(null);
        else if (contactFor) setContactFor(null);
        else if (gate) setGate(null);
        else if (loss) setLoss(null);
        else if (proposalFor) setProposalFor(null);
        else if (formOpen) closeForm();
        else if (settingsOpen) setSettingsOpen(false);
        else if (moduleManagerOpen) setModuleManagerOpen(false);
        else if (openId) setOpenId(null);
        else if (sidebarOpen) setSidebarOpen(false);
      } else if (e.key === "/" && !isTyping(e.target) && !anyOverlay) {
        e.preventDefault();
        if (!isListView) { if (!userCan(currentUserRef.current, "clientes")) return; setView("clientes"); }
        setTimeout(() => searchRef.current && searchRef.current.focus(), 0);
      } else if ((e.key === "n" || e.key === "N") && !isTyping(e.target) && !anyOverlay && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        openNew();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmState, accountOpen, nextStepFor, contactFor, gate, loss, proposalFor, formOpen, settingsOpen, moduleManagerOpen, openId, sidebarOpen, anyOverlay, view]);

  const openNew = () => { setEditing(null); setRequireFor(null); setFormOpen(true); setSidebarOpen(false); };
  const goView = (v) => { if (!can(v)) return; setView(v); setSidebarOpen(false); };
  const onSearch = (v) => { setQuery(v); if (v && !isListView && can("clientes")) setView("clientes"); };

  /* ---- acesso: sem usuários → cria o primeiro administrador; sem sessão → login ---- */
  if (users.length === 0) return <><SetupScreen vendedores={settings.vendedores || []} onCreate={doSetup} /><Toasts toasts={toasts} onDismiss={dismissToast} /></>;
  if (!currentUser) return <><LoginScreen users={users} onLogin={enterAs} /><Toasts toasts={toasts} onDismiss={dismissToast} /></>;
  const isAdminView = ADMIN_VIEWS.includes(view);
  const noAccess = !firstAllowedView(currentUser);

  const titles = {
    dashboard: { title: "Painel", subtitle: greeting() + " · " + longToday() },
    clientes: { title: "Clientes", subtitle: filtered.length === clients.length ? clients.length + (clients.length === 1 ? " cliente" : " clientes") + " em " + mod.nome : filtered.length + " de " + clients.length + " clientes" },
    funil: { title: "Funil de vendas", subtitle: "Arraste os cards ou use o botão Mover" },
    agenda: { title: "Agenda", subtitle: "Tarefas de todos os módulos" },
    relatorios: { title: "Relatórios", subtitle: "Conversão, tempos e desempenho do time" },
    usuarios: { title: "Usuários", subtitle: "Quem acessa o CRM e o que cada pessoa vê" },
    atividades: { title: "Atividades", subtitle: "Registro de tudo o que foi feito no CRM" },
  };
  const heading = titles[view] || titles.dashboard;
  const showFilters = isListView;
  const vendedores = (settings && settings.vendedores) || [];

  const sidebarProps = { modules, mod, view, settings, saveError, onSwitch: switchModule, onView: goView, onManage: () => { if (!can("modulos")) return; setModuleManagerOpen(true); setSidebarOpen(false); }, onSettings: openSettings, savedAt,
    user: currentUser, can, onLogout: doLogout, onAccount: () => setAccountOpen(true), usersCount: users.length };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Sidebar {...sidebarProps} className="hidden lg:flex" />
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40 anim-fade" onClick={() => setSidebarOpen(false)} />
          <Sidebar {...sidebarProps} className="flex anim-slide-left" onClose={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-3 lg:hidden">
          <IconBtn title="Abrir menu" onClick={() => setSidebarOpen(true)}><I.Menu size={22} /></IconBtn>
          <Logo height={22} />
          <button onClick={openNew} className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white" aria-label="Novo cliente"><I.Plus size={20} /></button>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              {isAdminView
                ? <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                    <span className="flex h-4 w-4 items-center justify-center rounded bg-indigo-600 text-white"><I.Shield size={10} /></span>
                    Administração
                  </div>
                : view === "agenda"
                ? <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                    <span className="flex h-4 w-4 items-center justify-center rounded bg-ink text-white"><I.Layers size={10} /></span>
                    Todos os módulos
                  </div>
                : <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                    <span className="flex h-4 w-4 items-center justify-center rounded text-white" style={{ background: mod.accent }}>{React.createElement(I[mod.icon] || I.Grid, { size: 10 })}</span>
                    {mod.nome}
                  </div>}
              <h1 className="text-2xl font-bold tracking-tight text-ink">{heading.title}</h1>
              <p className="mt-0.5 text-sm text-slate-500">{heading.subtitle}</p>
            </div>
            {!isAdminView && <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[240px] flex-1 lg:w-80">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><I.Search size={17} /></span>
                <input ref={searchRef} value={query} onChange={(e) => onSearch(e.target.value)} placeholder="Buscar cliente, empresa, e-mail…" className={inputCls + " pl-9 pr-9"} aria-label="Buscar clientes" />
                {query
                  ? <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Limpar busca"><I.X size={15} /></button>
                  : <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 sm:block"><Kbd>/</Kbd></span>}
              </div>
              <button onClick={openNew} className={btn.primary + " hidden lg:inline-flex"} title="Atalho: N"><I.Plus size={18} /> Novo cliente</button>
            </div>}
          </div>

          {showFilters && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="mr-1 hidden items-center gap-1 text-xs font-medium text-slate-400 sm:inline-flex"><I.Filter size={13} /> Etapa</span>
              <FilterChip active={filterStatus === "todos"} onClick={() => setFilterStatus("todos")} count={clients.length}>Todos</FilterChip>
              {STATUSES.map((s) => (
                <FilterChip key={s.key} active={filterStatus === s.key} onClick={() => setFilterStatus(filterStatus === s.key ? "todos" : s.key)} status={s} count={clients.filter((c) => c.status === s.key).length}>{s.label}</FilterChip>
              ))}
              {vendedores.length > 0 && (
                <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
                  <span className="hidden items-center gap-1 text-xs font-medium text-slate-400 sm:inline-flex"><I.User size={13} /> Responsável</span>
                  <Select small ariaLabel="Filtrar por responsável" className="w-full sm:w-52"
                    value={filterOwner === "todos" ? "" : filterOwner} onChange={(v) => setFilterOwner(v || "todos")}
                    placeholder="Todos os responsáveis"
                    options={[...vendedores.map((v) => ({ value: v.id, label: v.nome })), { value: "sem", label: "Sem responsável" }]} />
                </div>
              )}
              {hasFilter && (
                <button onClick={clearFilters} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-ink"><I.X size={13} /> Limpar</button>
              )}
            </div>
          )}

          {view === "dashboard" && (
            <Dashboard mod={mod} clients={clients} allModules={allModules} settings={settings}
              onOpen={openClientHere} onOpenIn={openClientIn} onToggleTask={toggleTaskIn} onPatchTask={patchTaskIn}
              onGo={goView} onNew={openNew} onMove={requestMove}
              onSetSoMeus={setSoMeus} onRemoveDemo={removeDemo} onDismissChecklist={dismissChecklist} onOpenSettings={openSettings} />
          )}
          {view === "agenda" && (
            <Agenda allModules={allModules} settings={settings} onOpenIn={openClientIn} onToggleTask={toggleTaskIn} onPatchTask={patchTaskIn}
              onSetSoMeus={setSoMeus} onNew={openNew} />
          )}
          {view === "clientes" && (
            <ClientsTable mod={mod} clients={sorted} total={clients.length} sort={sort} onSort={setSort} onOpen={openClientHere} onNew={openNew}
              hasFilter={hasFilter} onClear={clearFilters} settings={settings}
              onMove={requestMove} onPatch={patchClient} onContactLink={contactLink} />
          )}
          {view === "funil" && (
            <Funnel mod={mod} clients={filtered} onOpen={openClientHere} dragId={dragId} onDrop={onDrop} onNew={openNew} settings={settings}
              onMove={requestMove} onContactLink={contactLink} />
          )}
          {view === "relatorios" && <Reports mod={mod} clients={clients} allModules={allModules} settings={settings} onOpen={openClientHere} />}
          {view === "usuarios" && can("usuarios") && (
            <UsersView users={users} currentUser={currentUser} settings={settings}
              onCreate={createUser} onUpdate={updateUser} onResetPassword={resetUserPassword} onToggleActive={toggleUserActive} onDelete={deleteUser}
              onGoActivity={() => goView("atividades")} />
          )}
          {view === "atividades" && can("atividades") && (
            <ActivityView activity={activity} users={users} modules={allModules} onOpenIn={openClientIn} notify={notify} />
          )}
          {noAccess && <NoAccessView onLogout={doLogout} />}
        </main>
      </div>

      {openClient && (
        <ClientDrawer key={openClient.id} mod={mod} client={openClient} settings={settings} onClose={() => setOpenId(null)}
          onEdit={() => { setEditing(openClient); setRequireFor(null); setFormOpen(true); }}
          onDelete={() => removeClient(openClient.id)}
          patch={(p, log) => patchClient(openClient.id, p, log)}
          changeStatus={(s) => requestMove(openClient.id, s)}
          notify={notify}
          onProposal={() => setProposalFor(openClient.id)}
          onLog={(text, extra) => logClient(openClient.id, text, extra)}
          onOpenSettings={openSettings}
          onToggleTask={(taskId) => toggleTaskIn(mod.id, openClient.id, taskId)}
          onContact={() => setContactFor({ modId: mod.id, clientId: openClient.id })}
          onContactLink={(canal) => contactLink(openClient.id, canal)}
          initialTab={openTab} />
      )}
      {formOpen && <ClientForm mod={mod} initial={editing} settings={settings} clients={clients} requireFor={requireFor} onClose={closeForm} onSave={saveClient} onOpenExisting={openExisting} />}
      {proposalClient && (
        <ProposalModal mod={mod} client={proposalClient} settings={settings} onClose={() => setProposalFor(null)}
          onGenerated={({ numero, validade }) => {
            logClient(proposalClient.id, "Proposta gerada nº " + numero + " (validade " + validade + " dias)", { tipo: "proposta" });
            notify({ title: "Proposta gerada", message: "Nº " + numero + " · validade de " + validade + " dias" });
          }} />
      )}
      {moduleManagerOpen && <ModuleManager modules={modules} onClose={() => setModuleManagerOpen(false)} onAdd={addModule} onDelete={deleteModule} />}
      {settingsOpen && (
        <SettingsModal modules={modules} mod={mod} settings={settings} onSaveSettings={saveSettingsNow} savedAt={savedAt}
          onClose={() => setSettingsOpen(false)} onReset={resetData} onImport={importData} notify={notify} initialTab={settingsTab}
          saveError={saveError} onDetachRef={detachRef} onRemoveDemo={removeDemo} onImportClients={importClients}
          users={users} activity={activity} currentUser={currentUser} onLog={act}
          onGoUsers={can("usuarios") ? () => { setSettingsOpen(false); goView("usuarios"); } : null} />
      )}
      {accountOpen && (
        <ChangePasswordModal user={currentUser} forced={accountOpen === "forcada"} onSave={changeOwnPassword} onClose={() => setAccountOpen(false)} onLogout={doLogout} />
      )}
      {gate && gateClient && <StageGateModal status={gate.status} missing={gate.missing} client={gateClient} onFill={gateFill} onCancel={() => setGate(null)} />}
      {loss && lossClient && <LossReasonModal settings={settings} client={lossClient} onConfirm={lossConfirm} onCancel={() => setLoss(null)} />}
      {nextStepCtx.client && (
        <NextStepModal client={nextStepCtx.client} mod={nextStepCtx.mod} settings={settings}
          onPick={nextStepPick} onSkip={() => setNextStepFor(null)} onCancel={() => setNextStepFor(null)} />
      )}
      {contactCtx.client && (
        <ContactLogModal client={contactCtx.client} mod={contactCtx.mod} settings={settings}
          onConfirm={contactConfirm} onCancel={() => setContactFor(null)} />
      )}
      {confirmState && <ConfirmDialog {...confirmState} onCancel={() => setConfirmState(null)} onConfirm={() => { const fn = confirmState.onConfirm; setConfirmState(null); fn && fn(); }} />}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
