# Configuração manual

Tudo o que depende de credenciais ou de nomes do seu ambiente ficou para você preencher.
Nenhum token, senha ou conta foi inventado, e nada aqui exige recriar containers ou volumes.

## 1. PostgreSQL

1. Descubra o container e o banco que o n8n já usa (a credencial **Postgres account** do workflow `ultimo`
   mostra host, banco e usuário):
   ```powershell
   docker ps --format "table {{.Names}}\t{{.Image}}"
   ```
2. Aplique o script (pode ser executado mais de uma vez; não contém DROP, TRUNCATE nem DELETE):
   ```powershell
   Get-Content .\database\banco_rodomax.sql | docker exec -i <container_postgres> psql -U <usuario> -d <banco>
   ```
3. Confira:
   ```powershell
   docker exec -it <container_postgres> psql -U <usuario> -d <banco> -c "\dt"
   ```
   Devem aparecer `hub_demandas`, `hub_demandas_logisticas`, `hub_arquivos`, `hub_eventos`,
   `ia_historico`, `ia_modelos` e `telegram_conversas`, além das tabelas da 1ª etapa
   (`hub_registros`, `hub_pendencias`), que ficam **intactas**.

**Migração:** as tabelas antigas não são alteradas. As novas demandas passam a ser gravadas em `hub_demandas`;
os dados da 1ª etapa continuam consultáveis em `hub_registros`/`hub_pendencias`.

## 2. n8n (versão 2.33.7)

1. Editor → **Create workflow → ⋯ → Import from File** → `n8n/rodomax_hub_integrado.json`.
   O workflow se chama *RODOMAX HUB - Integrado (versão final)*. Não importe por cima do `ultimo`.
2. **Credencial PostgreSQL:** os nodes PostgreSQL apontam para a credencial existente
   *Postgres account* (id `xRB358Nv1hfm25RQ`, a mesma do `ultimo`). Se aparecer aviso de credencial,
   abra qualquer node PostgreSQL e selecione-a; ela precisa apontar para o banco onde o SQL foi aplicado.
3. Clique em **Publish** para ativar. Os webhooks de produção ficam em:

   | Método | URL | Uso |
   |---|---|---|
   | POST | `http://localhost:5678/webhook/rodomax/demanda` | formulários web (frete e geral) |
   | POST | `http://localhost:5678/webhook/rodomax/upload-pdf` | upload de PDF (multipart, campo `data`) |
   | POST | `http://localhost:5678/webhook/rodomax/upload-csv` | upload de CSV (JSON com o conteúdo) |
   | POST | `http://localhost:5678/webhook/rodomax/telegram` | Update do Telegram (via conector) |
   | GET | `http://localhost:5678/webhook/rodomax/consulta?tipo=...` | dashboard, demandas, demanda, arquivos, modelo |
   | POST | `http://localhost:5678/webhook/rodomax/ia/treinar` | treinar a árvore |

4. Os Code nodes usam **JavaScript** (task runner padrão). O Python Native já configurado continua
   disponível, mas não é usado por este workflow (ver ARQUITETURA.md).

> Os dois nodes de e-mail vêm **desativados** porque o n8n não ativa gatilhos sem credencial. O resto do
> workflow funciona sem eles.

## 3. Aplicação web

Requer **Node.js 18 ou superior** no Windows.

```powershell
Copy-Item .env.example .env      # ajuste se necessário
cd app
npm install
npm start                        # http://localhost:3000
```

Ou rode `.\iniciar_app.ps1`, que faz os mesmos passos.

| Variável (`.env`) | Padrão | Observação |
|---|---|---|
| `APP_PORT` | 3000 | porta da interface |
| `N8N_BASE_URL` | `http://localhost:5678` | use `http://n8n:5678` se o backend rodar em container |
| `N8N_WEBHOOK_PATH` | `/webhook` | `/webhook-test` só para depurar no editor |
| `N8N_TIMEOUT_MS` | 120000 | CSV grande pode levar alguns segundos |
| `TELEGRAM_BOT_TOKEN` | vazio | preencha para ligar o Telegram |

**Opcional: aplicação em container.** Ela entra na rede `rodomax-network` existente sem tocar nos outros containers:

```powershell
docker compose -f docker-compose.app.yml up -d --build
```

## 4. Telegram

1. No Telegram, fale com **@BotFather** → `/newbot` → escolha nome e usuário → copie o token.
2. Cole o token no `.env`: `TELEGRAM_BOT_TOKEN=...` e reinicie a aplicação (`npm start`).
   O terminal deve mostrar `Telegram: conector ativo para @seu_bot`. A tela **Canais** também mostra o status.
3. Abra o bot e envie `/start`.

**Por que existe um conector no backend?** O Telegram só entrega webhooks para URLs públicas HTTPS.
O n8n local (`localhost:5678`) não é alcançável pela internet, e torná-lo alcançável exigiria túnel e
alteração do container. O conector usa *long polling* (`getUpdates`) e repassa cada mensagem, no formato
oficial, ao webhook `/rodomax/telegram`. Conversa, validação, IA, gravação e o texto da resposta ficam no
n8n; o conector só envia ao usuário o texto que o n8n devolveu.

## 5. E-mail (Gmail gratuito)

Usa **IMAP** para receber e **SMTP** para responder, com senha de app. Não precisa de projeto no Google Cloud.

1. Use uma conta Gmail **dedicada à demonstração**.
2. Ative a verificação em duas etapas e crie uma **senha de app** (Conta Google → Segurança → Senhas de app).
3. No n8n, em **Credentials → Add**:
   - **IMAP:** usuário `seu.email@gmail.com`, senha de app, host `imap.gmail.com`, porta `993`, SSL ligado.
   - **SMTP:** usuário `seu.email@gmail.com`, senha de app, host `smtp.gmail.com`, porta `465`, SSL ligado.
4. No workflow:
   - node **Gatilho E-mail (IMAP)**: selecione a credencial IMAP e reative o node (*Deactivate/Activate* no menu do node);
   - node **Enviar Resposta por E-mail**: selecione a credencial SMTP, troque `CONFIGURAR_SEU_EMAIL@gmail.com`
     pelo endereço da conta e reative o node.
5. Clique em **Publish** de novo. O gatilho lê apenas mensagens **não lidas** da caixa de entrada e as marca como lidas.

Comportamento do canal:

- respostas automáticas (`no-reply`, `mailer-daemon`, cabeçalho `Auto-Submitted`) são ignoradas para evitar laço entre robôs;
- o primeiro anexo PDF é extraído e complementa o texto do e-mail;
- o mesmo e-mail (mesmo `Message-ID`) não gera uma segunda demanda nem uma segunda resposta;
- se o envio falhar, a demanda continua gravada, com `resposta_status = nao_enviada` e o motivo.

## 6. Portal e WhatsApp

- **Portal:** aparece apenas como canal demonstrativo, sem integração.
- **WhatsApp:** não é canal ativo nesta versão; o Telegram o substitui. O valor `whatsapp` da coluna `canal`
  do dataset é preservado como informação histórica (e não é usado pela IA).

## Checklist do que você precisa preencher

- [ ] Script SQL aplicado no banco usado pela credencial *Postgres account*
- [ ] Workflow importado, credencial PostgreSQL conferida e workflow publicado
- [ ] `.env` criado (a partir de `.env.example`)
- [ ] (opcional) `TELEGRAM_BOT_TOKEN`
- [ ] (opcional) credenciais IMAP/SMTP no n8n, endereço remetente e os dois nodes de e-mail reativados
- [ ] Base histórica importada e modelo treinado (pela interface)
