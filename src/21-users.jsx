/* ------------------------------ Usuários (v5) ----------------------------- */
/* Tela "Usuários" (só administrador): lista, novo/editar, redefinir senha,
   desativar/reativar e excluir. As abas que cada usuário vê são escolhidas aqui. */

function PerfilBadge({ perfil, size = "sm" }) {
  const admin = perfil === "admin";
  return (
    <span className={uiPillCls(size)} style={admin ? { background: "#EEF2FF", color: "#3730A3" } : { background: "#F1F5F9", color: "#475569" }}>
      {admin ? <I.Shield size={uiPillIcon(size)} /> : <I.User size={uiPillIcon(size)} />}{perfilLabel(perfil)}
    </span>
  );
}
function AtivoBadge({ ativo, size = "sm" }) {
  return (
    <span className={uiPillCls(size)} style={ativo ? { background: "#E6F6EE", color: "#065F46" } : { background: "#FEE2E2", color: "#991B1B" }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: ativo ? "#047857" : "#DC2626" }} />{ativo ? "Ativo" : "Desativado"}
    </span>
  );
}
/* Resumo das abas liberadas (chips). Administrador: "Vê tudo". */
function UserTabsSummary({ user }) {
  if (isAdmin(user)) return <span className="inline-flex items-center gap-1 text-xs text-slate-500"><I.Eye size={12} /> Vê tudo</span>;
  const labels = userTabLabels(user);
  if (!labels.length) return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700"><I.Alert size={12} /> Nenhuma aba liberada</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {labels.map((l) => <span key={l} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">{l}</span>)}
    </span>
  );
}

/* Formulário de usuário (novo ou edição). A senha só entra no cadastro; depois é por "Redefinir senha". */
function UserFormModal({ initial, users, settings, currentUser, onSave, onClose }) {
  const isEdit = !!(initial && initial.id);
  const isSelf = isEdit && !!currentUser && initial.id === currentUser.id;
  const [form, setForm] = useState(() => ({
    nome: initial ? initial.nome : "", login: initial ? initial.login : "", senha: "", confirma: "",
    perfil: initial ? initial.perfil : "usuario",
    vendedorId: initial ? (initial.vendedorId || "") : "__novo__",
    abas: initial ? { ...initial.abas } : permDefaults(false),
    trocarSenha: !isEdit,
  }));
  const [errors, setErrors] = useState({});
  const nameRef = useRef(null);
  useEffect(() => { nameRef.current && nameRef.current.focus(); }, []);
  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); if (errors[k]) setErrors((e) => ({ ...e, [k]: null })); };
  const setAba = (k, v) => setForm((f) => ({ ...f, abas: { ...f.abas, [k]: !!v } }));
  const setAll = (v) => setForm((f) => ({ ...f, abas: permDefaults(v) }));
  const vendedores = (settings && settings.vendedores) || [];
  const vendOpts = [{ value: "__novo__", label: "Criar um vendedor novo com este nome" }, ...vendedores.map((v) => ({ value: v.id, label: v.nome }))];
  /* Único administrador ativo não pode virar "usuário" (o CRM ficaria sem administrador). */
  const lastAdmin = isEdit && initial.perfil === "admin" && initial.ativo && activeAdmins(users).length <= 1;
  const isAdminForm = form.perfil === "admin";
  const allOn = PERM_TABS.every((t) => form.abas[t.key]);

  const submit = () => {
    const er = {};
    if (!form.nome.trim()) er.nome = "Informe o nome.";
    if (!form.login.trim()) er.login = "Informe o login.";
    else if (authLoginTaken(users, form.login, initial && initial.id)) er.login = "Este login já é usado por outro usuário.";
    if (!isEdit) {
      const pe = authValidatePassword(form.senha);
      if (pe) er.senha = pe;
      else if (form.senha !== form.confirma) er.confirma = "As senhas não são iguais.";
    }
    if (lastAdmin && form.perfil !== "admin") er.perfil = "Este é o único administrador ativo. Torne outra pessoa administradora antes.";
    if (Object.keys(er).length) { setErrors(er); return; }
    const data = {
      nome: form.nome.trim(), login: authNormalizeLogin(form.login), perfil: form.perfil,
      vendedorId: form.vendedorId, abas: isAdminForm ? permDefaults(true) : { ...form.abas },
    };
    if (!isEdit) { data.senha = form.senha; data.trocarSenha = !!form.trocarSenha; }
    onSave(data);
  };
  const onKey = (e) => { if (e.key === "Enter" && !["TEXTAREA", "BUTTON", "SELECT"].includes(e.target.tagName)) { e.preventDefault(); submit(); } };
  const footer = (
    <>
      <button type="button" onClick={onClose} className={btn.ghost}>Cancelar</button>
      <button type="button" onClick={submit} className={btn.primary}>{isEdit ? <><I.CheckSimple size={16} /> Salvar</> : <><I.Plus size={16} /> Criar usuário</>}</button>
    </>
  );

  return (
    <Modal title={isEdit ? "Editar usuário" : "Novo usuário"} subtitle={isEdit ? initial.nome + " · " + initial.login : "Quem vai usar o CRM e o que pode ver"}
      icon={I.Users} onClose={onClose} footer={footer} width="max-w-2xl">
      <div className="space-y-5" onKeyDown={onKey}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome" required error={errors.nome}>
            <input ref={nameRef} className={inputCls + (errors.nome ? inputErrCls : "")} value={form.nome} onChange={(e) => set("nome")(e.target.value)} placeholder="Ex.: Ana Ribeiro" autoComplete="off" />
          </Field>
          <Field label="Login" required error={errors.login} hint={!errors.login ? "O que a pessoa digita para entrar (pode ser o e-mail)" : null}>
            <input className={inputCls + (errors.login ? inputErrCls : "")} value={form.login} onChange={(e) => set("login")(e.target.value)} placeholder="ana@prospera.com.br" autoComplete="off" autoCapitalize="none" />
          </Field>
          {!isEdit && (
            <>
              <Field label="Senha inicial" required error={errors.senha} hint={!errors.senha ? "Mínimo de 6 caracteres" : null}>
                <PasswordInput value={form.senha} onChange={set("senha")} autoComplete="new-password" error={errors.senha} ariaLabel="Senha inicial" />
              </Field>
              <Field label="Repita a senha" required error={errors.confirma}>
                <PasswordInput value={form.confirma} onChange={set("confirma")} autoComplete="new-password" error={errors.confirma} ariaLabel="Repita a senha" />
              </Field>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 sm:col-span-2">
                <SettingsSwitch checked={form.trocarSenha} onChange={set("trocarSenha")} label="Pedir troca de senha no primeiro acesso" />
                <span className="text-sm text-slate-700">Pedir para trocar a senha no primeiro acesso</span>
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <Field label="Vendedor na equipe" hint="Ao entrar, o usuário passa a ser esse vendedor: responsável padrão dos clientes dele, autor das notas e filtro “Só meus”.">
              <Select value={form.vendedorId} onChange={set("vendedorId")} options={vendOpts} placeholder="Nenhum (não entra nas metas)" ariaLabel="Vendedor na equipe" />
            </Field>
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-slate-700">Perfil</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Perfil">
            {USER_PERFIS.map((p) => {
              const on = form.perfil === p.key;
              const dis = isSelf && p.key !== "admin";
              return (
                <button key={p.key} type="button" role="radio" aria-checked={on} disabled={dis} onClick={() => set("perfil")(p.key)}
                  title={dis ? "Você não pode tirar o seu próprio acesso de administrador" : ""}
                  className={"flex items-start gap-3 rounded-xl border p-3 text-left transition disabled:opacity-50 " + (on ? "border-brand bg-brand-50/60 ring-4 ring-brand/10" : "border-slate-200 hover:border-slate-300")}>
                  <span className={"mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg " + (p.key === "admin" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-500")}>
                    {p.key === "admin" ? <I.Shield size={16} /> : <I.User size={16} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{p.label}</span>
                    <span className="block text-xs text-slate-500">{p.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {errors.perfil && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.perfil}</p>}
        </div>

        <div>
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-slate-700">Abas que este usuário vê</div>
              <p className="text-xs text-slate-500">{isAdminForm ? "Administradores veem tudo, inclusive Usuários e Atividades." : "Desligue o que não precisa aparecer para essa pessoa."}</p>
            </div>
            {!isAdminForm && <button type="button" onClick={() => setAll(!allOn)} className="shrink-0 text-xs font-semibold text-brand hover:underline">{allOn ? "Desmarcar tudo" : "Marcar tudo"}</button>}
          </div>
          <div className={"grid grid-cols-1 gap-2 sm:grid-cols-2 " + (isAdminForm ? "opacity-60" : "")}>
            {PERM_TABS.map((t) => {
              const Ic = I[t.icon] || I.Grid;
              const on = isAdminForm || !!form.abas[t.key];
              return (
                <div key={t.key} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                  <span className={"flex h-8 w-8 shrink-0 items-center justify-center rounded-lg " + (on ? "bg-brand-50 text-brand" : "bg-slate-100 text-slate-400")}><Ic size={16} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{t.label}</span>
                    <span className="block truncate text-[11px] text-slate-500">{t.hint}</span>
                  </span>
                  {isAdminForm
                    ? <span className="text-xs font-semibold text-slate-400">Sempre</span>
                    : <SettingsSwitch checked={on} onChange={(v) => setAba(t.key, v)} label={"Liberar " + t.label} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* Redefinir a senha de outro usuário (administrador). A pessoa troca no próximo acesso. */
function ResetPasswordModal({ user, onSave, onClose }) {
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [errors, setErrors] = useState({});
  const submit = () => {
    const er = {};
    const pe = authValidatePassword(nova);
    if (pe) er.nova = pe;
    else if (nova !== confirma) er.confirma = "As senhas não são iguais.";
    if (Object.keys(er).length) { setErrors(er); return; }
    onSave(nova);
  };
  const onKey = (e) => { if (e.key === "Enter" && e.target.tagName !== "BUTTON") { e.preventDefault(); submit(); } };
  const footer = (
    <>
      <button type="button" onClick={onClose} className={btn.ghost}>Cancelar</button>
      <button type="button" onClick={submit} className={btn.primary}><I.Lock size={16} /> Redefinir senha</button>
    </>
  );
  return (
    <Modal title="Redefinir senha" subtitle={user.nome + " · " + user.login} icon={I.Lock} onClose={onClose} footer={footer} width="max-w-md">
      <div className="space-y-4" onKeyDown={onKey}>
        <SettingsInfo>Informe a senha temporária para <b className="text-ink">{user.nome}</b> com segurança. No próximo acesso o CRM pede para a pessoa escolher uma senha própria.</SettingsInfo>
        <Field label="Senha temporária" error={errors.nova} hint={!errors.nova ? "Mínimo de 6 caracteres" : null}>
          <PasswordInput value={nova} onChange={setNova} autoComplete="new-password" error={errors.nova} ariaLabel="Senha temporária" autoFocus />
        </Field>
        <Field label="Repita a senha" error={errors.confirma}>
          <PasswordInput value={confirma} onChange={setConfirma} autoComplete="new-password" error={errors.confirma} ariaLabel="Repita a senha" />
        </Field>
      </div>
    </Modal>
  );
}

/* Tela "Usuários". As regras (não desativar a si mesmo, manter ao menos um administrador) são
   conferidas também no app (06-app.jsx); aqui só apagamos/desabilitamos os botões. */
function UsersView({ users, currentUser, settings, onCreate, onUpdate, onResetPassword, onToggleActive, onDelete, onGoActivity }) {
  const [editing, setEditing] = useState(null);     // null | "new" | usuário
  const [resetting, setResetting] = useState(null); // usuário
  const admins = activeAdmins(users);
  const ativos = users.filter((u) => u.ativo).length;
  const sorted = [...users].sort((a, b) => (Number(b.ativo) - Number(a.ativo)) || (Number(isAdmin(b)) - Number(isAdmin(a))) || a.nome.localeCompare(b.nome));
  const smallBtn = btn.secondary + " px-3 py-2 text-xs";
  const smallDanger = btn.dangerSoft + " px-3 py-2 text-xs";

  const save = (data) => {
    if (editing === "new") onCreate(data);
    else if (editing && editing.id) onUpdate(editing.id, data);
    setEditing(null);
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><I.Users size={17} className="text-slate-400" /> Quem usa o CRM</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {users.length} {users.length === 1 ? "usuário" : "usuários"} · {ativos} {ativos === 1 ? "ativo" : "ativos"} · {admins.length} {admins.length === 1 ? "administrador" : "administradores"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onGoActivity && <button type="button" onClick={onGoActivity} className={btn.secondary}><I.History size={16} /> Ver atividades</button>}
            <button type="button" onClick={() => setEditing("new")} className={btn.primary}><I.Plus size={18} /> Novo usuário</button>
          </div>
        </div>
      </Card>

      <SettingsInfo icon={I.Info}>
        <b className="text-ink">Usuários e senhas ficam salvos neste navegador</b>, junto com os clientes. Para o time usar em outro computador,
        exporte um backup em Configurações → Backup e importe lá (o backup leva os usuários). Cada pessoa vê só as abas que você liberar.
      </SettingsInfo>

      <Card>
        <ul className="divide-y divide-slate-100">
          {sorted.map((u) => {
            const self = !!currentUser && u.id === currentUser.id;
            const lastAdmin = isAdmin(u) && u.ativo && admins.length <= 1;
            const vend = vendedorNome(settings, u.vendedorId);
            const lockNote = self ? "Você não pode fazer isso com o seu próprio usuário" : lastAdmin ? "Único administrador ativo: torne outra pessoa administradora antes" : "";
            return (
              <li key={u.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
                <Avatar name={u.nome} size={40} className={u.ativo ? "" : "opacity-50"} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={"text-sm font-semibold " + (u.ativo ? "text-ink" : "text-slate-500")}>{u.nome}</span>
                    {self && <span className="text-xs text-slate-400">(você)</span>}
                    <PerfilBadge perfil={u.perfil} size="xs" />
                    <AtivoBadge ativo={u.ativo} size="xs" />
                    {u.trocarSenha && <span className={uiPillCls("xs")} style={{ background: "#FEF3C7", color: "#92400E" }}><I.Lock size={11} /> troca de senha pendente</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><I.User size={12} /> {u.login}</span>
                    <span className="inline-flex items-center gap-1" title="Vendedor vinculado na equipe"><I.Briefcase size={12} /> {vend || "sem vendedor"}</span>
                    <span className="inline-flex items-center gap-1" title={u.ultimoAcesso ? fmtDateTime(u.ultimoAcesso) : "Nunca entrou"}><I.Clock size={12} /> {u.ultimoAcesso ? "entrou " + relTime(u.ultimoAcesso) : "nunca entrou"}</span>
                  </div>
                  <div className="mt-2"><UserTabsSummary user={u} /></div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                  <button type="button" onClick={() => setEditing(u)} className={smallBtn}><I.Pencil size={14} /> Editar</button>
                  <button type="button" onClick={() => setResetting(u)} className={smallBtn}><I.Lock size={14} /> Senha</button>
                  <button type="button" onClick={() => onToggleActive(u.id)} disabled={self || (u.ativo && lastAdmin)} title={self || (u.ativo && lastAdmin) ? lockNote : ""} className={smallBtn + " disabled:opacity-40"}>
                    {u.ativo ? <><I.X size={14} /> Desativar</> : <><I.CheckSimple size={14} /> Reativar</>}
                  </button>
                  <button type="button" onClick={() => onDelete(u.id)} disabled={self || lastAdmin} title={self || lastAdmin ? lockNote : ""} className={smallDanger + " disabled:opacity-40"}><I.Trash size={14} /> Excluir</button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {editing && (
        <UserFormModal initial={editing === "new" ? null : editing} users={users} settings={settings} currentUser={currentUser}
          onSave={save} onClose={() => setEditing(null)} />
      )}
      {resetting && (
        <ResetPasswordModal user={resetting} onSave={(senha) => { onResetPassword(resetting.id, senha); setResetting(null); }} onClose={() => setResetting(null)} />
      )}
    </div>
  );
}
