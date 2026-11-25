// Executa os nodes de IA (IA1 -> IA2 -> IA3) FORA do n8n, simulando $input.
// Uso: node tests/harness_ia.js   (serve para conferência; o oficial roda no n8n)
const fs = require('fs'); const path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'n8n', 'src', f), 'utf8');
const runNode = (code, inputItems) => {
  const $input = { first: () => inputItems[0], all: () => inputItems };
  return new Function('$input', code)($input);
};
const csv = fs.readFileSync(path.join(__dirname, '..', 'dados', 'rodomax_demandas.csv'), 'utf8').trim().split(/\r?\n/);
const cab = csv[0].split(',');
const registros = csv.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, i) => [cab[i], v])));
let out = runNode(src('ia1_preparar_dados.js'), [{ json: { registros } }]);
out = runNode(src('ia2_treinar_arvore.js'), out);
out = runNode(src('ia3_avaliar_modelo.js'), out);
const m = out[0].json.registro_modelo;
console.log(JSON.stringify(out[0].json.resumo, null, 1));
console.log(JSON.stringify(m.metricas.validacao_cruzada.resultados.map(v=>[v.profundidade_maxima,v.acuracia_media,v.desvio_padrao])));
console.log(JSON.stringify(m.metricas.arvore.matriz_confusao.valores), JSON.stringify(m.metricas.linha_base.matriz_confusao.valores));
console.log(JSON.stringify(m.importancias));
console.log(m.arvore_texto);
console.log(JSON.stringify(m.preparacao.vazamento_status_agendamento));
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(m));
