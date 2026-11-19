import React, { useEffect, useMemo, useState } from 'react';
import moment from 'moment';
import api from '../../connection/connection';
import '../ModalAbrirOS/ModalAbrirOS.css';
import './ModalFaturados.css';

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);
const soma = (lista) => (lista || []).reduce((acc, i) => acc + (Number(i?.valor) || 0), 0);
const arredondar = (v) => Math.round((Number(v) || 0) * 100) / 100;

// Só dígitos (centavos) -> "1.234,56"
const mascararValor = (texto) => {
    const digitos = String(texto || '').replace(/\D/g, '').slice(0, 9);
    if (!digitos) return '';
    return (parseInt(digitos, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const valorParaNumero = (texto) => {
    const digitos = String(texto || '').replace(/\D/g, '');
    return digitos ? parseInt(digitos, 10) / 100 : 0;
};
const numeroParaValor = (n) => mascararValor(String(Math.round((Number(n) || 0) * 100)));

const METODOS = [
    { valor: 'dinheiro', label: 'Dinheiro' },
    { valor: 'pix', label: 'Pix' },
    { valor: 'debito', label: 'Débito' },
    { valor: 'credito', label: 'Crédito' },
];

const resumir = (f) => {
    const recebido = soma(f.pagamento);
    const desconto = soma(f.descontos);
    return { recebido, desconto, aberto: Math.max(0, arredondar((Number(f.valor) || 0) - recebido - desconto)) };
};

// Faturados em aberto: receber pagamento e dar desconto para quitar (desconto exige admin).
const ModalFaturados = ({ onClose }) => {
    const [faturados, setFaturados] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [erroLista, setErroLista] = useState('');
    const [busca, setBusca] = useState('');
    const [selecionado, setSelecionado] = useState(null);
    const [modo, setModo] = useState('receber'); // receber | desconto

    const [metodo, setMetodo] = useState('dinheiro');
    const [valor, setValor] = useState('');
    const [parcelas, setParcelas] = useState('1');
    const [motivo, setMotivo] = useState('');
    const [login, setLogin] = useState('');
    const [senha, setSenha] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');
    const [aviso, setAviso] = useState('');

    const carregar = () => {
        setCarregando(true);
        setErroLista('');
        api.get('/faturados', { params: { status: 'aberto', ordem: 'desc' } })
            .then((res) => {
                if (res.data?.erro) throw new Error(res.data.valor);
                setFaturados(res.data?.valor || []);
            })
            .catch((e) => setErroLista(e.response?.data?.valor || e.message || 'Erro ao carregar faturados.'))
            .finally(() => setCarregando(false));
    };

    useEffect(carregar, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key !== 'Escape' || salvando) return;
            if (selecionado) setSelecionado(null);
            else onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, salvando, selecionado]);

    const lista = useMemo(() => {
        const termo = busca.trim().toLowerCase();
        return faturados
            .map((f) => ({ ...f, ...resumir(f) }))
            .filter((f) => f.aberto > 0.005)
            .filter((f) => !termo || `${f.clienteNome || f.venda?.clienteNome || ''} ${f.faturamentoId} ${f.venda?.vendaId ?? ''}`.toLowerCase().includes(termo));
    }, [faturados, busca]);

    const abrir = (f, modoInicial = 'receber') => {
        setSelecionado(f);
        setModo(modoInicial);
        setMetodo('dinheiro');
        setValor(numeroParaValor(f.aberto));
        setParcelas('1');
        setMotivo('');
        setLogin('');
        setSenha('');
        setErro('');
        setAviso('');
    };

    const trocarModo = (m) => {
        setModo(m);
        setErro('');
        if (selecionado) setValor(numeroParaValor(selecionado.aberto));
    };

    // Recarrega e mantém o faturado aberto na tela (ou fecha se quitou).
    const aposSalvar = (mensagem, atualizado) => {
        setAviso(mensagem);
        carregar();
        if (atualizado) {
            const novo = { ...selecionado, ...atualizado, venda: selecionado.venda };
            const r = resumir(novo);
            if (r.aberto <= 0.005) {
                setSelecionado(null);
            } else {
                setSelecionado({ ...novo, ...r });
                setValor(numeroParaValor(r.aberto));
            }
        }
    };

    const receber = () => {
        const v = valorParaNumero(valor);
        if (v <= 0) return setErro('Informe o valor.');
        if (v > selecionado.aberto + 0.005) return setErro(`O valor passa do que está em aberto (${formatarMoeda(selecionado.aberto)}).`);
        const qtdParcelas = metodo === 'credito' ? Math.max(1, parseInt(parcelas, 10) || 1) : 1;

        setSalvando(true);
        setErro('');
        api.post('/pagamentos/faturados', {
            faturadoId: selecionado._id,
            pagamentos: [{ metodo, valor: v, data: moment().format(), qtdParcelas }],
        })
            .then((res) => {
                if (res.data?.erro) { setErro(res.data.valor || 'Não foi possível registrar o pagamento.'); return; }
                aposSalvar(`Recebido ${formatarMoeda(v)} no faturado #${selecionado.faturamentoId}.`, res.data?.valor);
            })
            .catch((e) => setErro(e.response?.data?.valor || 'Não foi possível registrar o pagamento.'))
            .finally(() => setSalvando(false));
    };

    const darDesconto = () => {
        const v = valorParaNumero(valor);
        if (v <= 0) return setErro('Informe o valor do desconto.');
        if (v > selecionado.aberto + 0.005) return setErro(`O desconto passa do que está em aberto (${formatarMoeda(selecionado.aberto)}).`);
        if (!motivo.trim()) return setErro('Informe o motivo.');
        if (!login.trim() || !senha) return setErro('Informe login e senha do administrador.');

        setSalvando(true);
        setErro('');
        api.post(`/faturados/${selecionado._id}/desconto`, {
            valor: v,
            motivo: motivo.trim(),
            autorizacao: { login: login.trim(), senha },
        })
            .then((res) => {
                if (res.data?.erro) { setErro(res.data.valor || 'Não foi possível aplicar o desconto.'); return; }
                setSenha('');
                aposSalvar(`Desconto de ${formatarMoeda(v)} aplicado no faturado #${selecionado.faturamentoId}.`, res.data?.valor);
            })
            .catch((e) => setErro(e.response?.data?.valor || 'Não foi possível aplicar o desconto.'))
            .finally(() => setSalvando(false));
    };

    const renderLista = () => {
        if (carregando && faturados.length === 0) return <p className="fat-vazio">Carregando...</p>;
        if (erroLista) return <div className="aos-erro">{erroLista}</div>;
        if (lista.length === 0) return <p className="fat-vazio">Nenhum faturado em aberto.</p>;
        return (
            <table className="fat-tabela">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Cliente</th>
                        <th>Data</th>
                        <th className="num">Valor</th>
                        <th className="num">Em aberto</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {lista.map((f) => (
                        <tr key={f._id} onDoubleClick={() => abrir(f)}>
                            <td>{f.faturamentoId}</td>
                            <td>{f.clienteNome || f.venda?.clienteNome || 'Sem cliente'}</td>
                            <td>{f.data ? moment(f.data).format('DD/MM/YYYY') : '—'}</td>
                            <td className="num">{formatarMoeda(f.valor)}</td>
                            <td className="num fat-aberto">{formatarMoeda(f.aberto)}</td>
                            <td className="fat-acoes">
                                <button type="button" className="aos-btn-primario" onClick={() => abrir(f, 'receber')}>Receber</button>
                                <button type="button" className="aos-btn-secundario" onClick={() => abrir(f, 'desconto')}>Desconto</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    const renderDetalhe = () => {
        const f = selecionado;
        return (
            <>
                <div className="fat-resumo">
                    <div><span>Faturado</span><strong>#{f.faturamentoId}</strong></div>
                    <div><span>Cliente</span><strong>{f.clienteNome || f.venda?.clienteNome || 'Sem cliente'}</strong></div>
                    <div><span>Valor</span><strong>{formatarMoeda(f.valor)}</strong></div>
                    <div><span>Recebido</span><strong>{formatarMoeda(f.recebido)}</strong></div>
                    {f.desconto > 0 && <div><span>Desconto</span><strong>{formatarMoeda(f.desconto)}</strong></div>}
                    <div><span>Em aberto</span><strong className="fat-aberto">{formatarMoeda(f.aberto)}</strong></div>
                </div>

                <div className="fat-modos">
                    <button type="button" className={modo === 'receber' ? 'ativo' : ''} onClick={() => trocarModo('receber')} disabled={salvando}>Receber pagamento</button>
                    <button type="button" className={modo === 'desconto' ? 'ativo' : ''} onClick={() => trocarModo('desconto')} disabled={salvando}>Desconto para quitar</button>
                </div>

                {modo === 'receber' ? (
                    <>
                        <div className="fat-metodos">
                            {METODOS.map((m) => (
                                <button key={m.valor} type="button" className={metodo === m.valor ? 'ativo' : ''} onClick={() => setMetodo(m.valor)} disabled={salvando}>
                                    {m.label}
                                </button>
                            ))}
                        </div>
                        <div className="aos-grid">
                            <div className="aos-campo">
                                <label htmlFor="fat-valor">Valor</label>
                                <input id="fat-valor" type="text" inputMode="numeric" value={valor} onChange={(e) => setValor(mascararValor(e.target.value))} autoFocus />
                            </div>
                            {metodo === 'credito' && (
                                <div className="aos-campo">
                                    <label htmlFor="fat-parcelas">Parcelas</label>
                                    <input id="fat-parcelas" type="text" inputMode="numeric" value={parcelas} onChange={(e) => setParcelas(e.target.value.replace(/\D/g, '').slice(0, 2))} />
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <p className="aos-dica">O desconto não entra no caixa: só abate o que falta (ex.: o preço mudou até lançar a venda). Precisa de login e senha de administrador.</p>
                        <div className="aos-grid">
                            <div className="aos-campo">
                                <label htmlFor="fat-desc-valor">Valor do desconto</label>
                                <input id="fat-desc-valor" type="text" inputMode="numeric" value={valor} onChange={(e) => setValor(mascararValor(e.target.value))} autoFocus />
                            </div>
                            <div className="aos-campo">
                                <label htmlFor="fat-motivo">Motivo</label>
                                <input id="fat-motivo" type="text" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: preço mudou" />
                            </div>
                            <div className="aos-campo">
                                <label htmlFor="fat-login">Login do administrador</label>
                                <input id="fat-login" type="text" autoComplete="off" value={login} onChange={(e) => setLogin(e.target.value)} />
                            </div>
                            <div className="aos-campo">
                                <label htmlFor="fat-senha">Senha</label>
                                <input id="fat-senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
                            </div>
                        </div>
                    </>
                )}
                {erro && <div className="aos-erro">{erro}</div>}
            </>
        );
    };

    return (
        <div className="aos-overlay" onClick={(e) => { if (e.target === e.currentTarget && !salvando) onClose(); }}>
            <div className="aos-modal fat-modal">
                <div className="aos-header">
                    <h3>{selecionado ? 'Faturado' : 'Faturados em aberto'}</h3>
                    <button onClick={onClose} className="aos-close-btn" disabled={salvando}>&times;</button>
                </div>

                <div className="aos-body">
                    {aviso && <div className="fat-aviso">{aviso}</div>}
                    {selecionado ? renderDetalhe() : (
                        <>
                            <input
                                className="fat-busca"
                                type="text"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                placeholder="Buscar por cliente ou número"
                                autoFocus
                            />
                            {renderLista()}
                        </>
                    )}
                </div>

                <div className="aos-footer">
                    {selecionado ? (
                        <>
                            <button type="button" className="aos-btn-secundario" onClick={() => setSelecionado(null)} disabled={salvando}>Voltar</button>
                            <button
                                type="button"
                                className="aos-btn-primario"
                                onClick={modo === 'receber' ? receber : darDesconto}
                                disabled={salvando}
                            >
                                {salvando ? 'Salvando...' : modo === 'receber'
                                    ? `Receber ${valorParaNumero(valor) > 0 ? formatarMoeda(valorParaNumero(valor)) : ''}`
                                    : `Aplicar desconto ${valorParaNumero(valor) > 0 ? formatarMoeda(valorParaNumero(valor)) : ''}`}
                            </button>
                        </>
                    ) : (
                        <button type="button" className="aos-btn-secundario" onClick={onClose}>Fechar</button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModalFaturados;
