// Espelha helpers/PermissoesCatalogo.ts do vendasBackCentral.
const ALIASES_RECURSO = { venda: 'vendas' };

const normalizar = (valor) => String(valor ?? '').trim().toLowerCase();
const recursoCanonico = (recurso) => {
    const chave = normalizar(recurso);
    return ALIASES_RECURSO[chave] || chave;
};

export const temPermissao = (itens, recurso, acao) => {
    if (!Array.isArray(itens)) return false;
    const recursoAlvo = recursoCanonico(recurso);
    const acaoAlvo = normalizar(acao);
    return itens.some((item) => {
        const recursoItem = recursoCanonico(item?.recurso);
        if (recursoItem !== '*' && recursoItem !== recursoAlvo) return false;
        const acoes = Array.isArray(item?.acoes) ? item.acoes.map(normalizar) : [];
        return acoes.includes('*') || acoes.includes(acaoAlvo);
    });
};

// Resposta do /login: as permissões do PDV ficam em permissoes.permissoes.pdv.
// Perfis antigos ainda não têm a lista do PDV; nesse caso vale o cargo, como era antes.
export const podeNoPdv = (dadosLogin, permissao, cargosLegado) => {
    const pdv = dadosLogin?.permissoes?.permissoes?.pdv;
    if (Array.isArray(pdv) && pdv.length > 0) {
        return temPermissao(pdv, permissao[0], permissao[1]);
    }
    return cargosLegado.includes(dadosLogin?.cargo);
};
