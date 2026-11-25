// =====================================================================
// BLOCO IA | VALIDAR BASE HISTÓRICA (CSV com finalidade "historico")
// Confere cada linha antes de gravar em ia_historico. Os valores NÃO são alterados
// (só convertidos para número/minúsculas onde o tipo exige). Linhas com problema são
// rejeitadas e CONTADAS, com o motivo — nunca descartadas em silêncio.
// =====================================================================

const env = $input.first().json.envelope;
const NUM = ['distancia_km', 'frete_ton', 'saldo_ton', 'estrada_chao_km', 'antecedencia_h'];
const TXT = ['produto', 'uf_origem', 'destino', 'balanca'];
const validos = []; const rejeitados = []; const ids = new Set();

for (const { linha, campos: c } of env.linhas) {
  const motivos = [];
  const id = Number(c.id_demanda);
  if (!Number.isInteger(id) || id <= 0) motivos.push('id_demanda ausente ou inválido');
  else if (ids.has(id)) motivos.push(`id_demanda ${id} repetido no arquivo`);
  const reg = { id_demanda: id, canal: c.canal || null, status_agendamento: c.status_agendamento || null };
  for (const k of NUM) {
    const v = c[k] === '' || c[k] === undefined ? NaN : Number(String(c[k]).replace(',', '.'));
    if (Number.isNaN(v) || v < 0) motivos.push(`${k} inválido: "${c[k] ?? ''}"`); else reg[k] = v;
  }
  for (const k of TXT) { if (!c[k]) motivos.push(`${k} ausente`); else reg[k] = c[k]; }
  const at = String(c.atendida || '').trim().toLowerCase();
  if (!['sim', 'nao'].includes(at)) motivos.push(`atendida deve ser "sim" ou "nao": "${c.atendida ?? ''}"`); else reg.atendida = at;

  if (motivos.length) rejeitados.push({ linha, motivos });
  else { validos.push(reg); ids.add(id); }
}

return [{ json: {
  arquivo_id: env.arquivo_id,
  nome_arquivo: env.nome_arquivo,
  registros: validos,
  total_linhas: env.linhas.length,
  rejeitados: rejeitados.length,
  exemplos_rejeicao: rejeitados.slice(0, 20),
} }];
