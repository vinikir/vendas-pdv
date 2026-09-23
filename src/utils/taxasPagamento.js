import api from '../connection/connection';

// Espelha helpers/CalculoTaxas.ts do vendasBackCentral.
// O backend continua sendo a fonte da verdade: isto serve para prévia e bloqueio antes do POST.
export const METODOS_COM_TAXA_OBRIGATORIA = ['debito', 'credito'];

const ROTULO_METODO = {
    dinheiro: 'Dinheiro',
    pix: 'Pix',
    debito: 'Débito',
    credito: 'Crédito',
    faturado: 'Faturado',
    credito_loja: 'Crédito Loja'
};

const arredondar = (valor) => Math.round((Number(valor) || 0) * 100) / 100;

export const buscarTaxasPagamento = async () => {
    const res = await api.get('/taxas-pagamento?ativas=true');

    if (res?.data?.erro === false && Array.isArray(res.data.valor)) {
        return res.data.valor;
    }

    return [];
};

export const encontrarTaxaAplicavel = (taxas, metodo, qtdParcelas = 1) => {
    const candidatas = (taxas || []).filter((taxa) => (
        taxa?.ativo !== false &&
        taxa?.metodo === metodo &&
        Number(taxa?.parcelasMin ?? 1) <= qtdParcelas &&
        Number(taxa?.parcelasMax ?? 1) >= qtdParcelas
    ));

    if (candidatas.length === 0) return null;

    // Faixa mais específica primeiro.
    candidatas.sort((a, b) => (
        (Number(a.parcelasMax ?? 1) - Number(a.parcelasMin ?? 1)) -
        (Number(b.parcelasMax ?? 1) - Number(b.parcelasMin ?? 1))
    ));

    return candidatas[0];
};

// Só considera override quando veio um número válido e não negativo.
export const temValorTaxaManual = (valor) => {
    if (valor === undefined || valor === null || valor === '') return false;

    const convertido = typeof valor === 'string' ? Number(valor.replace(',', '.')) : Number(valor);
    return !Number.isNaN(convertido) && convertido >= 0;
};

export const calcularTaxaPagamento = (taxas, pagamento) => {
    const metodo = pagamento?.metodo;
    const valor = arredondar(pagamento?.valor);
    const qtdParcelas = Math.max(1, Math.trunc(Number(pagamento?.qtdParcelas) || 1));

    const taxa = encontrarTaxaAplicavel(taxas, metodo, qtdParcelas);
    const taxaManual = temValorTaxaManual(pagamento?.valorTaxaManual);

    const percentual = taxa ? Number(taxa.percentual) || 0 : 0;
    const taxaFixa = taxa ? Number(taxa.taxaFixa) || 0 : 0;

    const valorTaxaCalculado = taxaManual
        ? arredondar(pagamento.valorTaxaManual)
        : (valor * (percentual / 100)) + taxaFixa;

    const valorTaxa = arredondar(Math.min(Math.max(valorTaxaCalculado, 0), valor));

    // Com taxa manual o percentual exibido é o efetivo, derivado do valor informado.
    const percentualEfetivo = taxaManual
        ? (valor > 0 ? Number(((valorTaxa / valor) * 100).toFixed(4)) : 0)
        : percentual;

    return {
        metodo,
        valor,
        qtdParcelas,
        percentual: percentualEfetivo,
        taxaFixa: taxaManual ? 0 : taxaFixa,
        valorTaxa,
        valorLiquido: arredondar(valor - valorTaxa),
        prazoDias: taxa ? Number(taxa.prazoDias) || 0 : 0,
        taxaCadastrada: Boolean(taxa),
        taxaManual,
        // A taxa manual supre a falta de cadastro.
        exigeTaxa: METODOS_COM_TAXA_OBRIGATORIA.includes(metodo) && !taxaManual
    };
};

export const calcularTaxasPagamentos = (taxas, pagamentos) => {
    const calculados = (pagamentos || []).map((pagamento) => calcularTaxaPagamento(taxas, pagamento));

    const valorBruto = arredondar(calculados.reduce((acc, item) => acc + item.valor, 0));
    const valorTaxaTotal = arredondar(calculados.reduce((acc, item) => acc + item.valorTaxa, 0));
    const pendentes = calculados.filter((item) => item.exigeTaxa && !item.taxaCadastrada);

    return {
        pagamentos: calculados,
        valorBruto,
        valorTaxaTotal,
        valorLiquido: arredondar(valorBruto - valorTaxaTotal),
        pendentes
    };
};

export const mensagemTaxaPendente = (metodo, qtdParcelas = 1) => {
    const nome = ROTULO_METODO[metodo] || metodo;
    const descricao = metodo === 'credito' ? `${nome} ${qtdParcelas}x` : nome;
    return `Taxa da maquininha não cadastrada para ${descricao}. Cadastre em Caixa > Taxas de pagamento antes de finalizar.`;
};

export const mensagemTaxasPendentes = (pendentes) => {
    const descricoes = (pendentes || []).map((item) => {
        const nome = ROTULO_METODO[item.metodo] || item.metodo;
        return item.metodo === 'credito' ? `${nome} ${item.qtdParcelas}x` : nome;
    });

    return `Taxa da maquininha não cadastrada para: ${Array.from(new Set(descricoes)).join(', ')}. Cadastre em Caixa > Taxas de pagamento antes de finalizar.`;
};
