// =====================================================================================
// BLOCO 6B | PREVER ATENDIMENTO (ÁRVORE CART TREINADA)
// Usa o modelo ATIVO salvo no PostgreSQL (tabela ia_modelos), carregado pelo node anterior.
// Para cada demanda logística:
//   1. calcula o atributo derivado frete_por_km (mesma fórmula do treino);
//   2. percorre a árvore pergunta a pergunta até uma folha (caminho de decisão);
//   3. devolve a classe da folha (sim/nao), a frequência suavizada da folha e a explicação.
// A previsão é EXPERIMENTAL: apoio à decisão, não garantia de contratação/atendimento.
// Sem modelo treinado -> a demanda é registrada com status "erro" (falha técnica da IA).
// =====================================================================================

const modelo = $input.first().json;                                  // linha de ia_modelos (ou vazio)
const demandas = $('Normalizar Atributos Logísticos').all();
const AVISO = 'Previsão experimental gerada por árvore de decisão treinada com o histórico de 500 demandas. Não é garantia de contratação nem de execução do frete; a decisão final é da equipe de operação.';

const ROTULO = {
  produto: 'Produto', uf_origem: 'UF de origem', destino: 'Destino', balanca: 'Balança', distancia_km: 'Distância (km)',
  frete_ton: 'Frete (R$/t)', saldo_ton: 'Saldo (t)', estrada_chao_km: 'Estrada de chão (km)', antecedencia_h: 'Antecedência (h)',
  frete_por_km: 'Frete por t·km (R$)',
};
const fmtNum = (v) => (typeof v === 'number' ? (Math.round(v * 10000) / 10000).toString().replace('.', ',') : String(v));
const testar = (r, no) => (no.op === '<=' ? r[no.atributo] <= no.valor : no.valor.includes(r[no.atributo]));

function percorrer(arvore, r) {
  const caminho = []; let no = arvore;
  while (no.tipo === 'divisao') {
    const ok = testar(r, no);
    const pergunta = no.op === '<=' ? `${ROTULO[no.atributo] || no.atributo} ≤ ${fmtNum(no.valor)}?` : `${ROTULO[no.atributo] || no.atributo} ∈ {${no.valor.join(', ')}}?`;
    caminho.push({ atributo: no.atributo, pergunta, valor_da_demanda: r[no.atributo], resposta: ok ? 'sim' : 'não' });
    no = ok ? no.esquerda : no.direita;
  }
  return { folha: no, caminho };
}

return demandas.map((item, idx) => {
  const j = item.json;
  if (!modelo || !modelo.arvore) {
    return { json: { ...j, previsao: null, erro_ia: 'Nenhum modelo de IA treinado. Treine o modelo na Central de Controle (Modelo de IA).',
      eventos: [...j.eventos, { etapa: 'ia', detalhe: 'Falha: nenhum modelo ativo no banco' }] }, pairedItem: { item: 0 } };
  }
  try {
    const r = { ...j.atributos_ia };
    r.frete_por_km = Math.round((r.frete_ton / r.distancia_km) * 10000) / 10000;   // igual ao IA 1

    const { folha, caminho } = percorrer(modelo.arvore, r);
    const probSim = Math.round(((folha.contagem.sim + 1) / (folha.n + 2)) * 1000) / 1000;   // suavização de Laplace
    const classe = folha.classe;
    const decisivos = [...new Set(caminho.map((c) => c.atributo))];

    // avisos de extrapolação (valores fora do que o modelo viu no treino)
    const avisos = [];
    const prep = modelo.preparacao || {};
    for (const [campo, f] of Object.entries(prep.faixas || {})) {
      if (r[campo] !== undefined && (r[campo] < f.min || r[campo] > f.max)) avisos.push(`${ROTULO[campo] || campo} = ${fmtNum(r[campo])} está fora da faixa do treino (${fmtNum(f.min)} a ${fmtNum(f.max)}): previsão por extrapolação.`);
    }
    for (const [campo, valores] of Object.entries(prep.dominios || {})) {
      if (r[campo] !== undefined && !valores.includes(r[campo])) avisos.push(`${ROTULO[campo] || campo} "${r[campo]}" não aparece no histórico de treino.`);
    }

    const texto = classe === 'sim'
      ? `Perfil semelhante ao de demandas ATENDIDAS no histórico: ${folha.contagem.sim} de ${folha.n} demandas de treino com essas características foram atendidas.`
      : `Perfil semelhante ao de demandas NÃO ATENDIDAS no histórico: ${folha.contagem.nao} de ${folha.n} demandas de treino com essas características não foram atendidas. Sugestão: revisar valor do frete, prazo e condições de acesso.`;

    const previsao = {
      classe,
      rotulo: classe === 'sim' ? 'Tende a ser atendida' : 'Risco de não ser atendida',
      prob_atendida: probSim,
      modelo_id: modelo.id,
      explicacao: {
        resumo: texto,
        caminho,
        atributos_decisivos: decisivos.map((a) => ({ atributo: a, rotulo: ROTULO[a] || a, valor: r[a] })),
        folha: { n: folha.n, sim: folha.contagem.sim, nao: folha.contagem.nao },
        frete_por_km: r.frete_por_km,
        avisos,
        modelo: { id: modelo.id, versao: modelo.versao, acuracia_teste: modelo.acuracia, acuracia_linha_base: modelo.acuracia_linha_base },
        aviso_uso: AVISO,
      },
    };
    return { json: { ...j, previsao, avisos_ia: avisos,
      eventos: [...j.eventos, { etapa: 'ia', detalhe: `Árvore ${modelo.versao}: ${previsao.rotulo} (frequência de atendimento na folha ${Math.round(probSim * 100)}%) via ${decisivos.join(', ')}` }] }, pairedItem: { item: 0 } };
  } catch (e) {
    return { json: { ...j, previsao: null, erro_ia: `Falha ao executar a árvore: ${e.message}`,
      eventos: [...j.eventos, { etapa: 'ia', detalhe: `Falha técnica: ${e.message}` }] }, pairedItem: { item: 0 } };
  }
});
