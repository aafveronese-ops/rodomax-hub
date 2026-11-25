// Validação ESTÁTICA do workflow gerado (sem n8n): JSON válido, um único workflow, IDs e nomes
// únicos, conexões para nodes existentes, código JS de todos os Code nodes compilável,
// nenhum segredo embutido e credenciais apenas por referência.
const fs = require('fs'); const path = require('path');
const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'n8n', 'rodomax_hub_integrado.json'), 'utf8'));
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FALHA'} ${m}`); if (!c) process.exitCode = 1; };
const nomes = new Set(wf.nodes.map((n) => n.name));
ok(Array.isArray(wf.nodes) && wf.connections && wf.settings.executionOrder === 'v1', 'estrutura de workflow n8n (executionOrder v1)');
ok(nomes.size === wf.nodes.length, `nomes únicos (${wf.nodes.length} nodes)`);
ok(new Set(wf.nodes.map((n) => n.id)).size === wf.nodes.length, 'IDs únicos');
const destinos = Object.values(wf.connections).flatMap((c) => c.main.flat().map((l) => l.node));
ok(Object.keys(wf.connections).every((n) => nomes.has(n)) && destinos.every((n) => nomes.has(n)), `${destinos.length} conexões apontam para nodes existentes`);
const semEntrada = wf.nodes.filter((n) => !/Trigger|webhook|stickyNote|emailReadImap/i.test(n.type) && !destinos.includes(n.name));
ok(semEntrada.length === 0, `todo node de processamento tem entrada ${semEntrada.map((n) => n.name).join(', ')}`);
ok(!wf.nodes.some((n) => n.type === 'n8n-nodes-base.executeWorkflow'), 'nenhum sub-workflow (workflow único)');
for (const n of wf.nodes.filter((x) => x.type === 'n8n-nodes-base.code')) {
  try { new Function('$input', '$', '$getWorkflowStaticData', `return (async () => {\n${n.parameters.jsCode}\n})`); ok(true, `código compila: ${n.name}`); }
  catch (e) { ok(false, `código compila: ${n.name} -> ${e.message}`); }
}
const texto = JSON.stringify(wf);
ok(!/bot\d{6,}:[A-Za-z0-9_-]{20,}|password"\s*:\s*"[^"]+"|apiKey/i.test(texto), 'nenhum token/senha embutido no JSON');
const paths = wf.nodes.filter((n) => n.type === 'n8n-nodes-base.webhook').map((n) => `${n.parameters.httpMethod} ${n.parameters.path}`);
ok(new Set(paths).size === paths.length, `webhooks sem conflito: ${paths.join(' | ')}`);
ok(wf.nodes.filter((n) => n.disabled).map((n) => n.name).join(',') === 'Gatilho E-mail (IMAP),Enviar Resposta por E-mail', 'somente os nodes de e-mail vêm desativados (dependem de credencial)');
