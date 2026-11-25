# RODOMAX HUB — recebimento, classificação e análise de demandas com IA

Projeto acadêmico da disciplina **Data Science e Inteligência Artificial** (2ª etapa).
O HUB recebe demandas por **Web, PDF, CSV, Telegram e E-mail**, separa **demandas gerais**
(classificadas por regras e encaminhadas a um setor) de **demandas logísticas** (analisadas por uma
**árvore de decisão CART/Gini** que prevê se o frete tende a ser atendido), grava tudo no
**PostgreSQL** e responde pelo canal de origem. Tudo passa por **um único workflow do n8n**.

```
Interface web ──► Backend (Node.js) ──► n8n — workflow único ──► PostgreSQL
 (navegador)        /api/...              webhooks /rodomax/...     tabelas hub_* e ia_*
Telegram ──► conector do backend ──┘      Gmail (IMAP/SMTP) ◄──► n8n
```

**Resultado da IA (execução real sobre o `rodomax_demandas.csv`, 100 demandas de teste):**
acurácia **83%** contra **52%** da linha de base (prever sempre "sim"); recall da classe "não atendida" 81,3%.
Detalhes em [docs/IA_E_AVALIACAO.md](docs/IA_E_AVALIACAO.md).

## Estrutura

| Pasta / arquivo | Conteúdo |
|---|---|
| `n8n/rodomax_hub_integrado.json` | **Workflow único final** (importar no n8n) |
| `n8n/ultimo_original_preservado.json` | Cópia intacta do workflow `ultimo` da 1ª etapa |
| `n8n/src/*.js` | Código de cada Code node, legível (o JSON é gerado por `n8n/build_workflow.js`) |
| `database/banco_rodomax.sql` | Criação/migração **não destrutiva** do banco |
| `app/` | Aplicação web: `server.js` (backend), `telegram.js` (conector), `public/` (interface) |
| `dados/rodomax_demandas.csv` | Dataset da professora (cópia sem alterações) |
| `dados/exemplos/` | CSV e PDFs de exemplo **fictícios** para demonstração |
| `tests/` | Testes de integração, interface, validação estática e verificação com scikit-learn |
| `docs/` | Configuração, arquitetura, IA, testes, roteiro de apresentação e apoio ao relatório |

## Como executar (Windows + Docker Desktop já configurados)

Nada no ambiente existente (containers `n8n`, `n8n-runners`, PostgreSQL, volume `n8n_data`) precisa ser recriado.

1. **Banco** — aplique o script no PostgreSQL que o n8n já usa (não apaga nada):
   ```powershell
   Get-Content .\database\banco_rodomax.sql | docker exec -i <container_postgres> psql -U <usuario> -d <banco>
   ```
2. **n8n** — no editor (http://localhost:5678): *Create workflow → ⋯ → Import from File* →
   `n8n/rodomax_hub_integrado.json`. Confira a credencial **Postgres account** nos nodes PostgreSQL
   e clique em **Publish** (ativar). O workflow `ultimo` continua intacto.
3. **Aplicação web** — com Node.js 18+ instalado:
   ```powershell
   .\iniciar_app.ps1
   ```
   (ou `cd app; npm install; npm start`). Abra **http://localhost:3000**.
4. **Primeira carga da IA** — na tela *Importar CSV*, envie `dados/rodomax_demandas.csv` com a
   finalidade **Base histórica** e clique em **Treinar modelo**.
5. **Telegram e E-mail (opcionais)** — siga [docs/CONFIGURACAO.md](docs/CONFIGURACAO.md).

Verificação rápida (com tudo rodando): `node tests/teste_integracao.js`

## Documentação

- [docs/CONFIGURACAO.md](docs/CONFIGURACAO.md) — banco, credenciais, Telegram, Gmail, variáveis
- [docs/ARQUITETURA.md](docs/ARQUITETURA.md) — componentes, workflow bloco a bloco, banco, decisões
- [docs/IA_E_AVALIACAO.md](docs/IA_E_AVALIACAO.md) — preparação, CART/Gini, métricas, linha de base, limitações
- [docs/TESTES.md](docs/TESTES.md) — o que foi testado, como e com qual resultado
- [docs/APRESENTACAO.md](docs/APRESENTACAO.md) — roteiro de 10 minutos
- [docs/RELATORIO_APOIO.md](docs/RELATORIO_APOIO.md) — material de apoio ao relatório individual

> Protótipo acadêmico: não é um sistema pronto para produção. As previsões são experimentais e a
> decisão final sobre qualquer frete é humana.
