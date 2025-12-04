import React, { useState, useEffect, useRef } from 'react';
import './pdv.css'; // Arquivo CSS para estilos
import moment from 'moment-timezone';
import BuscarItem from '../../components/ModalBuscaItens/ModalBuscaItens';
import ModalCliente from '../../components/ModalCliente/ModalCliente';
import useUsuarioStore from '../../store/useUsuarioStore';

const PDV = () => {

    const [itensSelecionados, setItensSelecionados] = useState([])
    const [mostraModal, setMostraModal] = useState(false)
    const [clienteSelecionado, setClienteSelecionado] = useState({})
    const [mostrarModalCliente, setMostrarModalCliente] = useState(false);
    const horaAtualRef = useRef(moment());
    const usuario = useUsuarioStore((state) => state.usuario);
    const nomeOperador = usuario?.nome || "Operador";

    useEffect(() => {
        const intervalo = setInterval(() => {
            horaAtualRef.current = moment();
        }, 1000);
        const handleKeyDown = (e) => {
            if (e.key === "F1") {
                e.preventDefault();
                setMostraModal(true)
               
            }
            if (e.key === "F4") {
                e.preventDefault(); 
                limparBag()
               
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown)
            clearInterval(intervalo)
        }
    }, []);

    const limparBag = () => {
        setItensSelecionados([])
    }

    const calcularTotalItem = (item) => {
        return (item.valorTotal * (item.quantidade || 1)) - (item.desconto || 0);
    };

    const calcularTotalVenda = () => {
        return itensSelecionados.reduce((total, item) => total + calcularTotalItem(item), 0);
    };

    const calcularTotalDescontos = () => {
        return itensSelecionados.reduce((total, item) => total + (item.desconto || 0), 0);
    };

    const calcularSubtotal = () => {
        return itensSelecionados.reduce((total, item) => total + (item.valorVenda * (item.quantidade || 1)), 0);
    };

    return (
        <div className="pdv-container">
            {/* Side Menu - Substituindo o header */}
            <aside className="side-menu">
                <div className="menu-header">
                    <div className="logo-container">
                        <img src="/img/LogoSemFundo.png" alt="Logo" className="logo-img" />
                    </div>
                    <div className="header-info">
                        <div className="info-line">
                            <span className="info-label">Operador:</span>
                            <span className="info-value">{nomeOperador}</span>
                        </div>
                        <div className="info-line">
                            <span className="info-label">Data/Hora:</span>
                            <span className="info-value">{horaAtualRef.current.format("DD/MM/YYYY HH:mm")}</span>
                        </div>
                        {clienteSelecionado && (
                            <div className="info-line cliente-info">
                                <span className="info-label">Cliente:</span>
                                <span className="info-value">{clienteSelecionado.nome}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="menu-atalhos">
                    <h3>Atalhos</h3>
                    <ul>
                        <li>
                            <button className="atalho-btn" onClick={() => setMostraModal(true)}>
                                <span className="atalho-key">F1</span>
                                <span className="atalho-label">Pesquisar</span>
                            </button>
                        </li>
                        <li>
                            <button className="atalho-btn" onClick={() => setMostrarModalCliente(true)}>
                                <span className="atalho-key">F2</span>
                                <span className="atalho-label">Cliente</span>
                            </button>
                        </li>
                        <li>
                            <button className="atalho-btn">
                                <span className="atalho-key">F3</span>
                                <span className="atalho-label">Finalizar</span>
                            </button>
                        </li>
                        <li>
                            <button className="atalho-btn" onClick={() => limparBag()}>
                                <span className="atalho-key">F4</span>
                                <span className="atalho-label">Cancelar</span>
                            </button>
                        </li>
                    </ul>
                </div>
            </aside>

            {/* Área Principal */}
            <main className="pdv-main">
                <div className="tabela-container">
                    <table className="tabela-venda">
                        <thead>
                            <tr>
                                <th width="45%">Produto</th>
                                <th width="10%">Qtd</th>
                                <th width="15%">Unitário</th>
                                <th width="15%">Desconto (%)</th>
                                <th width="15%">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {itensSelecionados.map((item, index) => (
                                <tr key={index}>
                                    <td >
                                        <div className="produto-info">
                                            <span className="produto-nome">{item.produtoNome}</span>
                                            {item.marca && <span className="produto-marca">{item.marca}</span>}
                                        </div>
                                    </td>
                                    <td className="text-center">{item.qtd || 1}</td>
                                    <td className="text-right">R$ {item.valorUnitario.toFixed(2).replace(".", ",")}</td>
                                    <td className="text-right">{(item.desconto.toFixed(2).replace(".", ",") || 0)}</td>
                                    <td className="text-right">R$ {calcularTotalItem(item).toFixed(2).replace(".", ",")}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="resumo-venda">
                    <div className="total-linha">
                        <span>Subtotal:</span>
                        <span>R$ {itensSelecionados.reduce((total, item) => total + (item.valorUnitario * (item.quantidade || 1)), 0).toFixed(2).replace(".", ",")}</span>
                    </div>
                    <div className="total-linha desconto">
                        <span>Descontos:</span>
                        <span>- R$ {itensSelecionados.reduce((total, item) => total + (item.valorDoDesconto || 0), 0).toFixed(2).replace(".", ",")}</span>
                    </div>
                    <div className="total-linha total-geral">
                        <span>Total:</span>
                        <span>R$ {calcularTotalVenda().toFixed(2).replace(".", ",")}</span>
                    </div>
                </div>
            </main>
            {
                mostraModal && (
                    <BuscarItem
                        onSelecionarItem={(item) => {
                            setItensSelecionados((itens) => {
                                return [...itens, item]
                            })
                        }}
                        onClose={() => setMostraModal(false)}

                        bag={itensSelecionados}
                    />
                )
            }
            {
                mostrarModalCliente && (
                    <ModalCliente
                        onSelecionarCliente={(cliente) => {
                            setClienteSelecionado(cliente)
                            console.log('Cliente selecionado:', cliente);
                            setMostrarModalCliente(false);
                        }}

                        onClose={() => setMostrarModalCliente(false)}
                    />

                )
            }

        </div>
    );
}

export default PDV;
