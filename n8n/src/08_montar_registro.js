// =====================================================================
// BLOCO 7 | MONTAR REGISTRO PARA O POSTGRESQL
// Recebe os três caminhos unidos (gerais classificadas, logísticas com previsão e
// pendentes/rejeitadas) e monta o JSON gravado pela função hub_registrar_demanda().
// Situação final:
//   processada | pendente | rejeitada | erro (falha técnica, ex.: IA sem modelo treinado)
// =====================================================================

const RESPOSTA_INICIAL = {   // como a resposta é entregue em cada canal
  web: ['enviada', 'Resposta devolvida na tela da aplicação web'],
  pdf: ['enviada', 'Resposta devolvida na tela da aplicação web'],
  telegram: ['enviada', 'Texto devolvido ao conector do Telegram para envio ao usuário'],
  email: ['pendente', 'Aguardando envio por e-mail (SMTP)'],
  csv: ['nao_aplicavel', 'Importação em lote: resultado exibido na Central de Controle'],
  teste: ['nao_aplicavel', 'Caso de teste manual'],
};

return $input.all().map((item, idx) => {
  const j = item.json;
  const s = j.solicitante || {};
  const n = j.normalizados || {};
  const d = j.dados || {};
  let status = j.status_validacao === 'valida' ? 'processada' : j.status_validacao;
  if (j.tipo_demanda === 'logistica' && status === 'processada' && !j.previsao) status = 'erro';
  const motivos = [...(j.motivos || [])];
  if (j.erro_ia) motivos.push({ codigo: 'ERRO_IA', campo: 'ia', descricao: j.erro_ia });
  const [respStatus, respDetalhe] = RESPOSTA_INICIAL[j.canal] || ['pendente', null];

  const registro = {
    chave_evento: j.chave_evento,
    canal: j.canal,
    tipo_demanda: j.tipo_demanda,
    status,
    solicitante_nome: n.nome || d.nome || s.nome || null,
    solicitante_email: n.email || d.email || s.email || null,
    solicitante_telefone: n.telefone || d.telefone || s.telefone || null,
    telegram_chat_id: s.telegram_chat_id || null,
    assunto: n.tipo || d.tipo || j.assunto || null,
    descricao: n.observacao || d.observacao || j.texto || null,
    categoria: j.categoria || null,
    setor_responsavel: j.setor_responsavel || (j.tipo_demanda === 'logistica' ? 'Logística' : null),
    regra_classificacao: j.regra_classificacao || (j.tipo_demanda === 'logistica' ? `caminho logístico: ${j.motivo_tipo}` : null),
    motivos,
    avisos: j.avisos_ia || [],
    dados_originais: j.dados_originais,
    dados_normalizados: { campos: d, origem_dos_campos: j.origem_dos_campos, normalizados: n, alteracoes: j.alteracoes || [], campos_nao_mapeados: Object.keys(j.campos_nao_mapeados || {}) },
    arquivo_id: j.arquivo_id || null,
    linha_arquivo: j.linha_arquivo || null,
    resposta_status: respStatus,
    resposta_detalhe: respDetalhe,
    ambiente: j.ambiente,
    recebido_em: j.recebido_em,
    logistica: j.tipo_demanda === 'logistica' ? (j.atributos_ia || j.logistica_validada || {}) : null,
    previsao: j.previsao || null,
    eventos: [...(j.eventos || []), { etapa: 'registro', detalhe: `Situação final: ${status}` }],
  };
  return { json: { registro, contexto: { canal: j.canal, resposta: j.resposta || {}, tipo_demanda: j.tipo_demanda, status, campos_faltando: j.campos_faltando || [], motivos, previsao: j.previsao || null, setor: registro.setor_responsavel, categoria: registro.categoria, solicitante: registro.solicitante_nome, arquivo_id: j.arquivo_id || null, linha_arquivo: j.linha_arquivo || null, telegram: j.telegram || null } }, pairedItem: { item: idx } };
});
