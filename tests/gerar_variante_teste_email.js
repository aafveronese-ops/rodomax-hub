// Gera uma VARIANTE DE TESTE do workflow (não é entregável): troca o gatilho IMAP por um
// webhook "rodomax/teste-email" que simula o e-mail recebido, e ATIVA o node SMTP com uma
// credencial de teste. Usado apenas para testar localmente o caminho de e-mail sem conta Gmail.
// Uso: node tests/gerar_variante_teste_email.js <id_credencial_smtp> <saida.json>
const fs = require('fs'); const path = require('path');
const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'n8n', 'rodomax_hub_integrado.json'), 'utf8'));
const [credId, saida] = process.argv.slice(2);
const imap = wf.nodes.find((n) => n.name === 'Gatilho E-mail (IMAP)');
Object.assign(imap, { type: 'n8n-nodes-base.webhook', typeVersion: 2, disabled: false, webhookId: '0e000000-0000-4000-8000-000000000001',
  parameters: { httpMethod: 'POST', path: 'rodomax/teste-email', responseMode: 'responseNode', options: {} } });
wf.nodes.push({ id: '0e000000-0000-4000-8000-000000000002', name: 'Simular IMAP', type: 'n8n-nodes-base.code', typeVersion: 2, position: [120, -380],
  parameters: { jsCode: 'return $input.all().map((i) => ({ json: { ...i.json.body, metadata: { "message-id": i.json.body.message_id } }, binary: i.binary }));' } });
wf.connections['Gatilho E-mail (IMAP)'] = { main: [[{ node: 'Simular IMAP', type: 'main', index: 0 }]] };
wf.connections['Simular IMAP'] = { main: [[{ node: 'Preparar E-mail', type: 'main', index: 0 }]] };
const smtp = wf.nodes.find((n) => n.name === 'Enviar Resposta por E-mail');
smtp.disabled = false; smtp.credentials = { smtp: { id: credId, name: 'SMTP teste local' } }; smtp.parameters.fromEmail = 'hub@rodomax.test';
fs.writeFileSync(saida, JSON.stringify(wf, null, 2));
console.log('variante gerada:', saida);
