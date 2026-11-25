// =====================================================================
// BLOCO 8 | RESUMO DO LOTE CSV
// Um CSV é UM arquivo com N registros. A resposta informa, para o arquivo:
// lidos, processados, pendentes, rejeitados, com erro e as previsões da IA.
// Contadores oficiais vêm do banco (hub_atualizar_arquivo); detalhes, desta execução.
// =====================================================================

const lote = $input.first().json.lote || {};
const itens = $('Montar Resposta').all().map((i) => i.json).filter((j) => j.canal === 'csv');
const contar = (f) => itens.filter(f).length;

return [{ json: {
  ok: true,
  arquivo_id: lote.arquivo_id,
  nome_arquivo: lote.nome_arquivo,
  finalidade: 'novas_demandas',
  registros_lidos: lote.registros_total,
  registros_importados: lote.registros_importados,
  registros_rejeitados: lote.registros_rejeitados,
  nesta_execucao: {
    processadas: contar((j) => j.situacao === 'processada'),
    pendentes: contar((j) => j.situacao === 'pendente'),
    rejeitadas: contar((j) => j.situacao === 'rejeitada'),
    com_erro: contar((j) => j.situacao === 'erro' || j.situacao === 'erro_tecnico'),
    duplicadas_ignoradas: contar((j) => j.duplicado),
    gerais: contar((j) => j.tipo_demanda === 'geral'),
    logisticas: contar((j) => j.tipo_demanda === 'logistica'),
    previsao_atendida: contar((j) => j.previsao_classe === 'sim'),
    previsao_nao_atendida: contar((j) => j.previsao_classe === 'nao'),
  },
  amostra: itens.slice(0, 25).map((j) => ({ linha: j.linha_arquivo, protocolo: j.protocolo, situacao: j.situacao, tipo: j.tipo_demanda, previsao: j.previsao_classe, mensagem: j.resultado.mensagem.split('\n').slice(0, 3).join(' | ') })),
} }];
