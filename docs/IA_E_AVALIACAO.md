# IA e avaliação — Árvore de Decisão CART (índice Gini)

Os números abaixo vêm da **execução real** do workflow no n8n 2.33.7 sobre o `rodomax_demandas.csv`.
A tela *Modelo de IA* da Central mostra os mesmos valores, lidos do banco. Como a separação treino/teste usa
semente fixa, um novo treino com o mesmo arquivo reproduz exatamente estes resultados.

## 1. Problema de negócio

**Pergunta:** *esta demanda logística vai encontrar transporte (ser atendida) ou corre o risco de ficar parada?*

**Quem usa a resposta:** a equipe de operação/logística, ao receber o pedido, para priorizar a negociação
(revisar frete, prazo, condições de acesso) das demandas com risco. A resposta é **apoio à decisão**, não
uma decisão automática.

**Técnica:** classificação supervisionada com árvore de decisão (trilha "Classificação" da proposta). Foi
escolhida porque (a) o rótulo `atendida` existe no histórico, (b) a árvore é **explicável**: cada previsão
vem com o caminho de perguntas que a produziu, o que é essencial para a equipe confiar e para a arguição, e
(c) lida com atributos numéricos e categóricos sem normalização.

## 2. Dados

`rodomax_demandas.csv`: **500 registros**, 13 colunas, **nenhum valor ausente**, `id_demanda` único, nenhuma linha duplicada.

| Coluna | Tipo | Observação |
|---|---|---|
| id_demanda | inteiro | identificador → **não usado** |
| canal | categórico (webhook, planilha, email, whatsapp) | canal histórico → **não usado** (ver §3) |
| produto | categórico (MILHO 256, SOJA 244) | usado |
| uf_origem | categórico (PR 366, MS 134) | usado |
| destino | categórico (8 cidades; Paranaguá 311) | usado |
| distancia_km | numérico (74 a 1150) | usado |
| frete_ton | numérico (R$ 16,27 a 377) | usado |
| saldo_ton | numérico (300 a 5000) | usado |
| balanca | categórico (20m, 25m, 30m, sem_restricao) | usado |
| estrada_chao_km | numérico (0 a 30) | usado |
| antecedencia_h | numérico (4 a 96) | usado |
| status_agendamento | categórico (confirmado, pendente, cancelado) | **vazamento → excluído** |
| atendida | alvo: sim 261 (52,2%) / nao 239 (47,8%) | classes quase balanceadas |

Diferenças observadas entre as classes (médias): frete/t **146,8** (sim) × **115,6** (nao);
estrada de chão **3,9 km** × **8,5 km**; antecedência **55,5 h** × **44,3 h**; a distância praticamente não difere (559 × 566 km).

## 3. Preparação

1. **Importação controlada:** o CSV entra pela interface com finalidade *Base histórica*. Cada linha é conferida
   (tipos, `atendida` ∈ {sim, nao}, `id_demanda` único) e gravada em `ia_historico` **sem alterar valores**.
   Reimportar o mesmo arquivo não duplica (chave `id_demanda`).
2. **Conferência no treino (`IA 1`):** ausentes por campo, valores negativos ou zero → excluídos e contados (0 neste dataset).
3. **Atributo derivado:** `frete_por_km = frete_ton / distancia_km` (R$ por tonelada·km). O frete absoluto
   mistura o efeito da distância; o valor por km mede se o frete é *atraente para aquela rota*. A mesma
   fórmula é aplicada nas previsões.
4. **Atributos excluídos:**
   - `id_demanda`: identificador sem significado.
   - `status_agendamento`: **vazamento de informação**. Tabela cruzada real:

     | status_agendamento | sim | nao | % atendida |
     |---|---|---|---|
     | confirmado | 241 | 12 | 95,3% |
     | pendente | 20 | 133 | 13,1% |
     | cancelado | 0 | 94 | 0,0% |

     O agendamento é *consequência* do atendimento (cancelado = nunca atendida) e não existe no momento em que a
     demanda chega. **Experimento:** a mesma árvore treinada *com* esse campo chega a **95%** de acurácia no teste,
     um resultado artificial que não se repetiria com demandas novas. Por isso o campo foi excluído.
   - `canal`: registra por onde o pedido chegou no passado (WhatsApp, planilha…), não descreve a carga, e os canais
     atuais (Telegram, Web) não existem no histórico.
5. **Categóricos:** tratados nativamente pela árvore (partição de categorias, ver §4). Não há one-hot nem escala.
6. **Separação:** treino **80% (400)** / teste **20% (100)**, **estratificada** (treino: 209 sim/191 nao; teste: 52 sim/48 nao),
   semente fixa **42**.

## 4. Implementação (CART + Gini)

Implementada em JavaScript puro nos Code nodes `IA 2` (treino) e `Prever Atendimento` (uso), sem bibliotecas.

- **Impureza de Gini:** `Gini = 1 − Σ p(classe)²`.
- **Divisões numéricas:** `atributo ≤ limiar`, com limiares nos pontos médios entre valores consecutivos.
- **Divisões categóricas:** categorias ordenadas pela proporção de "nao" e teste de cada ponto de corte
  (`destino ∈ {A, B}`). Para alvo binário, esse procedimento encontra a melhor partição (Breiman et al., 1984).
- **Escolha:** a divisão de maior **ganho de Gini** (Gini do pai − média ponderada dos filhos).
- **Parada:** profundidade máxima, menos de 10 registros no nó, menos de 5 por folha, nó puro ou nenhum ganho.
- **Profundidade por validação cruzada (5 partes, só no treino):**

  | profundidade | 2 | **3** | 4 | 5 | 6 | 7 | 8 |
  |---|---|---|---|---|---|---|---|
  | acurácia média | 75,5% | **81,7%** | 79,2% | 78,5% | 79,0% | 78,5% | 78,5% |

  Escolhida a **profundidade 3**: melhor média, e em caso de empate o critério prefere a árvore mais simples.
  O conjunto de teste não participa dessa escolha.
- **Previsão:** a demanda percorre a árvore até uma folha. A classe é a majoritária da folha, e a
  "frequência de atendimento" exibida é `(sim+1)/(n+2)` na folha (suavização de Laplace). **Não é probabilidade calibrada.**

### Árvore obtida (8 folhas)

```
frete_por_km <= 0.215                                   [n=400]
|  sim: antecedencia_h <= 72.5                          [n=136]
|  |  sim: frete_por_km <= 0.197  -> nao (70 nao / 2 sim) | -> nao (23 nao / 6 sim)
|  |  não: estrada_chao_km <= 4.5 -> nao (12 nao / 9 sim) | -> nao (13 nao / 1 sim)
|  não: estrada_chao_km <= 9.5                          [n=264]
|  |  sim: frete_por_km <= 0.2509 -> sim (63 sim / 29 nao) | -> sim (99 sim / 7 nao)
|  |  não: frete_por_km <= 0.2601 -> nao (28 nao / 6 sim) | -> sim (23 sim / 9 nao)
```

**Leitura:** frete abaixo de ~R$ 0,215 por t·km tende a não ser atendido. Acima disso, o trecho de estrada de chão
pesa: com mais de 9,5 km de chão, só um frete acima de ~R$ 0,26 por t·km compensa.

**Importância dos atributos (redução de Gini):** `frete_por_km` 81,2% · `estrada_chao_km` 16,6% ·
`antecedencia_h` 2,2% · demais 0%. Produto, UF, destino, balança, saldo e distância não foram usados por nenhuma divisão.

## 5. Linha de base

Prever **sempre a classe mais frequente do treino** ("sim", 209 de 400).

## 6. Avaliação (conjunto de teste, 100 demandas nunca vistas)

Classe positiva = **"nao"** (o risco que se quer detectar).

| Métrica | Árvore CART | Linha de base |
|---|---|---|
| **Acurácia** | **83,0%** | 52,0% |
| Precisão ("nao") | 83,0% | 0% (nunca prevê "nao") |
| Recall ("nao") | 81,3% | 0% |
| F1 ("nao") | 82,1% | 0% |
| Precisão / recall ("sim") | 83,0% / 84,6% | 52,0% / 100% |

**Matriz de confusão (árvore):**

| | previsto sim | previsto nao |
|---|---|---|
| **real sim** (52) | 44 | 8 (alarme falso) |
| **real nao** (48) | 9 (risco não detectado) | 39 |

- Acurácia no **treino**: 82,8% × teste 83,0%. Treino e teste quase iguais indicam que não houve sobreajuste.
- Ganho sobre a linha de base: **+31 p.p.** de acurácia. A linha de base não detecta nenhuma demanda em risco; a árvore detecta 81,3%.
- Com 100 demandas de teste, cada erro vale 1 p.p.; os números são **indicativos**.
- **Verificação independente:** uma árvore do scikit-learn (`DecisionTreeClassifier`, Gini, profundidade 3, mesma
  divisão, one-hot) chegou à **mesma matriz [[44, 8], [9, 39]]** (`tests/verificacao_sklearn.py`).

### Exemplos reais do teste

| id | real | previsto | frete R$/t | R$/t·km | chão km | antec. h | comentário |
|---|---|---|---|---|---|---|---|
| 1398 | sim | sim | 223,00 | 0,312 | 6 | 77 | acerto: frete alto, pouco chão |
| 1117 | sim | sim | 106,00 | 0,245 | 0 | 50 | acerto |
| 1175 | sim | **nao** | 159,00 | 0,256 | 15 | 63 | falso positivo: muito chão e frete no limite (0,2601) |
| 1005 | sim | **nao** | 142,02 | 0,159 | 0 | 89 | falso positivo: frete baixo, mas foi atendido |
| 1015 | nao | **sim** | 236,62 | 0,264 | 29 | 6 | falso negativo: antecedência de só 6 h não pesou nesse ramo |
| 1114 | nao | **sim** | 115,00 | 0,267 | 24 | 56 | falso negativo: frete bom por km, mas não atendido |

Os erros ficam perto dos limiares, ou envolvem fatores que a árvore usa pouco (antecedência curta em fretes caros).

## 7. Demonstração com caso novo

Formulário *Solicitação de frete* (sem o campo `atendida`). Casos executados durante os testes:

| Entrada | Previsão | Caminho |
|---|---|---|
| SOJA, PR → Paranaguá, 560 km, R$ 150/t, 0 km de chão, 72 h | **Tende a ser atendida** (99 de 106 na folha) | 0,2679 > 0,215 → chão 0 ≤ 9,5 → 0,2679 > 0,2509 |
| MILHO, MS → Maringá, 800 km, R$ 120/t, 20 km de chão, 12 h | **Risco de não atendimento** (70 de 72 não atendidas) | 0,15 ≤ 0,215 → 12 h ≤ 72,5 → 0,15 ≤ 0,197 |
| Telegram: MILHO, PR → Toledo, 420 km, R$ 90/t, 25m, 8 km de chão, 48 h | **Risco de não atendimento** (23 de 29) | 0,214 ≤ 0,215 → 48 ≤ 72,5 → 0,214 > 0,197 |

Toda resposta traz protocolo, caminho na árvore, fatores decisivos, avisos de extrapolação (valor fora da faixa
do treino ou destino nunca visto) e a observação de que a previsão é **experimental** e a decisão final é humana.

## 8. Atualização do modelo

O treino roda **sob demanda**: botão *Treinar modelo* (tela Modelo de IA) ou execução manual no n8n. Cada treino
cria uma nova versão em `ia_modelos` e a torna ativa; as anteriores ficam registradas. Não há retreinamento
automático. Previsões já gravadas guardam o `modelo_id` usado.

## 9. Limitações

- **Base pequena** (500 registros, 100 de teste): métricas com incerteza de alguns pontos percentuais.
- **Histórico de uma região e de dois produtos** (PR/MS, milho/soja, 8 destinos): outras rotas e produtos são extrapolação, e o sistema avisa.
- **Variáveis ausentes:** disponibilidade de caminhões, sazonalidade de safra, preço de mercado do frete, clima e
  relacionamento com o embarcador não estão no dataset.
- Uma única árvore é instável: pequenas mudanças nos dados podem mudar os limiares.
- A "frequência de atendimento" da folha não é probabilidade calibrada.
- Correlação não é causa: frete baixo está *associado* ao não atendimento, mas o modelo não prova o motivo.

## 10. Riscos e cuidados

- **Profecia autorrealizável:** se a equipe deixar de trabalhar demandas marcadas como "risco", elas de fato não
  serão atendidas. O uso correto é priorizar ajustes, nunca recusar automaticamente.
- **Vazamento:** campos que só existem depois do resultado (como `status_agendamento`) não podem entrar no modelo.
- **Desatualização:** o mercado de frete muda; o modelo precisa ser reavaliado periodicamente com dados novos e rotulados.
- **LGPD:** o modelo usa apenas atributos operacionais. Nome, e-mail, telefone e chat do Telegram são guardados só
  para responder ao solicitante, não entram na IA e não aparecem no dashboard agregado. Em produção seriam
  necessários base legal, política de retenção, controle de acesso (não há login nesta versão) e anonimização dos
  dados usados em treino.

## 11. Próximos passos para produção

1. Rotular automaticamente as demandas do HUB (atendida ou não) para ampliar a base continuamente.
2. Comparar com Random Forest ou gradient boosting e calibrar probabilidades, mantendo a explicação por atributos.
3. Validação temporal (treinar no passado, testar no futuro).
4. Monitorar a taxa de acerto real por mês e alertar quando cair.
5. Autenticação, perfis de acesso e trilha de auditoria antes de qualquer uso real.
