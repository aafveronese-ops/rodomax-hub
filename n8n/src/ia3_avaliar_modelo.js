// =====================================================================================
// BLOCO IA | IA 3 - AVALIAR O MODELO E MONTAR O REGISTRO  (evolução do "IA 4 - Avaliar")
// Usa o conjunto de TESTE (20%, nunca visto no treino nem na validação cruzada).
// Todas as métricas são calculadas aqui a partir das previsões; nenhum número é digitado.
//   Classe positiva = "nao" (NÃO atendida): é o risco que a operação quer detectar.
//   Precisão = dos casos apontados como "nao", quantos realmente eram "nao".
//   Recall   = dos casos que realmente eram "nao", quantos o modelo encontrou.
//   F1       = média harmônica de precisão e recall.
//   Linha de base: prever SEMPRE a classe mais frequente do TREINO.
// =====================================================================================

const d = $input.first().json;
const POS = 'nao'; const NEG = 'sim'; const ALVO = 'atendida';
const arvore = d.modelo.arvore;
const testar = (r, no) => (no.op === '<=' ? r[no.atributo] <= no.valor : no.valor.includes(r[no.atributo]));
function folhaDe(no, r) { while (no.tipo === 'divisao') no = testar(r, no) ? no.esquerda : no.direita; return no; }
const r3 = (x) => Math.round(x * 1000) / 1000;
const div = (a, b) => (b === 0 ? 0 : a / b);   // convenção: divisão por zero => 0

function metricas(reais, previstos) {
  let vp = 0; let fp = 0; let fn = 0; let vn = 0;
  reais.forEach((real, i) => {
    const p = previstos[i];
    if (real === POS && p === POS) vp++; else if (real !== POS && p === POS) fp++;
    else if (real === POS && p !== POS) fn++; else vn++;
  });
  const precisao = div(vp, vp + fp); const recall = div(vp, vp + fn);
  const precisaoSim = div(vn, vn + fn); const recallSim = div(vn, vn + fp);
  return {
    acuracia: r3(div(vp + vn, reais.length)),
    precisao: r3(precisao), recall: r3(recall), f1: r3(div(2 * precisao * recall, precisao + recall)),
    por_classe: {
      nao: { precisao: r3(precisao), recall: r3(recall), f1: r3(div(2 * precisao * recall, precisao + recall)), suporte: vp + fn },
      sim: { precisao: r3(precisaoSim), recall: r3(recallSim), f1: r3(div(2 * precisaoSim * recallSim, precisaoSim + recallSim)), suporte: vn + fp },
    },
    matriz_confusao: {
      legenda: 'linhas = classe real; colunas = classe prevista; ordem [sim, nao]',
      rotulos: [NEG, POS],
      valores: [[vn, fp], [fn, vp]],
      vn, fp, fn, vp,
    },
  };
}

// ----------------------------- avaliação -----------------------------
const cTreino = d.preparacao.treino.classes;
const classeBase = cTreino[POS] > cTreino[NEG] ? POS : NEG;
const reais = d.teste.map((r) => r[ALVO]);
const folhas = d.teste.map((r) => folhaDe(arvore, r));
const previstos = folhas.map((f) => f.classe);
const mArvore = metricas(reais, previstos);
const mBase = metricas(reais, d.teste.map(() => classeBase));
const accTreino = r3(div(d.treino.filter((r) => folhaDe(arvore, r).classe === r[ALVO]).length, d.treino.length));
const ganho = r3(mArvore.acuracia - mBase.acuracia);

const veredito = ganho > 0
  ? `A árvore superou a linha de base: acurácia ${mArvore.acuracia} contra ${mBase.acuracia} (+${r3(ganho * 100)} p.p.). A linha de base (sempre "${classeBase}") não identifica nenhuma demanda em risco (recall da classe "nao" = ${mBase.recall}); a árvore identifica ${r3(mArvore.recall * 100)}% delas.`
  : `A árvore NÃO superou a linha de base (acurácia ${mArvore.acuracia} contra ${mBase.acuracia}). Possíveis causas: base pequena, atributos pouco informativos ou ruído nos rótulos.`;

// exemplos reais de acertos e erros (para o relatório)
const ex = d.teste.map((r, i) => ({
  id_demanda: r.id_demanda, real: r[ALVO], previsto: previstos[i],
  produto: r.produto, uf_origem: r.uf_origem, destino: r.destino, distancia_km: r.distancia_km, frete_ton: r.frete_ton,
  frete_por_km: r.frete_por_km, saldo_ton: r.saldo_ton, balanca: r.balanca, estrada_chao_km: r.estrada_chao_km,
  antecedencia_h: r.antecedencia_h, folha_n: folhas[i].n, folha_sim: folhas[i].contagem.sim, folha_nao: folhas[i].contagem.nao,
}));
const exemplos = {
  acertos: ex.filter((e) => e.real === e.previsto).slice(0, 4),
  falsos_positivos: ex.filter((e) => e.real === NEG && e.previsto === POS).slice(0, 3),   // previu "nao", era "sim"
  falsos_negativos: ex.filter((e) => e.real === POS && e.previsto === NEG).slice(0, 3),   // previu "sim", era "nao"
};

const metricasFinais = {
  conjunto_avaliado: `teste: ${d.teste.length} demandas históricas nunca vistas no treino`,
  classe_positiva: 'nao (não atendida)',
  arvore: mArvore,
  linha_base: { regra: `prever sempre "${classeBase}" (classe mais frequente no treino)`, classe: classeBase, ...mBase },
  acuracia_treino: accTreino,
  diferenca_treino_teste: r3(accTreino - mArvore.acuracia),
  ganho_sobre_linha_base: ganho,
  superou_linha_base: ganho > 0,
  veredito,
  observacao: `Com ${d.teste.length} demandas de teste, cada erro altera a acurácia em ~${r3(100 / d.teste.length)} p.p.: os números são indicativos, não definitivos.`,
  validacao_cruzada: d.modelo.validacao_cruzada,
  experimento_vazamento: d.modelo.experimento_vazamento,
  exemplos,
};

const agora = new Date();
const versao = `cart-gini-${agora.toISOString().slice(0, 19).replace(/[-:T]/g, '')}`;

return [{ json: {
  registro_modelo: {
    versao,
    algoritmo: d.modelo.algoritmo,
    parametros: d.modelo.parametros,
    atributos: d.atributos,
    arvore,
    arvore_texto: d.modelo.arvore_texto,
    importancias: d.modelo.importancias,
    metricas: { ...metricasFinais, estrutura: { nos: d.modelo.nos, folhas: d.modelo.folhas, profundidade_real: d.modelo.profundidade_real } },
    preparacao: d.preparacao,
    n_treino: d.treino.length,
    n_teste: d.teste.length,
  },
  resumo: {
    versao,
    registros: d.preparacao.registros_utilizados,
    treino: d.treino.length, teste: d.teste.length,
    profundidade: d.modelo.parametros.profundidade_maxima,
    folhas: d.modelo.folhas,
    acuracia: mArvore.acuracia, precisao_nao: mArvore.precisao, recall_nao: mArvore.recall, f1_nao: mArvore.f1,
    acuracia_linha_base: mBase.acuracia,
    acuracia_com_vazamento: d.modelo.experimento_vazamento.acuracia_teste,
    veredito,
  },
} }];
