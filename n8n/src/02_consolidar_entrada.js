// =====================================================================
// BLOCO 2 | CONSOLIDAR ENTRADA  (adaptado do node "Consolidar e Extrair" da 1ª etapa)
// Recebe itens de TODOS os canais e devolve um ENVELOPE PADRÃO por solicitação:
//   { canal, chave_evento, recebido_em, ambiente, solicitante, tipo_informado,
//     assunto, texto, campos_brutos, dados_originais, arquivo_id, linha_arquivo,
//     finalidade, resposta, eventos }
// • Itens do Telegram, e-mail, PDF, CSV e testes já chegam com "canal" (montados
//   pelos nodes de cada canal). Itens sem "canal" vieram do Webhook da aplicação web.
// • Nada é descartado aqui: entradas vazias seguem e serão tratadas na validação.
// • O conteúdo original é preservado em "dados_originais".
// =====================================================================

const texto = (v) => (v === null || v === undefined ? '' : String(v));

// Hash FNV-1a (2 sementes = 64 bits) — mesma função da 1ª etapa, usada para chaves determinísticas
function fnv(txt, seed) {
  let h = seed;
  for (const ch of txt) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const hash = (txt) => fnv(txt, 0x811c9dc5) + fnv(txt, 0x9747b28c);

// Corpo do webhook como objeto (aceita JSON ou texto puro)
function corpo(json) {
  let b = json.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = { mensagem: b }; } }
  return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
}

const agora = new Date().toISOString();

return $input.all().map((item, i) => {
  let j = item.json;
  if (j.envelope && typeof j.envelope === 'object') j = j.envelope;   // vindo do node PostgreSQL de arquivo

  let env;
  if (j.canal) {
    env = { ...j };                                                   // já é um envelope de canal
  } else {
    // ---- Aplicação web (formulários de frete e de demanda geral) ----
    const b = corpo(j);
    const { id_requisicao, tipo_demanda, nome, email, telefone, assunto, descricao, ...resto } = b;
    env = {
      canal: 'web',
      chave_evento: id_requisicao ? `web:${texto(id_requisicao)}` : null,
      solicitante: { nome: texto(nome).trim(), email: texto(email).trim(), telefone: texto(telefone).trim() },
      tipo_informado: tipo_demanda || null,
      assunto: texto(assunto).trim(),
      texto: texto(descricao).trim(),
      campos_brutos: { ...resto, ...(assunto ? { assunto } : {}), ...(descricao ? { descricao } : {}) },
      dados_originais: b,
      resposta: { via: 'http' },
    };
  }

  env.recebido_em = env.recebido_em || agora;
  env.ambiente = env.ambiente || 'demonstracao';
  env.solicitante = env.solicitante || {};
  env.campos_brutos = env.campos_brutos || {};
  env.dados_originais = env.dados_originais || env.campos_brutos;
  env.eventos = [...(env.eventos || []), { etapa: 'recebido', detalhe: `Recebido pelo canal ${env.canal}` }];
  // Sem identificador do evento: gera um a partir do conteúdo + data (evita gravar duas vezes o mesmo envio)
  if (!env.chave_evento) {
    env.chave_evento = `${env.canal}:${hash(JSON.stringify(env.dados_originais) + '|' + env.recebido_em + '|' + i)}`;
  }
  return { json: env, pairedItem: { item: i } };
});
