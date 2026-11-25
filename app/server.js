// =====================================================================================
// RODOMAX HUB — backend leve (Node.js + Express)
// Papel: servir a interface web e ser a CAMADA DE COMUNICAÇÃO com o n8n (webhooks HTTP).
// • Não acessa o PostgreSQL: quem valida, classifica, roda a IA e grava é o workflow do n8n.
// • Não duplica regras de negócio: aqui só há checagens de transporte (arquivo presente,
//   tamanho, finalidade) e tratamento de erros HTTP.
// • Opcional: conector do Telegram (long polling) — ver telegram.js.
// =====================================================================================
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

carregarEnv(path.join(__dirname, '..', '.env'));
const PORT = Number(process.env.APP_PORT || 3000);
const N8N_BASE_URL = (process.env.N8N_BASE_URL || 'http://localhost:5678').replace(/\/$/, '');
const N8N_WEBHOOK_PATH = (process.env.N8N_WEBHOOK_PATH || '/webhook').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.N8N_TIMEOUT_MS || 120000);

const app = express();
app.use(express.json({ limit: '2mb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ----------------------------------- utilitários -----------------------------------
function carregarEnv(arquivo) {   // leitor mínimo de .env (evita dependência extra)
  if (!fs.existsSync(arquivo)) return;
  for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const urlWebhook = (rota) => `${N8N_BASE_URL}${N8N_WEBHOOK_PATH}/rodomax/${rota}`;

class ErroN8n extends Error {
  constructor(status, mensagem, detalhe) { super(mensagem); this.status = status; this.detalhe = detalhe; }
}

// Chama um webhook do n8n e devolve { status, dados }. Trata as falhas mais comuns com mensagens claras.
async function chamarN8n(rota, { method = 'POST', json, form, query } = {}) {
  const url = new URL(urlWebhook(rota));
  Object.entries(query || {}).forEach(([k, v]) => { if (v !== undefined && v !== '') url.searchParams.set(k, v); });
  let resp;
  try {
    resp = await fetch(url, {
      method,
      headers: json ? { 'content-type': 'application/json' } : undefined,
      body: json ? JSON.stringify(json) : form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new ErroN8n(502, `Não foi possível conectar ao n8n em ${N8N_BASE_URL}. Verifique se o container está em execução.`, e.message);
  }
  const texto = await resp.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch (e) { dados = null; }
  if (resp.status === 404 && /not registered/i.test(texto)) {
    throw new ErroN8n(503, 'O webhook do n8n não está registrado: importe o workflow "rodomax_hub_integrado.json" e ative/publique o workflow.', texto.slice(0, 300));
  }
  if (!dados) {
    throw new ErroN8n(502, 'O workflow do n8n não devolveu resposta. Consulte a aba "Executions" do n8n para ver o erro.', `HTTP ${resp.status}: ${texto.slice(0, 300)}`);
  }
  return { status: resp.status, dados };
}

// Encapsula as rotas: erros viram JSON estruturado { ok:false, erro, detalhe }
const rota = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error(`[api] ${req.method} ${req.path}:`, e.message, e.detalhe || '');
    res.status(status).json({ ok: false, erro: e.message, detalhe: e.detalhe || null });
  }
};
const exigir = (cond, msg) => { if (!cond) throw new ErroN8n(400, msg); };

// ------------------------------------ rotas da API ------------------------------------
// Solicitações (frete ou demanda geral) — encaminhadas ao n8n como estão
app.post('/api/demandas', rota(async (req, res) => {
  const corpo = req.body || {};
  exigir(['logistica', 'geral'].includes(corpo.tipo_demanda), 'Informe tipo_demanda: "logistica" ou "geral".');
  corpo.id_requisicao = corpo.id_requisicao || crypto.randomUUID();   // idempotência: reenvio não duplica
  const { status, dados } = await chamarN8n('demanda', { json: corpo });
  res.status(status).json(dados);
}));

// Upload de PDF -> multipart para o n8n (o PDF segue como binário "data")
app.post('/api/upload/pdf', upload.single('arquivo'), rota(async (req, res) => {
  exigir(req.file, 'Selecione um arquivo PDF.');
  const ehPdf = /pdf/i.test(req.file.mimetype) || /\.pdf$/i.test(req.file.originalname);
  exigir(ehPdf, 'O arquivo enviado não é um PDF.');
  const form = new FormData();
  form.append('data', new Blob([req.file.buffer], { type: 'application/pdf' }), req.file.originalname);
  for (const campo of ['nome', 'email', 'telefone', 'tipo_demanda']) if (req.body[campo]) form.append(campo, req.body[campo]);
  form.append('tamanho_bytes', String(req.file.size));
  form.append('id_requisicao', req.body.id_requisicao || crypto.randomUUID());
  const { status, dados } = await chamarN8n('upload-pdf', { form });
  res.status(status).json(dados);
}));

// Upload de CSV -> texto (UTF-8; se não for UTF-8 válido, tenta Latin-1 do Excel)
app.post('/api/upload/csv', upload.single('arquivo'), rota(async (req, res) => {
  exigir(req.file, 'Selecione um arquivo CSV.');
  exigir(/\.(csv|txt)$/i.test(req.file.originalname) || /csv|text/i.test(req.file.mimetype), 'O arquivo enviado não é um CSV.');
  exigir(['historico', 'novas_demandas'].includes(req.body.finalidade), 'Escolha a finalidade: "novas_demandas" ou "historico".');
  let conteudo = new TextDecoder('utf-8').decode(req.file.buffer);
  if (conteudo.includes('\uFFFD')) conteudo = new TextDecoder('latin1').decode(req.file.buffer);
  const { status, dados } = await chamarN8n('upload-csv', { json: {
    nome_arquivo: req.file.originalname, finalidade: req.body.finalidade, conteudo,
    tamanho_bytes: req.file.size, nome: req.body.nome || '', email: req.body.email || '',
  } });
  res.status(status).json(dados);
}));

// Consultas (somente leitura; o n8n consulta o PostgreSQL)
const consulta = (tipo, extra = {}) => rota(async (req, res) => {
  const { status, dados } = await chamarN8n('consulta', { method: 'GET', query: { ...req.query, tipo, ...extra(req) } });
  res.status(status).json(dados);
});
app.get('/api/dashboard', consulta('dashboard', () => ({})));
app.get('/api/demandas', consulta('demandas', () => ({})));
app.get('/api/demandas/:protocolo', consulta('demanda', (req) => ({ protocolo: req.params.protocolo })));
app.get('/api/arquivos', consulta('arquivos', () => ({})));
app.get('/api/modelo', consulta('modelo', () => ({})));

app.post('/api/modelo/treinar', rota(async (req, res) => {
  const { status, dados } = await chamarN8n('ia/treinar', { json: {} });
  res.status(status).json(dados);
}));

// Saúde da integração (n8n alcançável? webhooks ativos? Telegram?)
const telegram = require('./telegram');
app.get('/api/saude', rota(async (req, res) => {
  const saude = { backend: true, n8n: false, workflow_ativo: false, telegram: telegram.status(), n8n_url: N8N_BASE_URL };
  try {
    const r = await fetch(`${N8N_BASE_URL}/healthz`, { signal: AbortSignal.timeout(4000) });
    saude.n8n = r.ok;
    if (r.ok) { await chamarN8n('consulta', { method: 'GET', query: { tipo: 'dashboard' } }); saude.workflow_ativo = true; }
  } catch (e) { saude.erro = e.message; }
  res.json(saude);
}));

// ------------------------------------ frontend ------------------------------------
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use('/api', (req, res) => res.status(404).json({ ok: false, erro: 'Rota da API não encontrada.' }));
app.use((err, req, res, next) => {   // erros do multer (arquivo grande etc.)
  const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo maior que 10 MB.' : err.message;
  res.status(400).json({ ok: false, erro: msg });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Rodomax HUB: http://localhost:${PORT}`);
    console.log(`n8n: ${N8N_BASE_URL}${N8N_WEBHOOK_PATH}/rodomax/...`);
    telegram.iniciar({ chamarN8n });
  });
}
module.exports = { app, chamarN8n };
