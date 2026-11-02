/* --------------------------------- mount ---------------------------------- */
/* Backup de emergência: baixa o que está no localStorage (clientes e configurações) como .json,
   no mesmo formato que o app importa. Se algum texto estiver ilegível, vai bruto em "raw". */
function mountExportRawBackup() {
  const read = (k) => { try { return window.localStorage.getItem(k); } catch (e) { return null; } };
  const payload = { app: "prospera-crm", version: 3, exportedAt: new Date().toISOString(), modules: null, settings: null, raw: {} };
  const put = (field, key) => {
    const s = read(key);
    if (s == null) return;
    try { payload[field] = JSON.parse(s); } catch (e) { payload.raw[key] = s; }
  };
  put("modules", "prospera_crm_v2");
  put("settings", "prospera_crm_settings_v3");
  if (!Object.keys(payload.raw).length) delete payload.raw;
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "prospera-crm-backup-emergencia-" + stamp + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* Tela amigável mostrada quando algo quebra dentro do React. Fica por cima de tudo (inclusive do #boot). */
function MountErrorScreen({ error }) {
  const msg = error && error.message ? error.message : String(error || "Erro desconhecido");
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-canvas p-4 text-ink" role="alertdialog" aria-modal="true" aria-label="Algo deu errado no CRM">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-pop">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-ink">Algo deu errado no CRM</h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Seus dados continuam salvos neste navegador. Recarregue a página; se o problema voltar, exporte um backup antes de qualquer outra coisa.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2.5">
          <button type="button" onClick={mountExportRawBackup}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
            Exportar backup
          </button>
          <button type="button" onClick={() => window.location.reload()} autoFocus
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark">
            Recarregar
          </button>
        </div>
        <details className="mt-4 text-xs text-slate-500">
          <summary className="cursor-pointer select-none font-medium text-slate-600">Detalhe técnico</summary>
          <code className="mt-2 block max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-red-100 bg-red-50 p-2.5 text-[11px] text-red-900">{msg}</code>
        </details>
      </div>
    </div>
  );
}

/* Captura erros de renderização de qualquer tela e evita o "branco mudo". */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error: error || new Error("Erro desconhecido") }; }
  componentDidCatch(error, info) {
    const msg = (error && error.message ? error.message : String(error)) +
      (info && info.componentStack ? "\n" + String(info.componentStack).trim().split("\n").slice(0, 3).join("\n") : "");
    try { if (window.__crmError) window.__crmError(msg); } catch (e) {}
    try { console.error("[Próspera CRM]", error, info); } catch (e) {}
  }
  render() {
    if (this.state.error) return <MountErrorScreen error={this.state.error} />;
    return this.props.children;
  }
}

try {
  ReactDOM.createRoot(document.getElementById("root")).render(<ErrorBoundary><ProsperaCRM /></ErrorBoundary>);
  /* O #boot é removido pelo próprio ProsperaCRM (useEffect no primeiro commit), não aqui. */
} catch (err) {
  if (window.__crmError) window.__crmError(err && err.message ? err.message : String(err));
  throw err;
}
