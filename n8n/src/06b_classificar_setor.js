// =====================================================================
// BLOCO 6A | CLASSIFICAR SETOR POR REGRAS  (node "Classificar por Regras" da 1ª etapa)
// Classificação por PALAVRAS-CHAVE — NÃO é IA. Procura os termos no assunto + descrição
// (sem acento, sem diferenciar maiúsculas) e escolhe a regra com mais termos encontrados.
// Empate: vale a ordem da lista. Nenhum termo: "Não identificada" -> setor "Atendimento"
// (triagem humana).
//
// CONFIGURAÇÃO: para mudar setores ou palavras, edite apenas a lista REGRAS abaixo.
// Os setores são uma proposta para demonstração, não a estrutura oficial da Rodomax.
// =====================================================================

const REGRAS = [
  { categoria: 'Cobrança e pagamentos',    setor: 'Financeiro',     termos: ['boleto', 'fatura', 'segunda via', 'pagamento', 'cobranca', 'vencimento', 'reembolso', 'nota fiscal', 'pix'] },
  { categoria: 'Cotação e proposta',       setor: 'Comercial',      termos: ['cotacao', 'orcamento', 'proposta', 'tabela de preco', 'parceria', 'contratar'] },
  { categoria: 'Atraso ou rastreamento',   setor: 'Logística',      termos: ['atras', 'onde esta', 'rastre', 'previsao de entrega', 'nao chegou', 'demora', 'entrega'] },
  { categoria: 'Avaria ou extravio',       setor: 'Operacional',    termos: ['avaria', 'danific', 'extravi', 'sinistro', 'ocorrencia', 'quebrad'] },
  { categoria: 'Coleta e agendamento',     setor: 'Operacional',    termos: ['coleta', 'agendar', 'agendamento', 'retirada', 'janela'] },
  { categoria: 'Manutenção de frota',      setor: 'Operacional',    termos: ['manutencao', 'pneu', 'oficina', 'revisao', 'mecanic', 'veiculo quebrado'] },
  { categoria: 'Cadastro e documentos',    setor: 'Administrativo', termos: ['cadastro', 'contrato', 'documentacao', 'documento', 'certidao', 'atualizar dados', 'rh', 'curriculo'] },
  { categoria: 'Reclamação e suporte',     setor: 'Atendimento',    termos: ['reclam', 'insatisf', 'duvida', 'atendimento', 'suporte', 'ajuda', 'informac'] },
];

const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// o termo precisa começar numa palavra ("atras" casa com "atrasada"; "frete" não casa dentro de "refrete")
const contem = (txt, termo) => new RegExp('(^|[^a-z0-9])' + termo).test(txt);

return $input.all().map((item, idx) => {
  const j = item.json;
  const n = j.normalizados || {};
  const txt = semAcento(`${n.tipo || ''} ${n.observacao || ''}`);

  let melhor = null;
  for (const regra of REGRAS) {
    const achados = regra.termos.filter((t) => contem(txt, t));
    if (achados.length && (!melhor || achados.length > melhor.achados.length)) melhor = { regra, achados };
  }
  const categoria = melhor ? melhor.regra.categoria : 'Não identificada';
  const setor = melhor ? melhor.regra.setor : 'Atendimento';
  const regra = melhor ? `palavras-chave: ${melhor.achados.join(', ')}` : 'nenhuma palavra-chave encontrada: triagem pelo Atendimento';

  return { json: {
    ...j,
    categoria,
    setor_responsavel: setor,
    regra_classificacao: regra,
    eventos: [...j.eventos, { etapa: 'classificacao', detalhe: `Setor ${setor} (${categoria}) — ${regra}` }],
  }, pairedItem: { item: idx } };
});
