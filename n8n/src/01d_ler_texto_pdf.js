// =====================================================================
// BLOCO 3 | LER TEXTO DO PDF
// Junta o texto extraído (node "Extrair Texto do PDF") ao envelope de origem.
// • PDF sem texto (escaneado/imagem) ou corrompido: a situação é informada e NADA
//   é inventado. OCR não faz parte desta versão.
// • Linhas "Chave: valor" viram campos; o restante vira texto livre (extraído depois).
// Saída: { arquivo_registro (para hub_arquivos), envelope (segue no pipeline) }
// =====================================================================

const texto = (v) => (v === null || v === undefined ? '' : String(v));
function lerChaveValor(conteudo) {
  const campos = {};
  for (const linha of texto(conteudo).split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Za-zÀ-ÿ /()_-]{2,40}):\s*(.+)$/);
    if (m) campos[m[1].trim()] = m[2].trim();
  }
  return campos;
}

const origens = $('Receber PDF').all();
return $input.all().map((item, i) => {
  const env = { ...origens[i].json };
  const ext = item.json || {};
  const erro = ext.error ? texto(ext.error.message || ext.error) : null;
  const conteudo = texto(ext.text).replace(/\u0000/g, '').trim();
  const legivel = !erro && conteudo.replace(/\s/g, '').length >= 10;
  const status = erro ? 'erro' : legivel ? 'recebido' : 'sem_texto';
  const detalhe = erro ? `Falha na extração: ${erro}` : legivel ? `${ext.numpages || '?'} página(s), ${conteudo.length} caracteres extraídos`
    : 'PDF sem texto extraível (provavelmente escaneado/imagem). OCR não faz parte desta versão.';

  const campos = legivel ? lerChaveValor(conteudo) : {};
  if (env.canal === 'email') {
    // e-mail: o texto do anexo complementa o corpo da mensagem
    if (legivel) { env.texto = [env.texto, conteudo].filter(Boolean).join('\n\n'); env.campos_brutos = { ...campos, ...env.campos_brutos }; }
    env.dados_originais = { ...env.dados_originais, texto_anexo_pdf: legivel ? conteudo.slice(0, 5000) : null };
  } else {
    env.texto = conteudo.slice(0, 10000);
    env.campos_brutos = campos;
    env.dados_originais = { arquivo: env.arquivo.nome, texto_extraido: conteudo.slice(0, 5000), formulario: env.solicitante };
  }
  env.eventos = [{ etapa: 'pdf', detalhe: `${env.arquivo.nome}: ${detalhe}` }];
  env.pdf_legivel = env.canal === 'email' ? true : legivel;   // e-mail ainda tem o corpo da mensagem
  env.pdf_detalhe = detalhe;

  return {
    json: {
      arquivo_registro: {
        nome_arquivo: env.arquivo.nome, tipo_arquivo: 'pdf', finalidade: 'documento', canal: env.canal,
        tamanho_bytes: Number(env.arquivo.tamanho) || null,
        registros_total: legivel ? 1 : 0, status, texto_extraido: legivel ? conteudo : null, detalhe,
      },
      envelope: env,
    },
    pairedItem: { item: i },
  };
});
