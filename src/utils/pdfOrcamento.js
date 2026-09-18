import moment from 'moment-timezone';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { LOGO_GEM_BASE64 } from './logoGem';

const formatCurrency = (value) => Number(value || 0).toFixed(2).replace('.', ',');
const escapeHtml = (value) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

// Mesmo layout usado no PDF de venda (pdfVenda.js) e no orçamento do vendasFront,
// adaptado para o fluxo do PDV.
export const criarHtmlOrcamento = ({
    orcamento,
    vendedor,
    cliente,
    itens = [],
    logoUrl = LOGO_GEM_BASE64,
    dataOrcamento = moment(),
    diasValidade = 30,
}) => {
    const totalOrcamento = itens.reduce((total, item) => total + (item?.valorTotal || 0), 0);
    const orcamentoId = escapeHtml(orcamento?.orcamentoId || '');
    const clienteNome = escapeHtml(cliente?.nome || 'Não informado');
    const vendedorNome = escapeHtml(vendedor?.nome || 'Não informado');

    const listagemProdutos = itens.map((item) => `
            <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 12px 8px; vertical-align: middle;">${escapeHtml(item?.produtoNome)}</td>
                <td style="text-align: center; padding: 12px 8px; vertical-align: middle;">${escapeHtml(item?.marca)}</td>
                <td style="text-align: center; padding: 12px 8px; vertical-align: middle;">${escapeHtml(item?.qtd)}</td>
                <td style="text-align: right; padding: 12px 8px; vertical-align: middle;">R$ ${formatCurrency(item?.valorUnitario)}</td>
                <td style="text-align: center; padding: 12px 8px; vertical-align: middle;">${escapeHtml(item?.desconto || 0)}%</td>
                <td style="text-align: right; padding: 12px 8px; vertical-align: middle; font-weight: bold;">R$ ${formatCurrency(item?.valorTotal)}</td>
            </tr>
        `).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Orçamento ${orcamentoId} - G&M Moto Peças</title>
        <style>
            body {
                font-family: 'Arial', sans-serif;
                margin: 0;
                padding: 20px;
                color: #333;
                line-height: 1.6;
            }
            .container {
                max-width: 800px;
                margin: 0 auto;
            }
            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #f0660a;
                padding-bottom: 20px;
            }
            .logo {
                width: 150px;
                height: auto;
            }
            .empresa-info {
                text-align: right;
            }
            .empresa-nome {
                font-size: 22px;
                font-weight: bold;
                color: #2a2a2a;
                margin-bottom: 5px;
            }
            .empresa-detalhes {
                font-size: 12px;
                color: #666;
            }
            .titulo-venda {
                background-color: #f0660a;
                color: white;
                text-align: center;
                padding: 15px;
                font-size: 24px;
                font-weight: bold;
                border-radius: 5px;
                margin-bottom: 20px;
            }
            .info-venda {
                margin-bottom: 25px;
            }
            .info-row {
                display: flex;
                margin-bottom: 8px;
            }
            .info-label {
                font-weight: bold;
                min-width: 150px;
                color: #555;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 25px;
            }
            th {
                background-color: #2a2a2a;
                color: white;
                padding: 12px 8px;
                text-align: left;
            }
            td {
                padding: 12px 8px;
            }
            .text-center {
                text-align: center;
            }
            .text-right {
                text-align: right;
            }
            .pagamento-section {
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px dashed #ccc;
            }
            .pagamento-title {
                font-weight: bold;
                margin-bottom: 10px;
                color: #555;
            }
            .total-row {
                font-weight: bold;
                font-size: 18px;
                text-align: right;
                margin-top: 20px;
                padding-top: 10px;
                border-top: 2px solid #2a2a2a;
            }
            .footer {
                margin-top: 40px;
                text-align: center;
                font-size: 12px;
                color: #777;
                border-top: 1px solid #eee;
                padding-top: 15px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img class="logo" src="${logoUrl}" alt="G&M Moto Peças">
                <div class="empresa-info">
                    <div class="empresa-nome">G & M Moto Peças</div>
                    <div class="empresa-detalhes">CNPJ: 55.744.795/0001-34</div>
                    <div class="empresa-detalhes">Contato: (11) 9 6564-0477</div>
                </div>
            </div>

            <div class="titulo-venda">ORÇAMENTO Nº ${orcamentoId}</div>

            <div class="info-venda">
                <div class="info-row">
                    <span class="info-label">Data do orçamento:</span>
                    <span>${dataOrcamento.format('DD/MM/YYYY')}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Válido até:</span>
                    <span>${moment(dataOrcamento).add(diasValidade, 'days').format('DD/MM/YYYY')}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Vendedor:</span>
                    <span>${vendedorNome}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Cliente:</span>
                    <span>${clienteNome}</span>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Produto</th>
                        <th class="text-center">Marca</th>
                        <th class="text-center">Qtd</th>
                        <th class="text-right">Val. Unit.</th>
                        <th class="text-center">Desc.</th>
                        <th class="text-right">Val. Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${listagemProdutos}
                </tbody>
            </table>
            <div class="pagamento-section">
                <div class="pagamento-title">Forma de Pagamento:</div>
                <div class="info-row">
                    <span class="info-label">A DEFINIR:</span>
                    <span>R$ ${formatCurrency(totalOrcamento)}</span>
                </div>
            </div>
            <div class="total-row">
                Total do orçamento: R$ ${formatCurrency(totalOrcamento)}
            </div>
            <div class="footer">
                <p>Obrigado por escolher G&M Moto Peças!</p>
                <p>Para dúvidas ou informações, entre em contato: (11) 9 6564-0477</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

export const gerarEBaixarPdfOrcamento = async ({ orcamento, vendedor, cliente, itens = [], dataOrcamento }) => {
    const dataOrcamentoMoment = dataOrcamento ? moment(dataOrcamento) : moment();
    const html = criarHtmlOrcamento({ orcamento, vendedor, cliente, itens, dataOrcamento: dataOrcamentoMoment });

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    tempDiv.style.width = '800px';
    document.body.appendChild(tempDiv);

    try {
        const canvas = await html2canvas(tempDiv, {
            allowTaint: true,
            useCORS: true,
            scale: 2,
            logging: false,
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const margem = 10;
        const larguraDisponivel = pdf.internal.pageSize.getWidth() - margem * 2;
        const alturaImagem = (imgProps.height * larguraDisponivel) / imgProps.width;

        pdf.addImage(imgData, 'PNG', margem, margem, larguraDisponivel, alturaImagem);

        const nomeArquivo = `GM_Orcamento_${orcamento?.orcamentoId || 'orcamento'}_${dataOrcamentoMoment.format('DDMMYYYY_HHmm')}.pdf`;
        pdf.save(nomeArquivo);
    } finally {
        document.body.removeChild(tempDiv);
    }
};
