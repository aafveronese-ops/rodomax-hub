/* =====================================================================================
   RODOMAX HUB — interface web (JavaScript puro, sem etapa de build)
   Duas áreas:
     • Solicitante: frete, demanda geral, PDF, CSV, consulta de protocolo
     • Central de Controle: dashboard, demandas, arquivos, modelo de IA, canais
   Toda informação exibida vem da API do backend (/api/...), que fala com o n8n.
   Nenhum número é fictício: sem dados, a tela mostra zero / estado vazio.
   ===================================================================================== */
(() => {
  'use strict';

  // ------------------------------------------------------------------ ícones (SVG)
  const P = {
    truck: '<path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    brain: '<path d="M12 5a3 3 0 0 0-5.8-1A3 3 0 0 0 4 9a3 3 0 0 0 0 5 3 3 0 0 0 3 4 3 3 0 0 0 5 1z"/><path d="M12 5a3 3 0 0 1 5.8-1A3 3 0 0 1 20 9a3 3 0 0 1 0 5 3 3 0 0 1-3 4 3 3 0 0 1-5 1z"/><path d="M12 5v14"/>',
    radio: '<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5"/>',
    upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  };
  const icone = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

  // ------------------------------------------------------------------ utilitários
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtNum = (v, casas = 0) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }));
  const fmtPct = (v) => (v === null || v === undefined || v === '' ? '—' : `${(Number(v) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
  const fmtData = (v) => (v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const CANAIS = { web: 'Web', telegram: 'Telegram', email: 'E-mail', pdf: 'PDF', csv: 'CSV', portal: 'Portal', teste: 'Teste' };
  const STATUS = { processada: 'Processada', pendente: 'Pendente', rejeitada: 'Rejeitada', erro: 'Erro', erro_tecnico: 'Erro técnico' };
  const TIPOS = { geral: 'Geral', logistica: 'Logística' };
  const chip = (cls, txt) => `<span class="chip chip-${esc(cls)}">${esc(txt)}</span>`;
  const chipStatus = (s) => chip(s, STATUS[s] || s);
  const chipTipo = (t) => chip(t, TIPOS[t] || t);
  const chipPrev = (p) => (p ? chip(p, p === 'sim' ? 'Tende a ser atendida' : 'Risco de não atendimento') : '<span class="mudo">—</span>');

  function toast(msg, tipo = '') {
    const t = document.createElement('div');
    t.className = `toast ${tipo}`; t.textContent = msg;
    $('#toasts').appendChild(t); setTimeout(() => t.remove(), 4500);
  }
  async function api(caminho, opcoes = {}) {
    let r;
    try { r = await fetch(caminho, opcoes); } catch (e) { throw new Error('Não foi possível falar com o backend da aplicação.'); }
    const d = await r.json().catch(() => ({ ok: false, erro: `Resposta inválida (HTTP ${r.status})` }));
    if (!r.ok && d.ok !== false) d.ok = false;
    if (d.ok === false && !d.protocolo && !d.situacao && !d.arquivo_id) throw Object.assign(new Error(d.erro || 'Falha na requisição'), { dados: d });
    return d;
  }
  const carregando = (txt = 'Carregando…') => `<div class="carregando"><div class="spinner"></div>${esc(txt)}</div>`;
  const vazio = (ic, titulo, texto, acao = '') => `<div class="vazio">${icone(ic)}<h3>${esc(titulo)}</h3><p>${texto}</p>${acao}</div>`;
  const erroBox = (e) => `<div class="aviso aviso-erro">${icone('alert')}<div><strong>Não foi possível carregar.</strong><br>${esc(e.message)}${e.dados && e.dados.detalhe ? `<br><span class="pequeno">${esc(e.dados.detalhe)}</span>` : ''}</div></div>`;
  function ocupado(botao, sim, txt) {
    if (sim) { botao.dataset.txt = botao.innerHTML; botao.disabled = true; botao.innerHTML = `<span class="spinner"></span>${esc(txt || 'Processando…')}`; }
    else { botao.disabled = false; botao.innerHTML = botao.dataset.txt; }
  }

  // tooltip compartilhado dos gráficos (hover)
  const tip = $('#tooltip');
  document.addEventListener('mousemove', (ev) => {
    const alvo = ev.target.closest('[data-tip]');
    if (!alvo) { tip.classList.remove('visivel'); return; }
    tip.innerHTML = alvo.dataset.tip; tip.classList.add('visivel');
    const x = Math.min(ev.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    tip.style.left = `${x}px`; tip.style.top = `${ev.clientY + 14}px`;
  });

  // ------------------------------------------------------------------ gráficos
  // Barras horizontais (uma série = uma cor; o rótulo identifica cada barra)
  function barras(itens, { cor = 'var(--serie-1)', unidade = '' } = {}) {
    const max = Math.max(1, ...itens.map((i) => i.valor));
    if (!itens.length) return '<p class="mudo pequeno">Sem dados.</p>';
    return `<div class="barras">${itens.map((i) => `
      <div class="barra-linha" data-tip="${esc(`<b>${esc(i.rotulo)}</b>: ${fmtNum(i.valor)} ${unidade}`)}">
        <span class="barra-rotulo">${esc(i.rotulo)}</span>
        <div class="barra-trilho"><div class="barra-preench" style="width:${(100 * i.valor) / max}%;background:${i.cor || cor}"></div></div>
        <span class="barra-valor">${fmtNum(i.valor)}</span>
      </div>`).join('')}</div>`;
  }
  // Colunas por dia (série temporal curta)
  function colunas(serie) {
    const max = Math.max(1, ...serie.map((s) => s.total));
    return `<div class="colunas">${serie.map((s) => `<div class="coluna" data-tip="${esc(`<b>${new Date(s.dia + 'T12:00').toLocaleDateString('pt-BR')}</b>: ${s.total} demanda(s)`)}"><div class="coluna-barra" style="height:${(100 * s.total) / max}%"></div></div>`).join('')}</div>
      <div class="colunas-eixo">${serie.map((s, i) => `<span>${i % 2 === 0 ? new Date(s.dia + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}</span>`).join('')}</div>`;
  }
  // Barra empilhada de duas/três partes, com legenda (identidade nunca só pela cor)
  function empilhada(partes) {
    const total = partes.reduce((s, p) => s + p.valor, 0);
    if (!total) return '<p class="mudo pequeno">Sem dados.</p>';
    return `<div class="empilhada">${partes.filter((p) => p.valor).map((p) => `<div data-tip="${esc(`<b>${esc(p.rotulo)}</b>: ${p.valor} (${Math.round((100 * p.valor) / total)}%)`)}" style="width:${(100 * p.valor) / total}%;background:${p.cor}"></div>`).join('')}</div>
      <div class="legenda">${partes.map((p) => `<span><i style="background:${p.cor}"></i>${esc(p.rotulo)}: <b>${fmtNum(p.valor)}</b> (${Math.round((100 * p.valor) / total)}%)</span>`).join('')}</div>`;
  }

  // ------------------------------------------------------------------ navegação
  const ROTAS = {
    'frete': { area: 'Solicitante', titulo: 'Solicitação de frete', icone: 'truck', render: telaFrete },
    'geral': { area: 'Solicitante', titulo: 'Demanda geral', icone: 'inbox', render: telaGeral },
    'pdf': { area: 'Solicitante', titulo: 'Enviar PDF', icone: 'file', render: telaPdf },
    'csv': { area: 'Solicitante', titulo: 'Importar CSV', icone: 'table', render: telaCsv },
    'protocolo': { area: 'Solicitante', titulo: 'Consultar protocolo', icone: 'search', render: telaProtocolo },
    'dashboard': { area: 'Central de Controle', titulo: 'Dashboard', icone: 'grid', render: telaDashboard },
    'demandas': { area: 'Central de Controle', titulo: 'Demandas', icone: 'list', render: telaDemandas },
    'arquivos': { area: 'Central de Controle', titulo: 'Arquivos importados', icone: 'folder', render: telaArquivos },
    'modelo': { area: 'Central de Controle', titulo: 'Modelo de IA', icone: 'brain', render: telaModelo },
    'canais': { area: 'Central de Controle', titulo: 'Canais de entrada', icone: 'radio', render: telaCanais },
  };
  function montarMenu() {
    const grupo = (nome, chaves) => `<div class="menu-grupo">${nome}</div>${chaves.map((k) => `<a class="menu-item" href="#/${k}" data-rota="${k}">${icone(ROTAS[k].icone)}<span>${ROTAS[k].titulo}</span></a>`).join('')}`;
    $('#menu').innerHTML = grupo('Solicitante', ['frete', 'geral', 'pdf', 'csv', 'protocolo']) + grupo('Central de Controle', ['dashboard', 'demandas', 'arquivos', 'modelo', 'canais']);
  }
  // Token de navegação: uma consulta que termina DEPOIS de o usuário trocar de tela é descartada
  let navAtual = 0;
  const mesmaTela = (id) => id === navAtual;
  function navegar() {
    navAtual++;
    const [chave, param] = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/');
    const r = ROTAS[chave] || ROTAS.dashboard;
    $$('.menu-item').forEach((a) => a.classList.toggle('ativo', a.dataset.rota === chave));
    $('#topo-area').textContent = r.area; $('#topo-titulo').textContent = r.titulo; $('#topo-acoes').innerHTML = '';
    document.title = `${r.titulo} · Rodomax HUB`;
    $('#sidebar').classList.remove('aberta');
    $('#gaveta').classList.remove('aberta'); $('#gaveta').setAttribute('aria-hidden', 'true');
    const el = $('#conteudo'); el.innerHTML = '';
    r.render(el, param ? decodeURIComponent(param) : null);
    el.focus({ preventScroll: true }); window.scrollTo(0, 0);
  }

  async function verificarSaude() {
    const box = $('#status-integracao');
    try {
      const s = await (await fetch('/api/saude')).json();
      const ok = s.n8n && s.workflow_ativo;
      box.className = `status-integracao ${ok ? 'ok' : 'falha'}`;
      box.lastElementChild.textContent = ok ? 'n8n conectado · workflow ativo' : s.n8n ? 'n8n online · workflow inativo' : 'n8n indisponível';
      window.__saude = s;
    } catch (e) { box.className = 'status-integracao falha'; box.lastElementChild.textContent = 'Backend indisponível'; }
  }

  // ------------------------------------------------------------------ formulários
  const UFS = ['PR', 'MS', 'SC', 'SP', 'RS', 'MT', 'GO', 'MG', 'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'MA', 'PA', 'PB', 'PE', 'PI', 'RJ', 'RN', 'RO', 'RR', 'SE', 'TO'];
  const DESTINOS = ['Paranaguá', 'Toledo', 'Maringá', 'Cascavel', 'Guarapuava', 'Xanxerê', 'Lacerdópolis', 'Videira'];
  const campo = (nome, rotulo, html, { classe = '', ajuda = '' } = {}) => `<div class="campo ${classe}" data-campo="${nome}"><label for="f-${nome}">${rotulo}</label>${html}${ajuda ? `<span class="ajuda">${ajuda}</span>` : ''}<span class="erro-campo"></span></div>`;
  const input = (nome, attrs = '') => `<input id="f-${nome}" name="${nome}" ${attrs}>`;
  const select = (nome, opcoes, vazioTxt = 'Selecione…') => `<select id="f-${nome}" name="${nome}"><option value="">${vazioTxt}</option>${opcoes.map((o) => (Array.isArray(o) ? `<option value="${esc(o[0])}">${esc(o[1])}</option>` : `<option>${esc(o)}</option>`)).join('')}</select>`;

  function lerForm(form) { return Object.fromEntries(new FormData(form).entries()); }
  function marcarErros(form, erros) {
    $$('.campo', form).forEach((c) => { c.classList.remove('invalido'); $('.erro-campo', c) && ($('.erro-campo', c).textContent = ''); });
    Object.entries(erros).forEach(([nome, msg]) => {
      const c = $(`[data-campo="${nome}"]`, form);
      if (c) { c.classList.add('invalido'); $('.erro-campo', c).textContent = msg; }
    });
    const primeiro = $('.campo.invalido input, .campo.invalido select, .campo.invalido textarea', form);
    if (primeiro) primeiro.focus();
    return !Object.keys(erros).length;
  }
  const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const telOk = (t) => { const d = t.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''); return d.length === 10 || d.length === 11; };
  function validarContato(d, erros) {
    if (!d.nome || d.nome.trim().length < 2) erros.nome = 'Informe seu nome.';
    if (!d.email && !d.telefone) erros.email = 'Informe e-mail ou telefone para retorno.';
    if (d.email && !emailOk(d.email)) erros.email = 'E-mail inválido.';
    if (d.telefone && !telOk(d.telefone)) erros.telefone = 'Telefone com DDD (10 ou 11 dígitos).';
  }

  // --------- Solicitação de frete
  function telaFrete(el) {
    el.innerHTML = `
      <div class="hero"><div><h2>Nova solicitação de frete</h2><p>Os dados operacionais seguem para o n8n, que valida, grava no PostgreSQL e executa a <b>árvore de decisão (CART/Gini)</b> treinada com o histórico. Você recebe o protocolo e a previsão experimental de atendimento.</p></div></div>
      <div class="grade g-21 mt">
        <form class="card" id="form-frete" novalidate>
          <div class="form-grade">
            <div class="form-secao">Solicitante</div>
            ${campo('nome', 'Nome / empresa', input('nome', 'autocomplete="name" maxlength="120"'))}
            ${campo('email', 'E-mail <small>(ou telefone)</small>', input('email', 'type="email" autocomplete="email"'))}
            ${campo('telefone', 'Telefone <small>(opcional)</small>', input('telefone', 'type="tel" placeholder="(42) 99999-0000"'))}
            <div class="form-secao">Carga e rota</div>
            ${campo('produto', 'Produto', select('produto', ['MILHO', 'SOJA']))}
            ${campo('uf_origem', 'UF de origem', select('uf_origem', UFS))}
            ${campo('destino', 'Destino', `${input('destino', 'list="lista-destinos" placeholder="ex.: Paranaguá"')}<datalist id="lista-destinos">${DESTINOS.map((d) => `<option>${d}</option>`).join('')}</datalist>`)}
            ${campo('distancia_km', 'Distância (km)', input('distancia_km', 'type="number" min="1" max="3500" step="1" placeholder="ex.: 560"'))}
            ${campo('estrada_chao_km', 'Estrada de chão (km)', input('estrada_chao_km', 'type="number" min="0" max="500" step="1" placeholder="0 = tudo asfalto"'))}
            ${campo('balanca', 'Restrição de balança', select('balanca', [['20m', '20 m'], ['25m', '25 m'], ['30m', '30 m'], ['sem_restricao', 'Sem restrição']]))}
            <div class="form-secao">Condições comerciais</div>
            ${campo('frete_ton', 'Frete por tonelada (R$)', input('frete_ton', 'type="number" min="1" max="1000" step="0.01" placeholder="ex.: 150"'))}
            ${campo('saldo_ton', 'Saldo (toneladas)', input('saldo_ton', 'type="number" min="1" max="100000" step="1" placeholder="ex.: 2500"'))}
            ${campo('antecedencia_h', 'Antecedência (horas)', input('antecedencia_h', 'type="number" min="0" max="720" step="1" placeholder="ex.: 72"'))}
          </div>
          <div class="form-acoes">
            <button type="button" class="botao botao-secundario" id="btn-limpar">Limpar</button>
            <button type="submit" class="botao botao-primario">${icone('send')}Enviar e analisar</button>
          </div>
        </form>
        <div class="card">
          <div class="card-titulo"><h3>Como a IA decide</h3></div>
          <p class="mudo" style="line-height:1.55;margin:0">A árvore faz perguntas sobre os atributos (ex.: <i>o frete por t·km está abaixo de R$ 0,215?</i>) até chegar a uma folha que reúne demandas históricas parecidas. A previsão é a classe majoritária dessa folha.</p>
          <div class="aviso aviso-alerta">${icone('alert')}<div>Previsão <b>experimental</b>: não é contratação nem garantia de atendimento. A decisão final é da equipe de operação.</div></div>
          <div class="aviso aviso-info">${icone('info')}<div>Nome, e-mail e telefone <b>não</b> são usados pela IA — só os atributos operacionais.</div></div>
        </div>
      </div>
      <div id="resultado"></div>`;
    const form = $('#form-frete');
    $('#btn-limpar').onclick = () => { form.reset(); marcarErros(form, {}); ($('#resultado') || {}).innerHTML = ''; };
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const d = lerForm(form); const erros = {};
      validarContato(d, erros);
      const num = (k, min, max, msg) => { const v = Number(d[k]); if (d[k] === '' || Number.isNaN(v) || v < min || v > max) erros[k] = msg; };
      if (!d.produto) erros.produto = 'Selecione o produto.';
      if (!d.uf_origem) erros.uf_origem = 'Selecione a UF.';
      if (!d.destino || d.destino.trim().length < 2) erros.destino = 'Informe o destino.';
      num('distancia_km', 1, 3500, 'Entre 1 e 3.500 km.');
      num('estrada_chao_km', 0, 500, 'Entre 0 e 500 km.');
      if (!erros.estrada_chao_km && !erros.distancia_km && Number(d.estrada_chao_km) > Number(d.distancia_km)) erros.estrada_chao_km = 'Não pode ser maior que a distância.';
      if (!d.balanca) erros.balanca = 'Selecione a balança.';
      num('frete_ton', 1, 1000, 'Entre R$ 1 e R$ 1.000.');
      num('saldo_ton', 1, 100000, 'Entre 1 e 100.000 t.');
      num('antecedencia_h', 0, 720, 'Entre 0 e 720 horas.');
      if (!marcarErros(form, erros)) return;
      await enviarDemanda(form, { ...d, tipo_demanda: 'logistica' });
    };
  }

  // --------- Demanda geral
  function telaGeral(el) {
    el.innerHTML = `
      <div class="hero"><div><h2>Nova demanda geral</h2><p>O HUB é multissetorial: financeiro, comercial, cadastro, atendimento, manutenção… O n8n identifica o assunto por <b>regras de palavras-chave</b> e encaminha ao setor responsável.</p></div></div>
      <div class="grade g-21 mt">
        <form class="card" id="form-geral" novalidate>
          <div class="form-grade">
            ${campo('nome', 'Nome / empresa', input('nome', 'autocomplete="name"'))}
            ${campo('email', 'E-mail <small>(ou telefone)</small>', input('email', 'type="email"'))}
            ${campo('telefone', 'Telefone <small>(opcional)</small>', input('telefone', 'type="tel"'))}
            ${campo('assunto', 'Assunto <small>(opcional)</small>', input('assunto', 'maxlength="120" placeholder="ex.: Segunda via de boleto"'), { classe: 'total' })}
            ${campo('descricao', 'Descreva sua solicitação', '<textarea id="f-descricao" name="descricao" maxlength="3000" placeholder="Explique o que você precisa…"></textarea>', { classe: 'total' })}
          </div>
          <div class="form-acoes"><button type="submit" class="botao botao-primario">${icone('send')}Enviar solicitação</button></div>
        </form>
        <div class="card">
          <div class="card-titulo"><h3>Setores de demonstração</h3></div>
          <ul class="lista-motivos pequeno mudo">
            <li><b>Financeiro</b>: boleto, fatura, pagamento</li><li><b>Comercial</b>: cotação, orçamento, proposta</li>
            <li><b>Operacional</b>: coleta, avaria, manutenção</li><li><b>Administrativo</b>: cadastro, contrato</li>
            <li><b>Logística</b>: atraso, rastreamento</li><li><b>Atendimento</b>: reclamação, dúvida (e triagem)</li>
          </ul>
          <p class="pequeno mudo">Configuração proposta para a demonstração — não é a estrutura oficial da Rodomax.</p>
        </div>
      </div>
      <div id="resultado"></div>`;
    const form = $('#form-geral');
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const d = lerForm(form); const erros = {};
      validarContato(d, erros);
      if (!d.descricao || d.descricao.trim().length < 5) erros.descricao = 'Descreva a solicitação (mínimo 5 caracteres).';
      if (!marcarErros(form, erros)) return;
      await enviarDemanda(form, { ...d, tipo_demanda: 'geral' });
    };
  }

  async function enviarDemanda(form, dados) {
    const botao = $('button[type=submit]', form);
    ocupado(botao, true, 'Processando no n8n…');
    ($('#resultado') || {}).innerHTML = '';
    try {
      const r = await api('/api/demandas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...dados, id_requisicao: uuid() }) });
      ($('#resultado') || {}).innerHTML = `<div class="card mt-g resultado">${htmlResultado(r)}</div>`;
      if (r.ok && r.situacao === 'processada') { form.reset(); toast(`Protocolo ${r.protocolo} gerado`, 'ok'); }
      $('#resultado') && $('#resultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { ($('#resultado') || {}).innerHTML = `<div class="mt-g">${erroBox(e)}</div>`; }
    finally { ocupado(botao, false); }
  }

  // Bloco de resultado (protocolo + setor ou previsão) — usado por frete, geral e PDF
  function htmlResultado(r) {
    if (!r.ok && !r.protocolo) {
      return `<div class="aviso aviso-erro" style="margin:0">${icone('alert')}<div><strong>${esc(r.titulo || 'Falha no processamento')}</strong><br>${esc(r.mensagem || r.erro || '')}</div></div>`;
    }
    const motivos = (r.motivos || []).filter((m) => m.codigo !== 'IGNORADO');
    let corpo = '';
    if (r.situacao === 'processada' && r.tipo_demanda === 'geral') {
      corpo = `<div class="aviso aviso-ok">${icone('check')}<div>Encaminhada ao setor <b>${esc(r.setor)}</b> · assunto identificado: <b>${esc(r.categoria)}</b>. O setor dará continuidade ao atendimento.</div></div>`;
    } else if (r.situacao === 'processada' && r.previsao) {
      corpo = htmlPrevisao(r.previsao);
    } else if (r.situacao === 'pendente') {
      corpo = `<div class="aviso aviso-alerta">${icone('alert')}<div><b>Faltam informações para concluir a análise:</b><ul class="lista-motivos">${motivos.map((m) => `<li>${esc(m.descricao)}</li>`).join('')}</ul></div></div>`;
    } else if (r.situacao === 'rejeitada') {
      corpo = `<div class="aviso aviso-erro">${icone('x')}<div><b>Dados inválidos — corrija e envie novamente:</b><ul class="lista-motivos">${motivos.map((m) => `<li>${esc(m.descricao)}</li>`).join('')}</ul></div></div>`;
    } else if (r.situacao === 'erro') {
      corpo = `<div class="aviso aviso-erro">${icone('alert')}<div><b>Demanda registrada, mas a IA não pôde analisar agora.</b><br>${esc(motivos.map((m) => m.descricao).join(' '))}</div></div>`;
    }
    return `
      <div class="resultado-cabecalho">
        <div><div class="protocolo-rotulo">Protocolo</div><div class="protocolo-grande">${esc(r.protocolo)}</div>
          <div class="mudo pequeno" style="margin-top:4px">${esc(r.titulo || '')}${r.duplicado ? ' · envio repetido: registro original mantido' : ''}</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${chipTipo(r.tipo_demanda)}${chipStatus(r.situacao)}</div>
      </div>
      ${corpo}
      <div class="form-acoes" style="justify-content:flex-start"><a class="botao botao-secundario" href="#/protocolo/${encodeURIComponent(r.protocolo)}">${icone('search')}Acompanhar protocolo</a></div>`;
  }

  function htmlPrevisao(p, compacto = false) {
    const ex = p.explicacao || {};
    const prob = Number(p.prob_atendida);
    const cor = p.classe === 'sim' ? 'var(--bom)' : 'var(--critico)';
    return `
      <div class="previsao-painel ${esc(p.classe)}">
        <div class="previsao-linha">
          <div class="previsao-icone">${icone(p.classe === 'sim' ? 'check' : 'alert')}</div>
          <div><div class="protocolo-rotulo">Previsão da IA (árvore CART/Gini)</div><div class="previsao-rotulo">${esc(p.rotulo)}</div></div>
          <div class="medidor" data-tip="${esc(`Na folha da árvore, ${ex.folha?.sim} de ${ex.folha?.n} demandas históricas foram atendidas (suavização de Laplace). Não é probabilidade calibrada.`)}">
            <div class="pequeno"><b>${fmtPct(prob)}</b> de atendimento em casos semelhantes (${ex.folha?.sim} de ${ex.folha?.n})</div>
            <div class="medidor-barra"><div style="width:${prob * 100}%;background:${cor}"></div></div>
          </div>
        </div>
        <p style="margin:12px 0 0;line-height:1.5">${esc(ex.resumo || '')}</p>
        ${compacto ? '' : `<div class="pequeno" style="margin-top:12px;font-weight:600">Caminho percorrido na árvore</div>
        <ol class="caminho">${(ex.caminho || []).map((c, i) => `<li><span class="passo">${i + 1}</span><span>${esc(c.pergunta)}</span><span class="mudo">valor: <b>${esc(typeof c.valor_da_demanda === 'number' ? c.valor_da_demanda.toLocaleString('pt-BR', { maximumFractionDigits: 4 }) : c.valor_da_demanda)}</b></span><span class="resp">${esc(c.resposta)}</span></li>`).join('')}</ol>`}
        <div class="pequeno" style="margin-top:10px">Fatores decisivos: ${(ex.atributos_decisivos || []).map((a) => `<b>${esc(a.rotulo)}</b>`).join(', ')} · Modelo ${esc(ex.modelo?.versao || '')} (acurácia no teste ${fmtPct(ex.modelo?.acuracia_teste)} vs. linha de base ${fmtPct(ex.modelo?.acuracia_linha_base)})</div>
      </div>
      ${(ex.avisos || []).length ? `<div class="aviso aviso-alerta">${icone('alert')}<div>${ex.avisos.map(esc).join('<br>')}</div></div>` : ''}
      <div class="aviso aviso-info">${icone('info')}<div>${esc(ex.aviso_uso || 'Previsão experimental. A decisão final é humana.')}</div></div>`;
  }

  // --------- Upload genérico (dropzone)
  function dropzone(id, aceita, texto) {
    return `<label class="dropzone" id="${id}"><input type="file" accept="${aceita}" hidden>${icone('upload')}<strong>${texto}</strong><div class="mudo">Clique para escolher ou arraste o arquivo aqui</div><div class="arquivo-escolhido"></div></label>`;
  }
  function ligarDropzone(zona, aoEscolher) {
    const inp = $('input', zona);
    const escolher = (f) => { if (!f) return; zona.arquivo = f; $('.arquivo-escolhido', zona).textContent = `${f.name} · ${(f.size / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`; aoEscolher && aoEscolher(f); };
    inp.onchange = () => escolher(inp.files[0]);
    zona.ondragover = (e) => { e.preventDefault(); zona.classList.add('sobre'); };
    zona.ondragleave = () => zona.classList.remove('sobre');
    zona.ondrop = (e) => { e.preventDefault(); zona.classList.remove('sobre'); escolher(e.dataTransfer.files[0]); };
  }

  function telaPdf(el) {
    el.innerHTML = `
      <div class="hero"><div><h2>Enviar solicitação em PDF</h2><p>O n8n extrai o texto do PDF, reconhece campos (linhas "Campo: valor" ou texto livre), identifica se é demanda geral ou de frete e processa pelo caminho correto. PDFs escaneados (só imagem) são informados — nada é inventado.</p></div></div>
      <div class="grade g-21 mt">
        <form class="card" id="form-pdf" novalidate>
          ${dropzone('zona-pdf', 'application/pdf,.pdf', 'Selecione o PDF da solicitação')}
          <div class="form-grade mt">
            ${campo('nome', 'Seu nome <small>(opcional)</small>', input('nome'))}
            ${campo('email', 'E-mail <small>(opcional)</small>', input('email', 'type="email"'))}
            ${campo('telefone', 'Telefone <small>(opcional)</small>', input('telefone', 'type="tel"'))}
          </div>
          <div class="form-acoes"><button type="submit" class="botao botao-primario">${icone('upload')}Enviar PDF</button></div>
        </form>
        <div class="card"><div class="card-titulo"><h3>Formato sugerido</h3></div>
          <pre style="background:var(--superficie-2);padding:12px;border-radius:10px;font-size:12px;margin:0;white-space:pre-wrap">Nome: Cooperativa X\nEmail: contato@x.com\nProduto: SOJA\nUF de origem: PR\nDestino: Paranaguá\nDistancia: 520 km\nFrete: 140\nSaldo: 3000\nBalanca: 25m\nEstrada de chao: 5\nAntecedencia: 60</pre>
          <p class="pequeno mudo">Exemplos prontos em <code>dados/exemplos/</code>.</p></div>
      </div>
      <div id="resultado"></div>`;
    const zona = $('#zona-pdf'); ligarDropzone(zona);
    $('#form-pdf').onsubmit = async (ev) => {
      ev.preventDefault();
      const d = lerForm(ev.target);
      if (!zona.arquivo) return toast('Selecione um arquivo PDF.', 'erro');
      if (!/\.pdf$/i.test(zona.arquivo.name)) return toast('O arquivo precisa ser .pdf', 'erro');
      if (d.email && !emailOk(d.email)) return marcarErros(ev.target, { email: 'E-mail inválido.' });
      const fd = new FormData(); fd.append('arquivo', zona.arquivo);
      ['nome', 'email', 'telefone'].forEach((k) => d[k] && fd.append(k, d[k])); fd.append('id_requisicao', uuid());
      const botao = $('button[type=submit]', ev.target); ocupado(botao, true, 'Extraindo e processando…');
      try {
        const r = await api('/api/upload/pdf', { method: 'POST', body: fd });
        ($('#resultado') || {}).innerHTML = `<div class="card mt-g resultado">${r.situacao === 'sem_texto'
          ? `<div class="aviso aviso-alerta" style="margin:0">${icone('alert')}<div><b>${esc(r.nome_arquivo)}</b>: ${esc(r.mensagem)}<br>O arquivo foi registrado na Central (Arquivos), mas nenhuma demanda foi criada.</div></div>`
          : htmlResultado(r)}</div>`;
      } catch (e) { ($('#resultado') || {}).innerHTML = `<div class="mt-g">${erroBox(e)}</div>`; }
      finally { ocupado(botao, false); }
    };
  }

  function telaCsv(el) {
    el.innerHTML = `
      <div class="hero"><div><h2>Importar planilha CSV</h2><p>Um CSV é <b>um arquivo</b> que pode conter <b>centenas de registros</b>. Escolha a finalidade: novas demandas (cada linha vira uma solicitação analisada) ou base histórica rotulada (usada só para treinar e avaliar a IA).</p></div></div>
      <div class="card mt">
        <div class="opcoes-finalidade">
          <label class="opcao selecionada"><input type="radio" name="finalidade" value="novas_demandas" checked><div><strong>Novas demandas</strong><span>Linhas sem a coluna <code>atendida</code>. Cada linha passa por validação, classificação ou previsão da IA e recebe protocolo.</span></div></label>
          <label class="opcao"><input type="radio" name="finalidade" value="historico"><div><strong>Base histórica (treino da IA)</strong><span>Ex.: <code>rodomax_demandas.csv</code> — exige a coluna <code>atendida</code> (sim/nao). Vai para a tabela do modelo; não vira demanda.</span></div></label>
        </div>
        ${dropzone('zona-csv', '.csv,text/csv', 'Selecione o arquivo CSV')}
        <p class="pequeno mudo">Separador <code>;</code> ou <code>,</code> detectado automaticamente · UTF-8 ou Latin-1 (Excel) · até 10 MB.</p>
        <div class="form-acoes"><button class="botao botao-primario" id="btn-csv">${icone('upload')}Importar</button></div>
      </div>
      <div id="resultado"></div>`;
    const zona = $('#zona-csv'); ligarDropzone(zona);
    $$('.opcao input').forEach((r) => r.onchange = () => $$('.opcao').forEach((o) => o.classList.toggle('selecionada', $('input', o).checked)));
    $('#btn-csv').onclick = async (ev) => {
      if (!zona.arquivo) return toast('Selecione um arquivo CSV.', 'erro');
      const finalidade = $('.opcao input:checked').value;
      const fd = new FormData(); fd.append('arquivo', zona.arquivo); fd.append('finalidade', finalidade);
      const botao = ev.currentTarget; ocupado(botao, true, 'Importando…');
      try {
        const r = await api('/api/upload/csv', { method: 'POST', body: fd });
        ($('#resultado') || {}).innerHTML = `<div class="card mt-g resultado">${r.ok === false ? `<div class="aviso aviso-erro" style="margin:0">${icone('x')}<div><b>${esc(r.nome_arquivo)}</b>: ${esc(r.erro)}</div></div>` : finalidade === 'historico' ? htmlHistorico(r) : htmlLote(r)}</div>`;
        const treinar = $('#btn-treinar-agora'); if (treinar) treinar.onclick = () => treinarModelo(treinar);
      } catch (e) { ($('#resultado') || {}).innerHTML = `<div class="mt-g">${erroBox(e)}</div>`; }
      finally { ocupado(botao, false); }
    };
  }
  function htmlLote(r) {
    const n = r.nesta_execucao || {};
    return `<div class="card-titulo"><div><h3>${esc(r.nome_arquivo)}</h3><div class="sub">1 arquivo · ${fmtNum(r.registros_lidos)} registro(s) lidos</div></div>${chip('processada', 'Lote processado')}</div>
      <div class="grade g-4">
        ${kpi('Registros lidos', r.registros_lidos, 'linhas de dados no arquivo', 'table')}
        ${kpi('Importados', r.registros_importados, `${n.processadas} processadas · ${n.pendentes} pendentes`, 'check')}
        ${kpi('Rejeitados', r.registros_rejeitados, 'dados inválidos ou linhas repetidas', 'x')}
        ${kpi('Previsões da IA', (n.previsao_atendida || 0) + (n.previsao_nao_atendida || 0), `${n.previsao_atendida} atendida · ${n.previsao_nao_atendida} risco`, 'brain')}
      </div>
      ${n.duplicadas_ignoradas ? `<div class="aviso aviso-alerta">${icone('alert')}<div><b>${fmtNum(n.duplicadas_ignoradas)}</b> linha(s) já haviam sido importadas em um envio anterior do mesmo conteúdo: os registros originais foram mantidos (nenhuma duplicidade criada).</div></div>` : ''}
      <div class="tabela-wrap mt" style="margin-bottom:-20px"><table><thead><tr><th>Linha</th><th>Protocolo</th><th>Tipo</th><th>Situação</th><th>Previsão</th><th>Resumo</th></tr></thead><tbody>
      ${(r.amostra || []).sort((a, b) => a.linha - b.linha).map((a) => `<tr class="clicavel" data-protocolo="${esc(a.protocolo)}"><td class="num">${a.linha}</td><td class="mono">${esc(a.protocolo)}</td><td>${chipTipo(a.tipo)}</td><td>${chipStatus(a.situacao)}</td><td>${chipPrev(a.previsao)}</td><td class="pequeno mudo">${esc(a.mensagem.split(' | ').slice(1).join(' · '))}</td></tr>`).join('')}
      </tbody></table></div>`;
  }
  function htmlHistorico(r) {
    return `<div class="card-titulo"><div><h3>${esc(r.nome_arquivo)} — base histórica</h3><div class="sub">1 arquivo · ${fmtNum(r.linhas_lidas)} linhas</div></div>${chip('processada', 'Importada')}</div>
      <div class="grade g-4">
        ${kpi('Linhas válidas', r.validos, 'conferidas antes de gravar', 'check')}
        ${kpi('Novas na base', r.inseridos, 'gravadas em ia_historico', 'database')}
        ${kpi('Já existentes', r.ja_existentes, 'mesmo id_demanda: não duplicadas', 'layers')}
        ${kpi('Rejeitadas', r.rejeitados, 'linhas com problema', 'x')}
      </div>
      ${(r.exemplos_rejeicao || []).length ? `<div class="aviso aviso-alerta">${icone('alert')}<div>${r.exemplos_rejeicao.slice(0, 5).map((x) => `Linha ${x.linha}: ${esc(x.motivos.join('; '))}`).join('<br>')}</div></div>` : ''}
      <div class="aviso aviso-info">${icone('info')}<div>Total na base histórica: <b>${fmtNum(r.total_na_base)}</b> registros. Treine o modelo para que as novas demandas usem esta base.</div></div>
      <div class="form-acoes" style="justify-content:flex-start"><button class="botao botao-destaque" id="btn-treinar-agora">${icone('brain')}Treinar modelo agora</button></div>`;
  }
  // valor numérico é formatado; texto (ex.: "83%") é exibido como veio
  const kpi = (rotulo, valor, detalhe, ic) => `<div class="card kpi"><div class="kpi-rotulo">${icone(ic)}${esc(rotulo)}</div><div class="kpi-valor">${typeof valor === 'string' ? esc(valor) : fmtNum(valor)}</div><div class="kpi-detalhe">${detalhe}</div></div>`;

  // --------- Consulta de protocolo
  function telaProtocolo(el, protocolo) {
    el.innerHTML = `<form class="card" id="form-prot" style="max-width:640px"><div class="form-grade" style="grid-template-columns:1fr auto;align-items:end">
      ${campo('protocolo', 'Número do protocolo', input('protocolo', 'placeholder="RDM-000001" autocomplete="off" style="text-transform:uppercase"'))}
      <button class="botao botao-primario" type="submit" style="margin-bottom:2px">${icone('search')}Consultar</button></div></form><div id="resultado" class="mt"></div>`;
    const form = $('#form-prot');
    form.onsubmit = (ev) => { ev.preventDefault(); const p = $('#f-protocolo').value.trim().toUpperCase(); if (p) location.hash = `#/protocolo/${encodeURIComponent(p)}`; };
    if (protocolo) { $('#f-protocolo').value = protocolo; carregarDetalhe(protocolo, $('#resultado')); }
  }
  async function carregarDetalhe(protocolo, alvo) {
    alvo.innerHTML = carregando('Consultando…');
    try {
      const r = await api(`/api/demandas/${encodeURIComponent(protocolo)}`);
      alvo.innerHTML = r.dados ? htmlDetalhe(r.dados) : `<div class="card">${vazio('search', 'Protocolo não encontrado', `Nenhuma demanda com o protocolo <b>${esc(protocolo)}</b>.`)}</div>`;
    } catch (e) { alvo.innerHTML = erroBox(e); }
  }
  function htmlDetalhe(x) {
    const d = x.demanda; const l = x.logistica;
    const motivos = (d.motivos || []).filter((m) => m.codigo !== 'IGNORADO');
    const prev = l && l.previsao ? { classe: l.previsao, rotulo: l.previsao === 'sim' ? 'Tende a ser atendida' : 'Risco de não ser atendida', prob_atendida: l.prob_atendida, explicacao: l.explicacao } : null;
    const atr = l ? [['Produto', l.produto], ['UF de origem', l.uf_origem], ['Destino', l.destino], ['Distância', `${fmtNum(l.distancia_km)} km`], ['Frete', `R$ ${fmtNum(l.frete_ton, 2)}/t`], ['Saldo', `${fmtNum(l.saldo_ton)} t`], ['Balança', l.balanca], ['Estrada de chão', `${fmtNum(l.estrada_chao_km)} km`], ['Antecedência', `${fmtNum(l.antecedencia_h)} h`]].filter((a) => a[1] && !/undefined|—/.test(a[1])) : [];
    return `
      <div class="card"><div class="resultado-cabecalho">
        <div><div class="protocolo-rotulo">Protocolo</div><div class="protocolo-grande">${esc(d.protocolo)}</div><div class="mudo pequeno">Recebido em ${fmtData(d.recebido_em)} via ${esc(CANAIS[d.canal] || d.canal)}${x.arquivo ? ` · arquivo ${esc(x.arquivo.nome_arquivo)}${d.linha_arquivo ? `, linha ${d.linha_arquivo}` : ''}` : ''}</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${chipTipo(d.tipo_demanda)}${chipStatus(d.status)}${d.ambiente === 'teste' ? chip('demo', 'teste') : ''}</div></div>
        ${prev ? htmlPrevisao(prev) : ''}
        ${d.tipo_demanda === 'geral' && d.status === 'processada' ? `<div class="aviso aviso-ok">${icone('check')}<div>Setor responsável: <b>${esc(d.setor_responsavel)}</b> · ${esc(d.categoria)}<br><span class="pequeno">Regra: ${esc(d.regra_classificacao)}</span></div></div>` : ''}
        ${motivos.length ? `<div class="aviso ${d.status === 'pendente' ? 'aviso-alerta' : 'aviso-erro'}">${icone('alert')}<div><b>${d.status === 'pendente' ? 'Pendências' : 'Problemas encontrados'}</b><ul class="lista-motivos">${motivos.map((m) => `<li>${esc(m.descricao)}</li>`).join('')}</ul></div></div>` : ''}
      </div>
      <div class="grade g-2 mt">
        <div class="card"><div class="card-titulo"><h3>Dados da solicitação</h3></div><dl class="dl">
          <dt>Solicitante</dt><dd>${esc(d.solicitante_nome || '—')}</dd>
          <dt>Contato</dt><dd>${esc([d.solicitante_email, d.solicitante_telefone].filter(Boolean).join(' · ') || (d.telegram_chat_id ? 'Telegram' : '—'))}</dd>
          ${d.assunto ? `<dt>Assunto</dt><dd>${esc(d.assunto)}</dd>` : ''}
          ${d.descricao ? `<dt>Descrição</dt><dd>${esc(d.descricao)}</dd>` : ''}
          ${atr.map((a) => `<dt>${esc(a[0])}</dt><dd>${esc(a[1])}</dd>`).join('')}
          <dt>Resposta</dt><dd>${chip(d.resposta_status, ({ enviada: 'Enviada', nao_enviada: 'Não enviada', pendente: 'Pendente', nao_aplicavel: 'Não se aplica' })[d.resposta_status] || d.resposta_status)}<div class="pequeno mudo" style="margin-top:4px">${esc(d.resposta_detalhe || '')}</div></dd>
        </dl>
        <details class="bruto"><summary>Conteúdo original recebido</summary><pre>${esc(JSON.stringify(d.dados_originais, null, 2))}</pre></details>
        <details class="bruto"><summary>Campos mapeados e normalizados</summary><pre>${esc(JSON.stringify(d.dados_normalizados, null, 2))}</pre></details></div>
        <div class="card"><div class="card-titulo"><h3>Histórico de processamento</h3><span class="sub">n8n</span></div>
          <ul class="linha-tempo">${(x.eventos || []).map((e) => `<li><div class="etapa">${esc(e.etapa.replace(/_/g, ' '))}</div><div class="mudo">${esc(e.detalhe || '')}</div><div class="pequeno mudo">${fmtData(e.criado_em)}</div></li>`).join('')}</ul></div>
      </div>`;
  }

  // ------------------------------------------------------------------ CENTRAL: dashboard
  async function telaDashboard(el) {
    $('#topo-acoes').innerHTML = `<button class="botao botao-secundario" id="btn-atualizar">${icone('refresh')}<span>Atualizar</span></button>`;
    $('#btn-atualizar').onclick = () => telaDashboard(el);
    el.innerHTML = carregando('Consultando o PostgreSQL via n8n…');
    const nav = navAtual; let d;
    try { d = (await api('/api/dashboard')).dados; } catch (e) { if (mesmaTela(nav)) el.innerHTML = erroBox(e); return; }
    const dm = d.demandas; const arq = d.arquivos; const pv = d.previsoes; const msg = d.mensagens; const m = d.modelo_ativo;
    const recentes = await api('/api/demandas?limite=6').then((r) => r.dados.itens).catch(() => []);
    if (!mesmaTela(nav)) return;
    const semDados = dm.total === 0;
    el.innerHTML = `
      ${semDados ? `<div class="card">${vazio('inbox', 'Nenhuma demanda registrada ainda', 'Os indicadores são calculados a partir do banco de dados. Envie uma solicitação de frete, uma demanda geral, um PDF ou um CSV para começar.', `<a class="botao botao-primario" href="#/frete">${icone('truck')}Nova solicitação de frete</a>`)}</div>` : ''}
      <div class="grade g-4 ${semDados ? 'mt' : ''}">
        ${kpi('Demandas recebidas', dm.total, `${fmtNum(dm.hoje)} hoje · ${fmtNum(dm.gerais)} gerais · ${fmtNum(dm.logisticas)} logísticas`, 'inbox')}
        ${kpi('Processadas', dm.processadas, 'classificadas ou analisadas pela IA', 'check')}
        ${kpi('Pendentes', dm.pendentes, 'aguardando informações', 'clock')}
        ${kpi('Rejeitadas / erro', dm.rejeitadas + dm.com_erro, `${fmtNum(dm.rejeitadas)} rejeitadas · ${fmtNum(dm.com_erro)} com erro técnico`, 'x')}
      </div>
      <div class="grade g-21 mt">
        <div class="card"><div class="card-titulo"><div><h3>Demandas por dia</h3><div class="sub">últimos 14 dias</div></div></div>${colunas(d.ultimos_14_dias || [])}</div>
        <div class="card"><div class="card-titulo"><div><h3>Previsões da IA</h3><div class="sub">demandas logísticas analisadas</div></div></div>
          ${pv.total ? `<div class="kpi-valor" style="margin:0 0 12px">${fmtNum(pv.total)}</div>${empilhada([{ rotulo: 'Tende a ser atendida', valor: pv.atendida, cor: 'var(--bom)' }, { rotulo: 'Risco de não atendimento', valor: pv.nao_atendida, cor: 'var(--critico)' }])}` : '<p class="mudo">Nenhuma previsão gerada ainda.</p>'}
          <div class="aviso aviso-info pequeno">${icone('brain')}<div>${m ? `Modelo ativo <b>${esc(m.versao)}</b>: acurácia ${fmtPct(m.acuracia)} no teste (linha de base ${fmtPct(m.acuracia_linha_base)}).` : 'Nenhum modelo treinado. Importe a base histórica e treine na tela Modelo de IA.'}</div></div>
        </div>
      </div>
      <div class="grade g-3 mt">
        <div class="card"><div class="card-titulo"><div><h3>Demandas por canal</h3><div class="sub">registros de demanda</div></div></div>
          ${barras(['web', 'telegram', 'email', 'pdf', 'csv'].map((c) => ({ rotulo: CANAIS[c], valor: (d.por_canal || {})[c] || 0 })), { unidade: 'demanda(s)' })}</div>
        <div class="card"><div class="card-titulo"><div><h3>Tipo de demanda</h3><div class="sub">geral x logística</div></div></div>
          ${empilhada([{ rotulo: 'Gerais', valor: dm.gerais, cor: 'var(--serie-1)' }, { rotulo: 'Logísticas', valor: dm.logisticas, cor: 'var(--serie-2)' }])}
          <div class="card-titulo mt"><div><h3>Gerais por setor</h3></div></div>
          ${barras(Object.entries(d.por_setor || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ rotulo: k, valor: v })), { unidade: 'demanda(s)' })}</div>
        <div class="card"><div class="card-titulo"><div><h3>Entradas por unidade</h3><div class="sub">mensagens, arquivos e registros não se somam</div></div></div>
          <dl class="dl" style="grid-template-columns:1fr auto">
            <dt><b>Mensagens</b></dt><dd></dd>
            <dt>Telegram</dt><dd class="num">${fmtNum(msg.telegram)}</dd><dt>E-mail</dt><dd class="num">${fmtNum(msg.email)}</dd><dt>Formulários web</dt><dd class="num">${fmtNum(msg.web)}</dd>
            <dt style="margin-top:8px"><b>Arquivos</b></dt><dd></dd>
            <dt>PDF recebidos</dt><dd class="num">${fmtNum(arq.pdf)}</dd><dt>CSV de novas demandas</dt><dd class="num">${fmtNum(arq.csv_novas_demandas)}</dd><dt>CSV de base histórica</dt><dd class="num">${fmtNum(arq.csv_historico)}</dd>
            <dt style="margin-top:8px"><b>Registros (dentro dos CSV)</b></dt><dd></dd>
            <dt>Lidos</dt><dd class="num">${fmtNum(arq.registros_csv_lidos)}</dd><dt>Importados</dt><dd class="num">${fmtNum(arq.registros_csv_importados)}</dd><dt>Rejeitados</dt><dd class="num">${fmtNum(arq.registros_csv_rejeitados)}</dd>
            <dt>Base histórica da IA</dt><dd class="num">${fmtNum(d.historico_ia.registros)}</dd>
          </dl></div>
      </div>
      <div class="card mt"><div class="card-titulo"><div><h3>Últimas demandas</h3></div><a class="botao botao-secundario" href="#/demandas">Ver todas</a></div>
        ${recentes.length ? tabelaDemandas(recentes) : '<p class="mudo">Nenhuma demanda.</p>'}</div>`;
    ligarLinhas(el);
  }

  function tabelaDemandas(itens) {
    return `<div class="tabela-wrap"><table><thead><tr><th>Protocolo</th><th>Data</th><th>Canal</th><th>Tipo</th><th>Solicitante</th><th>Setor</th><th>Situação</th><th>Resultado da IA</th></tr></thead><tbody>
      ${itens.map((i) => `<tr class="clicavel" data-protocolo="${esc(i.protocolo)}"><td class="mono">${esc(i.protocolo)}</td><td class="pequeno">${fmtData(i.criado_em)}</td><td>${esc(CANAIS[i.canal] || i.canal)}</td><td>${chipTipo(i.tipo_demanda)}</td><td>${esc(i.solicitante_nome || '—')}</td><td>${esc(i.setor_responsavel || '—')}</td><td>${chipStatus(i.status)}</td><td>${i.tipo_demanda === 'logistica' ? chipPrev(i.previsao) : '<span class="mudo pequeno">não se aplica</span>'}</td></tr>`).join('')}
      </tbody></table></div>`;
  }
  function ligarLinhas(el) {
    $$('tr[data-protocolo]', el).forEach((tr) => tr.onclick = () => abrirGaveta(tr.dataset.protocolo));
  }
  function abrirGaveta(protocolo) {
    const g = $('#gaveta'); g.classList.add('aberta'); g.setAttribute('aria-hidden', 'false');
    carregarDetalhe(protocolo, $('#gaveta-conteudo'));
  }
  $$('[data-fechar]').forEach((b) => b.onclick = () => { $('#gaveta').classList.remove('aberta'); $('#gaveta').setAttribute('aria-hidden', 'true'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#gaveta').classList.remove('aberta'); });

  // ------------------------------------------------------------------ CENTRAL: demandas
  function telaDemandas(el) {
    const estado = { offset: 0, limite: 25 };
    el.innerHTML = `
      <form class="filtros" id="filtros">
        ${campo('busca', 'Buscar', input('busca', 'placeholder="Protocolo, solicitante, destino, texto…"'), { classe: 'busca' })}
        ${campo('canal', 'Canal', select('canal', Object.entries(CANAIS).filter(([k]) => k !== 'portal'), 'Todos'))}
        ${campo('tipo_demanda', 'Tipo', select('tipo_demanda', [['geral', 'Geral'], ['logistica', 'Logística']], 'Todos'))}
        ${campo('status', 'Situação', select('status', Object.entries(STATUS).filter(([k]) => k !== 'erro_tecnico'), 'Todas'))}
        ${campo('previsao', 'Previsão IA', select('previsao', [['sim', 'Tende a ser atendida'], ['nao', 'Risco de não atendimento']], 'Todas'))}
      </form>
      <div class="card"><div id="lista">${carregando()}</div></div>`;
    const form = $('#filtros');
    const carregar = async () => {
      const f = lerForm(form); const q = new URLSearchParams({ ...f, limite: estado.limite, offset: estado.offset });
      if (f.canal === 'teste') q.set('incluir_testes', 'true');
      $('#lista').innerHTML = carregando();
      const nav = navAtual;
      try {
        const r = (await api(`/api/demandas?${q}`)).dados;
        if (!mesmaTela(nav) || !$('#lista')) return;
        const fim = Math.min(estado.offset + estado.limite, r.total);
        $('#lista').innerHTML = r.total ? `<div class="card-titulo"><div><h3>${fmtNum(r.total)} demanda(s)</h3><div class="sub">exibindo ${estado.offset + 1}–${fim} · clique para ver detalhes</div></div>
          <div style="display:flex;gap:8px"><button class="botao botao-secundario" id="ant" ${estado.offset ? '' : 'disabled'}>‹ Anterior</button><button class="botao botao-secundario" id="prox" ${fim < r.total ? '' : 'disabled'}>Próxima ›</button></div></div>${tabelaDemandas(r.itens)}`
          : vazio('search', 'Nenhuma demanda encontrada', 'Ajuste os filtros ou registre uma nova solicitação.');
        ligarLinhas($('#lista'));
        if ($('#ant')) { $('#ant').onclick = () => { estado.offset -= estado.limite; carregar(); }; $('#prox').onclick = () => { estado.offset += estado.limite; carregar(); }; }
      } catch (e) { if (mesmaTela(nav) && $('#lista')) $('#lista').innerHTML = erroBox(e); }
    };
    let t; form.oninput = () => { clearTimeout(t); t = setTimeout(() => { estado.offset = 0; carregar(); }, 300); };
    form.onsubmit = (e) => e.preventDefault();
    carregar();
  }

  // ------------------------------------------------------------------ CENTRAL: arquivos
  async function telaArquivos(el) {
    el.innerHTML = carregando(); const nav = navAtual;
    try {
      const lista = (await api('/api/arquivos')).dados || [];
      if (!mesmaTela(nav)) return;
      if (!lista.length) { el.innerHTML = `<div class="card">${vazio('folder', 'Nenhum arquivo importado', 'PDFs e CSVs enviados pela aplicação (ou anexos de e-mail) aparecem aqui com o resultado da validação.', `<a class="botao botao-primario" href="#/csv">${icone('table')}Importar CSV</a>`)}</div>`; return; }
      const FIN = { novas_demandas: 'Novas demandas', historico: 'Base histórica', documento: 'Documento' };
      el.innerHTML = `<div class="card"><div class="card-titulo"><div><h3>${lista.length} arquivo(s)</h3><div class="sub">cada arquivo é um lote; os registros ficam nas colunas ao lado</div></div></div>
        <div class="tabela-wrap"><table><thead><tr><th>Arquivo</th><th>Data</th><th>Tipo</th><th>Finalidade</th><th>Canal</th><th class="num">Registros</th><th class="num">Importados</th><th class="num">Rejeitados</th><th>Situação</th></tr></thead><tbody>
        ${lista.map((a) => `<tr><td><b>${esc(a.nome_arquivo)}</b><div class="pequeno mudo">${esc(a.detalhe || '')}</div>${a.texto_previa ? `<details class="bruto"><summary>Texto extraído</summary><pre>${esc(a.texto_previa)}</pre></details>` : ''}</td>
          <td class="pequeno">${fmtData(a.criado_em)}</td><td>${chip('demo', a.tipo_arquivo.toUpperCase())}</td><td>${esc(FIN[a.finalidade] || a.finalidade)}</td><td>${esc(CANAIS[a.canal] || a.canal)}</td>
          <td class="num">${fmtNum(a.registros_total)}</td><td class="num">${fmtNum(a.registros_importados)}${a.registros_duplicados ? `<div class="pequeno mudo">${fmtNum(a.registros_duplicados)} já existiam</div>` : ''}</td><td class="num">${fmtNum(a.registros_rejeitados)}</td>
          <td>${chip(a.status === 'processado' ? 'processada' : a.status === 'recebido' ? 'pendente' : 'erro', ({ processado: 'Processado', recebido: 'Recebido', sem_texto: 'Sem texto', erro: 'Erro' })[a.status] || a.status)}</td></tr>`).join('')}
        </tbody></table></div></div>`;
    } catch (e) { if (mesmaTela(nav)) el.innerHTML = erroBox(e); }
  }

  // ------------------------------------------------------------------ CENTRAL: modelo de IA
  async function treinarModelo(botao) {
    ocupado(botao, true, 'Treinando no n8n…');
    try {
      const r = await api('/api/modelo/treinar', { method: 'POST' });
      if (r.ok) { toast(`Modelo ${r.versao} treinado: acurácia ${fmtPct(r.resumo.acuracia)}`, 'ok'); if (location.hash.startsWith('#/modelo')) navegar(); else location.hash = '#/modelo'; }
      else toast(r.erro || 'Falha no treino', 'erro');
    } catch (e) { toast(e.message, 'erro'); } finally { if (document.body.contains(botao)) ocupado(botao, false); }
  }
  async function telaModelo(el) {
    $('#topo-acoes').innerHTML = `<button class="botao botao-destaque" id="btn-treinar">${icone('brain')}<span>Treinar modelo</span></button>`;
    $('#btn-treinar').onclick = (e) => treinarModelo(e.currentTarget);
    el.innerHTML = carregando('Carregando modelo…');
    const nav = navAtual; let dados;
    try { dados = (await api('/api/modelo')).dados; } catch (e) { if (mesmaTela(nav)) el.innerHTML = erroBox(e); return; }
    if (!mesmaTela(nav)) return;
    const m = dados.ativo; const h = dados.historico;
    if (!m) {
      el.innerHTML = `<div class="card">${vazio('brain', 'Nenhum modelo treinado', `Base histórica atual: <b>${fmtNum(h.registros)}</b> registros. ${h.registros ? 'Clique em <b>Treinar modelo</b>.' : 'Importe o <code>rodomax_demandas.csv</code> como <b>Base histórica</b> e depois treine.'}`, h.registros ? '' : `<a class="botao botao-primario" href="#/csv">${icone('table')}Importar base histórica</a>`)}</div>`;
      return;
    }
    const mt = m.metricas; const a = mt.arvore; const b = mt.linha_base; const prep = m.preparacao; const mc = a.matriz_confusao;
    const comp = (rot, va, vb) => `<div class="comp-item"><div class="comp-topo"><b>${rot}</b><span class="mudo">${va > vb ? `+${fmtNum((va - vb) * 100, 1)} p.p.` : ''}</span></div><div class="comp-barras">
        <div class="comp-barra" data-tip="${esc(`<b>Árvore CART</b> — ${rot}: ${fmtPct(va)}`)}"><span>Árvore</span><div class="trilho"><div style="width:${va * 100}%;background:var(--serie-1)"></div></div><b>${fmtPct(va)}</b></div>
        <div class="comp-barra" data-tip="${esc(`<b>Linha de base</b> — ${rot}: ${fmtPct(vb)}`)}"><span>Linha base</span><div class="trilho"><div style="width:${vb * 100}%;background:var(--serie-2)"></div></div><b>${fmtPct(vb)}</b></div></div></div>`;
    const tot = mc.vn + mc.fp + mc.fn + mc.vp;
    const cel = (v, ok, rot) => `<div class="cel" style="background:${ok ? `rgba(12,138,12,${0.12 + (0.55 * v) / tot})` : `rgba(208,59,59,${0.1 + (0.55 * v) / tot})`}" data-tip="${esc(rot)}"><strong>${v}</strong><span>${ok ? 'acerto' : 'erro'}</span></div>`;
    const vc = mt.validacao_cruzada; const maxVc = Math.max(...vc.resultados.map((r) => r.acuracia_media));
    el.innerHTML = `
      <div class="hero"><div><h2>Árvore de Decisão CART · índice Gini</h2><p>Problema: <b>prever se uma demanda logística será atendida</b>. Treinada no n8n (JavaScript) com ${fmtNum(prep.registros_utilizados)} demandas do <code>rodomax_demandas.csv</code>: ${fmtNum(m.n_treino)} para treino e ${fmtNum(m.n_teste)} para teste (estratificado, semente ${prep.semente_separacao}). Versão <b>${esc(m.versao)}</b> · ${fmtData(m.criado_em)}.</p></div>
        <div style="text-align:right"><div class="protocolo-rotulo" style="color:#b9c9dc">Acurácia no teste</div><div style="font-size:34px;font-weight:800">${fmtPct(a.acuracia)}</div><div class="pequeno" style="color:#b9c9dc">linha de base: ${fmtPct(b.acuracia)}</div></div></div>
      <div class="grade g-4 mt">
        ${kpi('Acurácia', fmtPct(a.acuracia), `linha de base ${fmtPct(b.acuracia)}`, 'activity')}
        ${kpi('Precisão ("nao")', fmtPct(a.precisao), 'dos alertas de risco, quantos estavam certos', 'check')}
        ${kpi('Recall ("nao")', fmtPct(a.recall), 'das não atendidas, quantas foram detectadas', 'search')}
        ${kpi('F1-score ("nao")', fmtPct(a.f1), 'equilíbrio entre precisão e recall', 'layers')}
      </div>
      <div class="aviso aviso-info">${icone('info')}<div>${esc(mt.veredito)} ${esc(mt.observacao)}</div></div>
      <div class="grade g-3 mt">
        <div class="card"><div class="card-titulo"><div><h3>Árvore × linha de base</h3><div class="sub">conjunto de teste · classe positiva "nao"</div></div></div>
          <div class="comparativo">${comp('Acurácia', a.acuracia, b.acuracia)}${comp('Precisão', a.precisao, b.precisao)}${comp('Recall', a.recall, b.recall)}${comp('F1-score', a.f1, b.f1)}</div>
          <div class="legenda"><span><i style="background:var(--serie-1)"></i>Árvore CART</span><span><i style="background:var(--serie-2)"></i>${esc(b.regra)}</span></div></div>
        <div class="card"><div class="card-titulo"><div><h3>Matriz de confusão</h3><div class="sub">${tot} demandas de teste</div></div></div>
          <div class="matriz"><div></div><div class="cab">Previsto: sim</div><div class="cab">Previsto: nao</div>
            <div class="cab lado">Real: sim</div>${cel(mc.vn, true, 'Real sim, previsto sim (verdadeiro negativo)')}${cel(mc.fp, false, 'Real sim, previsto nao (falso positivo: alarme falso)')}
            <div class="cab lado">Real: nao</div>${cel(mc.fn, false, 'Real nao, previsto sim (falso negativo: risco não detectado)')}${cel(mc.vp, true, 'Real nao, previsto nao (verdadeiro positivo)')}</div>
          <p class="pequeno mudo" style="margin-bottom:0">Acurácia no treino: ${fmtPct(mt.acuracia_treino)} (diferença treino−teste: ${fmtNum(mt.diferenca_treino_teste * 100, 1)} p.p.)</p></div>
        <div class="card"><div class="card-titulo"><div><h3>Importância dos atributos</h3><div class="sub">redução total de Gini</div></div></div>
          ${barras(m.importancias.filter((i) => i.importancia > 0).map((i) => ({ rotulo: i.atributo, valor: Math.round(i.importancia * 1000) / 10 })), { unidade: '%' }).replace(/<span class="barra-valor">([\d.,]+)<\/span>/g, '<span class="barra-valor">$1%</span>')}
          <p class="pequeno mudo">Atributos com importância zero não foram usados por nenhuma divisão: ${esc(m.importancias.filter((i) => !i.importancia).map((i) => i.atributo).join(', '))}.</p></div>
      </div>
      <div class="grade g-12 mt">
        <div class="card"><div class="card-titulo"><div><h3>Escolha da profundidade</h3><div class="sub">validação cruzada ${vc.folds} partes, só no treino</div></div></div>
          ${barras(vc.resultados.map((r) => ({ rotulo: `profundidade ${r.profundidade_maxima}`, valor: Math.round(r.acuracia_media * 1000) / 10, cor: r.profundidade_maxima === vc.profundidade_escolhida ? 'var(--serie-1)' : '#9ec5f4' })), { unidade: '% (média)' }).replace(/<span class="barra-valor">([\d.,]+)<\/span>/g, '<span class="barra-valor">$1%</span>')}
          <p class="pequeno mudo">Escolhida: <b>profundidade ${vc.profundidade_escolhida}</b> (barra escura). ${esc(vc.criterio)}. Melhor média: ${fmtPct(maxVc)}.</p></div>
        <div class="card"><div class="card-titulo"><div><h3>Árvore treinada</h3><div class="sub">${mt.estrutura.folhas} folhas · profundidade ${mt.estrutura.profundidade_real} · ramo esquerdo = condição verdadeira</div></div></div>
          <div class="arvore">${htmlArvore(m.arvore)}</div></div>
      </div>
      <div class="grade g-2 mt">
        <div class="card"><div class="card-titulo"><div><h3>Preparação dos dados</h3><div class="sub">tratamentos documentados</div></div></div>
          <dl class="dl"><dt>Registros</dt><dd>${fmtNum(prep.registros_lidos)} lidos · ${fmtNum(prep.registros_utilizados)} usados · ${fmtNum(prep.registros_excluidos)} excluídos</dd>
            <dt>Classes</dt><dd>sim: ${prep.distribuicao_classes.sim} · nao: ${prep.distribuicao_classes.nao}</dd>
            <dt>Treino / teste</dt><dd>${prep.treino.registros} (sim ${prep.treino.classes.sim} / nao ${prep.treino.classes.nao}) · ${prep.teste.registros} (sim ${prep.teste.classes.sim} / nao ${prep.teste.classes.nao})</dd>
            <dt>Atributos usados</dt><dd>${m.atributos.map((x) => `<code>${esc(x.nome)}</code>`).join(', ')}</dd>
            <dt>Atributo derivado</dt><dd>${esc(prep.atributo_derivado)}</dd>
            ${prep.atributos_excluidos.map((x) => `<dt>Excluído: ${esc(x.atributo)}</dt><dd>${esc(x.motivo)}</dd>`).join('')}
          </dl></div>
        <div class="card"><div class="card-titulo"><div><h3>Vazamento de informação</h3><div class="sub">status_agendamento × atendida</div></div></div>
          <div class="tabela-wrap" style="margin:0 -20px"><table><thead><tr><th>status_agendamento</th><th class="num">sim</th><th class="num">nao</th><th class="num">% atendida</th></tr></thead><tbody>
          ${prep.vazamento_status_agendamento.map((v) => `<tr><td>${esc(v.status_agendamento)}</td><td class="num">${v.sim}</td><td class="num">${v.nao}</td><td class="num">${fmtNum(v.percentual_atendida, 1)}%</td></tr>`).join('')}</tbody></table></div>
          <div class="aviso aviso-alerta">${icone('alert')}<div>Com <code>status_agendamento</code>, a mesma árvore chegaria a <b>${fmtPct(mt.experimento_vazamento.acuracia_teste)}</b> — mas esse campo só existe depois do resultado (cancelado = nunca atendida). Usá-lo seria "olhar a resposta". Por isso foi <b>excluído</b>.</div></div></div>
      </div>
      <div class="card mt"><div class="card-titulo"><div><h3>Exemplos reais do conjunto de teste</h3><div class="sub">acertos e erros (para o relatório)</div></div></div>
        <div class="tabela-wrap"><table><thead><tr><th>id</th><th>Resultado</th><th>Real</th><th>Previsto</th><th>Produto</th><th>Rota</th><th class="num">Frete R$/t</th><th class="num">R$/t·km</th><th class="num">Chão km</th><th class="num">Antec. h</th><th>Folha</th></tr></thead><tbody>
        ${[...mt.exemplos.acertos.map((x) => ['Acerto', x]), ...mt.exemplos.falsos_positivos.map((x) => ['Falso positivo', x]), ...mt.exemplos.falsos_negativos.map((x) => ['Falso negativo', x])].map(([t, x]) => `<tr><td class="mono">${x.id_demanda}</td><td>${chip(t === 'Acerto' ? 'processada' : 'rejeitada', t)}</td><td>${esc(x.real)}</td><td>${esc(x.previsto)}</td><td>${esc(x.produto)}</td><td class="pequeno">${esc(x.uf_origem)} → ${esc(x.destino)} (${fmtNum(x.distancia_km)} km)</td><td class="num">${fmtNum(x.frete_ton, 2)}</td><td class="num">${fmtNum(x.frete_por_km, 3)}</td><td class="num">${fmtNum(x.estrada_chao_km)}</td><td class="num">${fmtNum(x.antecedencia_h)}</td><td class="pequeno">${x.folha_sim} sim / ${x.folha_nao} nao</td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="card mt"><div class="card-titulo"><div><h3>Versões treinadas</h3><div class="sub">o modelo ativo é usado nas previsões</div></div></div>
        <div class="tabela-wrap"><table><thead><tr><th>ID</th><th>Versão</th><th>Data</th><th class="num">Acurácia</th><th>Situação</th></tr></thead><tbody>
        ${dados.versoes.map((v) => `<tr><td>${v.id}</td><td class="mono">${esc(v.versao)}</td><td>${fmtData(v.criado_em)}</td><td class="num">${fmtPct(v.acuracia)}</td><td>${v.ativo ? chip('processada', 'Ativo') : chip('demo', 'Inativo')}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function htmlArvore(no, ramo = '') {
    const rot = (n) => (n.op === '<=' ? `${n.atributo} ≤ ${Number(n.valor).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}` : `${n.atributo} ∈ {${n.valor.join(', ')}}`);
    const tag = ramo ? `<span class="ramo">${ramo}</span>` : '';
    if (no.tipo === 'folha') {
      return `<ul><li><span class="no-arvore folha-${no.classe}" data-tip="${esc(`Folha com ${no.n} demandas de treino: ${no.contagem.sim} atendidas, ${no.contagem.nao} não atendidas`)}">${tag}<b>atendida = ${no.classe}</b><span class="mudo">${no.contagem.sim} sim / ${no.contagem.nao} nao</span></span></li></ul>`;
    }
    return `<ul><li><span class="no-arvore" data-tip="${esc(`n=${no.n} · Gini ${no.gini} · ganho ${no.ganho}`)}">${tag}<b>${esc(rot(no))}</b><span class="mudo">n=${no.n}</span></span>${htmlArvore(no.esquerda, 'sim')}${htmlArvore(no.direita, 'não')}</li></ul>`;
  }

  // ------------------------------------------------------------------ CENTRAL: canais
  async function telaCanais(el) {
    const nav = navAtual;
    await verificarSaude();
    if (!mesmaTela(nav)) return;
    const s = window.__saude || {}; const tg = s.telegram || {};
    const card = (ic, nome, chipHtml, texto) => `<div class="card canal-card"><div class="canal-topo"><div class="canal-icone">${icone(ic)}</div><div><h3 style="font-size:15px">${nome}</h3></div><div style="margin-left:auto">${chipHtml}</div></div><p>${texto}</p></div>`;
    el.innerHTML = `
      <div class="grade g-3">
        ${card('globe', 'Web (formulários)', s.workflow_ativo ? chip('processada', 'Ativo') : chip('erro', 'n8n indisponível'), 'Solicitações de frete e demandas gerais enviadas por esta aplicação → backend → webhook <code>/rodomax/demanda</code>.')}
        ${card('file', 'PDF', s.workflow_ativo ? chip('processada', 'Ativo') : chip('erro', 'n8n indisponível'), 'Upload pela aplicação. Texto extraído pelo n8n (Extract From File). PDFs sem texto são informados, sem OCR.')}
        ${card('table', 'CSV', s.workflow_ativo ? chip('processada', 'Ativo') : chip('erro', 'n8n indisponível'), 'Importação em lote: <b>novas demandas</b> (cada linha é processada) ou <b>base histórica</b> (treino da IA).')}
        ${card('send', 'Telegram', tg.ativo ? chip('processada', `Ativo · @${esc(tg.bot)}`) : tg.configurado ? chip('erro', 'Token com erro') : chip('pendente', 'Aguardando token'), `Bot com conversa progressiva: o n8n pergunta os dados que faltam. Conector local (long polling) no backend${tg.ativo ? ` · ${tg.mensagens_recebidas} mensagem(ns) recebida(s), ${tg.respostas_enviadas} resposta(s) enviada(s)` : ' — defina <code>TELEGRAM_BOT_TOKEN</code> no <code>.env</code>'}.${tg.ultimo_erro ? `<br><span class="pequeno" style="color:var(--critico)">Último erro: ${esc(tg.ultimo_erro)}</span>` : ''}`)}
        ${card('mail', 'E-mail (Gmail)', chip('pendente', 'Configuração no n8n'), 'Gatilho IMAP e resposta SMTP no workflow, <b>desativados por padrão</b>. Após cadastrar as credenciais (Gmail + senha de app), ative os dois nodes. Ver CONFIGURACAO.md.')}
        ${card('layers', 'Portal', chip('demo', 'Demonstrativo'), 'Canal apenas ilustrativo nesta versão acadêmica: não há integração funcional com portal externo.')}
        ${card('message', 'WhatsApp', chip('demo', 'Substituído pelo Telegram'), 'Não é um canal ativo desta versão. Registros históricos com canal "whatsapp" no dataset são preservados apenas como informação histórica.')}
      </div>
      <div class="card mt"><div class="card-titulo"><h3>Arquitetura</h3></div>
        <p style="margin:0;line-height:1.7;color:var(--texto-2)">Interface web → <b>backend</b> (Node.js, ${esc(location.host)}) → <b>n8n</b> (${esc(s.n8n_url || '')}, workflow único "RODOMAX HUB - Integrado") → <b>PostgreSQL</b>. O navegador nunca acessa o banco: validação, classificação, IA e gravação acontecem no n8n.</p></div>`;
  }

  // ------------------------------------------------------------------ início
  $('#botao-menu').onclick = () => $('#sidebar').classList.toggle('aberta');
  montarMenu();
  window.addEventListener('hashchange', navegar);
  navegar();
  verificarSaude();
  setInterval(verificarSaude, 30000);
})();
