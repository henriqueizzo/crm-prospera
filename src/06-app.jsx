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
  const [saveError, setSaveError] = useState(false);
  const saveFail = useRef({ modules: false, settings: false });

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
  const openSettings = useCallback((tab) => { setSettingsTab(typeof tab === "string" ? tab : null); setSettingsOpen(true); setSidebarOpen(false); }, []);
  const plural = (n, um, varios) => n + " " + (n === 1 ? um : varios);

  /* ---- salvamento (com aviso quando o navegador recusa gravar) ---- */
  const reportSave = useCallback((kind, ok) => {
    const f = saveFail.current;
    if (ok) {
      if (f[kind]) { f[kind] = false; setSaveError(f.modules || f.settings); }
      return;
    }
    const wasFailing = f.modules || f.settings;
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
  const updateClientIn = (modId, id, fn, log, extra) =>
    setModules((ms) => ms.map((m) => (m.id !== modId ? m : { ...m, clients: m.clients.map((c) => {
      if (c.id !== id) return c;
      const next = fn(c);
      return touch(next, typeof log === "function" ? log(c, next) : log, extra);
    }) })));
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
    const n = preview.created.length;
    const undo = () => {
      setModuleClients((cs) => cs.map((x) => (x.id === id ? { ...snapshot, updatedAt: nowISO() } : x)), modId);
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
        if (openId === id) setOpenId(null);
        if (proposalFor === id) setProposalFor(null);
        if (nextStepFor && nextStepFor.clientId === id) setNextStepFor(null);
        if (contactFor && contactFor.clientId === id) setContactFor(null);
        notify({ title: "Cliente excluído", message: c.nome, kind: "info", duration: 7000,
          action: { label: "Desfazer", onClick: () => { setModuleClients((cs) => { const n = [...cs]; n.splice(Math.min(idx, n.length), 0, c); return n; }, modId); } } });
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
    setActiveModId(newMod.id); setModuleManagerOpen(false); setView("dashboard");
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
      notify({ title: "Dados de exemplo restaurados", kind: "info" });
    },
  });
  const importData = (payload) => {
    const data = Array.isArray(payload) ? { modules: payload, settings: null } : (payload || {});
    const mods = (data.modules || []).map(hydrateModule);
    if (!mods.length) { notify({ title: "Arquivo sem módulos", message: "Nada para importar.", kind: "error" }); return; }
    const nextSettings = data.settings ? hydrateSettings(data.settings) : null;
    askConfirm({
      title: "Importar backup?",
      message: "Os dados atuais serão substituídos por " + mods.length + " módulo(s) e " + mods.reduce((s, m) => s + m.clients.length, 0) + " cliente(s) do arquivo" + (nextSettings ? ", incluindo as configurações" : "") + ".",
      confirmLabel: "Importar", danger: true,
      onConfirm: () => {
        setModules(mods); setActiveModId(mods[0].id); setOpenId(null);
        if (nextSettings) setSettings(nextSettings);
        setSettingsOpen(false);
        notify({ title: "Backup importado", message: nextSettings ? "Clientes e configurações restaurados." : "Clientes restaurados." });
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
    if (m.id !== activeModId) setActiveModId(m.id);
    setSettingsOpen(false); setOpenId(null);
    setView("clientes");
    notify({ title: plural(list.length, "cliente importado", "clientes importados"), message: "Adicionados em " + m.nome + "." });
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
  const anyOverlay = !!(openId || formOpen || moduleManagerOpen || settingsOpen || confirmState || sidebarOpen || gate || loss || proposalFor || nextStepFor || contactFor);
  useEffect(() => { document.body.style.overflow = anyOverlay ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [anyOverlay]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        /* Esc enquanto digita só tira o foco do campo (não apaga nada nem fecha a janela). O segundo Esc fecha. */
        if (isTyping(e.target)) { e.target.blur(); return; }
        if (confirmState) setConfirmState(null);
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
        if (!isListView) setView("clientes");
        setTimeout(() => searchRef.current && searchRef.current.focus(), 0);
      } else if ((e.key === "n" || e.key === "N") && !isTyping(e.target) && !anyOverlay && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        openNew();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmState, nextStepFor, contactFor, gate, loss, proposalFor, formOpen, settingsOpen, moduleManagerOpen, openId, sidebarOpen, anyOverlay, view]);

  const openNew = () => { setEditing(null); setRequireFor(null); setFormOpen(true); setSidebarOpen(false); };
  const goView = (v) => { setView(v); setSidebarOpen(false); };
  const onSearch = (v) => { setQuery(v); if (v && !isListView) setView("clientes"); };

  const titles = {
    dashboard: { title: "Painel", subtitle: greeting() + " · " + longToday() },
    clientes: { title: "Clientes", subtitle: filtered.length === clients.length ? clients.length + (clients.length === 1 ? " cliente" : " clientes") + " em " + mod.nome : filtered.length + " de " + clients.length + " clientes" },
    funil: { title: "Funil de vendas", subtitle: "Arraste os cards ou use o botão Mover" },
    agenda: { title: "Agenda", subtitle: "Tarefas de todos os módulos" },
    relatorios: { title: "Relatórios", subtitle: "Conversão, tempos e desempenho do time" },
  };
  const heading = titles[view] || titles.dashboard;
  const showFilters = isListView;
  const vendedores = (settings && settings.vendedores) || [];

  const sidebarProps = { modules, mod, view, settings, saveError, onSwitch: switchModule, onView: goView, onManage: () => { setModuleManagerOpen(true); setSidebarOpen(false); }, onSettings: openSettings, savedAt };

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
              {view === "agenda"
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
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[240px] flex-1 lg:w-80">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><I.Search size={17} /></span>
                <input ref={searchRef} value={query} onChange={(e) => onSearch(e.target.value)} placeholder="Buscar cliente, empresa, e-mail…" className={inputCls + " pl-9 pr-9"} aria-label="Buscar clientes" />
                {query
                  ? <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Limpar busca"><I.X size={15} /></button>
                  : <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 sm:block"><Kbd>/</Kbd></span>}
              </div>
              <button onClick={openNew} className={btn.primary + " hidden lg:inline-flex"} title="Atalho: N"><I.Plus size={18} /> Novo cliente</button>
            </div>
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
          saveError={saveError} onDetachRef={detachRef} onRemoveDemo={removeDemo} onImportClients={importClients} />
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
