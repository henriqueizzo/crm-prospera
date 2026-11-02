# Próspera CRM

CRM multi-produto da Próspera Benefícios em um único arquivo `index.html`
(React + Tailwind via CDN, sem instalação). Os dados ficam salvos no navegador
de quem usa (localStorage); não há servidor nem sincronização entre máquinas.

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
│   ├── 01-core.js        #   constantes e helpers (tarefas, contato, CSV, valor do negócio)
│   ├── 02-icons.jsx      #   ícones
│   ├── 03-modules-seed.js#   módulos nativos e dados de exemplo (demo)
│   ├── 04-storage.js     #   persistência, migração de dados antigos, regras (SLA, pontuação, automações...)
│   ├── 05-ui.jsx         #   componentes visuais compartilhados
│   ├── 06-app.jsx        #   tela raiz (estado e fluxos)
│   ├── 07-sidebar.jsx … 19-agenda.jsx   # cada tela/janela em seu arquivo
│   └── 99-mount.jsx      #   montagem do React + tela de erro
├── build.py              # Junta src/ em index.html:  python build.py
├── Gerar index.bat       # Mesmo que o build.py, com duplo clique
├── docs/CONTRATO-V3.md   # Modelo de dados e regras da v3 (base)
├── docs/CONTRATO-V4.md   # O que mudou na v4 (modelo de dados, API do core, props, fluxos)
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

Quem já usava a versão 3 não perde nada: as chaves do navegador são as mesmas e os dados ganham os campos novos
na carga (tarefas com hora/tipo, histórico tipado, campo "Receita mensal estimada" em Adquirência). Backups das
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
