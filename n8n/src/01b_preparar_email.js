// =====================================================================
// BLOCO 1 | PREPARAR E-MAIL RECEBIDO (Email Trigger IMAP — formato "simple")
// • Lê remetente, assunto e corpo; preserva o conteúdo original.
// • NÃO presume que todo e-mail é frete: o tipo é decidido depois (geral x logística).
// • Ignora respostas automáticas (no-reply, mailer-daemon, "Auto-Submitted") para não
//   criar laço de respostas entre robôs.
// • Primeiro anexo PDF -> binário "data", para o node "Extrair Texto do PDF".
// =====================================================================

const texto = (v) => (v === null || v === undefined ? '' : String(v));
// "Nome <email@x.com>" -> { nome, email } (aceita também o formato "resolved" do n8n)
function lerRemetente(from) {
  if (from && typeof from === 'object' && Array.isArray(from.value)) return { nome: texto(from.value[0]?.name), email: texto(from.value[0]?.address) };
  const m = texto(from).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { nome: m[1].trim(), email: m[2].trim() } : { nome: '', email: texto(from).trim() };
}
const semHtml = (h) => texto(h).replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').trim();
// TXT/PDF/e-mail: linhas "Chave: valor" viram campos
function lerChaveValor(conteudo) {
  const campos = {};
  for (const linha of texto(conteudo).split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Za-zÀ-ÿ /()_-]{2,40}):\s*(.+)$/);
    if (m) campos[m[1].trim()] = m[2].trim();
  }
  return campos;
}

const saida = [];
for (const item of $input.all()) {
  const j = item.json;
  const rem = lerRemetente(j.from);
  const meta = j.metadata || j.headers || {};
  const autoSubmitted = texto(meta['auto-submitted'] || '').toLowerCase();
  const assunto = texto(j.subject).trim();
  const corpo = (texto(j.textPlain || j.text).trim() || semHtml(j.textHtml || j.html)).slice(0, 10000);

  // filtro anti-laço: mensagens automáticas não geram demanda nem resposta
  if (/no-?reply|mailer-daemon|postmaster/i.test(rem.email) || (autoSubmitted && autoSubmitted !== 'no')) continue;

  // primeiro anexo PDF vira o binário "data"
  const binarios = item.binary || {};
  const chavePdf = Object.keys(binarios).find((k) => /pdf/i.test(binarios[k].mimeType || '') || /\.pdf$/i.test(binarios[k].fileName || ''));
  const anexos = Object.values(binarios).map((b) => b.fileName).filter(Boolean);
  const messageId = texto(meta['message-id'] || j.messageId || '').trim();

  saida.push({
    json: {
      canal: 'email',
      chave_evento: `email:${messageId || (rem.email + '|' + assunto + '|' + texto(j.date))}`,
      solicitante: { nome: rem.nome, email: rem.email },
      assunto,
      texto: corpo,
      campos_brutos: lerChaveValor(corpo),
      dados_originais: { de: texto(j.from?.text || j.from), assunto, data: texto(j.date), corpo, anexos, message_id: messageId },
      resposta: { via: 'email', email: rem.email, assunto: assunto ? `Re: ${assunto}` : 'Rodomax HUB — sua solicitação' },
      tem_pdf: !!chavePdf,
      arquivo: chavePdf ? { nome: binarios[chavePdf].fileName, mime: binarios[chavePdf].mimeType, finalidade: 'documento' } : null,
    },
    binary: chavePdf ? { data: binarios[chavePdf] } : undefined,
  });
}
return saida;
