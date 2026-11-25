// =====================================================================
// BLOCO 2 | EXPANDIR LINHAS DO CSV (finalidade "novas_demandas")
// Cada linha do arquivo vira UMA solicitação (envelope) que segue o pipeline comum.
// O vínculo com o arquivo (arquivo_id + número da linha) é preservado.
// A coluna "atendida", se existir, NÃO é usada como atributo (ver Auditar e Validar).
// =====================================================================

const env = $input.first().json.envelope;
return env.linhas.map((l, i) => ({
  json: {
    canal: 'csv',
    // mesmo conteúdo reenviado => mesma chave => não duplica (o registro original é mantido)
    chave_evento: `csv:${env.hash_conteudo}:${l.linha}`,
    solicitante: { nome: env.solicitante?.nome || '', email: env.solicitante?.email || '' },
    tipo_informado: l.campos.tipo_demanda || null,
    assunto: '',
    texto: '',
    campos_brutos: l.campos,
    dados_originais: { arquivo: env.nome_arquivo, linha: l.linha, colunas: l.campos },
    arquivo_id: env.arquivo_id,
    linha_arquivo: l.linha,
    resposta: { via: 'lote' },
  },
  pairedItem: { item: 0 },
}));
