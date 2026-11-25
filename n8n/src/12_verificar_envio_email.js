// =====================================================================
// BLOCO 10 | VERIFICAR ENVIO DO E-MAIL
// O node "Enviar Resposta por E-mail" continua mesmo se falhar (On Error: continuar).
// Aqui descobrimos o que aconteceu e registramos — a demanda NUNCA é apagada:
//   accepted preenchido -> "enviada"
//   error               -> "nao_enviada" (motivo registrado)
//   node desativado     -> "nao_enviada" (envio por e-mail ainda não configurado)
// =====================================================================

const originais = $('Responder por Canal').all(2);   // saída 2 do Switch = e-mail
return $input.all().map((item, i) => {
  const r = item.json || {};
  const o = (originais[i] || item).json;
  let status; let detalhe;
  if (Array.isArray(r.accepted) && r.accepted.length) { status = 'enviada'; detalhe = `SMTP aceitou para ${r.accepted.join(', ')}`; }
  else if (r.error) { status = 'nao_enviada'; detalhe = `Falha no envio: ${String(r.error.message || r.error).slice(0, 300)}`; }
  else { status = 'nao_enviada'; detalhe = 'Envio por e-mail desativado no workflow (configure a credencial SMTP e ative o node).'; }
  return { json: { demanda_id: o.demanda_id, protocolo: o.protocolo, status, detalhe }, pairedItem: { item: i } };
});
