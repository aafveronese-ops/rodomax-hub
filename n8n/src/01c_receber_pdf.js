// =====================================================================
// BLOCO 1 | RECEBER PDF
// Duas origens chegam aqui:
//   • Webhook Upload PDF (aplicação web): binário "data" + campos opcionais do formulário
//   • Anexo PDF de e-mail (node "Preparar E-mail"): já é um envelope de canal "email"
// Confere nome/tipo do arquivo e repassa o binário para a extração de texto.
// =====================================================================

const texto = (v) => (v === null || v === undefined ? '' : String(v));
return $input.all().map((item, i) => {
  const j = item.json;
  const bin = (item.binary || {}).data;
  if (j.canal === 'email') return { json: j, binary: item.binary, pairedItem: { item: i } };

  const b = j.body || {};
  const nome = bin ? texto(bin.fileName) : '';
  const ehPdf = !!bin && (/pdf/i.test(texto(bin.mimeType)) || /\.pdf$/i.test(nome));
  return {
    json: {
      canal: 'pdf',
      chave_evento: b.id_requisicao ? `pdf:${b.id_requisicao}` : null,
      solicitante: { nome: texto(b.nome).trim(), email: texto(b.email).trim(), telefone: texto(b.telefone).trim() },
      tipo_informado: b.tipo_demanda || null,
      assunto: '',
      texto: '',
      campos_brutos: {},
      dados_originais: {},
      resposta: { via: 'http' },
      arquivo: { nome: nome || 'sem_nome.pdf', mime: bin ? bin.mimeType : null, tamanho: b.tamanho_bytes || null, finalidade: 'documento', eh_pdf: ehPdf },
    },
    binary: item.binary,
    pairedItem: { item: i },
  };
});
