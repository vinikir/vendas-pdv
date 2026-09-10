import React, { useState, useEffect } from 'react';
import './ModalBuscaVendas.css';
import api from '../../connection/connection';
import moment from 'moment-timezone';

const rotuloMetodo = {
    dinheiro: 'Dinheiro',
    pix: 'Pix',
    debito: 'Débito',
    credito: 'Crédito',
    faturado: 'Faturado'
};

const obterId = (venda) => venda._id?.$oid || venda._id;

const ModalBuscaVendas = ({ onClose, onSelecionarVenda }) => {
    const hoje = moment().format('YYYY-MM-DD');
    const [dataInicial, setDataInicial] = useState(hoje);
    const [dataFinal, setDataFinal] = useState(hoje);
    const [vendas, setVendas] = useState([]);
    const [buscando, setBuscando] = useState(false);
    const [erro, setErro] = useState('');

    const buscarVendas = () => {
        setBuscando(true);
        setErro('');

        api.get('venda', { params: { inicial: dataInicial, final: dataFinal } })
            .then((res) => {
                setVendas(res.data.valor || []);
            })
            .catch((err) => {
                setErro(err.response?.data?.valor || 'Erro ao buscar vendas.');
                setVendas([]);
            })
            .finally(() => {
                setBuscando(false);
            });
    };

    useEffect(() => {
        buscarVendas();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const totalPeriodo = vendas.reduce((total, venda) => total + (venda.valor || 0), 0);

    return (
        <div className="bv-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bv-modal">
                <div className="bv-header">
                    <h3>Vendas Finalizadas</h3>
                    <button onClick={onClose} className="bv-close-btn">&times;</button>
                </div>

                <div className="bv-filtros">
                    <div className="bv-campo-data">
                        <label>De</label>
                        <input
                            type="date"
                            value={dataInicial}
                            onChange={(e) => setDataInicial(e.target.value)}
                            className="bv-input-data"
                        />
                    </div>
                    <div className="bv-campo-data">
                        <label>Até</label>
                        <input
                            type="date"
                            value={dataFinal}
                            onChange={(e) => setDataFinal(e.target.value)}
                            className="bv-input-data"
                        />
                    </div>
                    <button className="bv-btn-buscar" onClick={buscarVendas} disabled={buscando}>
                        {buscando ? 'Buscando...' : 'Buscar'}
                    </button>
                </div>

                <div className="bv-resultados-container">
                    {erro ? (
                        <div className="bv-sem-resultados bv-erro">{erro}</div>
                    ) : vendas.length > 0 ? (
                        <table className="bv-tabela">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Vendedor</th>
                                    <th>Cliente</th>
                                    <th>Pagamento</th>
                                    <th className="bv-col-valor">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vendas.map((venda) => {
                                    const id = obterId(venda);
                                    const metodos = (venda.pagamento || [])
                                        .map((pag) => rotuloMetodo[pag.metodo] || pag.metodo)
                                        .join(', ');

                                    return (
                                        <tr
                                            key={id}
                                            className="bv-linha"
                                            onClick={() => onSelecionarVenda && onSelecionarVenda(venda)}
                                            title="Clique para carregar esta venda no PDV"
                                        >
                                            <td>{moment(venda.data).format('DD/MM/YYYY HH:mm')}</td>
                                            <td>{venda.vendedorNome || '-'}</td>
                                            <td>{venda.clienteNome || '-'}</td>
                                            <td>{metodos || '-'}</td>
                                            <td className="bv-col-valor">R$ {(venda.valor || 0).toFixed(2).replace('.', ',')}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="bv-sem-resultados">
                            {buscando ? 'Buscando...' : 'Nenhuma venda encontrada no período.'}
                        </div>
                    )}
                </div>

                <div className="bv-footer">
                    <span>{vendas.length} venda(s)</span>
                    <span className="bv-footer-total">Total: R$ {totalPeriodo.toFixed(2).replace('.', ',')}</span>
                </div>
            </div>
        </div>
    );
};

export default ModalBuscaVendas;
