import React, { useEffect, useState } from 'react';
import api from '../../connection/connection';
import './ModalDemanda.css';

const formatarTelefone = (valor) => {
    const n = String(valor || '').replace(/\D/g, '').slice(0, 11);
    if (n.length <= 2) return n;
    if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
    if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
};

// Anota o que o cliente procurou e a loja não tinha. Só a descrição é obrigatória.
const ModalDemanda = ({ descricaoInicial = '', produto = null, onClose, onSalvo }) => {
    const [form, setForm] = useState({
        descricao: produto?.nome || descricaoInicial,
        moto: '',
        qtd: '1',
        clienteNome: '',
        clienteTelefone: '',
    });
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [onClose]);

    const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

    const salvar = (e) => {
        e.preventDefault();
        if (form.descricao.trim().length < 2) {
            setErro('Diga o que o cliente procurou.');
            return;
        }
        setSalvando(true);
        setErro('');
        api.post('demandas', {
            descricao: form.descricao.trim(),
            moto: form.moto.trim(),
            qtd: Number(form.qtd) || 1,
            produtoId: produto ? (produto._id?.$oid || produto._id) : undefined,
            clienteNome: form.clienteNome.trim(),
            clienteTelefone: form.clienteTelefone.replace(/\D/g, ''),
            origem: 'pdv',
        })
            .then((res) => {
                if (res.data?.erro) throw new Error(res.data.valor);
                onSalvo && onSalvo(res.data.valor);
            })
            .catch((err) => setErro(err.response?.data?.valor || err.message || 'Não foi possível anotar.'))
            .finally(() => setSalvando(false));
    };

    return (
        <div className="dem-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <form className="dem-modal" onSubmit={salvar} onClick={(e) => e.stopPropagation()}>
                <div className="dem-header">
                    <h3>Procuraram e não tinha</h3>
                    <button type="button" className="dem-fechar" onClick={onClose} aria-label="Fechar">&times;</button>
                </div>

                {erro && <div className="dem-erro">{erro}</div>}

                <label className="dem-campo">
                    <span>O que procuraram *</span>
                    <input value={form.descricao} onChange={(e) => set('descricao', e.target.value)} disabled={Boolean(produto)} autoFocus={!produto} />
                </label>
                <div className="dem-linha">
                    <label className="dem-campo">
                        <span>Moto / aplicação</span>
                        <input value={form.moto} onChange={(e) => set('moto', e.target.value)} placeholder="Ex.: Biz 125 2020" autoFocus={Boolean(produto)} />
                    </label>
                    <label className="dem-campo dem-curto">
                        <span>Qtd</span>
                        <input type="text" inputMode="numeric" value={form.qtd} onChange={(e) => set('qtd', e.target.value.replace(/\D/g, '').slice(0, 3))} />
                    </label>
                </div>
                <p className="dem-secao">Cliente (opcional, para avisar quando chegar)</p>
                <div className="dem-linha">
                    <label className="dem-campo">
                        <span>Nome</span>
                        <input value={form.clienteNome} onChange={(e) => set('clienteNome', e.target.value)} />
                    </label>
                    <label className="dem-campo">
                        <span>WhatsApp</span>
                        <input type="text" inputMode="tel" value={form.clienteTelefone} onChange={(e) => set('clienteTelefone', formatarTelefone(e.target.value))} placeholder="(11) 98765-4321" />
                    </label>
                </div>

                <div className="dem-botoes">
                    <button type="button" className="dem-btn-secundario" onClick={onClose}>Cancelar</button>
                    <button type="submit" className="dem-btn" disabled={salvando}>{salvando ? 'Salvando...' : 'Anotar'}</button>
                </div>
            </form>
        </div>
    );
};

export default ModalDemanda;
