// Regras de desconto do PDV, iguais às do app (vendasApp/src/Store/pagamentoStore.js):
// - cada produto aceita até o seu descontoMaximo (%); o teto da venda é a soma dos tetos dos itens;
// - serviço (mão de obra) nunca recebe desconto, nem com autorização de administrador;
// - acima do teto só com autorização de administrador, e aí o limite passa a ser 100% do item;
// - o desconto da venda é distribuído nos itens; quem bate no teto passa o resto para os outros.

const arredondar = (valor) => Math.round((valor + Number.EPSILON) * 100) / 100;

export const ehServico = (item) => Boolean(item?.ehServico) || item?.tipo === 'servico';

export const subtotalItem = (item) => (
    arredondar(Number(item?.valorUnitario || 0) * (Number(item?.qtd) || 1))
);

export const tetoItem = (item, autorizado = false) => {
    if (ehServico(item)) return 0;
    const subtotal = subtotalItem(item);
    if (autorizado) return subtotal;
    return arredondar(subtotal * (Number(item?.descontoMaximo || 0) / 100));
};

export const tetoVenda = (itens, autorizado = false) => (
    arredondar(itens.reduce((total, item) => total + tetoItem(item, autorizado), 0))
);

export const subtotalVenda = (itens) => (
    arredondar(itens.reduce((total, item) => total + subtotalItem(item), 0))
);

export const descontoTotalVenda = (itens) => (
    arredondar(itens.reduce((total, item) => total + Number(item?.valorDoDesconto || 0), 0))
);

// Grava o desconto (em R$) no item: percentual, valor do desconto e total líquido.
export const aplicarValorNoItem = (item, valorDesconto, autorizado = false) => {
    const subtotal = subtotalItem(item);
    const valor = arredondar(Math.min(Math.max(valorDesconto, 0), subtotal));
    const percentual = subtotal > 0 ? arredondar((valor / subtotal) * 100) : 0;

    return {
        ...item,
        desconto: percentual,
        valorDoDesconto: valor,
        valorTotal: arredondar(subtotal - valor),
        descontoMedianteASenha: autorizado && percentual > Number(item?.descontoMaximo || 0)
    };
};

// Quando a quantidade muda, mantém o mesmo percentual de desconto do item.
export const recalcularItem = (item) => {
    const percentual = Number(item?.desconto || 0);
    const subtotal = subtotalItem(item);
    const valor = arredondar(subtotal * (percentual / 100));
    return { ...item, valorDoDesconto: valor, valorTotal: arredondar(subtotal - valor) };
};

const distribuirDesconto = (subtotais, maximos, alvo) => {
    const descontos = new Array(subtotais.length).fill(0);
    const saturado = new Array(subtotais.length).fill(false);
    let restante = alvo;

    for (let volta = 0; volta <= subtotais.length && restante > 0.005; volta += 1) {
        const baseDisponivel = subtotais.reduce(
            (acc, subtotal, idx) => (saturado[idx] ? acc : acc + subtotal),
            0
        );

        if (baseDisponivel <= 0) break;

        const taxa = restante / baseDisponivel;
        let distribuido = 0;
        let saturouAlgum = false;

        for (let idx = 0; idx < subtotais.length; idx += 1) {
            if (saturado[idx]) continue;

            const desejado = descontos[idx] + (subtotais[idx] * taxa);

            if (desejado >= maximos[idx] - 1e-9) {
                distribuido += maximos[idx] - descontos[idx];
                descontos[idx] = maximos[idx];
                saturado[idx] = true;
                saturouAlgum = true;
            } else {
                distribuido += subtotais[idx] * taxa;
                descontos[idx] = desejado;
            }
        }

        restante -= distribuido;
        if (!saturouAlgum) break;
    }

    // Acerta o resíduo de arredondamento no item que ainda comporta.
    const arredondados = descontos.map((valor) => arredondar(valor));
    const soma = arredondados.reduce((acc, valor) => acc + valor, 0);
    const sobra = arredondar(Math.min(alvo, maximos.reduce((a, v) => a + v, 0)) - soma);

    if (sobra !== 0) {
        const indice = arredondados.reduce((melhor, valor, idx) => (
            valor + sobra <= maximos[idx] + 0.01 && valor + sobra >= 0 ? idx : melhor
        ), -1);

        if (indice >= 0) {
            arredondados[indice] = arredondar(arredondados[indice] + sobra);
        }
    }

    return arredondados;
};

// Distribui um desconto total (R$) entre os itens da venda, substituindo os descontos atuais.
export const aplicarDescontoNaVenda = (itens, valorDesconto, autorizado = false) => {
    const subtotais = itens.map(subtotalItem);
    const maximos = itens.map((item) => tetoItem(item, autorizado));
    const descontos = distribuirDesconto(subtotais, maximos, Math.max(valorDesconto, 0));
    return itens.map((item, idx) => aplicarValorNoItem(item, descontos[idx], autorizado));
};
