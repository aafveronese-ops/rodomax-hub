// =====================================================================================
// TESTE DE INTEGRAÇÃO PONTA A PONTA: backend -> n8n -> PostgreSQL -> resposta
// Pré-requisitos: banco criado (banco_rodomax.sql), workflow importado e ATIVO, backend rodando.
// Uso (na raiz do projeto):   node tests/teste_integracao.js [http://localhost:3000]
// Cria demandas de teste reais no banco (canal web/csv/pdf/telegram) — rode em ambiente de demonstração.
// =====================================================================================
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const BASE = process.argv[2] || 'http://localhost:3000';
const N8N = process.env.N8N_BASE_URL || 'http://localhost:5678';
const EX = path.join(__dirname, '..', 'dados');
let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'OK   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const json = async (r) => ({ status: r.status, d: await r.json().catch(() => ({})) });
const post = (rota, corpo) => fetch(BASE + rota, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }).then(json);
const get = (rota) => fetch(BASE + rota).then(json);
const enviarArquivo = (rota, arquivo, campos = {}) => {
  const fd = new FormData();
  fd.append('arquivo', new Blob([fs.readFileSync(arquivo)]), path.basename(arquivo));
  Object.entries(campos).forEach(([k, v]) => fd.append(k, v));
  return fetch(BASE + rota, { method: 'POST', body: fd }).then(json);
};

(async () => {
  const s = (await get('/api/saude')).d;
  ok(s.n8n && s.workflow_ativo, `integração backend -> n8n (${s.n8n_url})`);
  if (!s.workflow_ativo) { console.log('Workflow não está ativo: interrompendo.'); process.exit(1); }

  // 1) base histórica + treino
  let r = await enviarArquivo('/api/upload/csv', path.join(EX, 'rodomax_demandas.csv'), { finalidade: 'historico' });
  ok(r.d.ok && r.d.validos === 500, `base histórica: 500 válidas (${r.d.inseridos} novas, ${r.d.ja_existentes} já existiam)`);
  r = await fetch(BASE + '/api/modelo/treinar', { method: 'POST' }).then(json);
  ok(r.d.ok && r.d.resumo.acuracia > r.d.resumo.acuracia_linha_base, `treino: acurácia ${r.d.resumo?.acuracia} x linha de base ${r.d.resumo?.acuracia_linha_base}`);

  // 2) demandas web
  const frete = { tipo_demanda: 'logistica', nome: 'Teste Integração', email: 'integracao@example.com', produto: 'SOJA', uf_origem: 'PR', destino: 'Paranaguá', distancia_km: 560, frete_ton: 150, saldo_ton: 2500, balanca: '25m', estrada_chao_km: 0, antecedencia_h: 72 };
  const id = crypto.randomUUID();
  r = await post('/api/demandas', { ...frete, id_requisicao: id });
  ok(/^RDM-\d{6}$/.test(r.d.protocolo) && ['sim', 'nao'].includes(r.d.previsao?.classe), `frete: ${r.d.protocolo} -> previsão "${r.d.previsao?.classe}"`);
  const r2 = await post('/api/demandas', { ...frete, id_requisicao: id });
  ok(r2.d.protocolo === r.d.protocolo && r2.d.duplicado, 'reenvio do mesmo pedido não duplica');
  r = await post('/api/demandas', { tipo_demanda: 'geral', nome: 'Teste', email: 't@example.com', descricao: 'Preciso da segunda via do boleto' });
  ok(r.d.setor === 'Financeiro' && !r.d.previsao, 'demanda geral -> setor Financeiro, sem previsão de IA');
  r = await post('/api/demandas', { tipo_demanda: 'logistica', nome: 'Teste', email: 't@example.com', produto: 'MILHO' });
  ok(r.d.situacao === 'pendente', 'frete incompleto -> pendente');
  r = await post('/api/demandas', { ...frete, uf_origem: 'ZZ', balanca: '99m' });
  ok(r.d.situacao === 'rejeitada', 'frete com valores inválidos -> rejeitada');

  // 3) arquivos
  r = await enviarArquivo('/api/upload/pdf', path.join(EX, 'exemplos', 'demanda_frete_exemplo.pdf'));
  ok(r.d.protocolo && r.d.tipo_demanda === 'logistica', `PDF de frete -> ${r.d.protocolo}`);
  r = await enviarArquivo('/api/upload/pdf', path.join(EX, 'exemplos', 'pdf_sem_texto_exemplo.pdf'));
  ok(r.status === 422 && r.d.situacao === 'sem_texto', 'PDF sem texto -> informado, sem inventar conteúdo');
  r = await enviarArquivo('/api/upload/csv', path.join(EX, 'exemplos', 'novas_demandas_exemplo.csv'), { finalidade: 'novas_demandas' });
  ok(r.d.ok && r.d.registros_lidos === 9, `CSV novas demandas: 1 arquivo, ${r.d.registros_lidos} registros (${r.d.registros_importados} importados, ${r.d.nesta_execucao?.duplicadas_ignoradas} já existentes)`);
  r = await enviarArquivo('/api/upload/csv', path.join(EX, 'exemplos', 'novas_demandas_exemplo.csv'), { finalidade: 'historico' });
  ok(r.status === 422, 'CSV sem "atendida" recusado como base histórica');

  // 4) Telegram (direto no webhook do n8n, formato oficial de Update)
  const chat = 900000 + Math.floor(Math.random() * 99999); let u = Date.now() % 1e9;
  const tg = async (texto) => (await fetch(`${N8N}/webhook/rodomax/telegram`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ update_id: ++u, message: { message_id: u, from: { id: chat, first_name: 'Teste' }, chat: { id: chat, type: 'private' }, date: 1, text: texto } }) }).then((x) => x.json())).texto || '';
  let t = await tg('Preciso transportar milho do PR para Toledo');
  ok(/dist[âa]ncia/i.test(t), 'Telegram: pergunta o próximo dado (distância)');
  for (const v of ['420', '90', '1200', '25m', '8']) t = await tg(v);
  t = await tg('48');
  ok(/RDM-\d{6}/.test(t) && /EXPERIMENTAL/.test(t), 'Telegram: conversa concluída com protocolo e previsão');

  // 5) consultas do dashboard
  const dash = (await get('/api/dashboard')).d.dados;
  ok(dash && dash.demandas.total > 0 && dash.modelo_ativo, `dashboard: ${dash?.demandas.total} demandas, modelo ${dash?.modelo_ativo?.versao}`);
  const lista = (await get('/api/demandas?tipo_demanda=logistica&limite=5')).d.dados;
  ok(lista.itens.length > 0 && lista.itens.every((i) => i.tipo_demanda === 'logistica'), 'histórico filtrado por tipo');
  const det = (await get(`/api/demandas/${lista.itens[0].protocolo}`)).d.dados;
  ok(det && det.eventos.length >= 3, 'detalhe do protocolo com histórico de processamento');

  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTodos os testes passaram.');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('Erro inesperado:', e); process.exit(1); });
