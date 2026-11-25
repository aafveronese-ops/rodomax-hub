// =====================================================================
// BLOCO 6A | NORMALIZAR DEMANDA GERAL  (node "Normalizar Dados" da 1ª etapa)
// Padroniza valores de forma conservadora (só altera quando há segurança).
// Campo ausente continua null: nada é inventado.
// =====================================================================

const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
const limpar = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// Só ajusta a caixa se o nome veio TODO em maiúsculas ou TODO em minúsculas.
function normalizarNome(nome) {
  const n = limpar(nome);
  if (n !== n.toUpperCase() && n !== n.toLowerCase()) return n;
  return n.toLowerCase().split(' ')
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');
}
function normalizarTelefone(v) {
  let d = String(v).replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  return d;
}
function normalizarData(v) {
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}
const emBranco = (v) => (v === undefined || v === null || v === '' ? null : v);

return $input.all().map((item, idx) => {
  const j = item.json; const d = j.dados || {};
  const normalizados = {
    nome: emBranco(d.nome && normalizarNome(d.nome)),
    telefone: emBranco(d.telefone && normalizarTelefone(d.telefone)),
    email: emBranco(d.email && limpar(d.email).toLowerCase()),
    documento: emBranco(d.documento && d.documento.replace(/\D/g, '')),
    data_pedido: emBranco(d.data_pedido && normalizarData(d.data_pedido)),
    tipo: emBranco(d.tipo && limpar(d.tipo)),
    observacao: emBranco(d.observacao && limpar(d.observacao)),
    nota_fiscal: emBranco(d.nota_fiscal && limpar(d.nota_fiscal)),
  };
  const alteracoes = Object.keys(normalizados)
    .filter((c) => d[c] !== undefined && d[c] !== normalizados[c])
    .map((c) => ({ campo: c, de: d[c], para: normalizados[c] }));

  return { json: {
    ...j,
    normalizados,
    alteracoes,
    eventos: [...j.eventos, { etapa: 'normalizacao', detalhe: `${alteracoes.length} campo(s) padronizado(s)` }],
  }, pairedItem: { item: idx } };
});
