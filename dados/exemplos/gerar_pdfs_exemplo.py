"""Gera os PDFs de EXEMPLO (fictícios) usados na demonstração. Requer: pip install fpdf2"""
from fpdf import FPDF
from pathlib import Path
aqui = Path(__file__).parent

def pdf(nome, titulo, linhas):
    p = FPDF(); p.add_page(); p.set_font('Helvetica', 'B', 15); p.cell(0, 10, titulo, new_x='LMARGIN', new_y='NEXT')
    p.set_font('Helvetica', '', 11)
    for l in linhas: p.multi_cell(0, 7, l, new_x='LMARGIN', new_y='NEXT')
    p.output(str(aqui / nome))

pdf('demanda_frete_exemplo.pdf', 'Solicitacao de Frete (exemplo ficticio)', [
    'Nome: Cooperativa Exemplo PDF', 'Email: contato@cooperativa-exemplo.com', 'Produto: SOJA', 'UF de origem: PR',
    'Destino: Paranagua', 'Distancia: 520 km', 'Frete: 140', 'Saldo: 3000', 'Balanca: 25m', 'Estrada de chao: 5', 'Antecedencia: 60',
    '', 'Observacao: carga pronta no armazem, favor confirmar disponibilidade.'])
pdf('demanda_geral_exemplo.pdf', 'Comunicado (exemplo ficticio)', [
    'Nome: Empresa Exemplo Ltda', 'Email: financeiro@empresa-exemplo.com', '',
    'Solicitamos a segunda via da fatura de outubro e a confirmacao do pagamento realizado via boleto.'])
# PDF sem texto (só um desenho): simula documento escaneado
p = FPDF(); p.add_page(); p.set_fill_color(200, 200, 200); p.rect(20, 20, 170, 120, style='F'); p.output(str(aqui / 'pdf_sem_texto_exemplo.pdf'))
print('PDFs gerados em', aqui)
