# Próspera CRM

CRM multi-produto da Próspera Benefícios em um único arquivo `index.html`
(React + Tailwind via CDN, sem instalação). Os dados ficam salvos no navegador
de quem usa (localStorage); não há servidor nem sincronização entre máquinas.

## Novidades da versão 5 (02/11/2026) — usuários, abas por pessoa e atividades

- **Login**: no primeiro acesso o CRM pede para criar o **primeiro administrador** (nome, login e senha). Depois,
  toda abertura passa pela tela de login. "Sair" fica no rodapé da barra lateral; clicar no próprio nome troca a senha.
- **Usuários** (só administrador): criar, editar, redefinir senha (a pessoa troca no próximo acesso), desativar/reativar e
  excluir. Perfis: **Administrador** (vê tudo, inclusive Usuários e Atividades) e **Usuário**.
- **Abas por usuário**: para cada usuário o administrador liga/desliga Painel, Agenda, Clientes, Funil de vendas,
  Relatórios, Configurações e backup e Gerenciar módulos. O que está desligado some do menu; links diretos (#funil)
  caem na primeira aba liberada.
- **Atividades** (só administrador): registro de tudo o que cada pessoa fez (entrou/saiu, clientes cadastrados/editados/
  excluídos, etapas, tarefas, contatos, notas, propostas, backup/planilhas, configurações e gestão de usuários), com
  resumo por usuário, filtros por período/usuário/tipo, busca e exportação CSV. Guarda os últimos 2.000 registros.
- Cada usuário é ligado a um **vendedor da equipe** (criado automaticamente com o mesmo nome, se você não escolher um
  existente): ao entrar, ele vira o "quem sou eu" (responsável padrão, autor das notas, filtro "Só meus").
- O **backup** passa a levar usuários (senhas guardadas só como hash com sal, nunca em texto) e o registro de atividades.
  Backups das versões 2, 3 e 4 continuam importáveis (sem usuários: os atuais são mantidos).
- Importante: como tudo fica no navegador, os usuários valem **por navegador**. Para o time usar em outra máquina,
  exporte o backup e importe lá. O login organiza o uso e registra quem fez o quê; não é uma proteção contra alguém
  com acesso técnico ao computador.

## O que tem (versão 4 — 29/10/2026)

**Telas**
- **Painel**: primeiros passos (checklist de onboarding), aviso de dados de exemplo com "Remover exemplos",
  indicadores, funil por etapa, tarefas de TODOS os módulos (atrasadas / hoje / 7 dias) com concluir e "+1 dia",
  chip "Só meus", clientes parados na etapa, quem contatar primeiro (pontuação), metas do mês por vendedor.
- **Agenda** (nova): todas as tarefas pendentes de todos os módulos, agrupadas em Atrasadas / Hoje / Amanhã /
  Próximos 7 dias / Depois / Sem data; filtro por tipo (ligação, WhatsApp, e-mail, reunião); concluir, adiar
  (+1 dia / +1 semana) e abrir o cliente; "Concluídas hoje".
- **Clientes**: tabela com empresa, etapa, prioridade, **próxima tarefa** (ou alerta "Sem próximo passo"), valor
  e ações rápidas (WhatsApp / ligar / e-mail / mover etapa). Ordenação, busca, filtro por etapa e responsável,
  botão "Exportar esta lista" (CSV). No celular vira uma lista compacta, sem rolagem lateral.
- **Funil de vendas**: Kanban; arraste os cards ou use o botão **Mover** (funciona no toque e no teclado).
  Cards mostram próxima tarefa, parados, prioridade, responsável, motivo da perda e atalhos de contato.
- **Relatórios**: conversão por etapa, tempo médio em cada etapa, ciclo médio de venda, motivos de perda,
  origem dos clientes, desempenho por vendedor e prioridade da carteira. Período = data de cadastro.
- **Ficha do cliente**: abas Resumo / Itens / Tarefas / Notas. Resumo tem perfil editável no lugar (origem,
  responsável, porte, interesse), botões WhatsApp / Ligar / E-mail (registram no histórico), **Registrar contato**
  (canal × resultado + próximo passo), mensagens prontas, proposta para imprimir/PDF e uma **linha do tempo única**
  (notas + histórico + etapas). Tarefas têm data, **hora e tipo**, podem ser editadas, adiadas e desfeitas.

**Regras do funil**
- **Prazo por etapa (SLA)**: amarelo perto do prazo, vermelho ("parado") quando passa. Contado em dias de calendário.
- **Campos obrigatórios por etapa**: ao mover (inclusive ao cadastrar já em outra etapa), o CRM avisa o que falta.
- **Motivo da perda** obrigatório ao marcar como perdido; vira relatório.
- **Próximo passo**: ao concluir a última tarefa de um lead/negociação, o CRM pergunta qual é o próximo passo.
  Cliente aberto sem tarefa pendente ganha o alerta "Sem próximo passo".
- **Desfazer** ao mover etapa e ao remover nota, item ou tarefa.
- **Aviso de duplicado** ao cadastrar; **pontuação do lead** (Alta / Média / Baixa); **automações** "quando X, crie tarefas".
- **Valor do negócio**: cada módulo diz qual campo em R$ é o valor (em Adquirência é a **receita mensal estimada**,
  não o TPV). Cliente fechado conta só os itens contratados.

**Configurações**: equipe e metas (remover vendedor avisa quantos clientes usam), prazos e campos obrigatórios,
motivos de perda, origens, automações, modelos de mensagem, pesos da pontuação, backup (JSON), **importar
planilha CSV** (com mapeamento de colunas e prévia), exportar CSV, remover exemplos e restaurar exemplo.

**Proteções**: se o navegador não conseguir salvar, a barra lateral avisa e oferece exportar backup; se os dados
salvos estiverem ilegíveis, uma cópia bruta é guardada antes de voltar ao padrão; lembrete de backup a cada 7 dias;
tela amigável com "Exportar backup" se algo quebrar; `Esc` enquanto digita só tira o foco (o segundo fecha).

Atalhos: `/` busca, `n` novo cliente, `Esc` fecha, `Enter` salva. Links diretos: `#painel`, `#agenda`, `#clientes`,
`#funil`, `#relatorios`.

## Conteúdo do projeto

```
.
├── index.html            # O CRM completo, GERADO a partir de src/ (não edite direto)
├── src/                  # Código-fonte dividido em módulos (edite aqui)
│   ├── _head.html        #   <head>, Tailwind config e CSS
│   ├── 01-core.js        #   constantes e helpers (tarefas, contato, CSV, valor do negócio, perfis/abas, hash de senha, atividades)
│   ├── 02-icons.jsx      #   ícones
│   ├── 03-modules-seed.js#   módulos nativos e dados de exemplo (demo)
│   ├── 04-storage.js     #   persistência (clientes, configurações, usuários, sessão, atividades), migração, regras
│   ├── 05-ui.jsx         #   componentes visuais compartilhados
│   ├── 06-app.jsx        #   tela raiz (estado, login, permissões, fluxos e registro de atividades)
│   ├── 07-sidebar.jsx … 19-agenda.jsx   # cada tela/janela em seu arquivo
│   ├── 20-auth.jsx       #   primeiro acesso, login, trocar senha
│   ├── 21-users.jsx      #   tela Usuários (formulário com abas por usuário, redefinir senha)
│   ├── 22-activity.jsx   #   tela Atividades
│   └── 99-mount.jsx      #   montagem do React + tela de erro
├── build.py              # Junta src/ em index.html:  python build.py
├── Gerar index.bat       # Mesmo que o build.py, com duplo clique
├── docs/CONTRATO-V3.md   # Modelo de dados e regras da v3 (base)
├── docs/CONTRATO-V4.md   # O que mudou na v4 (modelo de dados, API do core, props, fluxos)
├── docs/CONTRATO-V5.md   # O que mudou na v5 (usuários, permissões por aba, atividades)
├── docs/ESTUDO-INTEGRACAO-GMAIL-WHATSAPP.md   # Estudo de 28/10/2026 sobre automatizar e-mail e WhatsApp
├── assets/logo.png       # Logo da Próspera
├── backup/               # Versões anteriores (v1, v2 e v3)
└── README.md
```

## Como editar

1. Altere os arquivos em `src/`.
2. Rode `python build.py` (ou dê duplo clique em `Gerar index.bat`).
3. Abra `index.html` no navegador.

`python build.py --check` diz se o `index.html` está atualizado em relação a `src/`.

## Rodar localmente

Basta abrir `index.html` no navegador. Para servir por HTTP (recomendado):

```bash
python -m http.server 8000
# depois acesse http://localhost:8000
```

## Dados antigos

Quem já usava as versões 3 ou 4 não perde nada: as chaves do navegador são as mesmas e os dados ganham os campos novos
na carga. Na primeira abertura da v5 o CRM só pede para criar o administrador; os clientes continuam lá. Backups das
versões 2, 3 e 4 continuam importáveis. Em Adquirência, os itens antigos ficam com receita 0 até serem preenchidos.

## Site publicado

O CRM está no ar em **https://henriqueizzo.github.io/crm-prospera/** (GitHub Pages, repositório
`henriqueizzo/crm-prospera`, branch `main`, pasta raiz). Esta pasta é o clone desse repositório.

Para publicar uma alteração:

```bash
python build.py
git add .
git commit -m "descreva o que mudou"
git push
```

Em cerca de um minuto o site é atualizado sozinho. Lembre: os dados continuam no navegador de cada
pessoa; publicar o site não compartilha clientes entre máquinas.
