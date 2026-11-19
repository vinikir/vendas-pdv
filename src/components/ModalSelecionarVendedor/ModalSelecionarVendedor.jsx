import React, { useState, useEffect } from 'react';
import './ModalSelecionarVendedor.css';
import api from '../../connection/connection';
import { podeNoPdv } from '../../utils/permissoes';

const CARGOS_PERMITIDOS_PADRAO = ['vendedor', 'administrador'];

const ModalSelecionarVendedor = ({
    onSelecionar,
    onClose,
    titulo = 'Selecionar Vendedor',
    descricao = 'Informe o login e a senha de quem está realizando esta venda.',
    cargosPermitidos = CARGOS_PERMITIDOS_PADRAO,
    permissao = ['vendas', 'criar'],
    mensagemSemPermissao = 'Este usuário não tem permissão para esta ação.',
    // Quando quem entra é administrador, deixa escolher em nome de qual vendedor registrar.
    permitirAdminEscolher = false
}) => {
    const [login, setLogin] = useState('');
    const [senha, setSenha] = useState('');
    const [mostrarSenha, setMostrarSenha] = useState(false);
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState('');
    // Admin autenticado aguardando escolher o vendedor: { id, nome, cargo, token }
    const [adminAutenticado, setAdminAutenticado] = useState(null);
    const [vendedores, setVendedores] = useState([]);
    const [carregandoVendedores, setCarregandoVendedores] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const confirmar = (e) => {
        e.preventDefault();

        if (login.trim() === '' || senha.trim() === '') {
            setErro('Informe o login e a senha do vendedor.');
            return;
        }

        setErro('');
        setCarregando(true);

        api.post('login', { login, senha, acesso: 'pdv' })
            .then((res) => {
                const dados = res.data?.valor;

                if (!podeNoPdv(dados, permissao, cargosPermitidos)) {
                    setErro(mensagemSemPermissao);
                    return;
                }

                const autenticado = {
                    id: dados.funcionarioId || dados.id,
                    nome: dados.nome,
                    cargo: dados.cargo,
                    token: dados.token
                };

                if (permitirAdminEscolher && dados.cargo === 'administrador') {
                    setAdminAutenticado(autenticado);
                    carregarVendedores();
                    return;
                }

                onSelecionar(autenticado);
            })
            .catch((err) => {
                setErro(err.response?.data?.valor || 'Erro ao validar vendedor.');
            })
            .finally(() => {
                setCarregando(false);
            });
    };

    const carregarVendedores = () => {
        setCarregandoVendedores(true);
        api.get('vendedor-listar')
            .then((res) => {
                const lista = (res.data?.valor || [])
                    .filter((f) => f.ativo !== false && f.nome)
                    .map((f) => ({ id: f._id, nome: f.nome, cargo: f.cargo }))
                    .sort((a, b) => a.nome.localeCompare(b.nome));
                setVendedores(lista);
            })
            .catch(() => setErro('Não foi possível carregar a lista de vendedores.'))
            .finally(() => setCarregandoVendedores(false));
    };

    // O token continua sendo o do administrador: é ele quem autoriza e fica registrado
    // como autenticado; o vendedor escolhido só define em nome de quem a venda sai.
    const escolherVendedor = (vendedor) => {
        onSelecionar({
            ...vendedor,
            token: adminAutenticado.token,
            autorizadoPor: { id: adminAutenticado.id, nome: adminAutenticado.nome }
        });
    };

    if (adminAutenticado) {
        return (
            <div className="vnd-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
                <div className="vnd-modal">
                    <div className="vnd-header">
                        <h3>Vender em nome de</h3>
                        <button onClick={onClose} className="vnd-close-btn">&times;</button>
                    </div>
                    <div className="vnd-form">
                        <p className="vnd-descricao">
                            Administrador: <strong>{adminAutenticado.nome}</strong>. Escolha o vendedor desta venda.
                        </p>
                        <div className="vnd-lista">
                            <button type="button" className="vnd-lista-item" onClick={() => onSelecionar(adminAutenticado)}>
                                {adminAutenticado.nome} <span>(eu mesmo)</span>
                            </button>
                            {carregandoVendedores && <div className="vnd-descricao">Carregando vendedores...</div>}
                            {vendedores
                                .filter((v) => String(v.id) !== String(adminAutenticado.id))
                                .map((v) => (
                                    <button type="button" key={v.id} className="vnd-lista-item" onClick={() => escolherVendedor(v)}>
                                        {v.nome} <span>{v.cargo === 'administrador' ? '(administrador)' : ''}</span>
                                    </button>
                                ))}
                        </div>
                        {erro && <div className="vnd-erro">{erro}</div>}
                        <div className="vnd-footer">
                            <button type="button" className="vnd-btn-cancelar" onClick={() => { setAdminAutenticado(null); setSenha(''); }}>
                                Voltar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="vnd-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="vnd-modal">
                <div className="vnd-header">
                    <h3>{titulo}</h3>
                    <button onClick={onClose} className="vnd-close-btn">&times;</button>
                </div>

                <form className="vnd-form" onSubmit={confirmar}>
                    <p className="vnd-descricao">
                        {descricao}
                    </p>

                    <div className="vnd-form-group">
                        <label htmlFor="vnd-login">Login</label>
                        <input
                            id="vnd-login"
                            type="text"
                            value={login}
                            onChange={(e) => setLogin(e.target.value)}
                            placeholder="Login do vendedor"
                            autoFocus
                        />
                    </div>

                    <div className="vnd-form-group">
                        <label htmlFor="vnd-senha">Senha</label>
                        <div className="vnd-senha-wrapper">
                            <input
                                id="vnd-senha"
                                type={mostrarSenha ? 'text' : 'password'}
                                value={senha}
                                onChange={(e) => setSenha(e.target.value)}
                                placeholder="Senha"
                            />
                            <button
                                type="button"
                                className="vnd-toggle-senha"
                                onClick={() => setMostrarSenha((v) => !v)}
                                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                            >
                                {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                            </button>
                        </div>
                    </div>

                    {erro && <div className="vnd-erro">{erro}</div>}

                    <div className="vnd-footer">
                        <button type="button" className="vnd-btn-cancelar" onClick={onClose} disabled={carregando}>
                            Cancelar
                        </button>
                        <button type="submit" className="vnd-btn-confirmar" disabled={carregando}>
                            {carregando ? 'Validando...' : 'Confirmar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ModalSelecionarVendedor;
