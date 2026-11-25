// =====================================================================
// BLOCO 10 | CASOS DE TESTE (execução manual no editor do n8n)
// Gera solicitações de TESTE (canal "teste", ambiente "teste") que percorrem o mesmo
// pipeline das demandas reais. Ficam gravadas no banco, mas o dashboard IGNORA o
// ambiente "teste" — nenhum número fictício aparece nos indicadores.
// Os dados abaixo são EXEMPLOS FICTÍCIOS criados para teste (não são do dataset).
// =====================================================================

const execucao = new Date().toISOString();
const casos = [
  { cenario: 'geral_financeiro', tipo_informado: 'geral', solicitante: { nome: 'Teste Financeiro', email: 'teste.financeiro@example.com' },
    assunto: 'Segunda via de boleto', texto: 'Preciso da segunda via do boleto com vencimento nesta semana.' },
  { cenario: 'geral_cadastro', solicitante: { nome: 'Teste Cadastro', telefone: '42999990000' },
    assunto: '', texto: 'Gostaria de atualizar os dados do meu cadastro e do contrato.' },
  { cenario: 'logistica_campos', tipo_informado: 'logistica', solicitante: { nome: 'Teste Frete', email: 'teste.frete@example.com' },
    campos_brutos: { produto: 'SOJA', uf_origem: 'PR', destino: 'Paranaguá', distancia_km: '560', frete_ton: '150', saldo_ton: '2500', balanca: '25m', estrada_chao_km: '0', antecedencia_h: '72' } },
  { cenario: 'logistica_texto_livre', solicitante: { nome: 'Teste Texto Livre', email: 'teste.texto@example.com' },
    texto: 'Preciso transportar milho do PR para Toledo, 400 km, frete de R$ 75 por tonelada, saldo de 1.800 toneladas, balança 20m, 15 km de estrada de chão, 24 horas de antecedência.' },
  { cenario: 'logistica_incompleta', solicitante: { nome: 'Teste Incompleto', email: 'teste.incompleto@example.com' },
    texto: 'Preciso transportar soja de MS para Paranaguá.' },
  { cenario: 'logistica_invalida', tipo_informado: 'logistica', solicitante: { nome: 'Teste Inválido', email: 'email-invalido' },
    campos_brutos: { produto: 'MILHO', uf_origem: 'XX', destino: 'Maringá', distancia_km: '-5', frete_ton: '90', saldo_ton: '1000', balanca: '40m', estrada_chao_km: '0', antecedencia_h: '48' } },
];

return casos.map((c, i) => ({ json: {
  canal: 'teste',
  ambiente: 'teste',
  chave_evento: `teste:${execucao}:${i}`,
  solicitante: c.solicitante,
  tipo_informado: c.tipo_informado || null,
  assunto: c.assunto || '',
  texto: c.texto || '',
  campos_brutos: c.campos_brutos || {},
  dados_originais: { cenario: c.cenario, ...c },
  resposta: { via: 'teste' },
} }));
