// Usado apenas no teste automatizado do conector (TELEGRAM_API_BASE=http://127.0.0.1:8081).
// Mock mínimo da Bot API do Telegram para testar o conector (getMe, getWebhookInfo, getUpdates, sendMessage)
const http = require('http');
const fila = ['/start', 'Preciso transportar soja do PR para Paranaguá', '600', '170', '2000', 'sem restrição', '0', '96', 'Quero reclamar do atraso na entrega'];
let id = 5000; const enviados = [];
http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => b += c); req.on('end', () => {
    const m = req.url.split('/').pop(); const j = (r) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ok: true, result: r })); };
    if (m === 'getMe') return j({ username: 'rodomax_mock_bot' });
    if (m === 'getWebhookInfo') return j({ url: '' });
    if (m === 'sendMessage') { enviados.push(JSON.parse(b)); require('fs').writeFileSync('process.env.SAIDA || 'enviados_mock.json'', JSON.stringify(enviados, null, 1)); return j({}); }
    if (m === 'getUpdates') {
      // entrega uma mensagem por vez, após a resposta anterior
      if (fila.length && enviados.length >= (id - 5000)) { id++; const t = fila.shift(); return j([{ update_id: id, message: { message_id: id, from: { id: 999, first_name: 'Teste', last_name: 'Mock' }, chat: { id: 999, type: 'private' }, date: 1, text: t } }]); }
      return setTimeout(() => j([]), 500);
    }
    j({});
  });
}).listen(8081);
