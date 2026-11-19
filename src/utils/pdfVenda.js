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

// Mesmo layout/HTML usado no comprovante de venda do app mobile (vendasApp),
// só trocando a geração do PDF (react-native-html-to-pdf) por html2canvas + jsPDF no navegador.
export const criarHtmlVenda = ({
    venda,
    vendedor,
    itens = [],
    pagamentos = [],
    logoUrl = LOGO_GEM_BASE64,
    dataVenda = moment(),
    ordem = null,
}) => {
    const totalVenda = itens.reduce((total, item) => total + (item?.valorTotal || 0), 0);
    const vendaId = escapeHtml(venda?.vendaId || '');
    const clienteNome = escapeHtml(venda?.cliente || 'Não informado');
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

    // Venda vinda de OS: dados da moto, serviço e checklist de entrada.
    const respostaChecklist = (item) => {
        if (item?.tipo && item.tipo !== 'boolean') return escapeHtml(item?.value || '-');
        if (item?.realizado === false) return '<span style="color:#999;">Não verificado</span>';
        return item?.value ? '<span style="color:#2e7d32;font-weight:bold;">Sim</span>' : '<span style="color:#c62828;font-weight:bold;">Não</span>';
    };
    const checklist = Array.isArray(ordem?.checkList) ? ordem.checkList.filter((i) => i?.tipo !== 'foto') : [];
    const linhaMoto = (label, valor) => `
                <div class="info-row">
                    <span class="info-label">${label}:</span>
                    <span>${escapeHtml(valor === undefined || valor === null || valor === '' ? '-' : valor)}</span>
                </div>`;
    const secaoOS = ordem ? `
            <div class="secao-os">
                <div class="secao-titulo">Dados da moto</div>
                <div class="grid-moto">
                    ${linhaMoto('Placa', ordem.placa)}
                    ${linhaMoto('Marca', ordem.marca)}
                    ${linhaMoto('Modelo', ordem.modelo)}
                    ${linhaMoto('Cor', ordem.cor)}
                    ${linhaMoto('KM', ordem.km)}
                </div>
                ${ordem.servicoASerExecutado ? `
                <div class="info-row" style="margin-top:8px;">
                    <span class="info-label">Serviço:</span>
                    <span>${escapeHtml(ordem.servicoASerExecutado)}</span>
                </div>` : ''}
            </div>
            ${checklist.length > 0 ? `
            <div class="secao-os">
                <div class="secao-titulo">Checklist de entrada</div>
                <table class="tabela-checklist">
                    <tbody>
                        ${checklist.map((item) => `
                        <tr style="border-bottom: 1px solid #e0e0e0;">
                            <td style="padding: 6px 8px;">${escapeHtml(item?.label)}${item?.observacao ? `<br><span style="font-size:12px;color:#777;">${escapeHtml(item.observacao)}</span>` : ''}</td>
                            <td style="padding: 6px 8px; text-align: right; width: 140px;">${respostaChecklist(item)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>` : ''}
    ` : '';

    const formatarPagamentos = pagamentos.map((p) => {
        const temTroco = p?.troco > 0;
        return `
            <div class="info-row">
                <span class="info-label">${escapeHtml((p?.metodo || '').toString().toUpperCase())}:</span>
                <span>R$ ${formatCurrency(temTroco ? p.valorRecebido : p?.valor)}</span>
            </div>
            ${temTroco ? `
            <div class="info-row">
                <span class="info-label">Troco:</span>
                <span>R$ ${formatCurrency(p.troco)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Total:</span>
                <span>R$ ${formatCurrency(p.valor)}</span>
            </div>
            ` : ''}
        `;
    }).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Venda ${vendaId} - G&M Moto Peças</title>
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
                min-width: 120px;
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
            .secao-os {
                margin-bottom: 20px;
                padding: 12px 15px;
                border: 1px solid #e0e0e0;
                border-radius: 5px;
            }
            .secao-titulo {
                font-weight: bold;
                color: #f0660a;
                margin-bottom: 8px;
                text-transform: uppercase;
                font-size: 14px;
            }
            .grid-moto {
                display: grid;
                grid-template-columns: 1fr 1fr;
                column-gap: 20px;
            }
            .grid-moto .info-label {
                min-width: 70px;
            }
            .tabela-checklist {
                margin-bottom: 0;
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

            <div class="titulo-venda">${ordem ? 'ORDEM DE SERVIÇO' : 'VENDA'} Nº ${ordem ? escapeHtml(ordem.ordemServicoId ?? vendaId) : vendaId}</div>

            <div class="info-venda">
                <div class="info-row">
                    <span class="info-label">Data da venda:</span>
                    <span>${dataVenda.format('DD/MM/YYYY')}</span>
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

            ${secaoOS}

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
                ${formatarPagamentos}
            </div>
            <div class="total-row">
                Total da venda: R$ ${formatCurrency(totalVenda)}
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

export const gerarEBaixarPdfVenda = async ({ venda, vendedor, itens = [], pagamentos = [], dataVenda, ordem = null }) => {
    const dataVendaMoment = dataVenda ? moment(dataVenda) : moment();
    const html = criarHtmlVenda({ venda, vendedor, itens, pagamentos, dataVenda: dataVendaMoment, ordem });

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

        const pdf = new jsPDF('p', 'mm', 'a4');
        const margem = 10;
        const larguraDisponivel = pdf.internal.pageSize.getWidth() - margem * 2;
        const alturaUtil = pdf.internal.pageSize.getHeight() - margem * 2;

        // Escala: px do HTML -> px do canvas -> mm do PDF.
        const larguraHtml = tempDiv.offsetWidth || 800;
        const pxCanvasPorPxHtml = canvas.width / larguraHtml;
        const mmPorPxHtml = larguraDisponivel / larguraHtml;
        const alturaPaginaPx = alturaUtil / mmPorPxHtml;
        const alturaTotalPx = canvas.height / pxCanvasPorPxHtml;

        // Blocos que não podem ser cortados ao meio (linhas da tabela, linhas de info, títulos...).
        const topoDiv = tempDiv.getBoundingClientRect().top;
        const blocos = Array.from(tempDiv.querySelectorAll(
            'tr, .info-row, .header, .titulo-venda, .secao-titulo, .pagamento-title, .total-row, .footer p'
        )).map((el) => {
            const r = el.getBoundingClientRect();
            return { topo: r.top - topoDiv, base: r.bottom - topoDiv };
        });
        const corteValido = (y) => !blocos.some((b) => b.topo < y - 0.5 && b.base > y + 0.5);
        const candidatos = Array.from(new Set(blocos.flatMap((b) => [b.topo, b.base])))
            .sort((a, b) => a - b);

        // Cada página termina no fim do último bloco que cabe inteiro; a próxima começa exatamente ali.
        const cortes = [0];
        while (alturaTotalPx - cortes[cortes.length - 1] > alturaPaginaPx) {
            const inicio = cortes[cortes.length - 1];
            const limite = inicio + alturaPaginaPx;
            const melhor = candidatos.filter((y) => y > inicio + 1 && y <= limite && corteValido(y)).pop();
            cortes.push(melhor !== undefined ? melhor : limite);
        }
        cortes.push(alturaTotalPx);

        for (let k = 0; k < cortes.length - 1; k++) {
            const inicioPx = Math.round(cortes[k] * pxCanvasPorPxHtml);
            const fimPx = Math.min(canvas.height, Math.round(cortes[k + 1] * pxCanvasPorPxHtml));
            if (fimPx - inicioPx < 1) continue;

            const fatia = document.createElement('canvas');
            fatia.width = canvas.width;
            fatia.height = fimPx - inicioPx;
            const ctx = fatia.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, fatia.width, fatia.height);
            ctx.drawImage(canvas, 0, inicioPx, canvas.width, fatia.height, 0, 0, canvas.width, fatia.height);

            if (k > 0) pdf.addPage();
            const alturaFatiaMm = (fatia.height / pxCanvasPorPxHtml) * mmPorPxHtml;
            pdf.addImage(fatia.toDataURL('image/png'), 'PNG', margem, margem, larguraDisponivel, alturaFatiaMm);
        }

        const nomeArquivo = `GM_Venda_${venda?.vendaId || 'venda'}_${dataVendaMoment.format('DDMMYYYY_HHmm')}.pdf`;
        pdf.save(nomeArquivo);
    } finally {
        document.body.removeChild(tempDiv);
    }
};
