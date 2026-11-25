# Arquitetura

## Visão geral

```
┌────────────────────┐   HTTP/JSON    ┌──────────────────────┐  Webhooks HTTP  ┌───────────────────────────┐   SQL   ┌────────────┐
│ Interface web      │ ─────────────► │ Backend Node/Express │ ──────────────► │ n8n — WORKFLOW ÚNICO      │ ──────► │ PostgreSQL │
│ (HTML/CSS/JS puro) │ ◄───────────── │ app/server.js        │ ◄────────────── │ validação, regras, IA,    │ ◄────── │            │
└────────────────────┘                │ app/telegram.js      │                 │ gravação e respostas      │         └────────────┘
                                      └──────────▲───────────┘                 └───────────▲───────────────┘
                                 long polling    │                                  IMAP / SMTP│
                                       Telegram ─┘                                       Gmail ─┘
```

| Componente | Responsabilidade | Não faz |
|---|---|---|
| Interface (`app/public`) | formulários, uploads, dashboard, histórico, detalhes, tela do modelo | não acessa o banco; não calcula indicadores |
| Backend (`app/server.js`) | serve a interface; repassa requisições aos webhooks; trata erros HTTP; checa arquivo, tamanho e finalidade | não valida regras de negócio, não classifica, não roda IA |
| Conector Telegram (`app/telegram.js`) | traz mensagens (`getUpdates`) e entrega o texto devolvido pelo n8n | não interpreta mensagens |
| n8n | todo o processamento: consolidação, mapeamento, validação, classificação, IA, persistência, respostas, consultas | — |
| PostgreSQL | armazenamento central e funções SQL de gravação e consulta | não contém regras de negócio |

## O workflow único (`n8n/rodomax_hub_integrado.json`)

89 nodes (17 deles são notas), 79 conexões e **um único canvas**, sem sub-workflows. Os blocos são
separados por Sticky Notes.

### Bloco 1 — Entradas

| Canal | Nodes |
|---|---|
| Web | `Webhook Demanda Web` |
| PDF | `Webhook Upload PDF` → `Receber PDF` → `Extrair Texto do PDF` → `Ler Texto do PDF` → `Registrar Arquivo PDF` → `PDF Legível?` |
| CSV | `Webhook Upload CSV` → `Ler CSV` → `Registrar Arquivo CSV` → `Finalidade do CSV` → (erro \| base histórica \| novas demandas) |
| Telegram | `Webhook Telegram` → `Carregar Conversa Telegram` → `Interpretar Mensagem Telegram` → `Ação do Telegram` (processar \| responder \| ignorar) |
| E-mail | `Gatilho E-mail (IMAP)` → `Preparar E-mail` → `E-mail tem PDF?` (o anexo usa o mesmo extrator de PDF) |
| Testes/treino | `Execução Manual (treino + testes)` e `Webhook Treinar IA` |

### Blocos 2 a 5 — pipeline comum a todos os canais

1. **Consolidar Entrada** — monta um *envelope padrão* (`canal`, `chave_evento`, `solicitante`, `texto`,
   `campos_brutos`, `dados_originais`…) e preserva o conteúdo original.
2. **Mapear Campos** — sinônimos (`fone`→`telefone`, `frete`→`frete_ton`…) e extração de campos logísticos
   de **texto livre** com expressões regulares. Só preenche o que está escrito.
3. **Identificar Tipo de Demanda** — geral ou logística (tipo informado → 2 ou mais atributos logísticos → intenção de transporte → geral).
4. **Auditar e Validar** — `valida`, `pendente` (falta informação em canal interativo) ou `rejeitada`
   (valor inválido, conflito, linha duplicada no CSV). Cada problema vira um *motivo*.
5. **Direcionar Demanda** (Switch): Telegram incompleto → pergunta; Geral → 6A; Logística → 6B; pendente/rejeitada → registro direto.

### Bloco 6A — demandas gerais
`Normalizar Demanda Geral` (lógica da 1ª etapa) → `Classificar Setor por Regras` (palavras-chave → setor;
a lista `REGRAS` é a configuração). **Não usa IA.**

### Bloco 6B — demandas logísticas
`Normalizar Atributos Logísticos` (mesmo formato do dataset) → `Carregar Modelo Ativo` (PostgreSQL, uma vez por
execução) → `Prever Atendimento (Árvore CART)` (percorre a árvore e gera a explicação).

### Bloco 7 — PostgreSQL
`Unir Caminhos` (Merge com 3 entradas, executa uma vez mesmo se algum caminho vier vazio) → `Montar Registro`
→ `Gravar Demanda (PostgreSQL)` → `hub_registrar_demanda()` gera o protocolo `RDM-000000` e deduplica por `chave_evento`.

### Bloco 8 — respostas por canal
`Montar Resposta` gera o mesmo conteúdo para todos os canais → `Responder por Canal`:

| Canal | Entrega |
|---|---|
| Web/PDF | `Responder Web` (JSON para a tela) |
| Telegram | `Encerrar Conversa Telegram` → `Responder Telegram (resultado)` |
| E-mail | `Enviar Resposta por E-mail` (SMTP) → `Verificar Envio do E-mail` → `Registrar Envio do E-mail` |
| CSV | `Atualizar Contadores do Lote` → `Resumo do Lote CSV` → `Responder Importação CSV` |

### Bloco 9 — consultas do dashboard
`Webhook Consulta` → `Tipo de Consulta` → funções SQL (`hub_dashboard`, `hub_listar_demandas`,
`hub_detalhe_demanda`, `hub_listar_arquivos`, `hub_modelo_ativo`) → `Responder Consulta`.

### Bloco IA — treinamento
`Ler Base Histórica` → `IA 1 - Preparar Dados Históricos` → `Base Suficiente?` → `IA 2 - Treinar Árvore CART (Gini)`
→ `IA 3 - Avaliar Modelo e Linha de Base` → `Salvar Modelo Treinado` → `Responder Treinamento`.
O treino **não** roda a cada demanda: roda quando alguém clica em *Treinar modelo* ou executa o workflow manualmente.
O modelo salvo vira o **modelo ativo**, e os anteriores ficam guardados como versões inativas.

### Bloco 10 — erros e testes

| Situação | Tratamento |
|---|---|
| Dados incompletos ou inválidos | `pendente` ou `rejeitada`, com motivos; o solicitante é avisado |
| PDF sem texto ou corrompido | arquivo registrado como `sem_texto`/`erro`; resposta 422 explicando; nada inventado |
| CSV vazio, sem colunas ou com finalidade errada | arquivo registrado com `erro`; resposta 422 |
| Sem modelo treinado / falha da IA | demanda gravada com status `erro` e motivo `ERRO_IA` |
| Falha ao gravar no banco | resposta de erro técnico **sem protocolo** (nenhum protocolo falso) |
| Falha no envio de e-mail | demanda mantida; `resposta_status = nao_enviada` + motivo |
| Mesmo evento recebido de novo | `chave_evento` única: devolve o protocolo original (web: `id_requisicao`; e-mail: `Message-ID`; Telegram: `update_id`; CSV: hash do conteúdo + linha) |
| n8n fora do ar / workflow inativo | o backend responde 502/503 com mensagem clara; a interface mostra o status na barra lateral |

`Execução Manual (treino + testes)` treina o modelo e processa 6 casos de teste (`Casos de Teste`), gravados
com `ambiente = 'teste'`, que **não entram no dashboard**.

## Reaproveitamento do workflow `ultimo` (1ª etapa)

| Do `ultimo` | No HUB final |
|---|---|
| Consolidar e Extrair (leitura de remetente, "Chave: valor", CSV) | `Consolidar Entrada`, `Preparar E-mail`, `Ler Texto do PDF`, `Ler CSV` (parser agora suporta aspas e quebras de linha) |
| Mapear Campos (sinônimos, conflitos) | `Mapear Campos` + campos logísticos + extração de texto livre |
| Auditar e Validar (telefone, e-mail, data, documento, duplicidade, hash FNV) | `Auditar e Validar` + regras logísticas + pendente/rejeitada |
| Normalizar Dados | `Normalizar Demanda Geral` (igual) |
| Classificar por Regras | `Classificar Setor por Regras` (mais setores) |
| IA 2/3/4 (separação estratificada, CART Gini em JS, métricas, linha de base) | `IA 1/2/3`: agora com o **dataset real** em vez da base sintética, categorias por partição ótima, validação cruzada e teste de vazamento |
| Rotear por Setor / Notificar Setor | o setor fica gravado e é informado ao solicitante (o envio aos setores continua fora do escopo) |

**Removido, com justificativa:** `IA 1 - Gerar Base Sintética` (a professora forneceu dados reais),
`Webhook WhatsApp` (canal substituído pelo Telegram), `Consultar CRM` (endpoint fictício, sem CRM disponível)
e o formulário nativo do n8n (substituído pela aplicação web). O arquivo original está preservado em
`n8n/ultimo_original_preservado.json`, e o workflow `ultimo` no n8n não é alterado.

## Banco de dados (`database/banco_rodomax.sql`)

| Tabela | Conteúdo |
|---|---|
| `hub_demandas` | todas as demandas: protocolo, canal, tipo, status, solicitante, setor, motivos, dados originais e normalizados, situação da resposta |
| `hub_demandas_logisticas` | 1:1 com a demanda logística: os 9 atributos + previsão, frequência na folha, explicação, modelo usado |
| `hub_arquivos` | PDFs e CSVs (1 linha por arquivo = lote): finalidade, separador, cabeçalhos, contadores de registros, texto extraído |
| `hub_eventos` | linha do tempo do processamento de cada demanda/arquivo |
| `ia_historico` | base rotulada importada do CSV da professora (valores originais) |
| `ia_modelos` | árvores treinadas (JSON), parâmetros, métricas, preparação; um único ativo |
| `telegram_conversas` | estado da conversa progressiva por chat |
| `hub_registros`, `hub_pendencias` | tabelas da 1ª etapa, preservadas |

As funções `hub_*` só gravam e leem; não contêm regras de negócio. Assim, cada node PostgreSQL do workflow
executa uma única linha SQL parametrizada (`$1::jsonb`), o que evita injeção de SQL.

## Decisões técnicas

| Decisão | Motivo |
|---|---|
| Árvore em **JavaScript** dentro do n8n (não Python Native) | a árvore da 1ª versão já era JS e foi validada; o runner JS é o padrão e não depende de bibliotecas Python no container. A implementação foi conferida contra o scikit-learn (mesma matriz de confusão). |
| Modelo salvo no PostgreSQL (JSON) | treina uma vez e prevê em milissegundos; mantém o histórico de versões; dispensa servidor de ML separado |
| Conector Telegram por long polling | o Telegram não alcança `localhost`; evita túnel e alteração do container do n8n |
| IMAP/SMTP com senha de app (Gmail) | gratuito, sem projeto OAuth no Google Cloud |
| Interface sem framework e sem build | roda com `npm start` no Windows; código simples de explicar |
| Sem autenticação | escopo acadêmico (explicitamente fora do escopo) |
