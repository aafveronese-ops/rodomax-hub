// =====================================================================================
// CONECTOR DO TELEGRAM (long polling) — opcional, ativado por TELEGRAM_BOT_TOKEN no .env
//
// Por que existe: o Telegram só entrega webhooks para URLs públicas HTTPS. Em uma demonstração
// local (Docker Desktop, sem domínio), o n8n não é alcançável pelo Telegram. Este conector
// busca as mensagens (getUpdates) e as entrega ao webhook /rodomax/telegram do n8n.
// TODA a lógica (conversa, validação, IA, banco, texto da resposta) está no n8n; aqui apenas
// transportamos a mensagem e enviamos ao usuário o texto que o n8n devolveu.
// =====================================================================================
const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || '';
const API = () => (process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/$/, '');

const estado = { ativo: false, ultimo_erro: null, mensagens_recebidas: 0, respostas_enviadas: 0, iniciado_em: null, bot: null };
let offset = 0;

async function api(metodo, corpo) {
  const r = await fetch(`${API()}/bot${TOKEN()}/${metodo}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo || {}),
    signal: AbortSignal.timeout(40000),
  });
  const d = await r.json().catch(() => ({}));
  if (!d.ok) { const e = new Error(d.description || `Telegram HTTP ${r.status}`); e.codigo = d.error_code || r.status; throw e; }
  return d.result;
}
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function ciclo(chamarN8n) {
  const updates = await api('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'edited_message'] });
  for (const u of updates) {
    offset = u.update_id + 1;              // confirma o update (não será entregue de novo)
    estado.mensagens_recebidas++;
    try {
      const { dados } = await chamarN8n('telegram', { json: u });
      if (dados && dados.texto && dados.chat_id) {
        await api('sendMessage', { chat_id: dados.chat_id, text: String(dados.texto).slice(0, 4000) });
        estado.respostas_enviadas++;
      }
    } catch (e) {
      estado.ultimo_erro = `${new Date().toISOString()} ${e.message}`;
      console.error('[telegram] falha ao processar update', u.update_id, e.message);
      const chat = u.message?.chat?.id;
      if (chat) await api('sendMessage', { chat_id: chat, text: 'Recebemos sua mensagem, mas o HUB está indisponível no momento. Tente novamente em alguns minutos.' }).catch(() => {});
    }
  }
}

async function iniciar({ chamarN8n }) {
  if (!TOKEN()) { console.log('Telegram: desativado (defina TELEGRAM_BOT_TOKEN no .env para ativar)'); return; }
  try {
    estado.bot = (await api('getMe')).username;
    const info = await api('getWebhookInfo');
    if (info.url) console.warn(`[telegram] o bot tem um webhook configurado (${info.url}); getUpdates não funciona enquanto ele existir.`);
  } catch (e) { estado.ultimo_erro = e.message; console.error('[telegram] token inválido ou sem acesso à API:', e.message); return; }
  estado.ativo = true; estado.iniciado_em = new Date().toISOString();
  console.log(`Telegram: conector ativo para @${estado.bot}`);
  (async function loop() {
    for (;;) {
      try { await ciclo(chamarN8n); } catch (e) {
        estado.ultimo_erro = `${new Date().toISOString()} ${e.message}`;
        console.error('[telegram]', e.message);
        await esperar(e.codigo === 409 ? 15000 : 5000);
      }
    }
  })();
}

const status = () => ({ configurado: !!TOKEN(), ...estado });
module.exports = { iniciar, status };
