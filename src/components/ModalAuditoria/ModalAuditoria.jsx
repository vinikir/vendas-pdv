import React, { useState, useEffect } from 'react';
import './ModalAuditoria.css';
import api from '../../connection/connection';
import moment from 'moment-timezone';

const ROTULO_TIPO = {
    venda_criada: 'Venda criada',
    venda_cancelada: 'Venda cancelada',
    orcamento_criado: 'Orçamento criado',
    orcamento_convertido: 'Orçamento convertido em venda',
    desconto_aplicado: 'Desconto geral aplicado'
};

const obterId = (registro) => registro._id?.$oid || registro._id;

const ModalAuditoria = ({ onClose, token }) => {
    const hoje = moment().format('YYYY-MM-DD');
    const [dataInicial, setDataInicial] = useState(moment().subtract(7, 'days').format('YYYY-MM-DD'));
    const [dataFinal, setDataFinal] = useState(hoje);
    const [registros, setRegistros] = useState([]);
    const [buscando, setBuscando] = useState(false);
    const [erro, setErro] = useState('');

    const buscarRegistros = () => {
        setBuscando(true);
        setErro('');

        api.get('auditoria', {
            params: { inicial: dataInicial, final: dataFinal },
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
        })
            .then((res) => {
                setRegistros(res.data.valor || []);
            })
            .catch((err) => {
                setErro(err.response?.data?.valor || 'Erro ao buscar auditoria.');
                setRegistros([]);
            })
            .finally(() => {
                setBuscando(false);
            });
    };

    useEffect(() => {
        buscarRegistros();
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
        <div className="aud-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="aud-modal">
                <div className="aud-header">
                    <h3>Auditoria</h3>
                    <button onClick={onClose} className="aud-close-btn">&times;</button>
                </div>

                <div className="aud-filtros">
                    <div className="aud-campo-data">
                        <label>De</label>
                        <input type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} className="aud-input-data" />
                    </div>
                    <div className="aud-campo-data">
                        <label>Até</label>
                        <input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} className="aud-input-data" />
                    </div>
                    <button className="aud-btn-buscar" onClick={buscarRegistros} disabled={buscando}>
                        {buscando ? 'Buscando...' : 'Buscar'}
                    </button>
                </div>

                <div className="aud-resultados-container">
                    {erro ? (
                        <div className="aud-sem-resultados aud-erro">{erro}</div>
                    ) : registros.length > 0 ? (
                        <table className="aud-tabela">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Ação</th>
                                    <th>Quem</th>
                                    <th>Referência</th>
                                    <th>Detalhes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {registros.map((registro) => (
                                    <tr key={obterId(registro)}>
                                        <td>{moment(registro.data).format('DD/MM/YYYY HH:mm')}</td>
                                        <td>{ROTULO_TIPO[registro.tipo] || registro.tipo}</td>
                                        <td>{registro.funcionarioNome || '-'}</td>
                                        <td>{registro.referenciaNumero || '-'}</td>
                                        <td>{registro.detalhes || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="aud-sem-resultados">
                            {buscando ? 'Buscando...' : 'Nenhum registro encontrado no período.'}
                        </div>
                    )}
                </div>

                <div className="aud-footer">
                    <span>{registros.length} registro(s)</span>
                </div>
            </div>
        </div>
    );
};

export default ModalAuditoria;
