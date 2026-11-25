// =====================================================================================
// BLOCO IA | IA 1 - PREPARAR DADOS HISTÓRICOS  (evolução do "IA 2 - Preparar e Separar")
// Base: tabela ia_historico (importada do rodomax_demandas.csv da professora). Sem dados sintéticos.
// 1) confere tipos, ausentes e valores inválidos (registros problemáticos são excluídos e CONTADOS);
// 2) analisa VAZAMENTO DE INFORMAÇÃO em status_agendamento (tabela cruzada com "atendida");
// 3) monta os atributos do modelo (+ atributo derivado frete_por_km);
// 4) separa treino (80%) e teste (20%) de forma ESTRATIFICADA, com semente fixa.
// =====================================================================================

const SEMENTE_SEPARACAO = 42;   // semente fixa => a mesma separação em toda execução
const PROPORCAO_TESTE = 0.20;   // 80% treino / 20% teste
const MINIMO_REGISTROS = 50;
const CLASSES = ['sim', 'nao'];  // valores da coluna alvo "atendida"

// Atributos de ENTRADA do modelo. Excluídos de propósito (ver IA_E_AVALIACAO.md):
//   id_demanda          -> identificador, não tem significado preditivo
//   status_agendamento  -> VAZAMENTO: o agendamento é consequência do atendimento
//   canal               -> canal de recebimento histórico (WhatsApp/planilha...); não descreve a carga
//                          e os canais atuais (Telegram/Web) não existem no histórico
//   atendida            -> é a variável ALVO
const ATRIBUTOS = [
  { nome: 'produto',         tipo: 'cat', descricao: 'Produto transportado (MILHO, SOJA)' },
  { nome: 'uf_origem',       tipo: 'cat', descricao: 'UF de origem da carga' },
  { nome: 'destino',         tipo: 'cat', descricao: 'Cidade de destino' },
  { nome: 'balanca',         tipo: 'cat', descricao: 'Restrição de balança (20m, 25m, 30m, sem_restricao)' },
  { nome: 'distancia_km',    tipo: 'num', descricao: 'Distância da viagem (km)' },
  { nome: 'frete_ton',       tipo: 'num', descricao: 'Valor do frete por tonelada (R$)' },
  { nome: 'saldo_ton',       tipo: 'num', descricao: 'Saldo de carga a transportar (t)' },
  { nome: 'estrada_chao_km', tipo: 'num', descricao: 'Trecho em estrada de chão (km)' },
  { nome: 'antecedencia_h',  tipo: 'num', descricao: 'Antecedência do pedido (horas)' },
  { nome: 'frete_por_km',    tipo: 'num', descricao: 'Derivado: frete_ton / distancia_km (R$ por t·km)' },
];
// O MESMO cálculo é repetido no node "Prever Atendimento" (precisa ser idêntico)
const derivar = (r) => ({ ...r, frete_por_km: Math.round((r.frete_ton / r.distancia_km) * 10000) / 10000 });

const linhas = ($input.first().json.registros) || [];
if (linhas.length < MINIMO_REGISTROS) {
  // não lança exceção: devolve o erro para o node "Base Suficiente?" responder de forma clara
  return [{ json: { ok: false, erro: `Base histórica com ${linhas.length} registro(s). Importe o rodomax_demandas.csv (finalidade "Base histórica") antes de treinar — mínimo ${MINIMO_REGISTROS}.` } }];
}

// ---------- 1) conferência de qualidade ----------
const NUMERICOS = ATRIBUTOS.filter((a) => a.tipo === 'num' && a.nome !== 'frete_por_km').map((a) => a.nome);
const CATEGORICOS = ATRIBUTOS.filter((a) => a.tipo === 'cat').map((a) => a.nome);
const ausentes = Object.fromEntries([...NUMERICOS, ...CATEGORICOS, 'atendida'].map((c) => [c, 0]));
const excluidos = [];
const base = [];
for (const l of linhas) {
  const r = { id_demanda: Number(l.id_demanda), status_agendamento: l.status_agendamento, canal: l.canal };
  let ok = true;
  for (const c of NUMERICOS) {
    const v = l[c] === null || l[c] === undefined || l[c] === '' ? NaN : Number(l[c]);
    if (Number.isNaN(v)) { ausentes[c]++; ok = false; } else r[c] = v;
  }
  for (const c of CATEGORICOS) {
    const v = String(l[c] ?? '').trim();
    if (!v) { ausentes[c]++; ok = false; } else r[c] = v;
  }
  r.atendida = String(l.atendida ?? '').trim().toLowerCase();
  if (!CLASSES.includes(r.atendida)) { ausentes.atendida++; ok = false; }
  if (ok && (r.distancia_km <= 0 || r.frete_ton <= 0 || r.saldo_ton <= 0 || r.estrada_chao_km < 0 || r.antecedencia_h < 0)) ok = false;
  if (ok) base.push(derivar(r)); else excluidos.push(l.id_demanda);
}
const contar = (lista) => Object.fromEntries(CLASSES.map((c) => [c, lista.filter((r) => r.atendida === c).length]));

// ---------- 2) análise de vazamento: status_agendamento x atendida ----------
const cruzada = {};
for (const r of base) {
  const s = r.status_agendamento || '(vazio)';
  cruzada[s] = cruzada[s] || { sim: 0, nao: 0 };
  cruzada[s][r.atendida]++;
}
const vazamento = Object.entries(cruzada).map(([status, c]) => ({
  status_agendamento: status, sim: c.sim, nao: c.nao,
  percentual_atendida: Math.round((1000 * c.sim) / (c.sim + c.nao)) / 10,
}));

// ---------- 3) estatísticas descritivas (para o relatório) ----------
const descritiva = {};
for (const c of [...NUMERICOS, 'frete_por_km']) {
  const v = base.map((r) => r[c]).sort((a, b) => a - b);
  const media = v.reduce((s, x) => s + x, 0) / v.length;
  descritiva[c] = { min: v[0], max: v[v.length - 1], media: Math.round(media * 100) / 100, mediana: v[Math.floor(v.length / 2)] };
}
const dominios = {};
for (const c of CATEGORICOS) dominios[c] = [...new Set(base.map((r) => r[c]))].sort();

// ---------- 4) separação estratificada treino/teste ----------
function criarGerador(semente) {   // mulberry32 (mesmo gerador da 1ª versão)
  let a = semente >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = criarGerador(SEMENTE_SEPARACAO);
function embaralhar(lista) { const v = lista.slice(); for (let i = v.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [v[i], v[k]] = [v[k], v[i]]; } return v; }
const ordenada = base.slice().sort((a, b) => a.id_demanda - b.id_demanda);   // independe da ordem de leitura
const treino = []; const teste = [];
for (const classe of CLASSES) {
  const grupo = embaralhar(ordenada.filter((r) => r.atendida === classe));
  const nTeste = Math.round(grupo.length * PROPORCAO_TESTE);
  teste.push(...grupo.slice(0, nTeste));
  treino.push(...grupo.slice(nTeste));
}
const faixas = {};
for (const c of [...NUMERICOS, 'frete_por_km']) faixas[c] = { min: Math.min(...treino.map((r) => r[c])), max: Math.max(...treino.map((r) => r[c])) };

return [{ json: {
  ok: true,
  atributos: ATRIBUTOS,
  classes: CLASSES,
  treino,
  teste,
  preparacao: {
    fonte: 'ia_historico (rodomax_demandas.csv)',
    registros_lidos: linhas.length,
    registros_utilizados: base.length,
    registros_excluidos: excluidos.length,
    ids_excluidos: excluidos.slice(0, 50),
    ausentes_por_campo: ausentes,
    distribuicao_classes: contar(base),
    atributos_excluidos: [
      { atributo: 'id_demanda', motivo: 'identificador sem significado preditivo' },
      { atributo: 'status_agendamento', motivo: 'vazamento de informação: reflete o resultado (ver tabela cruzada)' },
      { atributo: 'canal', motivo: 'canal histórico (WhatsApp/planilha/e-mail/webhook) não descreve a carga; canais atuais (Telegram/Web) não existem no histórico' },
    ],
    atributo_derivado: 'frete_por_km = frete_ton / distancia_km',
    vazamento_status_agendamento: vazamento,
    descritiva,
    dominios,
    faixas,
    semente_separacao: SEMENTE_SEPARACAO,
    proporcao_teste: PROPORCAO_TESTE,
    estratificada: true,
    treino: { registros: treino.length, classes: contar(treino) },
    teste: { registros: teste.length, classes: contar(teste) },
  },
} }];
