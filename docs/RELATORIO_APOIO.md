# Material de apoio ao relatório individual

> Este documento organiza fatos e resultados **reais** do projeto para apoiar o relatório. O relatório é
> **individual**: cada integrante deve escrever com as próprias palavras, revisar o que está aqui e preencher
> as seções marcadas com ✍️. Nada sobre participação individual foi inventado.

**Disciplina:** Data Science e Inteligência Artificial · **Etapa:** 2ª · **Projeto:** Rodomax HUB
**Link do código:** ✍️ (GitHub ou Colab)

## 1. Problema de negócio e justificativa da técnica

- **Decisão apoiada:** identificar, no momento em que a demanda chega, se o frete tende a ser atendido ou corre
  risco de ficar parado, para a equipe priorizar ajustes (frete, prazo, rota).
- **Usuário da resposta:** equipe de operação/logística da Rodomax.
- **Técnica:** classificação supervisionada com **árvore de decisão CART (índice Gini)**, implementada no próprio
  workflow do n8n. Justificativa: há rótulo histórico (`atendida`); o modelo é explicável (caminho de perguntas);
  aceita atributos categóricos e numéricos; é adequado a uma base pequena. Trilha da proposta: "Classificação" (aulas 10 a 12).

## 2. Dados utilizados e preparação

- Base: `rodomax_demandas.csv` fornecida pela professora: 500 registros, 13 colunas, sem ausentes nem duplicatas;
  classes sim 261 (52,2%) e nao 239 (47,8%).
- Atributos usados: produto, uf_origem, destino, balanca, distancia_km, frete_ton, saldo_ton, estrada_chao_km,
  antecedencia_h e o derivado **frete_por_km = frete_ton / distancia_km**.
- Excluídos: `id_demanda` (identificador), `status_agendamento` (**vazamento**: cancelado = 0% atendida; com ele a
  acurácia iria a 95%, de forma artificial), `canal` (canal histórico; não descreve a carga).
- Separação estratificada 80/20 com semente 42 (400 treino / 100 teste). Profundidade escolhida por validação
  cruzada de 5 partes **apenas no treino**.

## 3. Resultados

| Métrica (teste, classe positiva "nao") | Árvore | Linha de base (sempre "sim") |
|---|---|---|
| Acurácia | **0,830** | 0,520 |
| Precisão | 0,830 | 0 |
| Recall | 0,813 | 0 |
| F1 | 0,821 | 0 |

Matriz de confusão (linhas = real, colunas = previsto, ordem sim/nao): **[[44, 8], [9, 39]]**.
Acurácia no treino: 0,828. Conferido com o scikit-learn (mesma matriz).

Atributos mais importantes: frete_por_km (81%), estrada_chao_km (17%), antecedencia_h (2%).

**Exemplos de acerto:** id 1398 (frete R$ 223/t, 0,31 por t·km, 6 km de chão → atendida, previsto atendida).
**Exemplos de erro:** id 1015 (frete alto, 0,264 por t·km, 29 km de chão, **6 h** de antecedência → previsto
atendida, real não atendida); id 1005 (frete baixo 0,159 → previsto não atendida, real atendida).
Mais exemplos na tela *Modelo de IA* e em IA_E_AVALIACAO.md.

## 4. Demonstração com caso novo

Frete SOJA, PR → Paranaguá, 560 km, R$ 150/t, 2.500 t, balança 25m, 0 km de chão, 72 h:
**"Tende a ser atendida"**: 99 de 106 demandas semelhantes do histórico foram atendidas. Caminho:
frete_por_km 0,268 > 0,215 → chão 0 ≤ 9,5 → 0,268 > 0,251.
Mesmo pedido com MILHO, MS → Maringá, 800 km, R$ 120/t, 20 km de chão, 12 h: **"Risco de não ser atendida"** (70 de 72).
✍️ Inserir captura de tela da demonstração.

## 5. Limitações, riscos e LGPD

- Base pequena e regional (PR/MS, milho/soja, 8 destinos); faltam variáveis de frota, safra e mercado.
- A frequência da folha não é probabilidade calibrada; uma única árvore é instável.
- Risco de **profecia autorrealizável** se o alerta for usado para recusar demandas; o uso correto é priorizar.
- **LGPD:** dados pessoais (nome, e-mail, telefone, chat) ficam fora do modelo e servem só para responder ao
  solicitante. Em produção: base legal, retenção, controle de acesso e anonimização dos dados de treino.

## 6. Próximos passos para produção no HUB

Rotular as demandas reais do HUB após o desfecho; validação temporal; comparar com ensembles; monitorar o
desempenho mensal; autenticação e auditoria.

## 7. Declaração de uso de IA generativa (revisar e ajustar)

> ✍️ *Modelo para revisão:* "Utilizamos ferramenta de IA generativa (Claude, da Anthropic) como apoio no
> desenvolvimento do código do workflow n8n, da aplicação web, dos scripts SQL e da documentação. Todo o código
> foi revisado, executado e testado pelo grupo, que é capaz de explicar cada componente e decisão. Os resultados
> numéricos apresentados foram obtidos da execução real do sistema sobre o dataset fornecido."
>
> Ajustem o texto para refletir **exatamente** como cada integrante usou a ferramenta.

## 8. Participação individual e autoavaliação

✍️ **Funções exercidas** (ex.: banco de dados, workflow n8n, IA, interface, testes, documentação, apresentação):

✍️ **O que aprendi / dificuldades:**

✍️ **Autoavaliação:**

## 9. Referências

- BREIMAN, L.; FRIEDMAN, J.; OLSHEN, R.; STONE, C. *Classification and Regression Trees*. Wadsworth, 1984.
- Documentação do n8n: https://docs.n8n.io
- Documentação do PostgreSQL: https://www.postgresql.org/docs/
- scikit-learn, `DecisionTreeClassifier` (usado apenas para verificação cruzada): https://scikit-learn.org
- Telegram Bot API: https://core.telegram.org/bots/api
- Material das aulas 10 a 12 da disciplina. ✍️
