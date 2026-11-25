// =====================================================================
// BLOCO 8 | PERGUNTAR PRÓXIMO DADO (Telegram)
// A demanda ainda está incompleta (ou com valor inválido): em vez de rejeitar, o bot
// guarda o que já foi informado e pergunta UM campo por vez. Nada é inventado.
// =====================================================================

const PERGUNTAS = {
  produto: 'Qual é o produto? (ex.: milho ou soja)',
  uf_origem: 'Qual a UF de origem da carga? (sigla, ex.: PR ou MS)',
  destino: 'Qual a cidade de destino? (ex.: Paranaguá)',
  distancia_km: 'Qual a distância da viagem em km? (ex.: 450)',
  frete_ton: 'Qual o valor do frete por tonelada, em R$? (ex.: 120)',
  saldo_ton: 'Qual o saldo de carga, em toneladas? (ex.: 1500)',
  balanca: 'Qual a restrição da balança? Responda 20m, 25m, 30m ou sem restrição.',
  estrada_chao_km: 'Quantos km do trajeto são em estrada de chão? (0 se for tudo asfalto)',
  antecedencia_h: 'Com quantas horas de antecedência o pedido está sendo feito? (ex.: 48)',
  descricao: 'Descreva sua solicitação em uma frase.',
};
const ORDEM = Object.keys(PERGUNTAS);

return $input.all().map((item, idx) => {
  const j = item.json;
  const anterior = (j.telegram && j.telegram.estado_anterior) || {};
  const invalidos = (j.motivos || []).filter((m) => m.codigo !== 'AUSENTE' && m.codigo !== 'IGNORADO');
  const camposInvalidos = invalidos.map((m) => m.campo).filter((c) => PERGUNTAS[c]);
  const pendentes = [...new Set([...camposInvalidos, ...(j.campos_faltando || [])])].filter((c) => PERGUNTAS[c]);
  pendentes.sort((a, b) => ORDEM.indexOf(a) - ORDEM.indexOf(b));
  const proximo = pendentes[0] || null;

  // guarda os campos já reconhecidos (exceto os inválidos, que serão perguntados de novo)
  const campos = {};
  for (const [k, v] of Object.entries(j.dados || {})) if (!camposInvalidos.includes(k) && ORDEM.includes(k)) campos[k] = v;
  const textos = (j.dados_originais && j.dados_originais.mensagens) || anterior.textos || [];

  const partes = [];
  if (!anterior.tipo && j.tipo_demanda === 'logistica') partes.push('Entendi: é um pedido de FRETE. Vou registrar e analisar a chance de atendimento.');
  if (invalidos.length) partes.push(`Não consegui aceitar: ${invalidos.map((m) => m.descricao).join('; ')}.`);
  const jaTenho = ORDEM.filter((c) => c !== 'descricao' && campos[c] !== undefined);
  if (j.tipo_demanda === 'logistica' && jaTenho.length) partes.push(`Já anotei: ${jaTenho.map((c) => `${c}=${campos[c]}`).join(', ')}.`);
  partes.push(proximo ? PERGUNTAS[proximo] : 'Pode detalhar melhor sua solicitação?');
  if (pendentes.length > 1) partes.push(`(faltam ${pendentes.length} informações — /cancelar para recomeçar)`);

  return { json: {
    chat_id: j.telegram.chat_id,
    update_id: j.telegram.update_id,
    estado: { tipo: j.tipo_demanda, campos, textos, aguardando: proximo, atualizado_em: new Date().toISOString() },
    texto: partes.join('\n'),
  }, pairedItem: { item: idx } };
});
