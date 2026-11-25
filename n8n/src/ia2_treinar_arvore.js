// =====================================================================================
// BLOCO IA | IA 2 - TREINAR ÁRVORE DE DECISÃO (CART com índice Gini, JavaScript puro)
// (evolução do node "IA 3 - Treinar Árvore (Gini)" da versão anterior)
//
// Aprendizado supervisionado: a árvore aprende, SÓ com o conjunto de TREINO, quais perguntas
// melhor separam "atendida = sim" de "atendida = nao". Nenhuma regra é escrita à mão.
//
// Algoritmo CART (para cada nó, recursivamente):
//   1. impureza de Gini do nó:  Gini = 1 - Σ p(classe)²
//   2. testa as divisões possíveis de cada atributo:
//        numérico:   "atributo <= limiar"   (limiar = ponto médio entre valores consecutivos)
//        categórico: "atributo ∈ {grupo}"  (categorias ordenadas pela proporção de "nao";
//                     para alvo binário isso encontra a melhor partição — Breiman et al., 1984)
//   3. escolhe a divisão de maior GANHO = Gini(pai) - média ponderada dos Gini dos filhos
//   4. divide e repete; vira FOLHA ao atingir profundidade máxima, poucos registros,
//      nó puro ou nenhuma divisão com ganho.
//
// Escolha da profundidade: VALIDAÇÃO CRUZADA (5 partes) feita APENAS no treino. O conjunto
// de teste fica guardado para a avaliação final (no node seguinte).
// =====================================================================================

const PARAMETROS = {
  criterio: 'gini',
  profundidades_avaliadas: [2, 3, 4, 5, 6, 7, 8],
  min_amostras_divisao: 10,     // nó com menos registros que isso não é dividido
  min_amostras_folha: 5,        // cada folha precisa ter pelo menos isso
  ganho_minimo: 1e-6,
  folds_validacao_cruzada: 5,
  semente_folds: 7,
};

const d = $input.first().json;
const CLASSES = d.classes;               // ['sim', 'nao']
const ALVO = 'atendida';

// --------------------------- CART ---------------------------
function contarClasses(regs) { const c = { sim: 0, nao: 0 }; for (const r of regs) c[r[ALVO]]++; return c; }
function gini(c, n) { if (n === 0) return 0; let s = 0; for (const k of CLASSES) s += (c[k] / n) ** 2; return 1 - s; }
const majoritaria = (c) => (c.nao > c.sim ? 'nao' : 'sim');   // empate -> 'sim'
const testar = (r, dv) => (dv.op === '<=' ? r[dv.atributo] <= dv.valor : dv.valor.includes(r[dv.atributo]));

function melhorDivisao(regs, atributos, p) {
  const n = regs.length; const cPai = contarClasses(regs); const gPai = gini(cPai, n);
  let melhor = null;
  const avaliar = (atributo, op, valor, cEsq, nEsq) => {
    const nDir = n - nEsq;
    if (nEsq < p.min_amostras_folha || nDir < p.min_amostras_folha) return;
    const cDir = { sim: cPai.sim - cEsq.sim, nao: cPai.nao - cEsq.nao };
    const ganho = gPai - ((nEsq / n) * gini(cEsq, nEsq) + (nDir / n) * gini(cDir, nDir));
    if (ganho > p.ganho_minimo && (!melhor || ganho > melhor.ganho + 1e-12)) melhor = { atributo, op, valor, ganho };
  };
  for (const a of atributos) {
    if (a.tipo === 'num') {
      const ord = regs.slice().sort((x, y) => x[a.nome] - y[a.nome]);
      const cEsq = { sim: 0, nao: 0 };
      for (let i = 0; i < n - 1; i++) {
        cEsq[ord[i][ALVO]]++;
        const v1 = ord[i][a.nome]; const v2 = ord[i + 1][a.nome];
        if (v1 === v2) continue;
        avaliar(a.nome, '<=', Math.round(((v1 + v2) / 2) * 10000) / 10000, { ...cEsq }, i + 1);
      }
    } else {
      const porCat = {};
      for (const r of regs) { const v = r[a.nome]; porCat[v] = porCat[v] || { sim: 0, nao: 0 }; porCat[v][r[ALVO]]++; }
      const cats = Object.keys(porCat).sort((x, y) => {
        const px = porCat[x].nao / (porCat[x].sim + porCat[x].nao); const py = porCat[y].nao / (porCat[y].sim + porCat[y].nao);
        return px - py || (x < y ? -1 : 1);
      });
      const cEsq = { sim: 0, nao: 0 }; let nEsq = 0;
      for (let i = 0; i < cats.length - 1; i++) {
        cEsq.sim += porCat[cats[i]].sim; cEsq.nao += porCat[cats[i]].nao; nEsq += porCat[cats[i]].sim + porCat[cats[i]].nao;
        avaliar(a.nome, 'in', cats.slice(0, i + 1), { ...cEsq }, nEsq);
      }
    }
  }
  return melhor;
}

function construir(regs, prof, atributos, p, importancia, nTotal) {
  const n = regs.length; const c = contarClasses(regs); const g = gini(c, n);
  const folha = { tipo: 'folha', classe: majoritaria(c), n, contagem: c, gini: Math.round(g * 1000) / 1000 };
  if (prof >= p.profundidade_maxima || n < p.min_amostras_divisao || g === 0) return folha;
  const dv = melhorDivisao(regs, atributos, p);
  if (!dv) return folha;
  if (importancia) importancia[dv.atributo] += (n / nTotal) * dv.ganho;
  const esq = regs.filter((r) => testar(r, dv)); const dir = regs.filter((r) => !testar(r, dv));
  return {
    tipo: 'divisao', atributo: dv.atributo, op: dv.op, valor: dv.valor, n, contagem: c,
    gini: Math.round(g * 1000) / 1000, ganho: Math.round(dv.ganho * 10000) / 10000,
    esquerda: construir(esq, prof + 1, atributos, p, importancia, nTotal),   // condição verdadeira
    direita: construir(dir, prof + 1, atributos, p, importancia, nTotal),    // condição falsa
  };
}
function prever(no, r) { while (no.tipo === 'divisao') no = testar(r, no) ? no.esquerda : no.direita; return no.classe; }
function treinar(regs, atributos, p, importancia) { return construir(regs, 0, atributos, p, importancia, regs.length); }
const acuracia = (arv, regs) => regs.filter((r) => prever(arv, r) === r[ALVO]).length / regs.length;

// ------------------- validação cruzada (somente no treino) -------------------
function criarGerador(semente) { let a = semente >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = criarGerador(PARAMETROS.semente_folds);
const K = PARAMETROS.folds_validacao_cruzada;
const folds = Array.from({ length: K }, () => []);
for (const classe of CLASSES) {   // folds estratificados
  const grupo = d.treino.filter((r) => r[ALVO] === classe).sort((a, b) => a.id_demanda - b.id_demanda);
  for (let i = grupo.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [grupo[i], grupo[k]] = [grupo[k], grupo[i]]; }
  grupo.forEach((r, i) => folds[i % K].push(r));
}
const media = (v) => v.reduce((s, x) => s + x, 0) / v.length;
const desvio = (v) => { const m = media(v); return Math.sqrt(media(v.map((x) => (x - m) ** 2))); };
const r3 = (x) => Math.round(x * 1000) / 1000;

const validacao = PARAMETROS.profundidades_avaliadas.map((prof) => {
  const p = { ...PARAMETROS, profundidade_maxima: prof };
  const accs = folds.map((_, k) => {
    const tr = folds.filter((__, i) => i !== k).flat();
    return acuracia(treinar(tr, d.atributos, p), folds[k]);
  });
  return { profundidade_maxima: prof, acuracia_media: r3(media(accs)), desvio_padrao: r3(desvio(accs)), por_fold: accs.map(r3) };
});
// melhor média; empate (diferença < 0,005) -> a árvore MAIS RASA (mais simples de explicar)
const melhorMedia = Math.max(...validacao.map((v) => v.acuracia_media));
const escolhida = validacao.find((v) => melhorMedia - v.acuracia_media < 0.005);
const PARAMS_FINAIS = { ...PARAMETROS, profundidade_maxima: escolhida.profundidade_maxima };

// ------------------- treino final com todo o conjunto de treino -------------------
const importancia = Object.fromEntries(d.atributos.map((a) => [a.nome, 0]));
const arvore = treinar(d.treino, d.atributos, PARAMS_FINAIS, importancia);

// ------------------- experimento de VAZAMENTO (somente para documentação) -------------------
// Mesma técnica, mesmos parâmetros, mas INCLUINDO status_agendamento. Se a acurácia saltar,
// confirma que o atributo "entrega a resposta" e por isso NÃO é usado no modelo oficial.
const atributosComVazamento = [...d.atributos, { nome: 'status_agendamento', tipo: 'cat' }];
const arvoreVazamento = treinar(d.treino, atributosComVazamento, PARAMS_FINAIS);
const experimentoVazamento = {
  descricao: 'Árvore treinada INCLUINDO status_agendamento (não utilizada em produção)',
  acuracia_teste: r3(acuracia(arvoreVazamento, d.teste)),
  primeira_pergunta: arvoreVazamento.tipo === 'divisao' ? `${arvoreVazamento.atributo} ${arvoreVazamento.op} ${JSON.stringify(arvoreVazamento.valor)}` : 'folha',
};

// ------------------- resumo e texto da árvore -------------------
let nNos = 0; let nFolhas = 0; let profReal = 0;
(function percorrer(no, p) { nNos++; profReal = Math.max(profReal, p); if (no.tipo === 'folha') { nFolhas++; return; } percorrer(no.esquerda, p + 1); percorrer(no.direita, p + 1); })(arvore, 0);
const fmt = (no) => (no.op === '<=' ? `${no.atributo} <= ${no.valor}` : `${no.atributo} ∈ {${no.valor.join(', ')}}`);
const linhas = [];
(function imprimir(no, recuo) {
  if (no.tipo === 'folha') { linhas.push(`${recuo}=> atendida=${no.classe}  (n=${no.n}; sim=${no.contagem.sim}, nao=${no.contagem.nao})`); return; }
  linhas.push(`${recuo}${fmt(no)}  [n=${no.n}, gini=${no.gini}, ganho=${no.ganho}]`);
  imprimir(no.esquerda, recuo + '|  sim: '); imprimir(no.direita, recuo + '|  não: ');
})(arvore, '');
const soma = Object.values(importancia).reduce((a, b) => a + b, 0) || 1;
const importancias = Object.entries(importancia)
  .map(([atributo, v]) => ({ atributo, importancia: r3(v / soma) }))
  .sort((a, b) => b.importancia - a.importancia);

return [{ json: {
  ...d,
  modelo: {
    algoritmo: 'Árvore de Decisão CART (índice Gini) — JavaScript puro no n8n',
    parametros: PARAMS_FINAIS,
    validacao_cruzada: { folds: K, resultados: validacao, profundidade_escolhida: escolhida.profundidade_maxima,
      criterio: 'maior acurácia média nos 5 folds do TREINO; empate (< 0,5 p.p.) favorece a árvore mais rasa' },
    nos: nNos, folhas: nFolhas, profundidade_real: profReal,
    importancias,
    arvore_texto: linhas.join('\n'),
    arvore,
    experimento_vazamento: experimentoVazamento,
  },
} }];
