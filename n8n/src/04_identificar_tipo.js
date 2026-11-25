// =====================================================================
// BLOCO 3 | IDENTIFICAR TIPO DE DEMANDA  (geral x logística)
// O HUB é multissetorial: só vai para o caminho logístico (e para a IA) o que for,
// de fato, um pedido de transporte/frete. Regras, em ordem:
//   1. Tipo informado explicitamente (formulário web, Telegram, CSV) -> respeitado.
//   2. 2 ou mais atributos logísticos encontrados (produto, distância, saldo...) -> logística.
//   3. Intenção de transporte no texto ("transportar", "carregar", "preciso de frete")
//      SEM palavras fortes de outro setor (boleto, fatura, reclamação...) -> logística.
//   4. Caso contrário -> demanda geral (vai para a classificação por setor).
// =====================================================================

const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const INTENCAO_TRANSPORTE = /(transport|carregar|carregamento|preciso de (um )?(frete|caminhao|carreta)|solicit\w* (de )?frete|frete (de|para) |escoar|embarcar|carga de )/;
const OUTRO_SETOR = /(boleto|fatura|cobranca|segunda via|pagamento|reclam|cadastro|contrato|nota fiscal|curriculo|vaga|manutencao)/;

function tipoInformado(v) {
  const t = semAcento(v);
  if (['logistica', 'frete', 'transporte', 'logistico'].includes(t)) return 'logistica';
  if (['geral', 'outro', 'outros', 'administrativo'].includes(t)) return 'geral';
  return null;
}

return $input.all().map((item, idx) => {
  const j = item.json;
  const txt = semAcento([j.dados.tipo, j.dados.observacao].filter(Boolean).join(' '));
  const nLog = j.campos_logisticos_encontrados.filter((c) => c !== 'destino').length;

  let tipo; let motivo;
  const informado = tipoInformado(j.tipo_informado) || tipoInformado(j.dados.tipo_demanda);
  if (informado) { tipo = informado; motivo = 'tipo informado pelo solicitante/canal'; }
  else if (nLog >= 2) { tipo = 'logistica'; motivo = `${nLog} atributos logísticos encontrados (${j.campos_logisticos_encontrados.join(', ')})`; }
  else if (INTENCAO_TRANSPORTE.test(txt) && !OUTRO_SETOR.test(txt)) { tipo = 'logistica'; motivo = 'intenção de transporte identificada no texto'; }
  else { tipo = 'geral'; motivo = nLog ? 'poucos atributos logísticos e sem intenção clara de transporte' : 'nenhum atributo logístico encontrado'; }

  return { json: {
    ...j,
    tipo_demanda: tipo,
    motivo_tipo: motivo,
    eventos: [...j.eventos, { etapa: 'identificacao', detalhe: `Demanda ${tipo === 'logistica' ? 'LOGÍSTICA' : 'GERAL'}: ${motivo}` }],
  }, pairedItem: { item: idx } };
});
