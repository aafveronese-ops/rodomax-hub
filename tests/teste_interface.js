// Teste de interface com Playwright (Chromium): navega por todas as telas, preenche formulários,
// faz uploads e verifica erros de console. Uso: node tests/teste_interface.js [url] [pasta_screenshots]
const { chromium } = require('playwright');
const path = require('path');
const URL = process.argv[2] || 'http://localhost:3000';
const OUT = process.argv[3] || '.';
const EX = path.join(__dirname, '..', 'dados', 'exemplos');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const erros = [];
  // 422 = resposta esperada para PDF sem texto (o navegador registra como recurso com falha)
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 422/.test(m.text())) erros.push(m.text()); });
  page.on('pageerror', (e) => erros.push(e.message));
  const ok = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FALHA'} ${msg}`); if (!cond) process.exitCode = 1; };
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`), fullPage: true });

  for (const r of ['dashboard', 'demandas', 'arquivos', 'modelo', 'canais', 'frete', 'geral', 'pdf', 'csv', 'protocolo']) {
    await page.goto(`${URL}/#/${r}`); await page.waitForTimeout(1200);
    ok((await page.locator('#conteudo').innerText()).length > 20, `tela ${r} renderizou`);
    await shot(`tela_${r}`);
  }
  // frete: validação do cliente
  await page.goto(`${URL}/#/frete`); await page.click('button[type=submit]');
  ok(await page.locator('.campo.invalido').count() >= 8, 'frete: campos obrigatórios marcados');
  await page.fill('#f-nome', 'Teste Interface'); await page.fill('#f-email', 'interface@example.com');
  await page.selectOption('#f-produto', 'SOJA'); await page.selectOption('#f-uf_origem', 'PR'); await page.fill('#f-destino', 'Paranaguá');
  await page.fill('#f-distancia_km', '580'); await page.fill('#f-estrada_chao_km', '0'); await page.selectOption('#f-balanca', '25m');
  await page.fill('#f-frete_ton', '155'); await page.fill('#f-saldo_ton', '2200'); await page.fill('#f-antecedencia_h', '70');
  await page.click('button[type=submit]'); await page.waitForSelector('.protocolo-grande', { timeout: 60000 });
  const prot = await page.locator('.protocolo-grande').innerText();
  ok(/^RDM-\d{6}$/.test(prot), `frete: protocolo ${prot}`); ok(await page.locator('.previsao-painel').count() === 1, 'frete: previsão exibida');
  await shot('resultado_frete');
  // consulta do protocolo
  await page.goto(`${URL}/#/protocolo/${prot}`); await page.waitForSelector('.linha-tempo li');
  ok((await page.locator('.linha-tempo li').count()) >= 5, 'protocolo: histórico de processamento'); await shot('protocolo_detalhe');
  // geral
  await page.goto(`${URL}/#/geral`); await page.fill('#f-nome', 'Teste Geral'); await page.fill('#f-telefone', '42999998888');
  await page.fill('#f-descricao', 'Preciso da segunda via do boleto deste mês'); await page.click('button[type=submit]');
  await page.waitForSelector('.protocolo-grande', { timeout: 60000 });
  ok((await page.locator('#resultado').innerText()).includes('Financeiro'), 'geral: encaminhada ao Financeiro'); await shot('resultado_geral');
  // pdf
  await page.goto(`${URL}/#/pdf`); await page.setInputFiles('#zona-pdf input', path.join(EX, 'demanda_geral_exemplo.pdf'));
  await page.click('button[type=submit]'); await page.waitForSelector('#resultado .card', { timeout: 60000 });
  ok((await page.locator('#resultado').innerText()).includes('RDM-'), 'pdf: protocolo gerado'); await shot('resultado_pdf');
  await page.goto(`${URL}/#/dashboard`); await page.goto(`${URL}/#/pdf`); await page.setInputFiles('#zona-pdf input', path.join(EX, 'pdf_sem_texto_exemplo.pdf'));
  await page.click('button[type=submit]'); await page.waitForSelector('#resultado .card', { timeout: 60000 });
  ok((await page.locator('#resultado').innerText()).includes('sem texto'), 'pdf sem texto: informado ao usuário');
  // csv
  await page.goto(`${URL}/#/csv`); await page.setInputFiles('#zona-csv input', path.join(EX, 'novas_demandas_exemplo.csv'));
  await page.click('#btn-csv'); await page.waitForSelector('#resultado .card', { timeout: 60000 });
  ok((await page.locator('#resultado').innerText()).includes('Registros lidos'), 'csv: resumo do lote'); await shot('resultado_csv');
  // demandas: filtro + gaveta de detalhes
  await page.goto(`${URL}/#/demandas`); await page.waitForSelector('tr[data-protocolo]');
  await page.selectOption('#f-tipo_demanda', 'logistica'); await page.waitForTimeout(1500);
  await page.locator('tr[data-protocolo]').first().click(); await page.waitForSelector('#gaveta.aberta .protocolo-grande');
  ok(true, 'demandas: gaveta de detalhes abriu'); await page.waitForTimeout(400); await shot('demandas_gaveta');
  // dashboard final + modelo
  await page.goto(`${URL}/#/dashboard`); await page.waitForTimeout(2000); await shot('dashboard');
  await page.goto(`${URL}/#/modelo`); await page.waitForTimeout(2000); ok((await page.locator('.matriz .cel').count()) === 4, 'modelo: matriz de confusão'); await shot('modelo');
  // mobile
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  for (const r of ['dashboard', 'frete', 'modelo']) {
    await m.goto(`${URL}/#/${r}`); await m.waitForTimeout(1800);
    const larg = await m.evaluate(() => document.documentElement.scrollWidth);
    ok(larg <= 392, `mobile ${r}: sem rolagem horizontal (${larg}px)`);
    await m.screenshot({ path: path.join(OUT, `mobile_${r}.png`), fullPage: true });
  }
  ok(erros.length === 0, `sem erros de console ${erros.length ? JSON.stringify(erros.slice(0, 3)) : ''}`);
  await browser.close();
})();
