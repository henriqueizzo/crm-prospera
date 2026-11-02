/* --------------------------- Confirmação e toasts -------------------------- */
/* Caixa de confirmação própria (substitui confirm()). Foco inicial no "Cancelar".
   Enter só confirma quando o foco está no botão de confirmar (nunca "no ar"),
   para ninguém confirmar sem querer ao apertar Enter; nas ações perigosas
   (danger) nem isso: só o clique. Tab fica preso entre os dois botões. Ao fechar,
   o foco volta para onde estava. Esc é tratado pelo app (onCancel). */
function ConfirmDialog({ title, message, confirmLabel = "Confirmar", danger, onCancel, onConfirm }) {
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    if (cancelRef.current) { try { cancelRef.current.focus({ preventScroll: true }); } catch (e) { cancelRef.current.focus(); } }
    return () => { if (prev && prev.focus && document.contains(prev)) { try { prev.focus({ preventScroll: true }); } catch (e) {} } };
  }, []);
  const onKey = (e) => {
    if (e.key === "Enter") {
      if (!danger && document.activeElement === confirmRef.current) { e.preventDefault(); onConfirm(); }
      return;
    }
    if (e.key === "Tab") {
      const order = [cancelRef.current, confirmRef.current].filter(Boolean);
      if (!order.length) return;
      const i = order.indexOf(document.activeElement);
      const next = e.shiftKey ? (i <= 0 ? order[order.length - 1] : order[i - 1]) : (i < 0 || i >= order.length - 1 ? order[0] : order[i + 1]);
      e.preventDefault(); next.focus();
    }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4" role="alertdialog" aria-modal="true" aria-label={title} onKeyDown={onKey}>
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px] anim-fade" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-pop anim-sheet sm:rounded-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-start gap-4">
          <span className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-xl " + (danger ? "bg-red-100 text-red-600" : "bg-brand-50 text-brand")}>
            {danger ? <I.Trash size={21} /> : <I.Info size={22} />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold leading-snug text-ink">{title}</h2>
            {message && <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{message}</p>}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2.5">
          <button ref={cancelRef} type="button" onClick={onCancel} className={btn.secondary}>Cancelar</button>
          <button ref={confirmRef} type="button" onClick={onConfirm} className={danger ? btn.danger : btn.primary}>{confirmLabel}</button>
        </div>
        <p className="mt-3 hidden text-right text-[11px] text-slate-400 sm:block"><Kbd>Esc</Kbd> cancela · <Kbd>Tab</Kbd> troca o botão · <Kbd>Enter</Kbd> aciona o botão em foco</p>
      </div>
    </div>
  );
}

/* Avisos na tela. No celular (< sm) ficam no TOPO, para não brigarem com o
   teclado nem com os botões de baixo; no desktop ficam embaixo, à direita.
   Cada aviso tem uma barra que mostra o tempo restante (mesmo tempo que o app
   usa para removê-lo); ao passar o mouse, a barra pausa e o aviso fica na tela
   até o mouse sair. No máximo 4 avisos visíveis. */
const TOAST_KINDS = {
  success: { icon: "Check", cls: "bg-emerald-50 text-emerald-600", bar: "text-emerald-500" },
  info:    { icon: "Info",  cls: "bg-brand-50 text-brand",          bar: "text-brand" },
  warning: { icon: "Alert", cls: "bg-amber-50 text-amber-600",      bar: "text-amber-500" },
  error:   { icon: "Alert", cls: "bg-red-50 text-red-600",          bar: "text-red-500" },
};
function Toasts({ toasts, onDismiss }) {
  const [held, setHeld] = useState([]);   // avisos que o app já removeu, mas o mouse ainda está em cima
  const hover = useRef(null);
  const last = useRef(toasts);
  useEffect(() => {
    if (hover.current) {
      const gone = last.current.filter((t) => t.id === hover.current && !toasts.some((x) => x.id === t.id));
      if (gone.length) setHeld((h) => [...h.filter((t) => !gone.some((g) => g.id === t.id)), ...gone]);
    }
    last.current = toasts;
  }, [toasts]);

  const list = [...toasts, ...held.filter((h) => !toasts.some((t) => t.id === h.id))].slice(-4);
  if (!list.length) return null;

  const dismiss = (id) => { setHeld((h) => h.filter((t) => t.id !== id)); onDismiss(id); };
  const onEnter = (id) => { hover.current = id; };
  const onLeave = (id) => { hover.current = null; setTimeout(() => setHeld((h) => h.filter((t) => t.id !== id)), 700); };

  return (
    <div className="pointer-events-none fixed left-4 right-4 top-4 z-[70] flex flex-col gap-2 sm:bottom-4 sm:left-auto sm:right-4 sm:top-auto sm:w-[min(380px,calc(100vw-2rem))]" aria-live="polite" aria-relevant="additions">
      {list.map((t) => {
        const k = TOAST_KINDS[t.kind] || TOAST_KINDS.success;
        const Ic = I[k.icon] || I.Check;
        const stuck = held.some((h) => h.id === t.id);
        return (
          <div key={t.id} role="status" onMouseEnter={() => onEnter(t.id)} onMouseLeave={() => onLeave(t.id)}
            className="toast pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-pop anim-toast">
            <span className={"flex h-8 w-8 shrink-0 items-center justify-center rounded-lg " + k.cls}><Ic size={17} /></span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="text-sm font-semibold leading-snug text-ink">{t.title}</div>
              {t.message && <div className="mt-0.5 truncate text-xs text-slate-500">{t.message}</div>}
            </div>
            {t.action && (
              <button type="button" onClick={() => { t.action.onClick(); dismiss(t.id); }}
                className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-bold text-brand transition hover:bg-brand-50">{t.action.label}</button>
            )}
            <button type="button" onClick={() => dismiss(t.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-300 transition hover:bg-slate-100 hover:text-slate-600" aria-label="Fechar aviso"><I.X size={15} /></button>
            {!stuck && <span className={"toast-bar " + k.bar} style={{ animationDuration: (t.duration || 4500) + "ms" }} aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}
