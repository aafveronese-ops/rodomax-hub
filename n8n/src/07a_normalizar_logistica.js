// =====================================================================
// BLOCO 6B | NORMALIZAR ATRIBUTOS LOGÍSTICOS
// Deixa os atributos no MESMO formato do dataset usado no treino:
//   produto MAIÚSCULO sem acento (MILHO) | UF em sigla (PR) | destino sem acento, iniciais
//   maiúsculas (Paranagua) | balança 20m/25m/30m/sem_restricao | números como Number.
// Dados pessoais (nome, e-mail, telefone) NÃO entram nos atributos da IA.
// =====================================================================

const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const titulo = (s) => semAcento(s).toLowerCase().replace(/\s+/g, ' ').trim()
  .split(' ').map((p) => (['de', 'da', 'do', 'das', 'dos'].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');
const limpar = (s) => (s === undefined || s === null || String(s).trim() === '' ? null : String(s).replace(/\s+/g, ' ').trim());

return $input.all().map((item, idx) => {
  const j = item.json; const l = j.logistica_validada || {}; const d = j.dados || {};
  const atributos = {
    produto: semAcento(l.produto).toUpperCase().trim(),
    uf_origem: l.uf_origem,
    destino: titulo(l.destino),
    distancia_km: l.distancia_km,
    frete_ton: l.frete_ton,
    saldo_ton: l.saldo_ton,
    balanca: l.balanca,
    estrada_chao_km: l.estrada_chao_km,
    antecedencia_h: l.antecedencia_h,
  };
  const normalizados = {
    nome: limpar(d.nome), email: d.email ? String(d.email).trim().toLowerCase() : null,
    telefone: d.telefone ? String(d.telefone).replace(/\D/g, '') : null,
    tipo: limpar(d.tipo), observacao: limpar(d.observacao),
  };
  return { json: {
    ...j,
    atributos_ia: atributos,
    normalizados,
    eventos: [...j.eventos, { etapa: 'normalizacao', detalhe: 'Atributos logísticos padronizados no formato do dataset' }],
  }, pairedItem: { item: idx } };
});
