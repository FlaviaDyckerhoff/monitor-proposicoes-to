# 🏛️ Monitor Proposições TO — ALETO

Monitora automaticamente a API SAPL da Assembleia Legislativa do Tocantins e envia email quando há proposições novas. Roda **4x por dia** via GitHub Actions (8h, 12h, 17h e 21h, horário de Brasília).

---

## Como funciona

1. O GitHub Actions roda o script nos horários configurados
2. O script chama a API REST pública do SAPL (`sapl.al.to.leg.br/api`)
3. Compara as proposições recebidas com as já registradas no `estado.json`
4. Se há proposições novas → envia email com a lista organizada por tipo
5. Salva o estado atualizado no repositório

---

## Estrutura do repositório

```
monitor-proposicoes-to/
├── monitor.js                      # Script principal
├── package.json                    # Dependências (só nodemailer)
├── estado.json                     # Estado salvo automaticamente pelo workflow
├── README.md                       # Este arquivo
└── .github/
    └── workflows/
        └── monitor.yml             # Workflow do GitHub Actions
```

---

## Setup — Passo a Passo

### PARTE 1 — Preparar o Gmail

**1.1** Acesse [myaccount.google.com/security](https://myaccount.google.com/security)

**1.2** Confirme que a **Verificação em duas etapas** está ativa.

**1.3** Procure por **"Senhas de app"** e clique.

**1.4** Digite um nome qualquer (ex: `monitor-aleto`) e clique em **Criar**.

**1.5** Copie a senha de **16 letras** gerada — ela só aparece uma vez.

> Se já tem App Password de outro monitor, pode reutilizar a mesma senha.

---

### PARTE 2 — Criar o repositório no GitHub

**2.1** Acesse [github.com](https://github.com) e clique em **+ → New repository**

**2.2** Preencha:
- **Repository name:** `monitor-proposicoes-to`
- **Visibility:** Private

**2.3** Clique em **Create repository**

---

### PARTE 3 — Fazer upload dos arquivos

**3.1** Na página do repositório, clique em **"uploading an existing file"**

**3.2** Faça upload de:
```
monitor.js
package.json
README.md
```
Clique em **Commit changes**.

**3.3** O `monitor.yml` precisa estar numa pasta específica. Clique em **Add file → Create new file**, digite o nome:
```
.github/workflows/monitor.yml
```
Abra o arquivo `monitor.yml`, copie todo o conteúdo e cole. Clique em **Commit changes**.

---

### PARTE 4 — Configurar os Secrets

**4.1** No repositório: **Settings → Secrets and variables → Actions**

**4.2** Clique em **New repository secret** e crie os 3 secrets:

| Name | Valor |
|------|-------|
| `EMAIL_REMETENTE` | seu Gmail (ex: seuemail@gmail.com) |
| `EMAIL_SENHA` | a senha de 16 letras do App Password (sem espaços) |
| `EMAIL_DESTINO` | email onde quer receber os alertas |

---

### PARTE 5 — Testar

**5.1** Vá em **Actions → Monitor Proposições TO → Run workflow → Run workflow**

**5.2** Aguarde ~15 segundos. Verde = funcionou.

**5.3** O **primeiro run** envia email com as 100 proposições mais recentes do ano e salva o estado. A partir do segundo run, só envia se houver proposições novas.

---

## Email recebido

O email chega organizado por tipo, com número em ordem decrescente:

```
🏛️ ALETO — 3 nova(s) proposição(ões)

Projeto de Lei da Casa — 1 proposição(ões)
  45/2026 | - | 27/03/2026 | Dispõe sobre...

Requerimento — 2 proposição(ões)
  120/2026 | - | 27/03/2026 | Requer informações...
  119/2026 | - | 27/03/2026 | Requer envio de...
```

> **Nota:** O campo Autor aparece como `-` porque a API SAPL da ALETO não retorna
> o autor inline na listagem de matérias. O nome está disponível numa chamada separada,
> mas isso dobraria o número de requisições sem ganho prático.

---

## API utilizada

```
Sistema:   SAPL Interlegis (Senado Federal)
URL base:  https://sapl.al.to.leg.br/api
Endpoint:  GET /materia/materialegislativa/
Params:    ?ano=2026&page=1&page_size=100&ordering=-id
Docs:      https://sapl.al.to.leg.br/api/schema/swagger-ui/
```

API pública, sem autenticação.

---

## Horários de execução

| Horário BRT | Cron UTC |
|-------------|----------|
| 08:00       | 0 11 * * * |
| 12:00       | 0 15 * * * |
| 17:00       | 0 20 * * * |
| 21:00       | 0 0 * * *  |

---

## Resetar o estado

Para forçar o reenvio de todas as proposições (útil para testar):

1. No repositório, clique em `estado.json` → lápis
2. Substitua o conteúdo por:
```json
{"proposicoes_vistas":[],"ultima_execucao":""}
```
3. Commit → rode o workflow manualmente

---

## Problemas comuns

**Não aparece "Senhas de app" no Google**
→ Ative a verificação em duas etapas primeiro.

**Erro "Authentication failed" no log**
→ Verifique se `EMAIL_SENHA` foi colado sem espaços.

**Workflow não aparece em Actions**
→ Confirme que o arquivo está em `.github/workflows/monitor.yml`.

**Log mostra "0 proposições encontradas"**
→ A API pode estar fora do ar. Tente acessar `https://sapl.al.to.leg.br/api/materia/materialegislativa/?ano=2026&page=1&page_size=1` no browser para confirmar.
