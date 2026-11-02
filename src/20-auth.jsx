/* ------------------------------- Acesso (v5) ------------------------------ */
/* Telas de entrada (primeiro acesso e login), troca de senha e aviso de "sem
   acesso". A conferência de senha é local (authCheck, 01-core.js): não existe
   servidor; usuários e senhas (em hash) ficam no localStorage deste navegador. */

/* Moldura centralizada das telas de entrada. */
function AuthShell({ title, subtitle, children, footer, wide = false }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10 text-ink">
      <div className={"w-full " + (wide ? "max-w-xl" : "max-w-sm")}>
        <div className="mb-6 flex justify-center"><Logo height={30} /></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-pop anim-pop sm:p-8">
          <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm leading-relaxed text-slate-500">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-xs leading-relaxed text-slate-400">{footer}</div>}
      </div>
    </div>
  );
}
/* Campo de senha com botão "mostrar / esconder". onChange recebe o valor (string). */
function PasswordInput({ value, onChange, placeholder = "••••••••", autoComplete = "current-password", error, inputRef, ariaLabel, autoFocus = false }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input ref={inputRef} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        autoComplete={autoComplete} aria-label={ariaLabel} autoFocus={autoFocus} className={inputCls + " pr-11" + (error ? inputErrCls : "")} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Esconder senha" : "Mostrar senha"} aria-pressed={show} tabIndex={-1}
        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
        {show ? <I.EyeOff size={16} /> : <I.Eye size={16} />}
      </button>
    </div>
  );
}
function AuthError({ children }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
      <I.Alert size={16} className="mt-0.5 shrink-0" /><span>{children}</span>
    </div>
  );
}

/* Primeiro acesso: ainda não existe nenhum usuário → cria o primeiro administrador e já entra. */
function SetupScreen({ vendedores = [], onCreate }) {
  const [form, setForm] = useState({ nome: "", login: "", senha: "", confirma: "", vendedorId: "__novo__" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const nameRef = useRef(null);
  useEffect(() => { nameRef.current && nameRef.current.focus(); }, []);
  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); if (errors[k]) setErrors((e) => ({ ...e, [k]: null })); };
  const submit = (e) => {
    if (e) e.preventDefault();
    const er = {};
    if (!form.nome.trim()) er.nome = "Informe seu nome.";
    if (!form.login.trim()) er.login = "Informe um login (pode ser o seu e-mail).";
    const pe = authValidatePassword(form.senha);
    if (pe) er.senha = pe;
    else if (form.senha !== form.confirma) er.confirma = "As senhas não são iguais.";
    if (Object.keys(er).length) { setErrors(er); return; }
    setBusy(true);
    /* O hash da senha leva alguns milissegundos: deixa o botão mudar para "Criando…" antes. */
    setTimeout(() => onCreate({ nome: form.nome.trim(), login: form.login, senha: form.senha, vendedorId: form.vendedorId }), 30);
  };
  const vendOpts = [{ value: "__novo__", label: "Criar um vendedor com o meu nome" }, ...vendedores.map((v) => ({ value: v.id, label: v.nome }))];
  return (
    <AuthShell wide title="Bem-vindo ao Próspera CRM" subtitle="Antes de começar, crie o primeiro administrador. Ele cadastra os outros usuários e escolhe o que cada um pode ver."
      footer={<>Usuários e senhas ficam salvos só neste navegador, junto com os dados do CRM.</>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Seu nome" required error={errors.nome}>
              <input ref={nameRef} className={inputCls + (errors.nome ? inputErrCls : "")} value={form.nome} onChange={(e) => set("nome")(e.target.value)} placeholder="Ex.: Ana Ribeiro" autoComplete="name" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Login" required error={errors.login} hint={!errors.login ? "É o que você digita para entrar. Pode ser o seu e-mail." : null}>
              <input className={inputCls + (errors.login ? inputErrCls : "")} value={form.login} onChange={(e) => set("login")(e.target.value)} placeholder="voce@prospera.com.br" autoComplete="username" inputMode="email" autoCapitalize="none" />
            </Field>
          </div>
          <Field label="Senha" required error={errors.senha} hint={!errors.senha ? "Mínimo de 6 caracteres" : null}>
            <PasswordInput value={form.senha} onChange={set("senha")} autoComplete="new-password" error={errors.senha} ariaLabel="Senha" />
          </Field>
          <Field label="Repita a senha" required error={errors.confirma}>
            <PasswordInput value={form.confirma} onChange={set("confirma")} autoComplete="new-password" error={errors.confirma} ariaLabel="Repita a senha" />
          </Field>
          {vendedores.length > 0 && (
            <div className="sm:col-span-2">
              <Field label="Você na equipe de vendas" hint="Liga o seu login a um vendedor: ele vira o responsável padrão dos seus clientes e o autor das suas notas.">
                <Select value={form.vendedorId} onChange={set("vendedorId")} options={vendOpts} ariaLabel="Vendedor correspondente" />
              </Field>
            </div>
          )}
        </div>
        <button type="submit" disabled={busy} className={btn.primary + " w-full"}>
          {busy ? "Criando…" : <><I.Shield size={16} /> Criar administrador e entrar</>}
        </button>
      </form>
    </AuthShell>
  );
}

/* Tela de login. */
function LoginScreen({ users, onLogin }) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => { ref.current && ref.current.focus(); }, []);
  const submit = (e) => {
    if (e) e.preventDefault();
    if (!login.trim() || !senha) { setErro("Informe login e senha."); return; }
    setBusy(true); setErro("");
    setTimeout(() => {
      const r = authCheck(users, login, senha);
      if (!r.ok) {
        setErro(r.erro === "inativo" ? "Este acesso está desativado. Fale com um administrador." : "Login ou senha incorretos.");
        setBusy(false);
        return;
      }
      onLogin(r.user);
    }, 30);
  };
  return (
    <AuthShell title="Entrar no CRM" subtitle="Use o login e a senha que o administrador criou para você."
      footer={<>Esqueceu a senha? Peça a um administrador para redefinir.<br />Os dados ficam salvos neste navegador.</>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Login">
          <input ref={ref} className={inputCls} value={login} onChange={(e) => setLogin(e.target.value)} placeholder="voce@prospera.com.br" autoComplete="username" inputMode="email" autoCapitalize="none" />
        </Field>
        <Field label="Senha">
          <PasswordInput value={senha} onChange={setSenha} autoComplete="current-password" ariaLabel="Senha" />
        </Field>
        {erro && <AuthError>{erro}</AuthError>}
        <button type="submit" disabled={busy} className={btn.primary + " w-full"}>{busy ? "Entrando…" : <><I.LogIn size={16} /> Entrar</>}</button>
      </form>
    </AuthShell>
  );
}

/* Trocar a própria senha. `forced`: um administrador redefiniu a senha e a pessoa precisa escolher
   a dela antes de continuar (não dá para fechar; só sair do CRM). */
function ChangePasswordModal({ user, forced = false, onSave, onClose, onLogout }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [errors, setErrors] = useState({});
  const submit = () => {
    const er = {};
    if (!forced && !authVerify(user, atual)) er.atual = "Senha atual incorreta.";
    const pe = authValidatePassword(nova);
    if (pe) er.nova = pe;
    else if (nova !== confirma) er.confirma = "As senhas não são iguais.";
    else if (!forced && nova === atual) er.nova = "A nova senha precisa ser diferente da atual.";
    if (Object.keys(er).length) { setErrors(er); return; }
    onSave(nova);
  };
  const onKey = (e) => { if (e.key === "Enter" && e.target.tagName !== "BUTTON") { e.preventDefault(); submit(); } };
  const footer = (
    <>
      {forced
        ? <button type="button" onClick={onLogout} className={btn.ghost}><I.LogOut size={16} /> Sair</button>
        : <button type="button" onClick={onClose} className={btn.ghost}>Cancelar</button>}
      <button type="button" onClick={submit} className={btn.primary}><I.Lock size={16} /> Salvar nova senha</button>
    </>
  );
  return (
    <Modal title={forced ? "Defina sua nova senha" : "Trocar minha senha"}
      subtitle={forced ? "Um administrador redefiniu sua senha. Escolha uma nova para continuar." : user.nome + " · " + user.login}
      icon={I.Lock} onClose={forced ? () => {} : onClose} footer={footer} width="max-w-md">
      <div className="space-y-4" onKeyDown={onKey}>
        {!forced && (
          <Field label="Senha atual" error={errors.atual}>
            <PasswordInput value={atual} onChange={setAtual} autoComplete="current-password" error={errors.atual} ariaLabel="Senha atual" autoFocus />
          </Field>
        )}
        <Field label="Nova senha" error={errors.nova} hint={!errors.nova ? "Mínimo de 6 caracteres" : null}>
          <PasswordInput value={nova} onChange={setNova} autoComplete="new-password" error={errors.nova} ariaLabel="Nova senha" autoFocus={forced} />
        </Field>
        <Field label="Repita a nova senha" error={errors.confirma}>
          <PasswordInput value={confirma} onChange={setConfirma} autoComplete="new-password" error={errors.confirma} ariaLabel="Repita a nova senha" />
        </Field>
      </div>
    </Modal>
  );
}

/* Quando o administrador não liberou nenhuma aba para o usuário. */
function NoAccessView({ onLogout }) {
  return (
    <Card className="mx-auto max-w-lg">
      <EmptyState icon={I.Shield} title="Nenhuma área liberada para você"
        text="Um administrador precisa liberar ao menos uma aba (Painel, Agenda, Clientes, Funil ou Relatórios) para o seu usuário."
        action={<button type="button" onClick={onLogout} className={btn.secondary}><I.LogOut size={16} /> Sair</button>} />
    </Card>
  );
}
