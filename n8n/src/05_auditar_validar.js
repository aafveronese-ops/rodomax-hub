// =====================================================================
// BLOCO 4 | AUDITAR E VALIDAR  (evolução do node "Auditar e Validar" da 1ª etapa)
// Define, com critérios explícitos, a situação de cada solicitação:
//   "valida"    -> segue para o caminho GERAL ou LOGÍSTICO
//   "pendente"  -> faltam informações (o solicitante é avisado do que falta)
//   "rejeitada" -> valor inválido/inconsistente, conflito ou duplicidade no lote
// Cada problema vira um item em "motivos" (nada é descartado em silêncio).
// Regras gerais (1ª etapa): contato, e-mail, telefone, documento, data.
// Regras logísticas: 9 atributos do dataset, com tipos e faixas plausíveis.
// =====================================================================

const LOGISTICOS = {
  produto: 'Produto', uf_origem: 'UF de origem', destino: 'Destino', distancia_km: 'Distância (km)',
  frete_ton: 'Frete por tonelada (R$)', saldo_ton: 'Saldo (toneladas)', balanca: 'Tipo de balança',
  estrada_chao_km: 'Estrada de chão (km)', antecedencia_h: 'Antecedência (horas)',
};
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
// Faixas de plausibilidade (validação de dados, não regra de negócio da IA)
const FAIXAS = {
  distancia_km: [1, 3500], frete_ton: [1, 1000], saldo_ton: [1, 100000],
  estrada_chao_km: [0, 500], antecedencia_h: [0, 720],
};
// Canais em que o solicitante pode completar a informação (os demais rejeitam o que falta)
const CANAIS_INTERATIVOS = ['web', 'telegram', 'email', 'teste'];

const digitos = (s) => String(s ?? '').replace(/\D/g, '');
const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Telefone brasileiro -> DDD+número (10 ou 11 dígitos) ou null. Remove +55 quando presente.
function parseTelefone(valor) {
  let d = digitos(valor);
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length === 10 && /^[1-9]{2}[2-9]/.test(d)) return d;
  if (d.length === 11 && /^[1-9]{2}9/.test(d)) return d;
  return null;
}
// Data -> AAAA-MM-DD ou null (aceita AAAA-MM-DD e DD/MM/AAAA)
function parseData(valor) {
  const s = String(valor ?? '').trim(); let a; let mes; let dia; let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/))) { a = +m[1]; mes = +m[2]; dia = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) { dia = +m[1]; mes = +m[2]; a = +m[3]; }
  else return null;
  const dt = new Date(Date.UTC(a, mes - 1, dia));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== mes - 1 || dt.getUTCDate() !== dia) return null;
  return `${a}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
// Número em formato brasileiro ou internacional ("1.500", "1500,5", "1500.5") -> Number ou NaN
function lerNumero(v) {
  if (v === null || v === undefined || v === '') return NaN;
  if (typeof v === 'number') return v;
  // aceita unidades comuns digitadas junto do número: "450 km", "R$ 120/t", "72h", "1.500 toneladas"
  let t = String(v).trim().toLowerCase().replace(/\s/g, '').replace(/^r\$/, '')
    .replace(/(por(tonelada|ton|t)|\/(tonelada|ton|t)|km|quilometros|horas?|hrs?|h|toneladas?|ton|t|reais)$/, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}
// Balança -> "20m" | "25m" | "30m" | "sem_restricao" | null
function lerBalanca(v) {
  const t = semAcento(v).replace(/\s/g, '');
  if (/^(sem_?restricao|semrestricao|livre|nenhuma)$/.test(t)) return 'sem_restricao';
  const m = t.match(/^(20|25|30)(m|metros)?$/);
  return m ? `${m[1]}m` : null;
}

function fnv(txt, seed) { let h = seed; for (const ch of txt) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
const hash = (txt) => fnv(txt, 0x811c9dc5) + fnv(txt, 0x9747b28c);

const vistos = new Map();   // conteúdo já visto NESTE lote -> evita duplicidade (ex.: linhas repetidas no CSV)

return $input.all().map((item, idx) => {
  const j = item.json; const d = j.dados || {};
  const motivos = []; const faltando = [];
  const add = (codigo, campo, descricao) => motivos.push({ codigo, campo, descricao });
  const interativo = CANAIS_INTERATIVOS.includes(j.canal);

  // ---------- regras gerais (contato e formatos) ----------
  if (j.canal === 'web' && !d.nome) { add('AUSENTE', 'nome', 'Nome do solicitante não informado'); faltando.push('nome'); }
  if (j.canal === 'web' && !d.telefone && !d.email) { add('AUSENTE', 'contato', 'Informe telefone ou e-mail para retorno'); faltando.push('contato'); }
  if (d.telefone && !parseTelefone(d.telefone)) add('INCONSISTENTE', 'telefone', `Telefone fora do padrão brasileiro: "${d.telefone}"`);
  if (d.email && !emailValido(d.email)) add('INCONSISTENTE', 'email', `E-mail inválido: "${d.email}"`);
  if (d.data_pedido && !parseData(d.data_pedido)) add('INCONSISTENTE', 'data_pedido', `Data inválida ou ambígua: "${d.data_pedido}"`);
  if (d.documento && ![11, 14].includes(digitos(d.documento).length)) add('INCONSISTENTE', 'documento', `CPF/CNPJ com quantidade de dígitos inválida: "${d.documento}"`);
  for (const c of j.conflitos || []) add('CONFLITO', c.campo, `Campos equivalentes com valores diferentes: ${c.valores.map((v) => `"${v}"`).join(' x ')}`);

  // ---------- regras por tipo ----------
  const logistica = {};
  if (j.tipo_demanda === 'geral') {
    if (!d.tipo && !d.observacao) { add('AUSENTE', 'descricao', 'Descreva a solicitação'); faltando.push('descricao'); }
  } else {
    for (const [campo, rotulo] of Object.entries(LOGISTICOS)) {
      if (d[campo] === undefined || String(d[campo]).trim() === '') { add('AUSENTE', campo, `${rotulo} não informado(a)`); faltando.push(campo); }
    }
    if (d.produto !== undefined) logistica.produto = semAcento(d.produto).toUpperCase();
    if (d.uf_origem !== undefined) {
      const ESTADOS = { 'PARANA': 'PR', 'MATO GROSSO DO SUL': 'MS', 'MATO GROSSO': 'MT', 'SANTA CATARINA': 'SC', 'SAO PAULO': 'SP', 'RIO GRANDE DO SUL': 'RS', 'GOIAS': 'GO' };
      const bruto = semAcento(d.uf_origem).toUpperCase();
      const uf = ESTADOS[bruto] || bruto;
      if (UFS.includes(uf)) logistica.uf_origem = uf; else add('INVALIDO', 'uf_origem', `UF inválida: "${d.uf_origem}" (use a sigla, ex.: PR)`);
    }
    if (d.destino !== undefined) {
      const dest = String(d.destino).trim();
      if (dest.length >= 2 && !/^\d+$/.test(dest)) logistica.destino = dest; else add('INVALIDO', 'destino', `Destino inválido: "${d.destino}"`);
    }
    for (const campo of Object.keys(FAIXAS)) {
      if (d[campo] === undefined) continue;
      const n = lerNumero(d[campo]); const [min, max] = FAIXAS[campo];
      if (Number.isNaN(n) || n < min || n > max) add('INVALIDO', campo, `${LOGISTICOS[campo]} deve ser um número entre ${min} e ${max}: "${d[campo]}"`);
      else logistica[campo] = n;
    }
    if (d.balanca !== undefined) {
      const b = lerBalanca(d.balanca);
      if (b) logistica.balanca = b; else add('INVALIDO', 'balanca', `Balança inválida: "${d.balanca}" (use 20m, 25m, 30m ou sem_restricao)`);
    }
    if (logistica.estrada_chao_km !== undefined && logistica.distancia_km !== undefined && logistica.estrada_chao_km > logistica.distancia_km) {
      add('INCONSISTENTE', 'estrada_chao_km', 'Estrada de chão maior que a distância total');
    }
    if (d.atendida !== undefined) add('IGNORADO', 'atendida', 'Campo "atendida" recebido em demanda nova: ignorado (é o que a IA prevê)');
  }

  // ---------- duplicidade dentro do mesmo lote ----------
  const base = [j.canal, j.arquivo_id || '', semAcento(d.nome), digitos(d.telefone) || semAcento(d.email),
    semAcento(`${d.tipo || ''} ${d.observacao || ''}`), JSON.stringify(logistica)].join('|');
  const chaveConteudo = hash(base);
  const ocorrencia = (vistos.get(chaveConteudo) || 0) + 1;
  vistos.set(chaveConteudo, ocorrencia);
  if (ocorrencia > 1 && j.canal === 'csv') add('DUPLICADO', 'registro', `Mesmo conteúdo já recebido neste arquivo (ocorrência ${ocorrencia})`);

  // ---------- situação final ----------
  const bloqueantes = motivos.filter((m) => m.codigo !== 'IGNORADO');
  const soFaltam = bloqueantes.length > 0 && bloqueantes.every((m) => m.codigo === 'AUSENTE');
  // No Telegram a conversa continua: dado ausente OU inválido é perguntado de novo (não rejeita)
  const corrigivelNoChat = j.canal === 'telegram' && bloqueantes.every((m) => ['AUSENTE', 'INVALIDO', 'INCONSISTENTE'].includes(m.codigo));
  const status = bloqueantes.length === 0 ? 'valida' : ((soFaltam && interativo) || corrigivelNoChat ? 'pendente' : 'rejeitada');

  return { json: {
    ...j,
    status_validacao: status,
    motivos,
    campos_faltando: faltando,
    logistica_validada: j.tipo_demanda === 'logistica' ? logistica : null,
    eventos: [...j.eventos, { etapa: 'validacao', detalhe: status === 'valida' ? 'Validação aprovada' : `${status}: ${bloqueantes.map((m) => m.descricao).join('; ')}` }],
  }, pairedItem: { item: idx } };
});
