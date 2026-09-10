import React, { useState, useEffect } from 'react';
import './ModalSelecionarVendedor.css';
import api from '../../connection/connection';

const CARGOS_PERMITIDOS_PADRAO = ['vendedor', 'administrador'];

const ModalSelecionarVendedor = ({
    onSelecionar,
    onClose,
    titulo = 'Selecionar Vendedor',
    descricao = 'Informe o login e a senha de quem está realizando esta venda.',
    cargosPermitidos = CARGOS_PERMITIDOS_PADRAO,
    mensagemSemPermissao = 'Este usuário não tem permissão para esta ação.'
}) => {
    const [login, setLogin] = useState('');
    const [senha, setSenha] = useState('');
    const [mostrarSenha, setMostrarSenha] = useState(false);
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState('');

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

                if (!cargosPermitidos.includes(dados?.cargo)) {
                    setErro(mensagemSemPermissao);
                    return;
                }

                onSelecionar({
                    id: dados.funcionarioId || dados.id,
                    nome: dados.nome,
                    cargo: dados.cargo,
                    token: dados.token
                });
            })
            .catch((err) => {
                setErro(err.response?.data?.valor || 'Erro ao validar vendedor.');
            })
            .finally(() => {
                setCarregando(false);
            });
    };

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
