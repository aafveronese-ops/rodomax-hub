// =====================================================================
// BLOCO 8 | MONTAR RESPOSTA (mesmo conteúdo para todos os canais)
// O canal de origem só muda COMO a resposta é entregue (tela web, Telegram, e-mail).
//   Demanda geral     -> protocolo + setor responsável (SEM previsão logística)
//   Demanda logística -> protocolo + previsão da árvore + aviso de caráter experimental
//   Pendente/rejeitada-> protocolo + o que falta/corrigir
//   Falha no banco    -> erro técnico (nenhum protocolo é inventado)
// =====================================================================

const registros = $('Montar Registro').all();
const pct = (x) => `${Math.round(Number(x) * 100)}%`;
const descreverErro = (e) => (!e ? 'falha no banco de dados' : typeof e === 'string' ? e
  : String(e.message || e.description || JSON.stringify(e)).slice(0, 300));

return $input.all().map((item, i) => {
  const ctx = registros[i].json.contexto;
  const reg = registros[i].json.registro;
  const r = item.json.r || item.json.resultado || null;          // retorno de hub_registrar_demanda()
  const falhaBanco = !r || !r.protocolo;

  const linhas = [];
  let titulo; let situacao = ctx.status;
  if (falhaBanco) {
    situacao = 'erro_tecnico';
    titulo = 'Não foi possível registrar sua solicitação agora';
    linhas.push('Ocorreu uma falha técnica ao gravar no banco de dados. Nenhum protocolo foi gerado. Tente novamente em instantes.');
  } else if (ctx.status === 'pendente') {
    titulo = 'Solicitação recebida — faltam informações';
    linhas.push(`Protocolo: ${r.protocolo}`, 'Para continuar, precisamos de:', ...ctx.motivos.filter((m) => m.codigo !== 'IGNORADO').map((m) => `• ${m.descricao}`));
  } else if (ctx.status === 'rejeitada') {
    titulo = 'Solicitação recebida, mas com dados inválidos';
    linhas.push(`Protocolo: ${r.protocolo}`, 'Corrija e envie novamente:', ...ctx.motivos.filter((m) => m.codigo !== 'IGNORADO').map((m) => `• ${m.descricao}`));
  } else if (ctx.status === 'erro') {
    titulo = 'Solicitação registrada — análise da IA indisponível';
    linhas.push(`Protocolo: ${r.protocolo}`, 'Sua demanda logística foi registrada, mas a previsão não pôde ser gerada agora. A equipe de Logística fará a análise.');
  } else if (ctx.tipo_demanda === 'geral') {
    titulo = 'Solicitação recebida e encaminhada';
    linhas.push(`Protocolo: ${r.protocolo}`, `Encaminhada ao setor: ${ctx.setor}`, `Assunto identificado: ${ctx.categoria}`, 'O setor responsável dará continuidade ao atendimento.');
  } else {
    const p = ctx.previsao;
    titulo = 'Demanda de frete recebida e analisada';
    linhas.push(
      `Protocolo: ${r.protocolo}`,
      `Previsão da IA: ${p.rotulo.toUpperCase()}`,
      `Frequência de atendimento em casos semelhantes do histórico: ${pct(p.prob_atendida)} (${p.explicacao.folha.sim} de ${p.explicacao.folha.n})`,
      `Principais fatores: ${p.explicacao.atributos_decisivos.map((a) => a.rotulo).join(', ')}`,
      p.explicacao.resumo,
      '',
      'Importante: esta é uma previsão EXPERIMENTAL. A demanda foi registrada e analisada — o frete ainda NÃO está contratado. A decisão final é da equipe de operação.',
    );
  }
  if (r && r.duplicado) linhas.push('', '(Este envio já havia sido recebido; mantivemos o registro original.)');
  const textoFinal = [titulo, '', ...linhas].join('\n');

  return { json: {
    canal: ctx.canal,
    demanda_id: r ? r.id : null,
    protocolo: r ? r.protocolo : null,
    duplicado: !!(r && r.duplicado),
    situacao,
    tipo_demanda: ctx.tipo_demanda,
    titulo,
    texto: textoFinal,
    // dados para a tela web
    resultado: {
      ok: !falhaBanco, protocolo: r ? r.protocolo : null, situacao, tipo_demanda: ctx.tipo_demanda,
      setor: ctx.tipo_demanda === 'geral' ? ctx.setor : null, categoria: ctx.categoria,
      previsao: ctx.tipo_demanda === 'logistica' ? ctx.previsao : null,
      motivos: ctx.motivos, titulo, mensagem: linhas.join('\n'), duplicado: !!(r && r.duplicado),
      erro_tecnico: falhaBanco ? descreverErro(item.json.error) : null,
    },
    // entrega por canal
    email_destino: ctx.resposta.email || null,
    email_assunto: ctx.resposta.assunto || 'Rodomax HUB — sua solicitação',
    chat_id: ctx.resposta.chat_id || null,
    update_id: ctx.resposta.update_id || null,
    arquivo_id: ctx.arquivo_id,
    linha_arquivo: ctx.linha_arquivo,
    previsao_classe: ctx.previsao ? ctx.previsao.classe : null,
    descricao_curta: (reg.descricao || '').slice(0, 80),
  }, pairedItem: { item: i } };
});
