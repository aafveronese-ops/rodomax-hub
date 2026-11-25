# Testes realizados

## Ambiente em que os testes rodaram

Os testes foram executados em um **ambiente Linux de desenvolvimento**, e não no Windows/Docker da equipe:

| Item | Versão usada nos testes | Ambiente da equipe |
|---|---|---|
| n8n | **2.33.7** (mesma versão), instalado via npm, task runner JavaScript interno | 2.33.7 em Docker com `n8n-runners` |
| PostgreSQL | 16.15 | container existente (versão não informada) |
| Node.js (backend) | 22 | Node 18+ no Windows |
| Navegador | Chromium (Playwright) | qualquer navegador moderno |

O workflow testado é **exatamente** o arquivo entregue (`n8n/rodomax_hub_integrado.json`), importado e publicado
pela CLI do n8n. Ainda é preciso repetir a verificação no ambiente Docker da equipe:
`node tests/teste_integracao.js` faz isso em cerca de 1 minuto.

## Situação de cada parte

| Parte | Situação |
|---|---|
| Banco (`banco_rodomax.sql`) | **Testado localmente**: aplicado 2× sobre um banco com as tabelas antigas preenchidas (dados preservados) e 1× em banco vazio |
| Workflow — web, PDF, CSV, consultas, treino, IA | **Testado localmente** no n8n 2.33.7 com PostgreSQL |
| Workflow — Telegram | **Testado localmente** via webhook (formato oficial de Update) e via conector do backend com uma **API do Telegram simulada**. **Não testado com um bot real** (depende de token) |
| Workflow — E-mail | **Testado localmente** com uma *variante de teste* que troca o gatilho IMAP por um webhook com o mesmo formato de dados e um **servidor SMTP local real**. **Não testado com Gmail** (depende de credenciais) |
| Backend | **Testado localmente** (todas as rotas, erros 400/404/422/502) |
| Interface | **Testada localmente** com Playwright (desktop 1440 px e celular 390 px) |
| IA | **Testada localmente** e **conferida com scikit-learn** |
| Execução manual no editor | **Testada** via `n8n execute` (treino + 6 casos de teste) |
| Ambiente Docker da equipe | **Pendente** de execução pela equipe |

## 1. Validação estática do workflow — `node tests/validar_workflow.js`

Resultado: **todas as verificações OK**. Um único workflow (89 nodes, 79 conexões, nenhum sub-workflow);
nomes e IDs únicos; todas as conexões apontam para nodes existentes; os **24 Code nodes compilam**; nenhum
token ou senha no JSON; 6 webhooks sem conflito de rota; somente os 2 nodes de e-mail vêm desativados.

## 2. Banco de dados

| Cenário | Resultado |
|---|---|
| Script aplicado sobre banco com `hub_registros` contendo um registro antigo | tabela e registro preservados; 7 tabelas novas criadas |
| Script aplicado novamente (idempotência) | sem erros (apenas avisos "already exists") |
| Banco vazio | 9 tabelas; `hub_registrar_demanda` gerou `RDM-000001` |
| Busca por `DROP`, `TRUNCATE`, `DELETE` no script | nenhuma ocorrência executável |

## 3. Integração ponta a ponta — `node tests/teste_integracao.js`

Executado com backend + n8n + PostgreSQL rodando. **17 de 17 verificações OK**:

| # | Cenário | Resultado obtido |
|---|---|---|
| 1 | Backend alcança o n8n e o workflow está ativo | OK |
| 2 | Importar `rodomax_demandas.csv` como base histórica | 500 válidas; na reimportação, 0 novas e 500 já existentes |
| 3 | Treinar modelo | acurácia 0,83 × linha de base 0,52 |
| 4 | Frete completo pela web | protocolo `RDM-0000xx` + previsão |
| 5 | Reenvio do mesmo pedido (mesmo `id_requisicao`) | mesmo protocolo, `duplicado: true` |
| 6 | Demanda geral "segunda via do boleto" | setor Financeiro, **sem** previsão de IA |
| 7 | Frete só com produto | `pendente`, com a lista do que falta |
| 8 | Frete com UF "ZZ" e balança "99m" | `rejeitada`, com motivos |
| 9 | PDF de frete | protocolo, tipo logística, previsão |
| 10 | PDF sem texto (só imagem) | HTTP 422, `sem_texto`, nenhuma demanda criada |
| 11 | CSV de novas demandas (9 linhas) | 1 arquivo, 9 registros; reenvio do mesmo arquivo → 9 já existentes, nenhuma duplicata |
| 12 | CSV sem `atendida` enviado como base histórica | recusado (HTTP 422) com explicação |
| 13–14 | Conversa no Telegram | bot pede a distância; após as respostas, protocolo + previsão "EXPERIMENTAL" |
| 15–17 | Dashboard, lista filtrada e detalhe do protocolo | dados reais; histórico com ≥ 3 eventos |

### Cenários adicionais executados manualmente (curl)

| Cenário | Resultado obtido |
|---|---|
| CSV `novas_demandas_exemplo.csv`: 5 fretes, 2 gerais, 1 inválido, 1 linha repetida | 7 processadas (3 previsões "sim", 2 "nao", 2 gerais → Comercial e Operacional), 2 rejeitadas (UF/balança inválidas; linha duplicada) |
| Conversa Telegram com valor inválido ("40m" para balança) | bot explica o erro e pergunta de novo; demais dados preservados |
| Mesmo `update_id` do Telegram reenviado | ignorado (sem resposta duplicada) |
| `/start`, saudação "oi" | mensagem de boas-vindas, sem criar demanda |
| E-mail com pedido de frete em texto livre | campos extraídos do texto → previsão; **resposta recebida no servidor SMTP local** |
| E-mail com PDF anexado | texto do PDF extraído; arquivo registrado como canal e-mail; previsão gerada |
| E-mail de `no-reply@` | ignorado (sem demanda e sem resposta) |
| Mesmo `Message-ID` reenviado | mesmo protocolo |
| E-mail "Preciso de frete para milho saindo do MS" | `pendente`; resposta lista os dados faltantes |
| SMTP fora do ar | demanda gravada; `resposta_status = nao_enviada` ("connect ECONNREFUSED") |
| Nenhum modelo ativo | demanda gravada com status `erro` e motivo "Nenhum modelo de IA treinado" |
| Função de gravação indisponível (simulação de falha do banco) | resposta "erro técnico", **sem protocolo** |
| `consulta?tipo=xyz` | HTTP 400 com explicação |
| Execução manual (`n8n execute`) | modelo treinado + 6 casos de teste: 2 gerais (Financeiro, Administrativo), 2 fretes com previsão (sim/nao), 1 pendente, 1 rejeitado; ambiente `teste`, fora do dashboard |

## 4. Interface — `node tests/teste_interface.js`

Playwright/Chromium. **24 de 24 verificações OK**: as 10 telas renderizam; validação do formulário de frete
(8+ campos obrigatórios marcados); envio de frete com protocolo e previsão; consulta de protocolo com histórico;
demanda geral → Financeiro; upload de PDF; PDF sem texto informado; importação de CSV com resumo do lote;
filtro + gaveta de detalhes; matriz de confusão na tela do modelo; **sem rolagem horizontal em 390 px**
(dashboard, frete, modelo); **nenhum erro de console**.

Problema encontrado e corrigido durante os testes: trocar de tela antes de uma consulta terminar fazia a resposta
antiga sobrescrever a tela nova. Foi resolvido com um token de navegação.

## 5. IA

| Verificação | Resultado |
|---|---|
| Treino offline (`tests/harness_ia.js`) × treino no n8n | métricas idênticas (0,83 / 0,83 / 0,813 / 0,821) |
| scikit-learn, mesma divisão, profundidade 3 (`tests/verificacao_sklearn.py`) | acurácia 0,830, matriz **[[44, 8], [9, 39]]**, idêntica à da implementação própria |
| Reprodutibilidade | dois treinos com a mesma base → mesma árvore e mesmas métricas |
| Linha de base | 0,52 (sempre "sim") |
| Experimento com `status_agendamento` | 0,95: vazamento confirmado e atributo excluído |

## 6. Problemas encontrados e corrigidos durante os testes

- Arrays passados como parâmetro do node PostgreSQL viravam `text[]` → todos os parâmetros JSON agora usam `JSON.stringify`.
- Filtro "tipo" conflitava com o parâmetro `tipo` da consulta → renomeado para `tipo_demanda`.
- Contadores do dashboard somavam registros de CSV histórico com CSV de demandas → separados.
- CSV reenviado gerava demandas duplicadas → chave do evento passou a usar o hash do conteúdo.
- E-mail repetido gerava nova resposta → o envio é pulado para duplicatas.

## O que a equipe ainda precisa verificar no próprio ambiente

1. Aplicar o SQL no PostgreSQL do Docker e publicar o workflow; rodar `node tests/teste_integracao.js`.
2. Telegram com bot real: `/start` e uma conversa de frete completa.
3. Gmail: enviar um e-mail para a conta configurada e conferir a resposta.
