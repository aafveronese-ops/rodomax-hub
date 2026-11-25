// =====================================================================
// BLOCO 1 | INTERPRETAR MENSAGEM DO TELEGRAM (conversa progressiva)
// Recebe o "Update" do Telegram (mesmo formato da API oficial) + o estado da conversa
// salvo no PostgreSQL. Decide a ação:
//   "ignorar"   -> update repetido ou sem mensagem (nada a responder)
//   "responder" -> comandos /start, /ajuda, /cancelar (resposta direta, sem demanda)
//   "processar" -> monta o envelope e segue para o pipeline comum do HUB
// A extração de campos NÃO é repetida aqui: o pipeline comum extrai, valida e, se faltar
// dado, o node "Perguntar Próximo Dado" pede ao usuário UM campo por vez.
// =====================================================================

const update = $('Webhook Telegram').first().json.body || {};
const conversa = $input.first().json.conversa || {};
const estado = conversa.estado || {};
const msg = update.message || update.edited_message || null;

const BOAS_VINDAS = [
  'Olá! Aqui é o Rodomax HUB.',
  '',
  'Você pode enviar:',
  '• um pedido de FRETE — ex.: "Preciso transportar milho do PR para Toledo"',
  '• qualquer outra solicitação (financeiro, cadastro, atendimento...) — ex.: "Preciso da segunda via do boleto"',
  '',
  'Se faltar alguma informação, eu pergunto. Comandos: /cancelar (recomeçar) e /ajuda.',
].join('\n');

const saida = (dados) => [{ json: { update_id: update.update_id ?? null, ...dados } }];

if (!msg || !msg.chat) return saida({ acao: 'ignorar', chat_id: null, texto: null, motivo: 'update sem mensagem' });
const chatId = msg.chat.id;
if (conversa.ultimo_update && update.update_id && Number(update.update_id) <= Number(conversa.ultimo_update)) {
  return saida({ acao: 'ignorar', chat_id: chatId, texto: null, motivo: 'update já processado (duplicado)' });
}
if (typeof msg.text !== 'string' || !msg.text.trim()) {
  return saida({ acao: 'responder', chat_id: chatId, estado, texto: 'Por enquanto eu só entendo mensagens de texto. Descreva sua solicitação em uma mensagem.' });
}

const textoMsg = msg.text.trim();
const comando = textoMsg.toLowerCase().split(/\s|@/)[0];
if (['/start', '/ajuda', '/help'].includes(comando)) return saida({ acao: 'responder', chat_id: chatId, estado: {}, texto: BOAS_VINDAS });
if (/^(oi|ola|olá|opa|bom dia|boa tarde|boa noite|e ai|e aí|hello|hi)[!.?\s]*$/i.test(textoMsg) && !estado.aguardando) return saida({ acao: 'responder', chat_id: chatId, estado: {}, texto: BOAS_VINDAS });
if (['/cancelar', '/cancel'].includes(comando)) return saida({ acao: 'responder', chat_id: chatId, estado: {}, texto: 'Conversa cancelada. Quando quiser, envie uma nova solicitação.' });

// ----- acumula a conversa -----
const nome = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.chat.title || 'Usuário do Telegram';
const campos = { ...(estado.campos || {}) };
let textos = [...(estado.textos || [])];
// resposta curta a uma pergunta feita -> vale para o campo perguntado; texto longo -> vai para o texto livre
if (estado.aguardando && textoMsg.length <= 40) campos[estado.aguardando] = textoMsg;
else textos.push(textoMsg);
textos = textos.slice(-10);

return saida({
  acao: 'processar',
  chat_id: chatId,
  envelope: {
    canal: 'telegram',
    chave_evento: `telegram:${update.update_id}`,
    solicitante: { nome, telegram_chat_id: chatId, telegram_usuario: msg.from?.username || null },
    tipo_informado: estado.tipo || null,
    assunto: '',
    texto: textos.join('\n'),
    campos_brutos: campos,
    dados_originais: { mensagens: textos, respostas: campos, ultimo_update: update.update_id, de: { id: msg.from?.id, username: msg.from?.username || null } },
    resposta: { via: 'telegram', chat_id: chatId, update_id: update.update_id },
    telegram: { chat_id: chatId, update_id: update.update_id, estado_anterior: estado },
  },
});
