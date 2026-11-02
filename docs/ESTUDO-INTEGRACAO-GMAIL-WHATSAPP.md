# Estudo: integrar o CRM da Próspera com Gmail e WhatsApp

Data: 28/10/2026 · Contexto: `index.html` (React + Tailwind por CDN), dados no localStorage, sem servidor, sem Supabase.
Fatos, preços e limites foram checados na web em 28/10/2026; onde a fonte é blog de fornecedor (e não página oficial), está marcado "confirmar".

## Resumo executivo

1. Dá para automatizar e-mail de verdade sem servidor próprio e sem pagar nada: **Google Apps Script** é um "servidor grátis" dentro da conta Google, com agendador (cron) e acesso ao Gmail.
2. Conta Gmail gratuita envia no máximo 500 e-mails/dia pelo Gmail e só **100 destinatários/dia via Apps Script**; Google Workspace sobe para 2.000/dia e 1.500/dia, respectivamente.
3. Chamar a Gmail API direto do navegador funciona, mas exige projeto no Google Cloud, origem HTTPS/localhost, token que vence em 1 h e, no modo "em teste", nova autorização a cada 7 dias.
4. O conector Gmail do Claude já **lê, rascunha, envia, responde e encaminha** e-mails (pede aprovação a cada ação); não tem gatilhos automáticos, então serve como "operador assistido", não como robô.
5. WhatsApp oficial (Cloud API da Meta) cobra **por mensagem entregue**: no Brasil, blogs de provedores citam ~US$ 0,0625 (R$ 0,32) por marketing e ~US$ 0,0068 (R$ 0,035) por utilidade; 1.000 mensagens de serviço/mês são grátis. Desde 01/10/2026 serviço acima disso e utilidade dentro da janela de 24 h também são cobrados.
6. Para abrir conversa no WhatsApp oficial só com **modelo aprovado** e **opt-in** registrado; limite inicial de 250 contatos únicos/24 h até verificar a empresa.
7. APIs não oficiais (Z-API ~R$ 99,99/mês, Evolution, WPPConnect) ligam o número como "WhatsApp Web"; a própria Z-API admite que o bloqueio do número "é possível e nenhuma estratégia elimina o risco".
8. Make (1.000 créditos/mês grátis), Zapier (100 tarefas/mês) e n8n (só teste grátis; Starter € 20/mês) ajudam, mas um CRM que vive no navegador só "fala" com eles enquanto a aba está aberta e esbarra em CORS.
9. LGPD permite prospecção B2B por **legítimo interesse** (art. 7º, IX) com teste de balanceamento, mensagem relevante, remetente identificado e opt-out fácil; Google exige SPF/DKIM, PTR, TLS e taxa de spam abaixo de 0,3 %.
10. **Recomendação: começar pelo caminho B** (Apps Script + Gmail + WhatsApp por link), usando o Claude para escrever e priorizar; deixar a API oficial do WhatsApp (caminho C) para quando houver base com opt-in e volume que justifique.

---

## 1. Gmail

### 1a. Gmail API direto do navegador (Google Identity Services, sem servidor)

**O que dá para fazer.** Com um token obtido no navegador, o `index.html` chama a Gmail API para enviar (`messages.send`), criar rascunhos (`drafts.create`) e ler respostas (`messages.list`/`get`). Cada envio custa 100 "unidades de cota", de alguns milhares por minuto por usuário [1]. O teto real é o do Gmail: conta gratuita **500 e-mails/dia** [2]; Workspace **2.000/dia** (500 no período de teste) [3].

**Token.** O GIS entrega um *access token* de vida curta (exemplo oficial: 1 hora) e **não entrega refresh token ao navegador**; ao vencer, o usuário clica de novo em "Conectar Gmail" [4][5]. As origens autorizadas precisam ser HTTPS ou `localhost` [5]: abrir o `index.html` por duplo clique (`file://`) **não funciona**; é preciso servir por `http://localhost:8000` (o README já ensina) ou GitHub Pages.

**Projeto no Google Cloud.** Criar projeto → ativar Gmail API → tela de consentimento "Externo" → credencial "ID do cliente OAuth / aplicativo Web". Escopos: `gmail.send` é **sensível**; `gmail.readonly`, `gmail.compose` e `gmail.modify` são **restritos** [6]. Com o app **"Em teste"**: até **100 usuários de teste** e autorização que **expira em 7 dias** [7]. "Em produção" sem verificação: aviso "app não verificado" e teto de **100 usuários novos na vida do projeto** [7][8]. A verificação pede site no domínio próprio, política de privacidade e vídeo; escopos restritos exigem **avaliação de segurança anual** quando os dados passam por servidores [6][9]. Para uso interno com poucos vendedores, "Em teste" basta; a chateação é reautorizar toda semana.

### 1b. Google Apps Script como "servidor gratuito"

Apps Script roda na nuvem do Google, dentro da sua conta, sem custo. Oferece `MailApp`/`GmailApp` (enviar, buscar, ler threads), gatilhos por tempo (de **a cada minuto** até mensal) e "Web App" com `doGet`/`doPost` que respondem HTTP [10][11].

**Cotas oficiais (conta gratuita → Workspace)** [11]: destinatários de e-mail por dia **100 → 1.500**; 50 destinatários por mensagem; leitura/escrita no Gmail 20.000 → 50.000/dia; tempo total de gatilhos **90 min → 6 h/dia**; 6 min por execução; 20 gatilhos por usuário/script; URL Fetch 20.000 → 100.000/dia.

**Como o CRM manda dados.** `fetch(URL_DO_WEBAPP, { method: "POST", body: JSON.stringify(dados) })` **sem** cabeçalho `Content-Type: application/json`: o Apps Script não tem `doOptions`, então o "preflight" de CORS falharia; como texto simples o navegador pula o preflight. Implantar como "Qualquer pessoa" e aceitar o redirecionamento para `script.googleusercontent.com` [12][13][14]. É prática comum, mas há relatos conflitantes; **testar antes**.

**Como ele devolve respostas.** (1) O `doPost` responde JSON na hora [13]; (2) um gatilho a cada 30 min roda `GmailApp.search("in:inbox newer_than:2d")`, casa a resposta com o cliente e grava numa aba da planilha; o CRM faz GET em `?acao=respostas` e atualiza o histórico. A planilha vira fila e log, visíveis para o dono.

### 1c. Claude com conector Gmail

O conector Gmail do Claude **busca e lê** mensagens, **cria rascunhos, envia, responde e encaminha**, gerencia marcadores; por padrão **pede aprovação antes de cada envio**; anexos só por metadados; sem agendamento ou gatilhos [15][16]. No Claude Code deste computador os mesmos comandos aparecem (`search_threads`, `create_draft`, `send_message`, `reply`, `forward`).

**Fluxo manual-assistido:** exportar JSON do CRM → no Claude Code: "leia o backup, liste quem está parado em Proposta há 5+ dias e gere um e-mail por cliente com o modelo X" → revisar → Claude cria rascunhos ou envia com aprovação → devolve um JSON de "envios feitos" → importar no CRM para o histórico. Bom para **dezenas** por sessão, com pessoa no comando; não substitui um agendador.

---

## 2. WhatsApp

### 2a. API oficial (WhatsApp Business Platform / Cloud API)

**Requisitos:** portfólio no Meta Business; **número dedicado** fora do app WhatsApp (ou migrado) que receba PIN por SMS/voz; nome de exibição aprovado; **verificação da empresa** com documentos no Business Manager [17][18]. Limite inicial: **250 clientes únicos/24 h**; sobe para 2.000 ao verificar a empresa (ou entregar 2.000 modelos de alta qualidade em 30 dias) e depois escala sozinho para 10.000, 100.000 e ilimitado [19].

**Modelos e janela de 24 h.** Só se abre conversa com **modelo aprovado** (marketing, utilidade ou autenticação). Quando o cliente responde, abre uma janela de 24 h de texto livre (mensagem de "serviço") [20].

**Preço (por mensagem entregue, desde 01/07/2025).** Página oficial da Meta [21]: **1.000 mensagens de serviço grátis por número/mês**; utilidade/autenticação no Brasil citadas como **0,68 centavo de dólar**; desde **01/10/2026** serviço acima de 1.000 e utilidade dentro da janela são cobrados, com cartão obrigatório; faturamento em **reais** desde jul/2026, obrigatório até 30/06/2027. A tabela interativa não expõe valores em texto; blogs de provedores citam **marketing US$ 0,0625 (R$ 0,3217)** e **utilidade/autenticação/serviço US$ 0,0068 (R$ 0,0350)** [22][23] — **confirmar na tabela oficial**. Não há mensalidade da Meta.

**Opt-in e bloqueio.** Só se pode contatar quem forneceu o número **e deu permissão de adesão**; a empresa "é a única responsável por determinar o método de adesão" e deve "respeitar todas as solicitações" de parar; feedback negativo leva a limite, restrição ou remoção [20]. A Meta ainda corta marketing para usuários que tendem a não ler (erro 131049) [24].

### 2b. Provedores (BSP) e APIs não oficiais

| Provedor | Tipo | Preço aproximado | Servidor? | Risco |
|---|---|---|---|---|
| Meta direto (Cloud API) | Oficial | R$ 0 fixo + por mensagem [21] | Receber respostas exige endereço HTTPS (webhook) | Baixo (qualidade) |
| Twilio | Oficial | US$ 0,005/mensagem + Meta, sem mensalidade [25] | Não (nuvem deles) | Baixo |
| Gupshup | Oficial | ~US$ 0,001/mensagem (blog, confirmar) + 6 % sobre marketing [26][27] | Não | Baixo |
| 360dialog | Oficial | € 49/número/mês, sem markup [28] | Não | Baixo |
| Zenvia | Oficial | Sob consulta (plano + uso); blog cita setup R$ 649 e ~R$ 1.150/mês, confirmar [29] | Não | Baixo |
| Z-API | **Não oficial** (número vira "WhatsApp Web" por QR code) | R$ 99,99/instância/mês, 2 dias de teste [30][31] | Não | **Banimento possível** (admitido pela própria Z-API) [31] |
| Evolution API / WPPConnect | Não oficial (Baileys) ou oficial | Software grátis; precisa de **VPS própria** | Sim | Fundador do WPPConnect relata números banidos [32][33] |

### 2c. O que dá para fazer sem API

- **Links `wa.me` com texto pronto** (já existe): o vendedor clica, revisa, envia. Zero custo e risco; falta só registrar no histórico.
- **App WhatsApp Business**: até **50 respostas rápidas** (atalho "/") [34], catálogo com até 500 itens [35], etiquetas; listas de transmissão de 256 contatos **só chegam a quem salvou seu número** (blogs; confirmar) [36]; "transmissões comerciais" pagas existem em alguns países [37].
- **Por que "disparo em massa" sem API oficial é arriscado:** robôs e extensões sobre o WhatsApp Web violam os termos; a Meta age por denúncias e bloqueios e pode banir o número [20][33]. No número principal da Próspera, o prejuízo é perder o canal inteiro.

---

## 3. Automação sem servidor próprio

- **Make**: plano Free com **1.000 créditos/mês** [38]; Core ~US$ 10,59/mês mensal ou ~US$ 9/mês anual por 10.000 créditos (blogs, confirmar) [39]. **Zapier**: Free com **100 tarefas/mês, Zaps de 2 passos, checagem a cada 15 min**; Professional a partir de US$ 19,99/mês (anual) [40]. **n8n Cloud**: sem plano grátis permanente (só teste); Starter **€ 20/mês (anual), 2.500 execuções**; a versão auto-hospedada é grátis mas exige servidor [41].
- **Google Sheets como ponte**: o caminho mais natural aqui. O Apps Script fica "colado" à planilha (abas `fila`, `enviados`, `respostas`, `optout`); Make/Zapier também leem Sheets, então ela vira o ponto de encontro.
- **Limitações do CRM no navegador**: (1) só executa com a aba aberta — o "relógio" fica no Apps Script ou no Make; (2) **CORS**: webhooks do Zapier aceitam o navegador se você **não** mandar `Content-Type` (ou usar `no-cors`, sem ler a resposta) [42]; do Make não achei confirmação; o n8n passou a recusar o navegador (`403 host_not_allowed`) [43]; (3) **polling**: o CRM consulta o Apps Script (GET) ao abrir e a cada poucos minutos; (4) origem `file://` quebra tudo — servir por `localhost` ou GitHub Pages.

---

## 4. Regras

**LGPD.** E-mail corporativo nominal (nome@empresa) é dado pessoal. Na prospecção B2B a base usual é o **legítimo interesse (art. 7º, IX)**; o Guia da ANPD (fev/2024) exige interesse legítimo, concreto e explícito, **teste de balanceamento** documentado (modelo no Anexo II, não vinculante) e exclui dados sensíveis [44]. Boas práticas recomendadas por escritórios: mensagem ligada ao cargo/empresa, remetente identificado, **opt-out em toda mensagem e atendido rápido**, registro da origem do contato [45]. O CAPEM (autorregulação de e-mail marketing, 2009) pede descadastro em todo e-mail, atendido em 2 dias (link) ou 5 dias úteis, e domínio próprio [46].

**Anti-spam de e-mail (Google, desde fev/2024).** Todo remetente: SPF **ou** DKIM, DNS reverso (PTR), TLS, **taxa de spam < 0,3 %** no Postmaster Tools (ideal < 0,1 %). Acima de 5.000/dia: SPF **e** DKIM, DMARC, descadastro em 1 clique [47]. Para a Próspera: domínio próprio com SPF/DKIM/DMARC, começar com **10–30 e-mails/dia** por vendedor e subir aos poucos, texto personalizado sem HTML pesado, acompanhar respostas e devoluções; pausar o modelo que não responde.

**WhatsApp.** Sem opt-in não há envio oficial; não solicitado = violação; bloqueios e denúncias derrubam a qualidade e o limite diário; marketing excessivo é cortado por usuário [20][24].

---

## 5. Recomendação

| Caminho | Custo mensal | Esforço | Risco | O que automatiza de verdade |
|---|---|---|---|---|
| **A. Claude operador + Gmail API no navegador** | R$ 0 (plano Claude já existe) | Médio: projeto Google Cloud, HTTPS/localhost, reautorizar a cada 7 dias | Médio: token vence em 1 h, nada roda com a aba fechada | Envio em 1 clique com registro automático; leitura de respostas; Claude escreve e prioriza |
| **B. Apps Script + Gmail + WhatsApp por link** | R$ 0 (ou Workspace ~R$ 30–40/usuário se quiser 1.500/dia e domínio próprio; confirmar preço) | Médio-baixo: 1 planilha + 1 script + 1 tela de configuração no CRM | Baixo | **Fila de e-mails com agendamento, follow-ups por etapa, leitura de respostas, log — mesmo com o navegador fechado**; WhatsApp continua manual via link |
| **C. API oficial WhatsApp via BSP + Apps Script/Make** | R$ 0–300 fixo (Twilio/Gupshup/Meta direto a 360dialog) + ~R$ 0,32 por marketing e ~R$ 0,035 por utilidade + Make (grátis/US$ 9) | Alto: Meta Business, verificação, número novo, modelos aprovados, webhook | Médio: custo variável, limite de 250/dia no início, qualidade | WhatsApp automático de verdade (modelos), respostas caindo no CRM |

**Eu faria primeiro o caminho B.** Custa zero, não exige verificação de app nem servidor, respeita as cotas sem truques, roda sozinho (cron) e aproveita o que o CRM já tem (modelos com variáveis, automações por etapa). O A resolve menos (nada roda com a aba fechada) com mais burocracia. O C só faz sentido quando o CRM tiver consentimento registrado para uma base real e volume acima de ~30 WhatsApps/dia; antes disso, o `wa.me` entrega o mesmo resultado sem risco. O Claude entra em B desde o dia 1 como redator e analista (lê o backup, aponta quem contatar, escreve os textos) e, se quiser, como operador assistido pelo conector.

### Passo a passo do caminho B

1. **Escolher a conta remetente.** Ideal: Google Workspace no domínio da Próspera (1.500 destinatários/dia, SPF/DKIM próprios). Com Gmail gratuito, planejar para 100/dia.
2. **Configurar SPF, DKIM e DMARC** no DNS do domínio e ativar o Postmaster Tools.
3. **Criar a planilha "Próspera CRM – Fila"** com abas `fila` (id, cliente, email, assunto, corpo, enviar_em, status), `enviados`, `respostas`, `optout`.
4. **Extensões → Apps Script** na planilha, com quatro funções: `doPost` (recebe `{segredo, acao:"enfileirar", envios:[...]}` e grava na `fila`), `doGet` (`?acao=status` ou `?acao=respostas`, devolve JSON), `processarFila()` (pega até N pendentes vencidos, envia com `GmailApp.sendEmail` com nome do vendedor e `replyTo`, marca `enviado`, respeita um teto diário) e `lerRespostas()` (`GmailApp.search("in:inbox newer_than:2d")`, casa por e-mail, grava em `respostas`). Um `segredo` simples garante que só o CRM fale com o script.
5. **Implantar → App da Web** ("executar como eu", acesso "Qualquer pessoa"); autorizar com a conta remetente; copiar a URL `/exec`.
6. **Gatilhos**: `processarFila` a cada 10 min (o script só envia em horário comercial), `lerRespostas` a cada 30 min.
7. **No CRM, aba Configurações → Integrações**: campos "URL do Apps Script" e "Segredo", botão "Testar conexão" (GET `?acao=status`).
8. **Campo de consentimento no cliente**: `consentimento = {email, whatsapp, base: "legítimo interesse" | "consentimento", origem, data}` e `optout` por canal. Sem base legal ou com opt-out, o botão de envio fica bloqueado.
9. **Fila de envios no CRM**: ao clicar "Enviar pelo Gmail", o CRM monta assunto/corpo com as variáveis, acrescenta assinatura e frase de opt-out ("Se não quiser receber, responda SAIR"), faz o `fetch` POST (texto simples) e guarda o item em `fila_envios` no localStorage como `pendente`.
10. **Histórico**: "E-mail enfileirado (modelo X)" ao enfileirar; "E-mail enviado via Gmail" quando `?acao=status` voltar `enviado`; "Resposta recebida" + tarefa "Responder" quando vier resposta. O CRM consulta o status ao abrir e a cada 5 min com a aba aberta.
11. **Automações ganham uma ação nova**: "enfileire o e-mail do modelo Y daqui a N dias" (ex.: 3 dias após entrar em Proposta, enviar "Acompanhamento"); se o cliente responder antes, cancelar o item.
12. **WhatsApp**: manter o `wa.me`, mas o botão registra "WhatsApp enviado (modelo)" no histórico; cadastrar os modelos como respostas rápidas no app; incluir a pergunta de opt-in na proposta e no cadastro.
13. **Claude como apoio semanal**: exportar o backup JSON e pedir ao Claude Code "quem contatar e com que texto"; opcionalmente ele cria os rascunhos pelo conector para o vendedor revisar.
14. **Medir após 30 dias**: respostas por modelo, devoluções, pedidos de SAIR, reclamações no Postmaster. Com base com opt-in e demanda real, abrir o caminho C por Twilio ou Gupshup (sem mensalidade) e os primeiros modelos de utilidade.

---

## Fontes

1. Gmail API – Usage limits: https://developers.google.com/workspace/gmail/api/reference/quota
2. Gmail (conta pessoal) – limites de envio: https://support.google.com/mail/answer/22839
3. Google Workspace – Gmail sending limits: https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace
4. Google Identity Services – Token model: https://developers.google.com/identity/oauth2/web/guides/use-token-model
5. Google OAuth 2.0 for client-side web apps (implicit flow): https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow
6. Gmail API – Scopes (sensíveis/restritos): https://developers.google.com/workspace/gmail/api/auth/scopes
7. Google Cloud – Manage app audience (Testing/Production): https://support.google.com/cloud/answer/15549945
8. Google Cloud – Unverified apps: https://support.google.com/cloud/answer/7454865
9. Google Cloud – OAuth app verification: https://support.google.com/cloud/answer/13464321
10. Apps Script – Installable triggers: https://developers.google.com/apps-script/guides/triggers/installable
11. Apps Script – Quotas: https://developers.google.com/apps-script/guides/services/quotas
12. Medium – Struggling with CORS in Google Apps Script: https://diyavijay.medium.com/struggling-with-cors-in-google-apps-script-heres-the-fix-e3eec09f07dd
13. Labnol – GET/POST in Apps Script: https://labnol.org/code/19871-get-post-requests-google-script
14. Google Groups – Cors issue with app script (opinião contrária): https://groups.google.com/g/google-apps-script-community/c/zJpevovcFLA
15. Claude Help – Use Google Workspace connectors: https://support.claude.com/en/articles/10166901-use-google-workspace-connectors
16. Claude – Gmail connector (lista de ferramentas): https://claude.com/connectors/gmail
17. Meta – Business phone numbers (registro): https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/registration.md
18. Meta – Business Verification: https://developers.facebook.com/docs/development/release/business-verification
19. Meta – Messaging limits: https://developers.facebook.com/docs/whatsapp/messaging-limits
20. WhatsApp – Política de Mensagens do WhatsApp Business: https://whatsappbusiness.com/pt-br/policy/
21. Meta – WhatsApp Business Platform Pricing: https://developers.facebook.com/docs/whatsapp/pricing
22. ChatMaxima – Preço da API do WhatsApp no Brasil (out/2026, blog): https://chatmaxima.com/pt-br/whatsapp-api-pricing/brazil/
23. Whautomate – WhatsApp API Pricing Brazil 2026 (blog): https://whautomate.com/whatsapp-business-api-pricing-brazil
24. Meta – Per-user marketing template message limits: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates/per-user-limits/
25. Twilio – WhatsApp pricing: https://www.twilio.com/en-us/messaging/channels/whatsapp/pricing
26. Gupshup – Fee changes to Cloud API marketing (jan/2026): https://support.gupshup.io/hc/en-us/articles/53700207494169
27. Retentionly – Gupshup pricing (blog): https://retentionly.io/post/gupshup-whatsapp-api-pricing
28. 360dialog – Pricing: https://www.360dialog.com/pricing
29. Message Central – WhatsApp providers Brazil 2026 (blog): https://www.messagecentral.com/blog/best-whatsapp-business-api-providers-brazil
30. Z-API – site e planos: https://z-api.io/
31. Z-API – Official WhatsApp API vs Z-API (2026): https://z-api.io/blog/en/official-whatsapp-api-vs-z-api-differences-costs-and-risks-in-2026/
32. Hora de Codar – Evolution API vs API oficial: https://horadecodar.com.br/evolution-api-vs-api-oficial-whatsapp/
33. TabNews – relato de banimento (fundador do WPPConnect): https://www.tabnews.com.br/Oletros/c11c08ca-890b-466d-9b15-85947904d4c1
34. WhatsApp FAQ – Como usar respostas rápidas: https://faq.whatsapp.com/2740839775981177/
35. WhatsApp Business – catálogo (até 500 itens): https://whatsappbusiness.com/resources/resource-library/whatsapp-business-app-resources-whatsapp-business-catalog/
36. Qualimero – WhatsApp Broadcast 2026 (blog): https://qualimero.com/en/blog/whatsapp-broadcast
37. WhatsApp FAQ – Business broadcasts: https://faq.whatsapp.com/1655751878365653/
38. Make – Pricing: https://www.make.com/en/pricing
39. Jetadmin – Make pricing 2026 (blog): https://www.jetadmin.io/blog/make-pricing/
40. Zapier – Pricing: https://zapier.com/pricing
41. n8n – Pricing: https://n8n.io/pricing/
42. Zapier Community – webhooks e CORS: https://community.zapier.com/code-webhooks-52/webhooks-and-squarespace-cors-error-23833
43. n8n Community – 403 host_not_allowed via browser fetch: https://community.n8n.io/t/webhook-returns-403-host-not-allowed-when-called-via-browser-fetch-since-update-to-1-123-69/308473
44. ANPD – Guia Orientativo: Legítimo Interesse (fev/2024): https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_legitimo_interesse.pdf
45. Mattos Filho – ANPD publica orientações sobre legítimo interesse: https://www.mattosfilho.com.br/unico/anpd-legitimo-interesse-lgpd/
46. Baguete – E-mail marketing terá regulamentação (CAPEM): https://www.baguete.com.br/noticias/e-mail-marketing-tera-regulamentacao
47. Google – Email sender guidelines: https://support.google.com/mail/answer/81126
