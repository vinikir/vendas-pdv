import React, { useState } from "react";
import api from "../../connection/connection";
import "./pdvlogin.css"; // Importando o novo CSS
import Modal from "../../components/modal/modal";
import { useAuth } from "../../Contexts/AuthContext";
import { useNavigate } from 'react-router-dom';

const PDVLogin = () => {
    const [loginText, setLogin] = useState("");
    const [senha, setSenha] = useState("");
    const [msgModal, setMsgModal] = useState("");
    const [modalAberta, setModalAberta] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();


    const logarPDV = () => {
        if (loginText.trim() === "" || senha.trim() === "") {
            setModalAberta(true);
            setMsgModal("Você precisa informar o login e a senha.");
            return;
        }

        api.post("login", { login: loginText, senha, acesso: "pdv" })
            .then((res) => {
                console.log(res);
                login(res.data.valor);
                navigate('/pdv');
            })
            .catch((er) => {
                console.log("entrou no erro", er);
                setModalAberta(true);
                setMsgModal(er.response?.data?.valor || "Erro ao fazer login no PDV");
                console.log(er.response?.data?.valor);
            });
    };

    return (
        <div className="containerLoginPDV">
            <div className="leftLoginPDV">
                <img src="/img/LogoSemFundo.png" alt="Logo" className="logoLoginPDV" />
                <h1 className="tituloPDV">Acesso Rápido ao PDV</h1>
            </div>

            <div className="rightLoginPDV">
                <div className="formLoginPDV">
                   

                    <div className="divInputLoginPDV">
                        <label>Login</label>
                        <input
                            value={loginText}
                            className="inputLoginPDV"
                            onChange={(e) => setLogin(e.target.value)}
                            placeholder="Digite seu login"
                        />
                    </div>

                    <div className="divInputLoginPDV">
                        <label>Senha</label>
                        <input
                            value={senha}
                            type="password"
                            className="inputLoginPDV"
                            onChange={(e) => setSenha(e.target.value)}
                            placeholder="Digite sua senha"
                        />
                    </div>

                    <button onClick={logarPDV} className="botaoLoginPDV">
                        Acessar PDV
                    </button>
                </div>
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
