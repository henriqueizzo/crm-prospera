/* ------------------------------ Proposta comercial ------------------------ */
/* Gera uma proposta a partir da ficha do cliente: prévia na tela (iframe com o
   mesmo HTML que vai para a impressão), impressão/PDF e cópia de um resumo. */
const PROPOSAL_INCLUDE = [
  { key: "todos", label: "Todos os itens" },
  { key: "interesse", label: "Só de interesse" },
  { key: "contratado", label: "Só contratados" },
];

function proposalEsc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function proposalNl(s) { return proposalEsc(s).replace(/\n/g, "<br>"); }

/* Detalhes de um item (campos que não são título, status nem valor). */
function proposalItemDetails(mod, item) {
  const titleField = mod.fields.find((f) => f.fromOptions) || mod.fields.find((f) => f.type === "text");
  return mod.fields
    .filter((f) => f.type !== "status" && f.type !== "currency" && (!titleField || f.id !== titleField.id))
    .map((f) => {
      const v = item[f.id];
      if (v === "" || v === undefined || v === null || (f.type === "number" && !v)) return null;
      return f.label.replace(/\s*\(%.*\)/, "") + ": " + (/%/.test(f.label) ? v + "%" : v);
    })
    .filter(Boolean)
    .join(" · ");
}

/* HTML independente da proposta (usado na prévia e na impressão). */
function proposalBuildHtml(p) {
  const logoUrl = new URL("assets/logo.png", window.location.href).href;
  const rows = p.items.map((it) => {
    const det = proposalItemDetails(p.mod, it);
    return '<tr><td><div class="it">' + proposalEsc(itemTitle(p.mod, it)) + "</div>" + (det ? '<div class="det">' + proposalEsc(det) + "</div>" : "") + "</td>" +
      '<td class="num">' + proposalEsc(BRL(itemValue(p.mod, it))) + "</td></tr>";
  }).join("");
  const emptyRow = '<tr><td colspan="2" class="empty">Nenhum ' + proposalEsc(p.mod.itemLabel.toLowerCase()) + " selecionado para esta proposta.</td></tr>";
  const totals =
    '<tr class="sub"><td>Subtotal</td><td class="num">' + proposalEsc(BRL(p.subtotal)) + "</td></tr>" +
    (p.desconto > 0 ? '<tr class="sub"><td>Desconto (' + proposalEsc(p.desconto) + '%)</td><td class="num">− ' + proposalEsc(BRL(p.descontoValor)) + "</td></tr>" : "") +
    '<tr class="tot"><td>Total</td><td class="num">' + proposalEsc(BRL(p.total)) + "</td></tr>";
  const printScript = p.autoPrint ? "<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},350);});<\/script>" : "";
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    "<title>Proposta " + proposalEsc(p.numero) + " · " + proposalEsc(p.client.nome) + "</title>" +
    "<style>" +
    "@page{size:A4;margin:16mm 16mm 18mm}" +
    "*{box-sizing:border-box}html,body{margin:0;background:#fff}" +
    "body{font-family:Inter,-apple-system,'Segoe UI',Roboto,system-ui,sans-serif;color:#1A1A2E;font-size:13px;line-height:1.5;padding:28px 32px}" +
    "@media print{body{padding:0}}" +
    ".head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:16px;border-bottom:3px solid #3152E4}" +
    ".brand{display:flex;align-items:center;gap:10px}.brand img{height:30px}.brand .txt{font-weight:800;font-size:22px;letter-spacing:-.02em;text-transform:lowercase}" +
    ".brand .tag{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#3152E4;background:#EFF4FF;border-radius:6px;padding:2px 6px}" +
    ".meta{text-align:right}.meta h1{margin:0;font-size:18px;letter-spacing:-.01em}.meta div{font-size:11.5px;color:#64748b}.meta b{color:#1A1A2E}" +
    ".grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0}" +
    ".box{border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px}.box h3{margin:0 0 6px;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#64748b}" +
    ".box div{font-size:13px}.box .nm{font-weight:700;font-size:14px}" +
    "p.msg{white-space:normal;margin:0 0 16px;font-size:13.5px}" +
    "table{width:100%;border-collapse:collapse;margin:6px 0 16px}th{text-align:left;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;padding:8px 10px;border-bottom:1px solid #e2e8f0;background:#f8fafc}" +
    "td{padding:9px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}td.num,th.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}" +
    ".it{font-weight:600}.det{font-size:11.5px;color:#64748b;margin-top:2px}td.empty{color:#94a3b8;text-align:center;padding:18px}" +
    "tr.sub td{color:#475569;border-bottom:none;padding-top:6px;padding-bottom:4px}tr.tot td{font-weight:800;font-size:15px;border-top:2px solid #1A1A2E;border-bottom:none;padding-top:10px}" +
    ".cond{background:#f8fafc;border-radius:12px;padding:12px 14px;font-size:12px;color:#475569}.cond h3{margin:0 0 4px;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#64748b}" +
    ".sign{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-top:34px}.sign .line{width:260px;border-top:1px solid #1A1A2E;padding-top:6px;font-size:12px}.sign .line b{display:block;font-size:13px}" +
    ".foot{margin-top:26px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10.5px;color:#94a3b8;display:flex;justify-content:space-between}" +
    /* Celular (prévia estreita): blocos em 1 coluna e assinaturas empilhadas na largura toda. */
    "@media (max-width:520px){body{padding:18px 16px}.head{flex-wrap:wrap}.meta{text-align:left}" +
    ".grid{grid-template-columns:1fr}.sign{flex-direction:column;align-items:stretch;gap:28px}.sign .line{width:100%}.foot{flex-wrap:wrap;gap:4px}}" +
    "</style></head><body>" +
    '<div class="head"><div class="brand"><img src="' + proposalEsc(logoUrl) + '" alt="Próspera" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'inline\'"><span class="txt" style="display:none">próspera</span><span class="tag">' + proposalEsc(p.mod.nome) + "</span></div>" +
    '<div class="meta"><h1>Proposta comercial</h1><div>Nº <b>' + proposalEsc(p.numero) + "</b></div><div>Emitida em <b>" + proposalEsc(p.dataEmissao) + "</b></div><div>Válida por <b>" + proposalEsc(p.validade) + " dias</b> (até " + proposalEsc(p.dataValidade) + ")</div></div></div>" +
    '<div class="grid"><div class="box"><h3>Preparada para</h3><div class="nm">' + proposalEsc(p.client.nome) + "</div>" +
    (p.client.empresa ? "<div>" + proposalEsc(p.client.empresa) + "</div>" : "") +
    (p.client.telefone ? "<div>" + proposalEsc(p.client.telefone) + "</div>" : "") +
    (p.client.email ? "<div>" + proposalEsc(p.client.email) + "</div>" : "") + "</div>" +
    '<div class="box"><h3>Seu contato na Próspera</h3><div class="nm">' + proposalEsc(p.vendedor || "Equipe Próspera") + "</div><div>Próspera Benefícios</div><div>" + proposalEsc(p.mod.itemLabelPlural) + "</div></div></div>" +
    (p.mensagem.trim() ? '<p class="msg">' + proposalNl(p.mensagem.trim()) + "</p>" : "") +
    "<table><thead><tr><th>" + proposalEsc(p.mod.itemLabel) + '</th><th class="num">Valor</th></tr></thead><tbody>' + (rows || emptyRow) + totals + "</tbody></table>" +
    (p.condicoes.trim() ? '<div class="cond"><h3>Condições comerciais</h3>' + proposalNl(p.condicoes.trim()) + "</div>" : "") +
    '<div class="sign"><div class="line"><b>' + proposalEsc(p.vendedor || "Equipe Próspera") + "</b>Próspera Benefícios</div><div class=\"line\"><b>" + proposalEsc(p.client.nome) + "</b>De acordo</div></div>" +
    '<div class="foot"><span>Próspera Benefícios · proposta nº ' + proposalEsc(p.numero) + "</span><span>Gerada pelo Próspera CRM em " + proposalEsc(p.dataEmissao) + "</span></div>" +
    printScript + "</body></html>";
}

function proposalPlainText(p) {
  const lines = [
    "Proposta comercial nº " + p.numero + " — Próspera Benefícios",
    "Cliente: " + p.client.nome + (p.client.empresa ? " (" + p.client.empresa + ")" : ""),
    "Emitida em " + p.dataEmissao + " · válida por " + p.validade + " dias (até " + p.dataValidade + ")",
    "",
  ];
  if (p.mensagem.trim()) lines.push(p.mensagem.trim(), "");
  lines.push(p.mod.itemLabelPlural + ":");
  if (p.items.length === 0) lines.push("- (nenhum item selecionado)");
  p.items.forEach((it) => {
    const det = proposalItemDetails(p.mod, it);
    lines.push("- " + itemTitle(p.mod, it) + (det ? " (" + det + ")" : "") + " — " + BRL(itemValue(p.mod, it)));
  });
  lines.push("", "Subtotal: " + BRL(p.subtotal));
  if (p.desconto > 0) lines.push("Desconto (" + p.desconto + "%): -" + BRL(p.descontoValor));
  lines.push("Total: " + BRL(p.total), "");
  if (p.condicoes.trim()) lines.push("Condições: " + p.condicoes.trim(), "");
  lines.push(p.vendedor ? p.vendedor + " · Próspera Benefícios" : "Equipe Próspera Benefícios");
  return lines.join("\n");
}

function proposalCopyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); resolve();
    } catch (e) { reject(e); }
  });
}

/* `notify` é opcional (o app pode passar); sem ele, o erro de cópia aparece dentro do modal. */
function ProposalModal({ mod, client, settings, onClose, onGenerated, notify }) {
  const st = settings || {};
  const hasStatus = mod.fields.some((f) => f.type === "status");
  const first = (client.nome || "").trim().split(" ")[0] || "cliente";
  const [numero] = useState(() => todayISO().replace(/-/g, "") + "-" + uid().slice(0, 4).toUpperCase());
  const [validade, setValidade] = useState(15);
  const [incluir, setIncluir] = useState("todos");
  const [desconto, setDesconto] = useState(0);
  const [vendedor, setVendedor] = useState(() => vendedorNome(st, client.responsavel) || vendedorNome(st, st.usuarioAtual) || "");
  const [mensagem, setMensagem] = useState(() =>
    "Olá " + first + ", obrigado pelo interesse na Próspera. Preparamos esta proposta de " + mod.itemLabelPlural.toLowerCase() +
    " pensando nas necessidades da " + (client.empresa || "sua empresa") + ". Fico à disposição para ajustar o que for preciso.");
  const [condicoes, setCondicoes] = useState(
    "Validade conforme indicada no cabeçalho. Valores sujeitos a análise cadastral e às condições contratuais vigentes.\nPagamento e faturamento conforme contrato. Esta proposta não substitui o contrato definitivo.");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);

  const items = useMemo(() => {
    const all = client.items || [];
    if (!hasStatus || incluir === "todos") return all;
    return all.filter((it) => (it.status || "interesse") === incluir);
  }, [client.items, incluir, hasStatus]);

  const validadeNum = Math.max(1, Math.min(365, Number(validade) || 15));
  const descontoNum = Math.max(0, Math.min(100, Number(desconto) || 0));
  const subtotal = items.reduce((s, it) => s + itemValue(mod, it), 0);
  const descontoValor = Math.round(subtotal * descontoNum) / 100;
  const total = Math.max(0, subtotal - descontoValor);

  const data = {
    mod, client, items, numero, vendedor, mensagem, condicoes,
    validade: validadeNum, desconto: descontoNum, subtotal, descontoValor, total,
    dataEmissao: fmtDate(todayISO()), dataValidade: fmtDate(daysFromNow(validadeNum)),
  };
  const previewHtml = useMemo(() => proposalBuildHtml({ ...data, autoPrint: false }),
    [items, numero, vendedor, mensagem, condicoes, validadeNum, descontoNum, subtotal, total, client, mod]);

  const print = () => {
    const w = window.open("", "_blank");
    if (!w) { setPopupBlocked(true); return; }
    setPopupBlocked(false);
    w.document.open(); w.document.write(proposalBuildHtml({ ...data, autoPrint: true })); w.document.close();
    onGenerated && onGenerated({ numero, validade: validadeNum });
  };
  const copy = () => {
    setCopyError(false);
    proposalCopyText(proposalPlainText(data))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => {
        const msg = { kind: "error", title: "Não foi possível copiar o resumo", message: "O navegador bloqueou a cópia. Use \"Imprimir / salvar PDF\" ou copie o texto da prévia." };
        if (typeof notify === "function") notify(msg); else setCopyError(true);
      });
  };

  const label = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";
  const smallInput = inputCls + " py-2 text-sm";

  return (
    <Modal title="Proposta comercial" subtitle={client.nome + (client.empresa ? " · " + client.empresa : "")} icon={I.FileText} onClose={onClose} width="max-w-5xl"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[11px] text-slate-400">Nº {numero} · {items.length} {items.length === 1 ? mod.itemLabel.toLowerCase() : mod.itemLabelPlural.toLowerCase()} · total <b className="text-slate-600 tnum">{BRL(total)}</b></div>
          <div className="flex items-center justify-end gap-2.5">
            <button type="button" onClick={onClose} className={btn.ghost}>Fechar</button>
            <button type="button" onClick={copy} className={btn.secondary}>{copied ? <><I.CheckSimple size={16} /> Copiado!</> : <><I.Copy size={16} /> Copiar resumo</>}</button>
            <button type="button" onClick={print} className={btn.primary}><I.Printer size={16} /> Imprimir / salvar PDF</button>
          </div>
        </div>
      }>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 text-sm font-semibold text-ink">Opções da proposta</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className={label}>Validade (dias)</span>
                <input type="number" min="1" max="365" value={validade} onChange={(e) => setValidade(e.target.value === "" ? "" : Number(e.target.value))} className={smallInput} />
              </label>
              <label className="block"><span className={label}>Desconto</span>
                <div className="relative">
                  <input type="number" min="0" max="100" step="0.5" value={desconto} onChange={(e) => setDesconto(e.target.value === "" ? "" : Number(e.target.value))} className={smallInput + " pr-8"} placeholder="0" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">%</span>
                </div>
              </label>
            </div>
            {hasStatus && (
              <div className="mt-3">
                <span className={label}>Quais {mod.itemLabelPlural.toLowerCase()} incluir</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {PROPOSAL_INCLUDE.map((o) => (
                    <button key={o.key} type="button" onClick={() => setIncluir(o.key)}
                      className={"rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition " + (incluir === o.key ? "border-brand bg-brand-50 text-brand" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className="mt-3 block"><span className={label}>Vendedor (assina a proposta)</span>
              <input value={vendedor} onChange={(e) => setVendedor(e.target.value)} className={smallInput} placeholder="Nome de quem envia" />
            </label>
          </div>

          <label className="block"><span className={label}>Mensagem de abertura</span>
            <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} className={inputCls + " min-h-[110px] resize-y text-sm"} />
          </label>
          <label className="block"><span className={label}>Condições comerciais</span>
            <textarea value={condicoes} onChange={(e) => setCondicoes(e.target.value)} className={inputCls + " min-h-[96px] resize-y text-sm"} />
          </label>

          {items.length === 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <I.Alert size={15} className="mt-0.5 shrink-0" /><span>Nenhum {mod.itemLabel.toLowerCase()} entra nesta proposta. Adicione itens na aba "{mod.itemLabelPlural.split(" ")[0]}" da ficha ou mude o filtro acima.</span>
            </div>
          )}
          {popupBlocked && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <I.Alert size={15} className="mt-0.5 shrink-0" /><span>O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente de novo.</span>
            </div>
          )}
          {copyError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800" role="alert">
              <I.Alert size={15} className="mt-0.5 shrink-0" /><span>Não foi possível copiar o resumo. Use "Imprimir / salvar PDF" ou copie o texto da prévia.</span>
            </div>
          )}
          <p className="text-[11px] leading-relaxed text-slate-400">Na janela de impressão, escolha "Salvar como PDF" para gerar o arquivo e enviar ao cliente.</p>
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><I.Eye size={14} /> Prévia (é assim que vai sair no papel)</span>
            <span className="hidden sm:inline">Formato A4</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-200/60 p-2 sm:p-4">
            <iframe title="Prévia da proposta" srcDoc={previewHtml} sandbox="allow-same-origin" className="h-[62vh] w-full rounded-lg bg-white shadow-card lg:h-[64vh]" />
          </div>
        </div>
      </div>
    </Modal>
  );
}
