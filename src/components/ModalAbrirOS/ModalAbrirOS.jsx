import React, { useState, useEffect } from 'react';
import './ModalAbrirOS.css';

// Mesmos ids/labels do checklist do app (vendasApp/src/constants/checklistOS.js), sem os itens de foto,
// para a OS aberta no PDV aparecer igual nas telas e no PDF do app.
const CHECKLIST_PDV = [
    { id: 2, label: 'Moto liga?' },
    { id: 3, label: 'Faróis funcionando?' },
    { id: 4, label: 'Pneus em bom estado?' },
    { id: 7, label: 'Possui arranhões/amassados?' },
    { id: 9, label: 'Combustível suficiente?' },
];

const ModalAbrirOS = ({ onConfirmar, onClose, salvando, totalItens }) => {
    const [placa, setPlaca] = useState('');
    const [marca, setMarca] = useState('');
    const [modelo, setModelo] = useState('');
    const [cor, setCor] = useState('');
    const [km, setKm] = useState('');
    const [servico, setServico] = useState('');
    // { [id]: true | false } — ausente = não verificado
    const [respostas, setRespostas] = useState({});
    const [erro, setErro] = useState('');

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !salvando) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, salvando]);

    const responder = (id, valor) => {
        setRespostas((atual) => {
            const proximo = { ...atual };
            if (proximo[id] === valor) delete proximo[id];
            else proximo[id] = valor;
            return proximo;
        });
    };

    const confirmar = (acao) => {
        const placaLimpa = placa.trim().toUpperCase();
        if (!placaLimpa) {
            setErro('Informe a placa.');
            return;
        }
        setErro('');

        // Item não respondido vai como não verificado (realizado: false), igual ao app:
        // assim não aparece no PDF como "Não" e parece defeito.
        const checkList = CHECKLIST_PDV.map((item) => ({
            id: item.id,
            label: item.label,
            tipo: 'boolean',
            value: respostas[item.id] === true,
            observacao: '',
            realizado: respostas[item.id] !== undefined,
        }));

        onConfirmar({
            placa: placaLimpa,
            marca: marca.trim(),
            modelo: modelo.trim(),
            cor: cor.trim(),
            km: km ? Number(km) : '',
            servicoASerExecutado: servico.trim(),
            checkList,
        }, acao);
    };

    return (
        <div className="aos-overlay" onClick={(e) => { if (e.target === e.currentTarget && !salvando) onClose(); }}>
            <div className="aos-modal">
                <div className="aos-header">
                    <h3>Abrir ordem de serviço</h3>
                    <button onClick={onClose} className="aos-close-btn" disabled={salvando}>&times;</button>
                </div>

                <div className="aos-body">
                    <div className="aos-grid">
                        <div className="aos-campo">
                            <label htmlFor="aos-placa">Placa *</label>
                            <input
                                id="aos-placa"
                                type="text"
                                value={placa}
                                onChange={(e) => setPlaca(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8))}
                                placeholder="ABC1D23"
                                autoFocus
                            />
                        </div>
                        <div className="aos-campo">
                            <label htmlFor="aos-km">KM</label>
                            <input
                                id="aos-km"
                                type="text"
                                inputMode="numeric"
                                value={km}
                                onChange={(e) => setKm(e.target.value.replace(/\D/g, '').slice(0, 7))}
                                placeholder="Opcional"
                            />
                        </div>
                        <div className="aos-campo">
                            <label htmlFor="aos-marca">Marca</label>
                            <input id="aos-marca" type="text" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Opcional" />
                        </div>
                        <div className="aos-campo">
                            <label htmlFor="aos-modelo">Modelo</label>
                            <input id="aos-modelo" type="text" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Opcional" />
                        </div>
                        <div className="aos-campo">
                            <label htmlFor="aos-cor">Cor</label>
                            <input id="aos-cor" type="text" value={cor} onChange={(e) => setCor(e.target.value)} placeholder="Opcional" />
                        </div>
                    </div>

                    <div className="aos-campo">
                        <label htmlFor="aos-servico">Serviço a ser executado</label>
                        <textarea
                            id="aos-servico"
                            rows={2}
                            maxLength={500}
                            value={servico}
                            onChange={(e) => setServico(e.target.value)}
                            placeholder="Opcional"
                        />
                    </div>

                    <div className="aos-checklist">
                        <span className="aos-checklist-titulo">Checklist (opcional)</span>
                        {CHECKLIST_PDV.map((item) => (
                            <div key={item.id} className="aos-check-linha">
                                <span>{item.label}</span>
                                <div className="aos-check-opcoes">
                                    <button
                                        type="button"
                                        className={respostas[item.id] === true ? 'ativo-sim' : ''}
                                        onClick={() => responder(item.id, true)}
                                    >
                                        Sim
                                    </button>
                                    <button
                                        type="button"
                                        className={respostas[item.id] === false ? 'ativo-nao' : ''}
                                        onClick={() => responder(item.id, false)}
                                    >
                                        Não
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <p className="aos-dica">
                        {totalItens > 0
                            ? `${totalItens} item(ns) do carrinho entram na OS e o estoque fica reservado.`
                            : 'A OS abre sem itens; você pode adicionar peças depois.'}
                    </p>

                    {erro && <div className="aos-erro">{erro}</div>}
                </div>

                <div className="aos-footer">
                    <button type="button" className="aos-btn-secundario" onClick={onClose} disabled={salvando}>
                        Cancelar
                    </button>
                    <button type="button" className="aos-btn-secundario" onClick={() => confirmar('liberar')} disabled={salvando}>
                        {salvando ? 'Salvando...' : 'Abrir e liberar PDV'}
                    </button>
                    <button type="button" className="aos-btn-primario" onClick={() => confirmar('finalizar')} disabled={salvando}>
                        {salvando ? 'Salvando...' : 'Abrir e finalizar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalAbrirOS;
