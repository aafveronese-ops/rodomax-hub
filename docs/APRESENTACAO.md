# Roteiro de demonstração (até 10 minutos)

A proposta pede o protótipo funcionando, sem slides. Deixe abertas três janelas: **aplicação web**
(http://localhost:3000), **editor do n8n** com o workflow *RODOMAX HUB - Integrado* e o **Telegram** com o bot.

## Preparação (antes da aula)

- [ ] Containers `n8n`, `n8n-runners` e PostgreSQL rodando; workflow **publicado**
- [ ] `npm start` na pasta `app`; a barra lateral mostra "n8n conectado · workflow ativo"
- [ ] Base histórica importada e modelo treinado. Para mostrar a importação ao vivo, deixe só o treino para a aula.
- [ ] Arquivos à mão: `dados/rodomax_demandas.csv`, `dados/exemplos/novas_demandas_exemplo.csv`, `dados/exemplos/demanda_frete_exemplo.pdf`
- [ ] (opcional) Telegram e Gmail configurados e testados uma vez
- [ ] Rodar `node tests/teste_integracao.js` uma última vez

## Roteiro

| Tempo | O que mostrar | O que falar |
|---|---|---|
| 0:00–1:00 | **Canais** (Central) | Problema: a Rodomax recebe demandas por vários canais e quer saber cedo **quais fretes correm risco de ficar parados**. O HUB da 1ª etapa organiza; a 2ª etapa decide. Arquitetura: web → backend → **um único workflow n8n** → PostgreSQL. |
| 1:00–2:30 | **Modelo de IA**: dados e vazamento | 500 demandas reais do dataset. Mostrar a tabela `status_agendamento` × `atendida` (cancelado = 0% atendida): é **vazamento**. Com ele a árvore teria 95%, um resultado falso; por isso foi excluído. Atributo criado: frete por t·km. |
| 2:30–4:00 | **Modelo de IA**: técnica e métricas | CART com Gini: perguntas que mais reduzem a impureza. Profundidade 3 escolhida por validação cruzada só no treino. **Acurácia 83% contra 52% da linha de base**; matriz de confusão (9 riscos não detectados, 8 alarmes falsos). Mostrar a árvore: frete por km e estrada de chão. |
| 4:00–5:30 | **Solicitação de frete** ao vivo (caso novo) | Preencher: SOJA, PR → Paranaguá, 560 km, R$ 150/t, 0 km de chão, 72 h → **Tende a ser atendida** + caminho. Depois mudar o frete para **R$ 100** → **Risco**. Destacar o aviso: previsão experimental, decisão humana. |
| 5:30–6:30 | **n8n → Executions** | Abrir a execução: Webhook → Consolidar → Mapear → Identificar → Validar → Logística → Modelo → Previsão → Gravar → Responder. Mostrar o protocolo no node *Gravar Demanda*. |
| 6:30–7:30 | **Telegram** (ou e-mail) | "Preciso transportar milho do PR para Toledo" → o bot pergunta o que falta → resposta com protocolo. Depois: "Preciso da segunda via do boleto" → **Financeiro, sem IA**: o HUB é multissetorial. |
| 7:30–8:30 | **Importar CSV** (novas demandas) | 1 arquivo, 9 registros: 7 processados, 2 rejeitados (UF inválida e linha repetida). Um CSV não é "9 arquivos". |
| 8:30–9:30 | **Dashboard** e **Demandas** | Indicadores lidos do banco (mensagens ≠ arquivos ≠ registros). Abrir um protocolo: dados originais, normalizados e a linha do tempo. |
| 9:30–10:00 | Encerramento | Limitações: base pequena, uma região, sem dados de frota e safra. Riscos: profecia autorrealizável, LGPD. Próximos passos: rotular demandas do HUB, validação temporal, autenticação. |

## Plano B

| Problema | O que fazer |
|---|---|
| Telegram sem internet | mostrar a conversa pelo e-mail ou explicar com a execução gravada no n8n |
| n8n lento ou inativo | o status aparece na barra lateral; mostrar telas já carregadas e o JSON no editor |
| Modelo apagado | Importar CSV → Base histórica → Treinar modelo (menos de 5 segundos) |

## Perguntas prováveis na arguição

- **Por que árvore de decisão?** Explicável: cada previsão mostra o caminho percorrido. Lida com atributos
  categóricos e numéricos, e a base é pequena.
- **O que é o índice Gini?** `1 − Σ p²`; mede a mistura de classes no nó. A divisão escolhida é a que mais reduz esse índice.
- **Como evitaram sobreajuste?** Profundidade máxima por validação cruzada no treino, mínimo de 5 registros por folha;
  acurácia de treino 82,8% contra 83% no teste.
- **Por que não usar `status_agendamento`?** É consequência do atendimento: vazamento.
- **Por que a frequência não é probabilidade?** É a proporção suavizada da folha, sem calibração.
- **Onde o modelo roda?** Code node JavaScript no n8n; a árvore fica salva em JSON no PostgreSQL (`ia_modelos`).
- **E as demandas gerais?** Regras de palavras-chave, explicitamente **não** IA, e nunca vão para a árvore.
- **Dados pessoais?** Ficam fora do modelo; servem só para responder. Ver a seção LGPD em IA_E_AVALIACAO.md.
- **Por que um conector para o Telegram?** O Telegram não alcança `localhost`; o conector só transporta mensagens,
  e toda a lógica fica no n8n.
