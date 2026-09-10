import React, { useState } from "react";
import api from "../../connection/connection";
import "./pdvlogin.css"; // Importando o novo CSS
import Modal from "../../components/modal/modal";
import { useAuth } from "../../Contexts/AuthContext";
import { useNavigate } from 'react-router-dom';

const PDVLogin = () => {
    const [loginText, setLogin] = useState("");
    const [senha, setSenha] = useState("");
    const [mostrarSenha, setMostrarSenha] = useState(false);
    const [carregando, setCarregando] = useState(false);
    const [msgModal, setMsgModal] = useState("");
    const [modalAberta, setModalAberta] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const logarPDV = (e) => {
        e.preventDefault();

        if (loginText.trim() === "" || senha.trim() === "") {
            setModalAberta(true);
            setMsgModal("Você precisa informar o login e a senha.");
            return;
        }

        setCarregando(true);

        api.post("login", { login: loginText, senha, acesso: "pdv" })
            .then((res) => {
                login(res.data.valor);
                navigate('/pdv');
            })
            .catch((er) => {
                setModalAberta(true);
                setMsgModal(er.response?.data?.valor || "Erro ao fazer login no PDV");
            })
            .finally(() => {
                setCarregando(false);
            });
    };

    return (
        <div className="containerLoginPDV">
            <div className="leftLoginPDV">
                <div className="brandBadgePDV">
                    <img src="/img/LogoSemFundo.png" alt="Logo" className="logoLoginPDV" />
                    <div className="dividerPDV" />
                    <h1 className="tituloPDV">Sistema PDV</h1>
                    <p className="subtituloPDV">
                        Gestão rápida e segura para o balcão da sua loja de peças.
                    </p>
                </div>
            </div>

            <div className="rightLoginPDV">
                <form className="formLoginPDV" onSubmit={logarPDV}>
                    <div className="formHeaderPDV">
                        <h2>Acessar PDV</h2>
                        <p>Informe suas credenciais para continuar</p>
                    </div>

                    <div className="divInputLoginPDV">
                        <label htmlFor="loginPDV">Login</label>
                        <div className="inputWrapperPDV">
                            <span className="inputIconPDV">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </span>
                            <input
                                id="loginPDV"
                                value={loginText}
                                className="inputLoginPDV"
                                onChange={(e) => setLogin(e.target.value)}
                                placeholder="Digite seu login"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="divInputLoginPDV">
                        <label htmlFor="senhaPDV">Senha</label>
                        <div className="inputWrapperPDV">
                            <span className="inputIconPDV">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                            </span>
                            <input
                                id="senhaPDV"
                                value={senha}
                                type={mostrarSenha ? "text" : "password"}
                                className="inputLoginPDV"
                                onChange={(e) => setSenha(e.target.value)}
                                placeholder="Digite sua senha"
                            />
                            <button
                                type="button"
                                className="togglePasswordPDV"
                                onClick={() => setMostrarSenha((v) => !v)}
                                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                            >
                                {mostrarSenha ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.4 21.4 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.4 21.4 0 0 1-3.22 4.55" />
                                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                                        <line x1="1" y1="1" x2="23" y2="23" />
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="botaoLoginPDV" disabled={carregando}>
                        {carregando && <span className="spinnerPDV" />}
                        {carregando ? "Acessando..." : "Acessar PDV"}
                    </button>

                    <p className="rodapePDV">© {new Date().getFullYear()} — Todos os direitos reservados</p>
                </form>
            </div>

            <Modal
                msg={msgModal}
                showModal={modalAberta}
                handleClose={() => setModalAberta(false)}
            />
        </div>
    );
};

export default PDVLogin;
