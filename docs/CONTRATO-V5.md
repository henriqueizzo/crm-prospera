# Contrato da versão 5 — Próspera CRM

Só o que mudou em relação à v4 (`CONTRATO-V4.md` continua valendo). Implementado em 02/11/2026.

## 0. Objetivo da v5

Gestão de usuários com login e senha, perfis (administrador / usuário), **abas visíveis por usuário**
(o administrador customiza) e **registro de atividades** (quem fez o quê, quando, em qual cliente),
no mesmo espírito das telas "Usuários" e "Atividade" dos sistemas Licita (LicitaProspera / LicitaFinnet),
mas sem servidor: tudo fica no `localStorage` do navegador, como o resto do CRM.

## 1. Arquivos

| Arquivo | O que faz |
|---|---|
| `01-core.js` (fim) | `USER_PERFIS`, `PERM_TABS`, `PERM_DEFAULT_USER`, `ADMIN_VIEWS`, `MAIN_VIEWS`, `userCan`, `firstAllowedView`, `userTabLabels`, SHA-256 puro (`authSha256Hex`), `authHash`/`authVerify`/`authCheck`, `ACTIVITY_TYPES`, `activityEntry`, `appendActivity`, `activityInDays`, `activitySummary`, `activityToCSV`. `VIEW_HASH` ganha `usuarios` e `atividades`. |
| `04-storage.js` (fim) | chaves `prospera_crm_users_v5`, `prospera_crm_session_v5`, `prospera_crm_activity_v5`; `hydrateUser(s)`, `load/saveUsers`, `load/saveSession`, `hydrateActivity`, `load/saveActivity`; `serializeBackup(modules, settings, { users, activity })` (version 5) e `parseBackup` devolvendo `users`/`activity` (null nos backups antigos). |
| `20-auth.jsx` | `AuthShell`, `PasswordInput`, `SetupScreen` (primeiro administrador), `LoginScreen`, `ChangePasswordModal` (`forced`), `NoAccessView`. |
| `21-users.jsx` | `UsersView`, `UserFormModal`, `ResetPasswordModal`, `PerfilBadge`, `AtivoBadge`, `UserTabsSummary`. |
| `22-activity.jsx` | `ActivityView` (período, usuário, tipo, busca, resumo por usuário, lista por dia, "Mostrar mais", CSV). |
| `06-app.jsx` | estado `users`/`session`/`activity`/`accountOpen`; `currentUser`, `can`; gate (setup → login → app); `act`/`actClient`; handlers de usuários; telas novas; props novas para Sidebar e SettingsModal. |
| `07-sidebar.jsx` | itens só se `can(aba)`; seção **Administração** (Usuários, Atividades) para administrador; rodapé com usuário logado (clique = trocar senha) + botão **Sair**. |
| `14-settings.jsx` | "Você neste CRM" (somente leitura; "quem sou eu" vem do login); backup com usuários/atividades; `patch` registra "Configurações alteradas: <aba>". |
| `02-icons.jsx` | `EyeOff`, `LogOut`, `LogIn`, `Lock`, `Key`. |
| `99-mount.jsx` | backup de emergência inclui as chaves novas. |

## 2. Modelo de dados

### 2.1 Usuário (`prospera_crm_users_v5` = array)
```
{ id, nome, login (minúsculo, único), senhaHash, salt, perfil: "admin" | "usuario", ativo: true,
  vendedorId: "" | id de settings.vendedores, abas: { dashboard, agenda, clientes, funil, relatorios, configuracoes, modulos },
  criadoEm, ultimoAcesso, trocarSenha: false }
```
- `senhaHash = authHash(senha, salt)`: SHA-256 de `salt + ":" + senha`, mais 1.499 rodadas de SHA-256(h + salt). A senha nunca é guardada.
- `abas` só vale para `perfil = "usuario"`; administrador vê tudo (`userCan` devolve true), inclusive `usuarios` e `atividades`.
- Padrão de usuário novo: Painel, Agenda, Clientes, Funil, Relatórios ligados; Configurações e Gerenciar módulos desligados.

### 2.2 Sessão (`prospera_crm_session_v5`)
`{ userId, at }` ou ausente. Usuário logado = `users.find(id === session.userId && ativo)`.

### 2.3 Atividade (`prospera_crm_activity_v5` = array, mais recente primeiro, máx. 2.000)
```
{ id, at, userId, userNome, tipo, texto (≤ 240), modId, clientId, clientNome }
```
Tipos: `acesso`, `cliente`, `etapa`, `tarefa`, `contato`, `nota`, `proposta`, `dados`, `config`, `usuarios`.
`appendActivity` ignora repetição igual (mesmo usuário, tipo, texto e cliente) em menos de 2 minutos.

### 2.4 Backup (version 5)
`{ app, version: 5, exportedAt, modules, settings, users, activity }`. Importar um backup com `users` substitui a lista,
mas mantém quem está importando (mesmo login do arquivo, ou o usuário atual é acrescentado) para ninguém ficar trancado fora.
"Restaurar dados de exemplo" apaga clientes e configurações, **não** apaga usuários nem atividades.

## 3. Fluxos no app

- **Sem usuários** → `SetupScreen`: cria o administrador (vendedor na equipe: escolhe um existente ou cria com o nome), entra e registra "Primeiro administrador criado" + "Entrou no CRM".
- **Sem sessão** → `LoginScreen` (`authCheck`): erro genérico "Login ou senha incorretos."; inativo recebe aviso próprio.
- **Entrar** (`enterAs`): `ultimoAcesso`, sessão, `settings.usuarioAtual = vendedorId` (se existir), registro "Entrou no CRM", tela inicial = primeira aba liberada.
- **`trocarSenha`** (admin redefiniu): efeito abre `ChangePasswordModal` forçado assim que o usuário está logado (também ao reabrir o CRM). Só dá para salvar a nova senha ou sair.
- **Permissões**: `goView`, hash, atalho `/`, `openSettings` e "Gerenciar módulos" respeitam `can()`. Efeito: se `view` não está liberada, vai para `firstAllowedView`. Nenhuma aba liberada → `NoAccessView`.
- **Registro**: `act(tipo, texto, ref)` usa `currentUserRef`; `actClient(modId, clientId, texto, histTipo)` deduz o tipo pela linha do tempo (`ACTIVITY_FROM_HISTORY`). `updateClientIn` registra automaticamente quando o `log` é texto (edição, tarefas, contatos, notas, itens, proposta); `commitMove`, cadastro, exclusão (e os "desfazer"), módulos, backup/planilha/exemplos/restaurar, usuários e senha registram explicitamente.
- **Usuários** (admin): não dá para desativar/excluir a si mesmo nem o último administrador ativo; login único; redefinir senha marca `trocarSenha` (exceto na própria).

## 4. Diretrizes

- Mantém tudo da v4. As chaves antigas (`prospera_crm_v2`, `prospera_crm_settings_v3`) não mudam: quem já usava só cria o administrador na primeira abertura.
- Telas de acesso usam `Logo`, `Field`, `inputCls`, `btn` e `Modal` existentes; sem `alert()`/`prompt()`.
- O login organiza e registra o uso; não é proteção contra quem tem acesso técnico ao navegador (dados e hashes ficam no `localStorage`).
- Testes: `.claude/tools/crm-prospera-test/unit-v5.js` (53 asserções) e `make-seeds.js` + `__probe.html?seed=admin|login|limitado|forcada` para capturas logadas.
