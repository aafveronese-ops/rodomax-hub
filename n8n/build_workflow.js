#!/usr/bin/env node
// =====================================================================================
// Gera n8n/rodomax_hub_integrado.json (UM ÚNICO workflow, um único canvas) a partir do
// código dos Code nodes em n8n/src/*.js. Assim o código fica legível/versionável e o
// JSON importável é sempre reproduzível:   node n8n/build_workflow.js
// Não é necessário rodar este script para usar o projeto: o JSON já vem gerado.
// =====================================================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, 'rodomax_hub_integrado.json');
// Credencial PostgreSQL já existente no n8n da equipe (mesma do workflow "ultimo").
// Ao importar, se o id não existir, basta selecionar a credencial em cada node PostgreSQL.
const PG_CRED = { postgres: { id: 'xRB358Nv1hfm25RQ', name: 'Postgres account' } };

const uuid = (seed) => {
  const h = crypto.createHash('sha1').update('rodomax-hub:' + seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const code = (file) => fs.readFileSync(path.join(SRC, file), 'utf8')
  .replace(/[\u0300-\u036f\ufeff\ufffd]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));   // mantém caracteres invisíveis como escapes legíveis

const nodes = [];
const connections = {};
const add = (n) => { nodes.push({ id: uuid(n.name), ...n }); return n.name; };
const link = (from, to, outIndex = 0, inIndex = 0) => {
  connections[from] = connections[from] || { main: [] };
  while (connections[from].main.length <= outIndex) connections[from].main.push([]);
  connections[from].main[outIndex].push({ node: to, type: 'main', index: inIndex });
};

// ------------------------------ fábricas de nodes ------------------------------
const webhook = (name, pos, method, p, extra = {}) => add({ name, type: 'n8n-nodes-base.webhook', typeVersion: 2, position: pos, webhookId: uuid('wh:' + p),
  parameters: { httpMethod: method, path: p, responseMode: 'responseNode', options: {} }, ...extra });
const codeNode = (name, pos, file, extra = {}) => add({ name, type: 'n8n-nodes-base.code', typeVersion: 2, position: pos, parameters: { jsCode: code(file) }, ...extra });
const pg = (name, pos, query, replacement, extra = {}) => add({ name, type: 'n8n-nodes-base.postgres', typeVersion: 2.5, position: pos,
  parameters: { operation: 'executeQuery', query, options: replacement ? { queryReplacement: replacement } : {} }, credentials: PG_CRED, ...extra });
const respond = (name, pos, body, code_ = 200, extra = {}) => add({ name, type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.4, position: pos,
  parameters: { respondWith: 'json', responseBody: body, options: code_ === 200 ? {} : { responseCode: code_ } }, ...extra });
const cond = (expr, i) => ({ id: uuid('cond:' + expr + i), leftValue: expr, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } });
const switchNode = (name, pos, regras, fallback = false) => add({ name, type: 'n8n-nodes-base.switch', typeVersion: 3.2, position: pos,
  parameters: {
    rules: { values: regras.map(([rotulo, expr], i) => ({
      conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 }, conditions: [cond(expr, i)], combinator: 'and' },
      renameOutput: true, outputKey: rotulo })) },
    options: fallback ? { fallbackOutput: 'extra', renameFallbackOutput: 'Outro' } : {},
  } });
const ifNode = (name, pos, expr) => add({ name, type: 'n8n-nodes-base.if', typeVersion: 2.2, position: pos,
  parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 }, conditions: [cond(expr, 0)], combinator: 'and' }, options: {} } });
let nota = 0;
const sticky = (titulo, texto, pos, w, h, color) => add({ name: `Nota ${String(++nota).padStart(2, '0')} - ${titulo}`, type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: pos,
  parameters: { content: `## ${titulo}\n${texto}`, width: w, height: h, ...(color ? { color } : {}) } });

// ======================================================================================
// LAYOUT (x cresce da esquerda para a direita, seguindo o fluxo)
//   y -900 Telegram | y -480 E-mail | y 0 Web | y 380 PDF | y 760 CSV
//   y 1200 Consultas (dashboard) | y 1700 IA (treino) / testes
// ======================================================================================
const Y = { tg: -900, mail: -480, web: 0, pdf: 380, csv: 760, consulta: 1240, ia: 1760, teste: 2060 };

// ---------------------------- Sticky notes (blocos) ----------------------------
sticky('RODOMAX HUB — WORKFLOW CENTRAL ÚNICO', 'Projeto acadêmico (Data Science e IA). Um único canvas recebe TODOS os canais, valida, separa **demandas gerais** (classificação por regras) de **demandas logísticas** (IA CART/Gini), grava no PostgreSQL e responde pelo canal de origem.\n\nBlocos: 1 Entradas · 2 Consolidação · 3 Mapeamento · 4 Validação · 5 Direcionamento · 6A Gerais · 6B Logísticas/IA · 7 PostgreSQL · 8 Respostas · 9 Consultas · 10 Erros/Testes.\n\nO workflow "ultimo" (1ª etapa) foi preservado; a lógica válida dele foi reaproveitada aqui.', [-420, -1420], 900, 340, 6);
sticky('1 · ENTRADAS', 'Telegram (via conector do backend), E-mail (IMAP — **desativado até configurar a credencial**), Web (formulários), PDF e CSV (uploads da aplicação web).\n\n**Portal**: canal apenas demonstrativo (sem integração nesta versão). **WhatsApp**: substituído pelo Telegram.', [-420, -1040], 300, 2260, 7);
sticky('Telegram — conversa progressiva', 'Recebe o Update do Telegram. Estado da conversa em `telegram_conversas`. Comandos: /start, /ajuda, /cancelar.', [-80, -1040], 1200, 300, 4);
sticky('E-mail (IMAP + SMTP)', 'Gatilho e envio **desativados por padrão**: configure as credenciais (Gmail + senha de app) e ative os dois nodes. Respostas automáticas (no-reply) são ignoradas para evitar laços.', [-80, -620], 1200, 300, 4);
sticky('Web — formulários', 'Formulários de frete e de demanda geral da aplicação web (backend → este webhook).', [-80, -140], 1200, 280, 4);
sticky('PDF — extração de texto', 'PDF convencional: texto extraído pelo n8n. PDF escaneado/sem texto é informado ao usuário (sem OCR, nada é inventado).', [-80, 240], 1200, 300, 4);
sticky('CSV — dois tipos de importação', '**historico**: base rotulada (com `atendida`) → só treino/avaliação da IA.\n**novas_demandas**: cada linha vira uma demanda (sem `atendida`: é o que a IA prevê).', [-80, 620], 1700, 340, 4);
sticky('2-4 · CONSOLIDAR · MAPEAR · IDENTIFICAR · VALIDAR', 'Envelope padrão para todos os canais → sinônimos de campos e extração do texto livre → **geral x logística** → auditoria e validação (valida / pendente / rejeitada).', [1440, -260], 1060, 420, 5);
sticky('5 · DIRECIONAMENTO', 'Telegram incompleto → pergunta o próximo dado.\nGeral → 6A · Logística → 6B · Pendente/Rejeitada → registro direto.', [2520, -260], 300, 420, 3);
sticky('6A · DEMANDAS GERAIS', 'Normalização + classificação **por regras** (palavras-chave → setor). Não é IA e não usa a árvore.', [2860, -560], 560, 300, 5);
sticky('6B · DEMANDAS LOGÍSTICAS — IA', 'Atributos no formato do dataset → modelo ATIVO do banco → **árvore CART (Gini)** → previsão + explicação (caminho na árvore). Previsão experimental.', [2860, 120], 820, 320, 2);
sticky('Telegram: coleta de dados', 'Faltou dado ou valor inválido: o bot guarda o que já recebeu e pergunta UM campo por vez.', [2860, -1040], 820, 300, 3);
sticky('7 · POSTGRESQL', 'Merge une os 3 caminhos → registro único → `hub_registrar_demanda()` gera o protocolo **RDM-000000** e evita duplicidade (chave_evento). Falha do banco não gera protocolo falso.', [3720, -260], 800, 420, 6);
sticky('8 · RESPOSTAS POR CANAL', 'Mesmo conteúdo para todos os canais; muda só a entrega: tela web, Telegram, e-mail (SMTP) ou resumo do lote CSV. Falha no envio **não apaga** a demanda (status registrado).', [4560, -560], 980, 1120, 6);
sticky('9 · CONSULTAS PARA O DASHBOARD', 'GET /webhook/rodomax/consulta?tipo=dashboard|demandas|demanda|arquivos|modelo — leitura via funções SQL. O navegador nunca acessa o banco.', [-80, 1060], 1300, 520, 5);
sticky('IA · TREINAMENTO E AVALIAÇÃO (CART/Gini)', 'Executado sob demanda (botão "Treinar modelo" na Central ou execução manual). Base: `ia_historico` (rodomax_demandas.csv). Treino/teste 80/20 estratificado (semente 42), profundidade por validação cruzada no treino, métricas no teste + linha de base. O modelo treinado vira o **modelo ativo** em `ia_modelos`.', [-80, 1620], 1960, 340, 2);
sticky('10 · ERROS E TESTES', 'Erros tratados: dados incompletos/inválidos (pendente/rejeitada), PDF ilegível, CSV vazio/sem colunas, IA sem modelo (status erro), falha no banco (erro técnico sem protocolo), falha de e-mail (registrada). Execução manual: treina o modelo e roda 6 casos de teste (ambiente "teste", fora do dashboard).', [-80, 1990], 1300, 260, 3);

// ---------------------------------- BLOCO 1: ENTRADAS ----------------------------------
// Telegram
webhook('Webhook Telegram', [0, Y.tg], 'POST', 'rodomax/telegram');
pg('Carregar Conversa Telegram', [240, Y.tg],
  "SELECT COALESCE((SELECT to_jsonb(c) FROM telegram_conversas c WHERE c.chat_id = $1::bigint), '{}'::jsonb) AS conversa;",
  '={{ [ $json.body?.message?.chat?.id ?? $json.body?.edited_message?.chat?.id ?? 0 ] }}');
codeNode('Interpretar Mensagem Telegram', [480, Y.tg], '01a_interpretar_telegram.js');
switchNode('Ação do Telegram', [720, Y.tg], [
  ['Processar', "={{ $json.acao === 'processar' }}"],
  ['Responder', "={{ $json.acao === 'responder' }}"],
  ['Ignorar', "={{ $json.acao === 'ignorar' }}"],
]);
// E-mail
add({ name: 'Gatilho E-mail (IMAP)', type: 'n8n-nodes-base.emailReadImap', typeVersion: 2.1, position: [0, Y.mail], disabled: true,
  parameters: { mailbox: 'INBOX', postProcessAction: 'read', format: 'simple', downloadAttachments: true, dataPropertyAttachmentsPrefixName: 'attachment_', options: { customEmailConfig: '["UNSEEN"]' } } });
codeNode('Preparar E-mail', [240, Y.mail], '01b_preparar_email.js');
ifNode('E-mail tem PDF?', [480, Y.mail], '={{ $json.tem_pdf === true }}');
// Web
webhook('Webhook Demanda Web', [0, Y.web], 'POST', 'rodomax/demanda');
// PDF
webhook('Webhook Upload PDF', [0, Y.pdf], 'POST', 'rodomax/upload-pdf');
codeNode('Receber PDF', [240, Y.pdf], '01c_receber_pdf.js');
add({ name: 'Extrair Texto do PDF', type: 'n8n-nodes-base.extractFromFile', typeVersion: 1, position: [480, Y.pdf], onError: 'continueRegularOutput', alwaysOutputData: true,
  parameters: { operation: 'pdf', binaryPropertyName: 'data', options: {} } });
codeNode('Ler Texto do PDF', [720, Y.pdf], '01d_ler_texto_pdf.js');
pg('Registrar Arquivo PDF', [960, Y.pdf], 'SELECT ($2::jsonb || hub_registrar_arquivo($1::jsonb)) AS envelope;', '={{ [ JSON.stringify($json.arquivo_registro), JSON.stringify($json.envelope) ] }}');
ifNode('PDF Legível?', [1200, Y.pdf], '={{ $json.envelope.pdf_legivel === true }}');
respond('Responder PDF Ilegível', [1440, Y.pdf + 140], "={{ { ok: false, situacao: 'sem_texto', arquivo_id: $json.envelope.arquivo_id, nome_arquivo: $json.envelope.arquivo.nome, mensagem: $json.envelope.pdf_detalhe } }}", 422);
// CSV
webhook('Webhook Upload CSV', [0, Y.csv], 'POST', 'rodomax/upload-csv');
codeNode('Ler CSV', [240, Y.csv], '01e_ler_csv.js');
pg('Registrar Arquivo CSV', [480, Y.csv], 'SELECT ($2::jsonb || hub_registrar_arquivo($1::jsonb)) AS envelope;', '={{ [ JSON.stringify($json.arquivo_registro), JSON.stringify($json.envelope) ] }}');
switchNode('Finalidade do CSV', [720, Y.csv], [
  ['Erro no arquivo', '={{ $json.envelope.csv_ok !== true }}'],
  ['Base histórica', "={{ $json.envelope.finalidade === 'historico' }}"],
  ['Novas demandas', "={{ $json.envelope.finalidade === 'novas_demandas' }}"],
]);
respond('Responder CSV com Erro', [960, Y.csv + 180], '={{ { ok: false, arquivo_id: $json.envelope.arquivo_id, nome_arquivo: $json.envelope.nome_arquivo, erro: $json.envelope.erro } }}', 422);
codeNode('Validar Base Histórica', [960, Y.csv], '01f_validar_historico.js');
pg('Importar Base Histórica', [1200, Y.csv], 'SELECT hub_importar_historico($1::int, $2::jsonb, $3::int, $4::jsonb) AS r;',
  '={{ [ $json.arquivo_id, JSON.stringify($json.registros), $json.rejeitados, JSON.stringify($json.exemplos_rejeicao) ] }}');
respond('Responder Importação Histórica', [1440, Y.csv], "={{ { ok: true, finalidade: 'historico', nome_arquivo: $('Validar Base Histórica').first().json.nome_arquivo, linhas_lidas: $('Validar Base Histórica').first().json.total_linhas, ...$json.r } }}");
codeNode('Expandir Linhas do CSV', [960, Y.csv - 180], '01g_expandir_csv.js');

// ------------------------- BLOCOS 2, 3, 4, 5: pipeline comum -------------------------
codeNode('Consolidar Entrada', [1480, 0], '02_consolidar_entrada.js');
codeNode('Mapear Campos', [1720, 0], '03_mapear_campos.js');
codeNode('Identificar Tipo de Demanda', [1960, 0], '04_identificar_tipo.js');
codeNode('Auditar e Validar', [2200, 0], '05_auditar_validar.js');
switchNode('Direcionar Demanda', [2600, 0], [
  ['Telegram: coletar dados', "={{ $json.canal === 'telegram' && $json.status_validacao === 'pendente' }}"],
  ['Geral', "={{ $json.tipo_demanda === 'geral' && $json.status_validacao === 'valida' }}"],
  ['Logística', "={{ $json.tipo_demanda === 'logistica' && $json.status_validacao === 'valida' }}"],
  ['Pendente ou rejeitada', "={{ $json.status_validacao !== 'valida' }}"],
]);
// 6A
codeNode('Normalizar Demanda Geral', [2940, -400], '06a_normalizar_geral.js');
codeNode('Classificar Setor por Regras', [3180, -400], '06b_classificar_setor.js');
// 6B
codeNode('Normalizar Atributos Logísticos', [2940, 280], '07a_normalizar_logistica.js');
pg('Carregar Modelo Ativo', [3180, 280],
  "SELECT id, versao, arvore, jsonb_build_object('faixas', preparacao->'faixas', 'dominios', preparacao->'dominios') AS preparacao, metricas->'arvore'->>'acuracia' AS acuracia, metricas->'linha_base'->>'acuracia' AS acuracia_linha_base FROM ia_modelos WHERE ativo LIMIT 1;",
  null, { executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput' });
codeNode('Prever Atendimento (Árvore CART)', [3420, 280], '07b_prever_atendimento.js');
// Telegram: coleta
codeNode('Perguntar Próximo Dado (Telegram)', [2940, -880], '10_perguntar_telegram.js');
pg('Salvar Conversa Telegram', [3180, -880],
  "INSERT INTO telegram_conversas (chat_id, estado, ultimo_update) VALUES ($1::bigint, $2::jsonb, $3::bigint) ON CONFLICT (chat_id) DO UPDATE SET estado = EXCLUDED.estado, ultimo_update = EXCLUDED.ultimo_update, atualizado_em = now() RETURNING chat_id, $4::text AS texto;",
  '={{ [ $json.chat_id, JSON.stringify($json.estado), $json.update_id, $json.texto ] }}');
respond('Responder Telegram (coleta)', [3420, -880], '={{ { chat_id: $json.chat_id ?? null, texto: $json.texto ?? null } }}');

// ------------------------------- BLOCO 7: PostgreSQL -------------------------------
add({ name: 'Unir Caminhos', type: 'n8n-nodes-base.merge', typeVersion: 3.2, position: [3760, 0], parameters: { numberInputs: 3 } });
codeNode('Montar Registro', [4000, 0], '08_montar_registro.js');
pg('Gravar Demanda (PostgreSQL)', [4240, 0], 'SELECT hub_registrar_demanda($1::jsonb) AS r;', '={{ [ JSON.stringify($json.registro) ] }}', { onError: 'continueRegularOutput', alwaysOutputData: true });
codeNode('Montar Resposta', [4480, 0], '09_montar_resposta.js');

// ------------------------------- BLOCO 8: Respostas -------------------------------
switchNode('Responder por Canal', [4720, 0], [
  ['Web / PDF', "={{ ['web', 'pdf'].includes($json.canal) }}"],
  ['Telegram', "={{ $json.canal === 'telegram' }}"],
  ['E-mail', "={{ $json.canal === 'email' && !$json.duplicado }}"],   // e-mail repetido não gera nova resposta
  ['Lote CSV', "={{ $json.canal === 'csv' }}"],
  ['Teste manual', "={{ $json.canal === 'teste' }}"],
]);
respond('Responder Web', [5040, -420], '={{ $json.resultado }}');
pg('Encerrar Conversa Telegram', [5040, -220],
  "INSERT INTO telegram_conversas (chat_id, estado, ultimo_update) VALUES ($1::bigint, '{}'::jsonb, $2::bigint) ON CONFLICT (chat_id) DO UPDATE SET estado = '{}'::jsonb, ultimo_update = EXCLUDED.ultimo_update, atualizado_em = now() RETURNING chat_id, $3::text AS texto;",
  '={{ [ $json.chat_id, $json.update_id, $json.texto ] }}', { onError: 'continueRegularOutput' });
respond('Responder Telegram (resultado)', [5280, -220], "={{ { chat_id: $json.chat_id ?? $('Montar Resposta').first().json.chat_id, texto: $json.texto ?? $('Montar Resposta').first().json.texto } }}");
add({ name: 'Enviar Resposta por E-mail', type: 'n8n-nodes-base.emailSend', typeVersion: 2.1, position: [5040, -20], disabled: true, onError: 'continueRegularOutput', alwaysOutputData: true,
  parameters: { fromEmail: 'CONFIGURAR_SEU_EMAIL@gmail.com', toEmail: '={{ $json.email_destino }}', subject: '={{ $json.email_assunto }}', emailFormat: 'text', text: '={{ $json.texto }}', options: { appendAttribution: false } } });
codeNode('Verificar Envio do E-mail', [5280, -20], '12_verificar_envio_email.js');
pg('Registrar Envio do E-mail', [5520, -20], 'SELECT hub_registrar_resposta($1::bigint, $2, $3) AS r;', '={{ [ $json.demanda_id, $json.status, $json.detalhe ] }}', { onError: 'continueRegularOutput' });
pg('Atualizar Contadores do Lote', [5040, 180], 'SELECT hub_atualizar_arquivo($1::int) AS lote;', '={{ [ $json.arquivo_id ] }}', { executeOnce: true });
codeNode('Resumo do Lote CSV', [5280, 180], '11_resumo_lote_csv.js');
respond('Responder Importação CSV', [5520, 180], '={{ $json }}');
add({ name: 'Fim dos Casos de Teste', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [5040, 380], parameters: {} });

// --------------------------- BLOCO 9: consultas (dashboard) ---------------------------
webhook('Webhook Consulta', [0, Y.consulta], 'GET', 'rodomax/consulta');
switchNode('Tipo de Consulta', [240, Y.consulta], [
  ['dashboard', "={{ $json.query.tipo === 'dashboard' }}"],
  ['demandas', "={{ $json.query.tipo === 'demandas' }}"],
  ['demanda', "={{ $json.query.tipo === 'demanda' }}"],
  ['arquivos', "={{ $json.query.tipo === 'arquivos' }}"],
  ['modelo', "={{ $json.query.tipo === 'modelo' }}"],
], true);
pg('Consultar Dashboard', [560, Y.consulta - 120], 'SELECT hub_dashboard() AS resultado;', null);
pg('Consultar Demandas', [560, Y.consulta - 20], 'SELECT hub_listar_demandas($1::jsonb) AS resultado;', '={{ [ JSON.stringify($json.query) ] }}');
pg('Consultar Protocolo', [560, Y.consulta + 80], 'SELECT hub_detalhe_demanda($1) AS resultado;', "={{ [ $json.query.protocolo || '' ] }}");
pg('Consultar Arquivos', [560, Y.consulta + 180], 'SELECT hub_listar_arquivos() AS resultado;', null);
pg('Consultar Modelo', [560, Y.consulta + 280], 'SELECT hub_modelo_ativo() AS resultado;', null);
respond('Responder Consulta', [880, Y.consulta + 80], '={{ { ok: true, dados: $json.resultado } }}');
respond('Consulta Inválida', [560, Y.consulta + 380], "={{ { ok: false, erro: 'Parâmetro tipo inválido. Use dashboard, demandas, demanda, arquivos ou modelo.' } }}", 400);

// ----------------------------- IA: treinamento e testes -----------------------------
webhook('Webhook Treinar IA', [0, Y.ia - 40], 'POST', 'rodomax/ia/treinar');
add({ name: 'Execução Manual (treino + testes)', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, Y.ia + 120], parameters: {} });
pg('Ler Base Histórica', [240, Y.ia], "SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY h.id_demanda), '[]'::jsonb) AS registros FROM ia_historico h;", null, { executeOnce: true });
codeNode('IA 1 - Preparar Dados Históricos', [480, Y.ia], 'ia1_preparar_dados.js');
ifNode('Base Suficiente?', [720, Y.ia], '={{ $json.ok === true }}');
codeNode('IA 2 - Treinar Árvore CART (Gini)', [960, Y.ia - 60], 'ia2_treinar_arvore.js');
codeNode('IA 3 - Avaliar Modelo e Linha de Base', [1200, Y.ia - 60], 'ia3_avaliar_modelo.js');
pg('Salvar Modelo Treinado', [1440, Y.ia - 60], 'SELECT hub_salvar_modelo($1::jsonb) AS salvo;', '={{ [ JSON.stringify($json.registro_modelo) ] }}');
respond('Responder Treinamento', [1680, Y.ia - 60], "={{ { ok: true, ...$json.salvo, resumo: $('IA 3 - Avaliar Modelo e Linha de Base').first().json.resumo } }}");
respond('Responder Treinamento (sem base)', [960, Y.ia + 120], '={{ { ok: false, erro: $json.erro } }}', 422);
codeNode('Casos de Teste', [240, Y.teste], '00_casos_de_teste.js');

// ===================================== CONEXÕES =====================================
// Telegram
link('Webhook Telegram', 'Carregar Conversa Telegram');
link('Carregar Conversa Telegram', 'Interpretar Mensagem Telegram');
link('Interpretar Mensagem Telegram', 'Ação do Telegram');
link('Ação do Telegram', 'Consolidar Entrada', 0);
link('Ação do Telegram', 'Salvar Conversa Telegram', 1);
link('Ação do Telegram', 'Responder Telegram (coleta)', 2);
// E-mail
link('Gatilho E-mail (IMAP)', 'Preparar E-mail');
link('Preparar E-mail', 'E-mail tem PDF?');
link('E-mail tem PDF?', 'Receber PDF', 0);
link('E-mail tem PDF?', 'Consolidar Entrada', 1);
// Web
link('Webhook Demanda Web', 'Consolidar Entrada');
// PDF
link('Webhook Upload PDF', 'Receber PDF');
link('Receber PDF', 'Extrair Texto do PDF');
link('Extrair Texto do PDF', 'Ler Texto do PDF');
link('Ler Texto do PDF', 'Registrar Arquivo PDF');
link('Registrar Arquivo PDF', 'PDF Legível?');
link('PDF Legível?', 'Consolidar Entrada', 0);
link('PDF Legível?', 'Responder PDF Ilegível', 1);
// CSV
link('Webhook Upload CSV', 'Ler CSV');
link('Ler CSV', 'Registrar Arquivo CSV');
link('Registrar Arquivo CSV', 'Finalidade do CSV');
link('Finalidade do CSV', 'Responder CSV com Erro', 0);
link('Finalidade do CSV', 'Validar Base Histórica', 1);
link('Finalidade do CSV', 'Expandir Linhas do CSV', 2);
link('Validar Base Histórica', 'Importar Base Histórica');
link('Importar Base Histórica', 'Responder Importação Histórica');
link('Expandir Linhas do CSV', 'Consolidar Entrada');
// pipeline comum
link('Consolidar Entrada', 'Mapear Campos');
link('Mapear Campos', 'Identificar Tipo de Demanda');
link('Identificar Tipo de Demanda', 'Auditar e Validar');
link('Auditar e Validar', 'Direcionar Demanda');
link('Direcionar Demanda', 'Perguntar Próximo Dado (Telegram)', 0);
link('Direcionar Demanda', 'Normalizar Demanda Geral', 1);
link('Direcionar Demanda', 'Normalizar Atributos Logísticos', 2);
link('Direcionar Demanda', 'Unir Caminhos', 3, 2);
link('Perguntar Próximo Dado (Telegram)', 'Salvar Conversa Telegram');
link('Salvar Conversa Telegram', 'Responder Telegram (coleta)');
link('Normalizar Demanda Geral', 'Classificar Setor por Regras');
link('Classificar Setor por Regras', 'Unir Caminhos', 0, 0);
link('Normalizar Atributos Logísticos', 'Carregar Modelo Ativo');
link('Carregar Modelo Ativo', 'Prever Atendimento (Árvore CART)');
link('Prever Atendimento (Árvore CART)', 'Unir Caminhos', 0, 1);
link('Unir Caminhos', 'Montar Registro');
link('Montar Registro', 'Gravar Demanda (PostgreSQL)');
link('Gravar Demanda (PostgreSQL)', 'Montar Resposta');
link('Montar Resposta', 'Responder por Canal');
link('Responder por Canal', 'Responder Web', 0);
link('Responder por Canal', 'Encerrar Conversa Telegram', 1);
link('Responder por Canal', 'Enviar Resposta por E-mail', 2);
link('Responder por Canal', 'Atualizar Contadores do Lote', 3);
link('Responder por Canal', 'Fim dos Casos de Teste', 4);
link('Encerrar Conversa Telegram', 'Responder Telegram (resultado)');
link('Enviar Resposta por E-mail', 'Verificar Envio do E-mail');
link('Verificar Envio do E-mail', 'Registrar Envio do E-mail');
link('Atualizar Contadores do Lote', 'Resumo do Lote CSV');
link('Resumo do Lote CSV', 'Responder Importação CSV');
// consultas
link('Webhook Consulta', 'Tipo de Consulta');
['Consultar Dashboard', 'Consultar Demandas', 'Consultar Protocolo', 'Consultar Arquivos', 'Consultar Modelo'].forEach((n, i) => { link('Tipo de Consulta', n, i); link(n, 'Responder Consulta'); });
link('Tipo de Consulta', 'Consulta Inválida', 5);
// IA
link('Webhook Treinar IA', 'Ler Base Histórica');
link('Execução Manual (treino + testes)', 'Ler Base Histórica');
link('Execução Manual (treino + testes)', 'Casos de Teste');
link('Ler Base Histórica', 'IA 1 - Preparar Dados Históricos');
link('IA 1 - Preparar Dados Históricos', 'Base Suficiente?');
link('Base Suficiente?', 'IA 2 - Treinar Árvore CART (Gini)', 0);
link('Base Suficiente?', 'Responder Treinamento (sem base)', 1);
link('IA 2 - Treinar Árvore CART (Gini)', 'IA 3 - Avaliar Modelo e Linha de Base');
link('IA 3 - Avaliar Modelo e Linha de Base', 'Salvar Modelo Treinado');
link('Salvar Modelo Treinado', 'Responder Treinamento');
link('Casos de Teste', 'Consolidar Entrada');

// ===================================== SAÍDA =====================================
const workflow = {
  name: 'RODOMAX HUB - Integrado (versão final)',
  nodes,
  pinData: {},
  connections,
  active: false,
  settings: { executionOrder: 'v1', binaryMode: 'separate', saveManualExecutions: true, callerPolicy: 'workflowsFromSameOwner' },
  versionId: uuid('version:' + JSON.stringify(nodes).length),
  meta: { templateCredsSetupCompleted: true },
  id: 'RodomaxHubFinal01',
  tags: [],
};
// validações estáticas antes de gravar
const nomes = new Set(nodes.map((n) => n.name));
if (nomes.size !== nodes.length) throw new Error('Nomes de nodes duplicados');
if (new Set(nodes.map((n) => n.id)).size !== nodes.length) throw new Error('IDs duplicados');
for (const [de, c] of Object.entries(connections)) {
  if (!nomes.has(de)) throw new Error('Conexão de node inexistente: ' + de);
  c.main.flat().forEach((l) => { if (!nomes.has(l.node)) throw new Error(`Conexão para node inexistente: ${de} -> ${l.node}`); });
}
fs.writeFileSync(OUT, JSON.stringify(workflow, null, 2));
console.log(`OK: ${OUT}\n${nodes.length} nodes (${nodes.filter((n) => n.type.endsWith('stickyNote')).length} notas), ${Object.values(connections).reduce((s, c) => s + c.main.flat().length, 0)} conexões`);
