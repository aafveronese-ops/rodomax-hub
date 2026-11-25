// =====================================================================
// BLOCO 3 | LER CSV  (evolução do leitor de CSV da 1ª etapa)
// • Detecta o separador (; , ou TAB) pelo cabeçalho e respeita aspas (inclusive quebras de linha).
// • Cabeçalhos são padronizados ("Distância (km)" -> "distancia_km").
// • Distingue a FINALIDADE da importação (escolhida na interface):
//     "historico"       -> base ROTULADA para treino/avaliação: exige a coluna "atendida"
//     "novas_demandas"  -> demandas novas para processamento: "atendida" NÃO é exigida
//                          (se vier, é ignorada, pois é exatamente o que a IA vai prever)
// • 1 arquivo = 1 lote: registros_total conta LINHAS de dados, não arquivos.
// Saída: { arquivo_registro (hub_arquivos), envelope (linhas + metadados) }
// =====================================================================

const texto = (v) => (v === null || v === undefined ? '' : String(v));
const chave = (k) => String(k).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
function fnv(txt, seed) { let h = seed; for (const ch of txt) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
const hash = (txt) => fnv(txt, 0x811c9dc5) + fnv(txt, 0x9747b28c);

const COLUNAS_HISTORICO = ['produto', 'uf_origem', 'destino', 'distancia_km', 'frete_ton', 'saldo_ton', 'balanca', 'estrada_chao_km', 'antecedencia_h', 'atendida'];

// Parser CSV simples e correto: aspas duplas, "" escapado, separador e quebras de linha dentro de aspas
function parseCsv(conteudo, sep) {
  const linhas = []; let campo = ''; let linha = []; let aspas = false;
  for (let i = 0; i < conteudo.length; i++) {
    const ch = conteudo[i];
    if (aspas) {
      if (ch === '"' && conteudo[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && conteudo[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.some((c) => c.trim() !== '')) linhas.push(linha);
      linha = [];
    } else campo += ch;
  }
  linha.push(campo);
  if (linha.some((c) => c.trim() !== '')) linhas.push(linha);
  return linhas;
}

const b = $input.first().json.body || {};
const nome = texto(b.nome_arquivo).trim() || 'sem_nome.csv';
const finalidade = ['historico', 'novas_demandas'].includes(b.finalidade) ? b.finalidade : null;
const conteudo = texto(b.conteudo).replace(/^\uFEFF/, '');   // remove BOM do Excel
const primeira = conteudo.split(/\r?\n/)[0] || '';
const contagem = { ';': (primeira.match(/;/g) || []).length, ',': (primeira.match(/,/g) || []).length, '\t': (primeira.match(/\t/g) || []).length };
const sep = Object.keys(contagem).sort((x, y) => contagem[y] - contagem[x])[0];

let erro = null; let aviso = null;
const tabela = conteudo.trim() ? parseCsv(conteudo, sep) : [];
const cabecalhos = (tabela[0] || []).map((c) => chave(c));
const linhas = tabela.slice(1).map((v, i) => ({ linha: i + 2, campos: Object.fromEntries(cabecalhos.map((c, k) => [c, texto(v[k]).trim()])) }));

if (!finalidade) erro = 'Finalidade da importação não informada (use "historico" ou "novas_demandas").';
else if (!conteudo.trim()) erro = 'Arquivo CSV vazio.';
else if (cabecalhos.length < 2) erro = 'Não foi possível identificar colunas: verifique o separador (; ou ,).';
else if (!linhas.length) erro = 'CSV sem linhas de dados (apenas cabeçalho).';
else if (finalidade === 'historico') {
  const faltam = COLUNAS_HISTORICO.filter((c) => !cabecalhos.includes(c));
  if (faltam.length) erro = `Base histórica precisa das colunas: ${faltam.join(', ')}. Para demandas novas (sem "atendida"), escolha a finalidade "Novas demandas".`;
} else if (cabecalhos.includes('atendida')) {
  aviso = 'A coluna "atendida" foi recebida em demandas novas e será ignorada (é o que a IA prevê). Para treinar o modelo, importe como "Base histórica".';
}

const detalhe = erro || [`${linhas.length} linha(s) de dados, separador "${sep === '\t' ? 'TAB' : sep}"`, aviso].filter(Boolean).join('. ');
return [{ json: {
  arquivo_registro: {
    nome_arquivo: nome, tipo_arquivo: 'csv', finalidade: finalidade || 'novas_demandas', canal: 'web',
    tamanho_bytes: Number(b.tamanho_bytes) || conteudo.length, hash_conteudo: hash(conteudo), separador: sep === '\t' ? 'TAB' : sep,
    cabecalhos, registros_total: linhas.length, status: erro ? 'erro' : 'recebido', detalhe,
  },
  envelope: {
    csv_ok: !erro, erro, aviso, finalidade, nome_arquivo: nome, separador: sep, cabecalhos,
    hash_conteudo: hash(conteudo), linhas, solicitante: { nome: texto(b.nome).trim(), email: texto(b.email).trim() },
  },
} }];
