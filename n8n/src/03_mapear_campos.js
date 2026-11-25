// =====================================================================
// BLOCO 3 | MAPEAR CAMPOS  (evolução do node "Mapear Campos" da 1ª etapa)
// 1) Reconhece nomes equivalentes (celular = fone = telefone; frete = frete_ton ...)
// 2) Quando o pedido chega como TEXTO LIVRE (Telegram, e-mail, PDF), extrai os campos
//    logísticos com expressões regulares simples. Só preenche o que está escrito:
//    nada é inventado. Campo não encontrado continua ausente.
// Saída: dados (campos canônicos), origem_dos_campos, campos_nao_mapeados, conflitos
// Os VALORES ainda não são convertidos aqui (isso é feito na validação/normalização).
// =====================================================================

const SINONIMOS = {
  // ---- campos gerais (1ª etapa) ----
  nome: ['nome', 'nome_cliente', 'cliente', 'nome_completo', 'razao_social', 'solicitante', 'name'],
  telefone: ['telefone', 'celular', 'fone', 'tel', 'whatsapp', 'phone', 'contato'],
  email: ['email', 'e_mail', 'mail'],
  documento: ['documento', 'cpf', 'cnpj', 'cpf_cnpj', 'doc'],
  data_pedido: ['data_pedido', 'data', 'data_solicitacao', 'data_do_pedido', 'dt_pedido'],
  tipo: ['tipo', 'assunto', 'motivo', 'tipo_solicitacao', 'subject', 'setor_desejado'],
  observacao: ['observacao', 'obs', 'mensagem', 'descricao', 'texto', 'detalhes', 'message', 'solicitacao'],
  nota_fiscal: ['nota_fiscal', 'nf', 'num_nf', 'nfe'],
  tipo_demanda: ['tipo_demanda', 'categoria_demanda'],
  // ---- campos logísticos (mesmos nomes do dataset rodomax_demandas.csv) ----
  produto: ['produto', 'carga', 'mercadoria', 'grao'],
  uf_origem: ['uf_origem', 'uf', 'origem_uf', 'estado_origem', 'origem', 'uf_de_origem'],
  destino: ['destino', 'cidade_destino', 'destino_cidade', 'entrega'],
  distancia_km: ['distancia_km', 'distancia', 'km', 'distancia_em_km'],
  frete_ton: ['frete_ton', 'frete', 'valor_frete', 'frete_por_tonelada', 'preco_ton', 'frete_r_ton', 'valor_do_frete'],
  saldo_ton: ['saldo_ton', 'saldo', 'toneladas', 'volume_ton', 'quantidade_ton', 'peso_ton', 'saldo_em_toneladas'],
  balanca: ['balanca', 'tipo_balanca', 'balanca_m', 'tipo_de_balanca'],
  estrada_chao_km: ['estrada_chao_km', 'estrada_chao', 'chao_km', 'estrada_terra_km', 'estrada_de_chao', 'km_estrada_de_chao'],
  antecedencia_h: ['antecedencia_h', 'antecedencia', 'antecedencia_horas', 'prazo_h', 'antecedencia_em_horas'],
  // ---- históricos (só são guardados; NÃO são usados como atributo da IA) ----
  id_demanda: ['id_demanda'],
  canal_historico: ['canal'],
  status_agendamento: ['status_agendamento'],
  atendida: ['atendida'],
};
const CAMPOS_LOGISTICOS = ['produto', 'uf_origem', 'destino', 'distancia_km', 'frete_ton', 'saldo_ton', 'balanca', 'estrada_chao_km', 'antecedencia_h'];

// "Nome Cliente" -> "nome_cliente" ; "Distância (km)" -> "distancia_km"
const chave = (k) => String(k).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const PARA_CANONICO = {};
for (const [canonico, apelidos] of Object.entries(SINONIMOS)) apelidos.forEach((a) => { PARA_CANONICO[a] = canonico; });

// Dois valores "dizem a mesma coisa"? (telefone/documento/NF comparam só dígitos)
function mesmoValor(campo, a, b) {
  if (['telefone', 'documento', 'nota_fiscal'].includes(campo)) return a.replace(/\D/g, '') === b.replace(/\D/g, '');
  return chave(a) === chave(b);
}

// ----------------------- EXTRAÇÃO DE TEXTO LIVRE -----------------------
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const ESTADOS = { 'parana': 'PR', 'mato grosso do sul': 'MS', 'mato grosso': 'MT', 'santa catarina': 'SC', 'sao paulo': 'SP', 'rio grande do sul': 'RS', 'goias': 'GO', 'minas gerais': 'MG' };
const PRODUTOS = ['milho', 'soja', 'trigo', 'sorgo', 'farelo', 'arroz', 'feijao', 'cafe', 'algodao'];
const CIDADES_CONHECIDAS = ['Paranagua', 'Toledo', 'Maringa', 'Xanxere', 'Lacerdopolis', 'Cascavel', 'Guarapuava', 'Videira'];
const NUM = '(\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?)';

function extrairDoTexto(textoOriginal) {
  const t = semAcento(textoOriginal);           // mantém maiúsculas (para UF)
  const low = t.toLowerCase();
  const achados = {};
  let m;

  // produto
  const prod = PRODUTOS.find((p) => new RegExp(`\\b${p}\\b`).test(low));
  if (prod) achados.produto = prod.toUpperCase();

  // estrada de chão: "12 km de estrada de chão", "estrada de chão: 12", "sem estrada de chão"
  if ((m = low.match(new RegExp(`${NUM}\\s*km\\s*(?:de\\s+)?(?:estrada\\s+de\\s+)?(?:chao|terra)`)))) achados.estrada_chao_km = m[1];
  else if ((m = low.match(new RegExp(`(?:estrada\\s+de\\s+)?(?:chao|terra)\\s*(?:de|:|=)?\\s*${NUM}`)))) achados.estrada_chao_km = m[1];
  else if (/sem\s+(?:estrada\s+de\s+)?(?:chao|terra)|(?:tudo|so|somente)\s+(?:no\s+)?asfalto/.test(low)) achados.estrada_chao_km = '0';

  // distância: "450 km" (que NÃO seja de estrada de chão) ou "distância: 450"
  if ((m = low.match(new RegExp(`distancia\\s*(?:de|:|=)?\\s*${NUM}`)))) achados.distancia_km = m[1];
  else {
    const re = new RegExp(`${NUM}\\s*(?:km|quilometros)\\b(?!\\s*(?:de\\s+)?(?:estrada\\s+de\\s+)?(?:chao|terra))`, 'g');
    const r = re.exec(low);
    if (r) achados.distancia_km = r[1];
  }

  // frete por tonelada: "frete de R$ 120/t", "R$ 120 por tonelada", "frete: 120"
  if ((m = low.match(new RegExp(`frete\\s*(?:de|:|=|a)?\\s*(?:r\\$)?\\s*${NUM}`)))) achados.frete_ton = m[1];
  else if ((m = low.match(new RegExp(`r\\$\\s*${NUM}\\s*(?:\\/\\s*t|por\\s+t|\\/\\s*ton|por\\s+ton)`)))) achados.frete_ton = m[1];

  // saldo em toneladas: "saldo de 1.500 t", "1500 toneladas" (não precedido de R$)
  if ((m = low.match(new RegExp(`saldo\\s*(?:de|:|=)?\\s*${NUM}`)))) achados.saldo_ton = m[1];
  else if ((m = low.match(new RegExp(`(?<!r\\$\\s?)${NUM}\\s*(?:t|ton|toneladas)\\b(?!\\s*\\/)`)))) achados.saldo_ton = m[1];

  // balança
  if (/balanca[^.\n]{0,20}sem\s+restric|sem\s+restricao/.test(low)) achados.balanca = 'sem_restricao';
  else if ((m = low.match(/balanca\s*(?:de|:|=)?\s*(20|25|30)\s*m/)) || (m = low.match(/\b(20|25|30)\s*m(?:etros)?\s*(?:de\s+)?balanca/))) achados.balanca = `${m[1]}m`;

  // antecedência: "72 horas de antecedência", "antecedência: 48h", "3 dias de antecedência"
  if ((m = low.match(new RegExp(`antecedencia\\s*(?:de|:|=)?\\s*${NUM}\\s*(h|horas?|dias?)?`)))) achados.antecedencia_h = m[2] && m[2].startsWith('dia') ? String(Number(m[1].replace(',', '.')) * 24) : m[1];
  else if ((m = low.match(new RegExp(`${NUM}\\s*(h|horas?|dias?)\\s*(?:de\\s+)?antecedencia`)))) achados.antecedencia_h = m[2].startsWith('dia') ? String(Number(m[1].replace(',', '.')) * 24) : m[1];

  // UF de origem: "do PR", "origem PR", "saindo do Paraná", ou sigla isolada em maiúsculas
  if ((m = t.match(/\b(?:origem|uf|de|do|da|saindo\s+d[eoa]|sai\s+d[eoa])\s*:?\s*([A-Z]{2})\b/)) && UFS.includes(m[1])) achados.uf_origem = m[1];
  else {
    const est = Object.keys(ESTADOS).find((e) => low.includes(e));
    if (est) achados.uf_origem = ESTADOS[est];
    else { const sig = (t.match(/\b[A-Z]{2}\b/g) || []).find((s) => UFS.includes(s)); if (sig) achados.uf_origem = sig; }
  }

  // destino: cidade conhecida do histórico ou "para <Cidade>" / "destino: <Cidade>"
  const conhecida = CIDADES_CONHECIDAS.find((c) => new RegExp(`\\b${c.toLowerCase()}\\b`).test(low));
  if (conhecida) achados.destino = conhecida;
  else if ((m = t.match(/\b(?:destino|para|ate)\s*:?\s*([A-Z][a-zA-Z]+(?:\s+(?:d[aeo]s?\s+)?[A-Z][a-zA-Z]+)*)/))) {
    if (!UFS.includes(m[1])) achados.destino = m[1];
  }
  return achados;
}

return $input.all().map((item, idx) => {
  const env = item.json;
  const dados = {}; const origem = {}; const naoMapeados = {}; const conflitos = [];

  // 1) campos estruturados (formulário, CSV, linhas "Chave: valor" do PDF/e-mail)
  for (const [campoOriginal, bruto] of Object.entries(env.campos_brutos || {})) {
    const destino = PARA_CANONICO[chave(campoOriginal)];
    if (!destino || (bruto !== null && typeof bruto === 'object')) { naoMapeados[campoOriginal] = bruto; continue; }
    const valor = String(bruto ?? '').trim();
    if (valor === '') continue;                                   // vazio = ausente (não inventamos nada)
    if (dados[destino] === undefined) { dados[destino] = valor; origem[destino] = `campo "${campoOriginal}"`; }
    else if (!mesmoValor(destino, dados[destino], valor)) conflitos.push({ campo: destino, valores: [dados[destino], valor] });
  }

  // 2) dados do solicitante informados pelo canal (remetente do e-mail, perfil do Telegram, formulário)
  const s = env.solicitante || {};
  if (!dados.nome && s.nome) { dados.nome = s.nome; origem.nome = `canal ${env.canal}`; }
  if (!dados.email && s.email) { dados.email = s.email; origem.email = `canal ${env.canal}`; }
  if (!dados.telefone && s.telefone) { dados.telefone = s.telefone; origem.telefone = `canal ${env.canal}`; }
  if (!dados.tipo && env.assunto) { dados.tipo = env.assunto; origem.tipo = 'assunto'; }
  if (!dados.observacao && env.texto) { dados.observacao = env.texto; origem.observacao = 'texto da mensagem'; }

  // 3) texto livre: extrai campos logísticos que ainda não vieram estruturados
  const textoLivre = [env.assunto, env.texto].filter(Boolean).join('\n');
  const extraidos = textoLivre ? extrairDoTexto(textoLivre) : {};
  for (const [campo, valor] of Object.entries(extraidos)) {
    if (dados[campo] === undefined) { dados[campo] = valor; origem[campo] = 'extraído do texto'; }
  }

  return { json: {
    ...env,
    dados,
    origem_dos_campos: origem,
    campos_logisticos_encontrados: CAMPOS_LOGISTICOS.filter((c) => dados[c] !== undefined),
    campos_nao_mapeados: naoMapeados,
    conflitos,
    eventos: [...env.eventos, { etapa: 'mapeamento', detalhe: `${Object.keys(dados).length} campos reconhecidos; ${Object.keys(extraidos).length} extraídos do texto livre` }],
  }, pairedItem: { item: idx } };
});
