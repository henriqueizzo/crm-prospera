/* ----------------------------- MÓDULOS NATIVOS ---------------------------- */
const benefitsModule = {
  id: "beneficios", nome: "Benefícios", icon: "Gift", accent: "#3152E4",
  itemLabel: "Benefício", itemLabelPlural: "Benefícios corporativos",
  options: ["Plano de saúde", "Odontológico", "Vale-refeição/alimentação", "Seguro de vida", "Previdência", "Vale-transporte"],
  fields: [
    { id: "tipo", label: "Tipo", type: "text", fromOptions: true },
    { id: "status", label: "Status", type: "status" },
    { id: "valor", label: "Valor anual", type: "currency" },
  ],
  valueField: "valor",   // campo em R$ que representa o valor do negócio
};

/* Em Adquirência o TPV é o volume que passa na maquininha, não o que a Próspera
   ganha. O valor do negócio é a receita mensal estimada (≈ 1,5% a 2,5% do TPV). */
const acquiringModule = {
  id: "adquirencia", nome: "Adquirência", icon: "Card", accent: "#7C3AED",
  itemLabel: "Produto", itemLabelPlural: "Produtos de adquirência",
  options: ["Maquininha POS", "Pinpad / TEF", "Tap to Pay (celular)", "Gateway online", "Link de pagamento", "Antecipação de recebíveis"],
  fields: [
    { id: "tipo", label: "Produto", type: "text", fromOptions: true },
    { id: "status", label: "Status", type: "status" },
    { id: "qtd", label: "Qtd. equipamentos", type: "number" },
    { id: "modelo", label: "Modelo", type: "text" },
    { id: "bandeiras", label: "Bandeiras", type: "text" },
    { id: "tpv", label: "TPV mensal estimado", type: "currency" },
    { id: "receita", label: "Receita mensal estimada (R$)", type: "currency" },
    { id: "mdr_debito", label: "Taxa débito (%)", type: "number" },
    { id: "mdr_credito", label: "Taxa crédito (%)", type: "number" },
    { id: "taxa_pix", label: "Taxa Pix (%)", type: "number" },
    { id: "antecipacao", label: "Antecipação (% a.m.)", type: "number" },
  ],
  valueField: "receita",
};

/* -------------------------- DADOS-SEMENTE POR MÓDULO ----------------------
   Todos os clientes de exemplo têm demo: true (o painel oferece "Remover exemplos").
   Os exemplos foram montados para mostrar os recursos do CRM:
   - Juliana (lead há 12 dias) estoura o prazo de 7 dias da etapa → "parado";
   - Patrícia (negociação há 12 dias, prazo 15) entra na faixa de atenção e
     está SEM tarefa pendente → alerta "Sem próximo passo";
   - Mariana (negociação há 3 h) está dentro do prazo, com tarefa marcada para amanhã às 10:00;
   - Ricardo e André fecharam neste mês → aparecem nas metas;
   - Mariana e Patrícia têm interesse alto + porte médio/grande → prioridade "Alta".
--------------------------------------------------------------------------- */
const hist = (h, text) => ({ id: uid(), at: hoursAgo(h), text });
const seedStage = (status, h) => ({ status, at: hoursAgo(h) });
const seedNote = (h, text, autor) => ({ id: uid(), at: hoursAgo(h), text, autor });
/* Tarefa de exemplo: dias a partir de hoje, tipo (ligacao/whatsapp/email/reuniao/outro) e opcionais (hora, auto, feito em h atrás). */
const seedTask = (titulo, dias, tipo, extra) => {
  const o = extra || {};
  const t = { id: uid(), titulo, data: daysFromNow(dias), hora: o.hora || "", tipo: tipo || "", feito: !!o.feitoH, auto: !!o.auto };
  if (o.feitoH) t.feitoEm = hoursAgo(o.feitoH);
  return t;
};

const seedBeneficios = [
  { id: uid(), demo: true, nome: "Mariana Costa", telefone: "(11) 98888-1234", email: "mariana@techlog.com.br", empresa: "TechLog Soluções", status: "negociacao",
    obs: "Empresa com 80 funcionários, busca pacote completo até o fim do trimestre.",
    origem: "indicacao", responsavel: "ana", porte: "media", interesse: "alto",
    items: [
      { id: uid(), tipo: "Plano de saúde", status: "interesse", valor: 18500 },
      { id: uid(), tipo: "Odontológico", status: "interesse", valor: 2400 },
    ],
    tasks: [
      seedTask("Enviar proposta revisada", 1, "email", { hora: "10:00" }),
      seedTask("Cobrar retorno da proposta", 3, "whatsapp", { auto: true }),
    ],
    stageLog: [seedStage("lead", 80), seedStage("negociacao", 3)],
    comments: [seedNote(28, "RH quer comparar com a operadora atual antes de decidir. Enviar tabela de coparticipação.", "Ana Ribeiro")],
    createdAt: hoursAgo(80), updatedAt: hoursAgo(3),
    history: [hist(3, "Tarefa automática criada: Cobrar retorno da proposta"), hist(3, "Etapa alterada para Em negociação"), hist(28, "Nota adicionada"), hist(30, "Benefício adicionado: Odontológico"), hist(80, "Cliente cadastrado")] },
  { id: uid(), demo: true, nome: "Ricardo Alves", telefone: "(21) 97777-5678", email: "ricardo@nortemed.com", empresa: "NorteMed", status: "fechado",
    obs: "Contrato assinado. Renovação anual em janeiro.",
    origem: "site", responsavel: "carlos", porte: "media", interesse: "alto",
    items: [
      { id: uid(), tipo: "Plano de saúde", status: "contratado", valor: 32000 },
      { id: uid(), tipo: "Seguro de vida", status: "contratado", valor: 4800 },
      { id: uid(), tipo: "Vale-refeição/alimentação", status: "contratado", valor: 9600 },
    ],
    tasks: [
      seedTask("Enviar contrato assinado para o cadastro", 0, "email", { auto: true, feitoH: 20 }),
      seedTask("Agendar onboarding do cliente", 2, "reuniao", { auto: true }),
      seedTask("Agendar reunião de pós-venda", 6, "reuniao", { hora: "15:00" }),
    ],
    stageLog: [seedStage("lead", 300), seedStage("negociacao", 100), seedStage("fechado", 26)],
    comments: [seedNote(27, "Diretoria aprovou o pacote completo. Assinatura digital concluída.", "Carlos Mendes")],
    createdAt: hoursAgo(300), updatedAt: hoursAgo(20),
    history: [hist(20, "Tarefa concluída: Enviar contrato assinado para o cadastro"), hist(26, "Tarefa automática criada: Agendar onboarding do cliente"), hist(26, "Etapa alterada para Fechado"), hist(60, "Tarefa criada: Agendar reunião de pós-venda"), hist(100, "Etapa alterada para Em negociação"), hist(300, "Cliente cadastrado")] },
  { id: uid(), demo: true, nome: "Juliana Prado", telefone: "(31) 96666-4321", email: "ju.prado@grupobravo.com.br", empresa: "Grupo Bravo", status: "lead",
    obs: "Indicação de cliente. Primeiro contato pendente.",
    origem: "indicacao", responsavel: "ana", porte: "pequena", interesse: "medio",
    items: [{ id: uid(), tipo: "Previdência", status: "interesse", valor: 0 }],
    tasks: [seedTask("Fazer primeiro contato por telefone", -2, "ligacao", { auto: true })],
    stageLog: [seedStage("lead", 290)],
    comments: [],
    createdAt: hoursAgo(290), updatedAt: hoursAgo(290),
    history: [hist(290, "Tarefa automática criada: Fazer primeiro contato por telefone"), hist(290, "Cliente cadastrado")] },
  { id: uid(), demo: true, nome: "Fernando Lima", telefone: "(41) 95555-8765", email: "fernando@delta.ind.br", empresa: "Delta Indústria", status: "perdido",
    obs: "Optou por concorrente por questão de preço.",
    origem: "evento", responsavel: "carlos", porte: "grande", interesse: "baixo",
    motivoPerda: "preco", motivoPerdaObs: "Concorrente ofereceu cerca de 12% mais barato no plano de saúde.",
    items: [], tasks: [],
    stageLog: [seedStage("lead", 400), seedStage("negociacao", 250), seedStage("perdido", 120)],
    comments: [],
    createdAt: hoursAgo(400), updatedAt: hoursAgo(120),
    history: [hist(120, "Etapa alterada para Perdido (motivo: Preço)"), hist(250, "Etapa alterada para Em negociação"), hist(400, "Cliente cadastrado")] },
];

const seedAdquirencia = [
  { id: uid(), demo: true, nome: "Patrícia Gomes", telefone: "(11) 91234-0001", email: "patricia@redeveloz.com.br", empresa: "Rede Veloz Varejo", status: "negociacao",
    obs: "Rede com 12 lojas. Quer reduzir MDR e ter antecipação automática.",
    origem: "prospeccao", responsavel: "carlos", porte: "grande", interesse: "alto",
    items: [
      { id: uid(), tipo: "Maquininha POS", status: "interesse", qtd: 24, modelo: "Smart POS A920", bandeiras: "Visa, Master, Elo", tpv: 480000, receita: 9600, mdr_debito: 0.99, mdr_credito: 2.49, taxa_pix: 0.49, antecipacao: 1.8 },
    ],
    /* Sem tarefa pendente de propósito: mostra o alerta "Sem próximo passo". */
    tasks: [
      seedTask("Simular taxas por loja", 0, "outro", { feitoH: 5 }),
      seedTask("Cobrar retorno da proposta", -6, "whatsapp", { auto: true, feitoH: 150 }),
    ],
    stageLog: [seedStage("lead", 400), seedStage("negociacao", 288)],
    comments: [seedNote(8, "Gerente financeiro pediu simulação separada para as 3 lojas de maior volume.", "Carlos Mendes")],
    createdAt: hoursAgo(400), updatedAt: hoursAgo(5),
    history: [hist(5, "Tarefa concluída: Simular taxas por loja"), hist(8, "Nota adicionada"), hist(150, "Tarefa concluída: Cobrar retorno da proposta"), hist(288, "Tarefa automática criada: Cobrar retorno da proposta"), hist(288, "Etapa alterada para Em negociação"), hist(400, "Cliente cadastrado")] },
  { id: uid(), demo: true, nome: "André Souza", telefone: "(48) 99876-0002", email: "andre@cafedaesquina.com", empresa: "Café da Esquina", status: "fechado",
    obs: "Microempreendedor, fechou com Tap to Pay no celular.",
    origem: "instagram", responsavel: "ana", porte: "mei", interesse: "medio",
    items: [
      { id: uid(), tipo: "Tap to Pay (celular)", status: "contratado", qtd: 2, modelo: "App Próspera Pay", bandeiras: "Visa, Master", tpv: 35000, receita: 735, mdr_debito: 1.29, mdr_credito: 3.19, taxa_pix: 0.99, antecipacao: 2.2 },
    ],
    tasks: [seedTask("Confirmar primeira utilização", 13, "ligacao", { auto: true })],
    stageLog: [seedStage("lead", 200), seedStage("negociacao", 120), seedStage("fechado", 40)],
    comments: [],
    createdAt: hoursAgo(200), updatedAt: hoursAgo(40),
    history: [hist(40, "Tarefa automática criada: Confirmar primeira utilização"), hist(40, "Etapa alterada para Fechado"), hist(120, "Etapa alterada para Em negociação"), hist(200, "Cliente cadastrado")] },
  { id: uid(), demo: true, nome: "Loja Bella Moda", telefone: "(85) 98765-0003", email: "contato@bellamoda.com.br", empresa: "Bella Moda", status: "lead",
    obs: "Chegou pelo site. Avaliando trocar de adquirente atual.",
    origem: "site", responsavel: "", porte: "pequena", interesse: "baixo",
    items: [{ id: uid(), tipo: "Link de pagamento", status: "interesse", qtd: 0, modelo: "", bandeiras: "", tpv: 60000, receita: 1200, mdr_debito: 0, mdr_credito: 0, taxa_pix: 0, antecipacao: 0 }],
    tasks: [seedTask("Fazer primeiro contato", 1, "ligacao", { auto: true })],
    stageLog: [seedStage("lead", 20)],
    comments: [],
    createdAt: hoursAgo(20), updatedAt: hoursAgo(20),
    history: [hist(20, "Tarefa automática criada: Fazer primeiro contato"), hist(20, "Cliente cadastrado")] },
];

const initialModules = [
  { ...benefitsModule, clients: seedBeneficios },
  { ...acquiringModule, clients: seedAdquirencia },
];
