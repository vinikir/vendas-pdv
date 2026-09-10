import React, { useState, useEffect } from 'react';
import './ModalListarOrcamentos.css';
import api from '../../connection/connection';
import moment from 'moment-timezone';
import { gerarEBaixarPdfOrcamento } from '../../utils/pdfOrcamento';

const obterId = (orcamento) => orcamento._id?.$oid || orcamento._id;

const calcularTotalOrcamento = (orcamento) => {
    const produtos = orcamento.produtos || [];
    return produtos.reduce((total, item) => total + (item?.valorTotal || 0), 0);
};

const ModalListarOrcamentos = ({ onClose, onSelecionarOrcamento }) => {
    const [orcamentos, setOrcamentos] = useState([]);
    const [buscando, setBuscando] = useState(false);
    const [erro, setErro] = useState('');
    const [gerandoPdfId, setGerandoPdfId] = useState(null);

    const reimprimirOrcamento = (e, orcamento) => {
        e.stopPropagation();
        const id = obterId(orcamento);
        setGerandoPdfId(id);

        gerarEBaixarPdfOrcamento({
            orcamento,
            vendedor: { nome: orcamento.user },
            itens: orcamento.produtos || [],
            dataOrcamento: orcamento.data
        }).catch((err) => {
            console.log('Erro ao gerar PDF do orçamento', err);
        }).finally(() => {
            setGerandoPdfId(null);
        });
    };

    const buscarOrcamentos = () => {
        setBuscando(true);
        setErro('');

        api.post('orcamentos')
            .then((res) => {
                const lista = res.data.valor || [];
                lista.sort((a, b) => (b.orcamentoId || 0) - (a.orcamentoId || 0));
                setOrcamentos(lista);
            })
            .catch((err) => {
                setErro(err.response?.data?.valor || 'Erro ao buscar orçamentos.');
                setOrcamentos([]);
            })
            .finally(() => {
                setBuscando(false);
            });
    };

    useEffect(() => {
        buscarOrcamentos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="lo-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="lo-modal">
                <div className="lo-header">
                    <h3>Orçamentos</h3>
                    <div className="lo-header-acoes">
                        <button className="lo-btn-atualizar" onClick={buscarOrcamentos} disabled={buscando}>
                            {buscando ? 'Buscando...' : 'Atualizar'}
                        </button>
                        <button onClick={onClose} className="lo-close-btn">&times;</button>
                    </div>
                </div>

                <div className="lo-resultados-container">
                    {erro ? (
                        <div className="lo-sem-resultados lo-erro">{erro}</div>
                    ) : orcamentos.length > 0 ? (
                        <table className="lo-tabela">
                            <thead>
                                <tr>
                                    <th>Nº</th>
                                    <th>Data</th>
                                    <th>Vendedor</th>
                                    <th>Status</th>
                                    <th className="lo-col-valor">Valor</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {orcamentos.map((orcamento) => {
                                    const id = obterId(orcamento);

                                    return (
                                        <tr
                                            key={id}
                                            className="lo-linha"
                                            onClick={() => onSelecionarOrcamento && onSelecionarOrcamento(orcamento)}
                                            title="Clique para carregar este orçamento no PDV"
                                        >
                                            <td>{orcamento.orcamentoId || '-'}</td>
                                            <td>{moment(orcamento.data).format('DD/MM/YYYY HH:mm')}</td>
                                            <td>{orcamento.user || '-'}</td>
                                            <td>
                                                <span className={`lo-status lo-status-${(orcamento.status || '').toLowerCase()}`}>
                                                    {orcamento.status || '-'}
                                                </span>
                                            </td>
                                            <td className="lo-col-valor">R$ {calcularTotalOrcamento(orcamento).toFixed(2).replace('.', ',')}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="lo-btn-pdf"
                                                    onClick={(e) => reimprimirOrcamento(e, orcamento)}
                                                    disabled={gerandoPdfId === id}
                                                    title="Baixar PDF deste orçamento"
                                                >
                                                    {gerandoPdfId === id ? 'Gerando...' : 'PDF'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="lo-sem-resultados">
                            {buscando ? 'Buscando...' : 'Nenhum orçamento encontrado.'}
                        </div>
                    )}
                </div>

                <div className="lo-footer">
                    <span>{orcamentos.length} orçamento(s)</span>
                </div>
            </div>
        </div>
    );
};

export default ModalListarOrcamentos;
