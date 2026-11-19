import React, { useState, useEffect, useMemo } from 'react';
import moment from 'moment-timezone';
import api from '../../connection/connection';
import '../ModalListarOrcamentos/ModalListarOrcamentos.css';
import './ModalAbrirOS.css';

const totalOS = (ordem) => (
    Number(ordem.valorTotal) || (ordem.produtos || []).reduce((total, item) => total + (Number(item?.valorTotal) || 0), 0)
);

const ModalListarOS = ({ onClose, onSelecionar }) => {
    const [ordens, setOrdens] = useState([]);
    const [buscando, setBuscando] = useState(false);
    const [erro, setErro] = useState('');
    const [filtro, setFiltro] = useState('');

    const buscar = () => {
        setBuscando(true);
        setErro('');
        api.get('ordem-servico?status=aberto')
            .then((res) => setOrdens(res.data?.valor || []))
            .catch((err) => {
                setErro(err.response?.data?.valor || 'Erro ao buscar ordens de serviço.');
                setOrdens([]);
            })
            .finally(() => setBuscando(false));
    };

    useEffect(() => {
        buscar();
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const ordensFiltradas = useMemo(() => {
        const termo = filtro.trim().toLowerCase();
        if (!termo) return ordens;
        return ordens.filter((o) => (
            [o.ordemServicoId, o.placa, o.modelo, o.marca, o.clienteNome, o.vendedorNome]
                .some((campo) => String(campo ?? '').toLowerCase().includes(termo))
        ));
    }, [ordens, filtro]);

    return (
        <div className="lo-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="lo-modal">
                <div className="lo-header">
                    <h3>Ordens de serviço abertas</h3>
                    <div className="lo-header-acoes">
                        <button className="lo-btn-atualizar" onClick={buscar} disabled={buscando}>
                            {buscando ? 'Buscando...' : 'Atualizar'}
                        </button>
                        <button onClick={onClose} className="lo-close-btn">&times;</button>
                    </div>
                </div>

                <div className="los-busca">
                    <input
                        type="text"
                        value={filtro}
                        onChange={(e) => setFiltro(e.target.value)}
                        placeholder="Filtrar por nº, placa, modelo, cliente..."
                        autoFocus
                    />
                </div>

                <div className="lo-resultados-container">
                    {erro ? (
                        <div className="los-vazio">{erro}</div>
                    ) : ordensFiltradas.length > 0 ? (
                        <table className="los-tabela">
                            <thead>
                                <tr>
                                    <th>Nº</th>
                                    <th>Aberta em</th>
                                    <th>Placa</th>
                                    <th>Moto</th>
                                    <th>Cliente</th>
                                    <th className="los-valor">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ordensFiltradas.map((ordem) => (
                                    <tr
                                        key={ordem._id}
                                        className="los-linha"
                                        onClick={() => onSelecionar(ordem)}
                                        title="Clique para carregar esta OS no PDV"
                                    >
                                        <td>{ordem.ordemServicoId || '-'}</td>
                                        <td>{moment(ordem.dataAbertura || ordem.createdAt).format('DD/MM/YYYY HH:mm')}</td>
                                        <td>{ordem.placa || '-'}</td>
                                        <td>{[ordem.marca, ordem.modelo, ordem.cor].filter(Boolean).join(' ') || '-'}</td>
                                        <td>{ordem.clienteNome || '-'}</td>
                                        <td className="los-valor">R$ {totalOS(ordem).toFixed(2).replace('.', ',')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="los-vazio">{buscando ? 'Buscando...' : 'Nenhuma OS aberta.'}</div>
                    )}
                </div>

                <div className="lo-footer">
                    <span>{ordensFiltradas.length} OS aberta(s)</span>
                </div>
            </div>
        </div>
    );
};

export default ModalListarOS;
