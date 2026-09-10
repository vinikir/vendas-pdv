import React, { useState, useRef, useEffect, useMemo } from 'react';
import './ModalBuscaItens.css';
import api from '../../connection/connection'

const obterId = (item) => item._id?.$oid || item._id;

const BuscarItem = ({ onSelecionarItem, onClose, bag }) => {
    const [termoBusca, setTermoBusca] = useState('');
    const [resultados, setResultados] = useState([]);
    const [buscando, setBuscando] = useState(false);
    const [selecionados, setSelecionados] = useState({}); // { [id]: { item, quantidade } }
    const [mostrarAjuda, setMostrarAjuda] = useState(false);

    const time = useRef(null);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const buscarItem = (valor) => {
        setTermoBusca(valor)
        if (valor.trim() === '') {
            setResultados([]);
            setBuscando(false);
            return;
        }

        setBuscando(true);
        clearTimeout(time.current);

        time.current = setTimeout(() => {
            api.get('produtos?search=' + encodeURIComponent(valor.trim())).then((res) => {
                setResultados(res.data.valor);
            }).finally(() => {
                setBuscando(false);
            })
        }, 500)
    }

    const toggleSelecionado = (item) => {
        if (!item.estoque || item.estoque <= 0) return;

        const id = obterId(item);
        setSelecionados((atual) => {
            const proximo = { ...atual };
            if (proximo[id]) {
                delete proximo[id];
            } else {
                proximo[id] = { item, quantidade: 1 };
            }
            return proximo;
        });
    };

    const alterarQuantidade = (item, valorInput) => {
        const id = obterId(item);
        const numeros = valorInput.replace(/[^\d]/g, '');
        let qtd = parseInt(numeros, 10);

        if (isNaN(qtd) || qtd < 1) qtd = 1;
        if (item.estoque && qtd > item.estoque) qtd = item.estoque;

        setSelecionados((atual) => {
            if (!atual[id]) return atual;
            return { ...atual, [id]: { item, quantidade: qtd } };
        });
    };

    const listaSelecionados = useMemo(() => Object.values(selecionados), [selecionados]);
    const totalSelecionado = useMemo(
        () => listaSelecionados.reduce((total, { item, quantidade }) => total + item.valorVenda * quantidade, 0),
        [listaSelecionados]
    );

    const adicionarSelecionados = () => {
        listaSelecionados.forEach(({ item, quantidade }) => {
            onSelecionarItem({
                desconto: 0,
                produtoId: obterId(item),
                produtoNome: item.nome,
                qtd: quantidade,
                tipo: "venda",
                valorTotal: item.valorVenda * quantidade,
                valorDoDesconto: 0,
                valorUnitario: item.valorVenda,
                marca: item.marca,
                estoque: item.estoque
            });
        });
        onClose();
    };

    return (
        <div className="bi-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="buscar-item-modal">
                <div className="bi-modal-header">
                    <h3>Buscar Item</h3>
                    <button onClick={onClose} className="bi-close-btn">
                        &times;
                    </button>
                </div>

                <div className="bi-busca-container">
                    <div className="bi-busca-input-wrapper">
                        <span className="bi-busca-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            value={termoBusca}
                            onChange={(e) => buscarItem(e.target.value)}
                            placeholder="Digite nome, código ou marca..."
                            autoFocus
                            className="bi-busca-input"
                        />
                        {buscando && <span className="bi-busca-spinner" />}
                        <button
                            type="button"
                            className="bi-ajuda-btn"
                            onClick={() => setMostrarAjuda((v) => !v)}
                            aria-label="Regras de busca"
                        >
                            ?
                        </button>
                    </div>

                    {mostrarAjuda && (
                        <div className="bi-ajuda-painel">
                            <div className="bi-ajuda-linha">
                                <code>termo</code>
                                <span>encontra "termo" em qualquer parte do nome</span>
                            </div>
                            <div className="bi-ajuda-linha">
                                <code>termo#</code>
                                <span>encontra o que <strong>começa</strong> com "termo"</span>
                            </div>
                            <div className="bi-ajuda-linha">
                                <code>#termo</code>
                                <span>encontra o que <strong>termina</strong> com "termo"</span>
                            </div>
                            <div className="bi-ajuda-linha">
                                <code>a,b,c</code>
                                <span>busca vários termos ao mesmo tempo (ex: <code>oleo,manete#,#titan</code>)</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bi-resultados-container">
                    {resultados.length > 0 ? (
                        <table className="bi-resultados-table">
                            <thead>
                                <tr>
                                    <th className="bi-col-check"></th>
                                    <th>Produto</th>
                                    <th>Marca</th>
                                    <th>Estoque</th>
                                    <th>Preço</th>
                                    <th className="bi-col-qtd">Qtd</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resultados.map((item) => {
                                    const id = obterId(item);
                                    const selecionado = !!selecionados[id];
                                    const semEstoque = !item.estoque || item.estoque <= 0;

                                    return (
                                        <tr
                                            key={id}
                                            onClick={() => toggleSelecionado(item)}
                                            className={`bi-item-row ${selecionado ? 'bi-selecionado' : ''} ${semEstoque ? 'bi-linha-desabilitada' : ''}`}
                                        >
                                            <td className="bi-col-check">
                                                <input
                                                    type="checkbox"
                                                    checked={selecionado}
                                                    disabled={semEstoque}
                                                    onChange={() => toggleSelecionado(item)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="bi-checkbox"
                                                />
                                            </td>
                                            <td>
                                                <div className="bi-produto-info">
                                                    <span className="bi-produto-nome">{item.nome}</span>
                                                    {item.codigoBarra && <span className="bi-produto-codigo">Cód: {item.codigoBarra}</span>}
                                                </div>
                                            </td>
                                            <td>{item.marca || '-'}</td>
                                            <td className={semEstoque ? 'bi-sem-estoque' : 'bi-em-estoque'}>
                                                {semEstoque ? 'Sem estoque' : item.estoque}
                                            </td>
                                            <td className="bi-preco">R$ {item.valorVenda.toFixed(2)}</td>
                                            <td className="bi-col-qtd">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max={item.estoque || 1}
                                                    disabled={!selecionado}
                                                    value={selecionados[id]?.quantidade ?? 1}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => alterarQuantidade(item, e.target.value)}
                                                    className="bi-qtd-input"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="bi-sem-resultados">
                            {buscando ? 'Buscando...' : termoBusca ? 'Nenhum item encontrado' : 'Digite para buscar itens'}
                        </div>
                    )}
                </div>

                <div className="bi-rodape">
                    <div className="bi-rodape-resumo">
                        {listaSelecionados.length > 0 ? (
                            <>
                                <strong>{listaSelecionados.length}</strong> item(ns) selecionado(s)
                                <span className="bi-rodape-total">R$ {totalSelecionado.toFixed(2)}</span>
                            </>
                        ) : (
                            <span className="bi-rodape-vazio">Nenhum item selecionado</span>
                        )}
                    </div>
                    <div className="bi-rodape-botoes">
                        <button onClick={onClose} className="bi-btn-cancelar">
                            Cancelar
                        </button>
                        <button
                            onClick={adicionarSelecionados}
                            disabled={listaSelecionados.length === 0}
                            className="bi-btn-confirmar"
                        >
                            Adicionar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BuscarItem;
