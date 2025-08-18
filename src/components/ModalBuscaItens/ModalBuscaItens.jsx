import React, { useState, useRef } from 'react';
import './ModalBuscaItens.css'; // Podemos usar o mesmo CSS do PDV
import api from '../../connection/connection'
const BuscarItem = ({ onSelecionarItem, onClose, bag }) => {
    const [termoBusca, setTermoBusca] = useState('');
    const [resultados, setResultados] = useState([]);
    const [itemSelecionado, setItemSelecionado] = useState(null);
    const [quantidade, setQuantidade] = useState(1);
    const [desconto, setDesconto] = useState(0);
    const [valor, setValor] = useState(0);
    const [msg, setMsg] = useState(0);


    const time = useRef(null);

    const buscarItem = (valor) => {

        setTermoBusca(valor)
        if (valor.trim() === '') {
            setResultados([]);
            return;
        }

        clearTimeout(time.current);

        time.current = setTimeout(() => {
            
            api.get('produtos?search=' + valor.trim()).then((res) => {
                setResultados(res.data.valor);
            })

        }, 1500)
    }

    function calcularDesconto(valor, porcentagem) {
        if (typeof valor !== "number" || typeof porcentagem !== "number") return 0;
        return valor - (valor * (porcentagem / 100));
      }


    function somenteNumeros(valor) {
        const apenasNumeros = valor.replace(/[^\d]/g, '');
        return parseFloat(apenasNumeros);
    }

    const handleSelecionar = (item) => {
        

        setItemSelecionado(item);
        setValor(calcularDesconto(item.valorVenda,desconto)*quantidade)
    };

    const inserirQuantidade = (qtd) => {
        setMsg("")
        if(itemSelecionado.estoque < qtd ){
            setMsg(`Estoque insuficiente. Quantidade disponível: ${itemSelecionado.estoque}.`);

            setQuantidade(1)
            return
        }

        setQuantidade(somenteNumeros(qtd))
        setValor(calcularDesconto(itemSelecionado.valorVenda,desconto)*qtd)
    }

    const inserirDesconto = (descontoI) => {
        setMsg("")
        if(itemSelecionado.descontoMaximo < descontoI ){
            setMsg(`Desconto máximo permitido: ${itemSelecionado.descontoMaximo}%.`);

            setDesconto(0)
            return
        }

        setDesconto(somenteNumeros(descontoI))
      
       
        setValor(calcularDesconto(itemSelecionado.valorVenda,somenteNumeros(descontoI))*quantidade)
    }

    const handleConfirmar = () => {
        if (itemSelecionado) {
            onSelecionarItem({
                ...itemSelecionado,
                quantidade: 1,
                desconto: 0
            });
            onClose();
        }
    };

    const enviarParaABag = () => {
        onSelecionarItem(
            {
                desconto: desconto,
                produtoId: itemSelecionado._id,
                produtoNome: itemSelecionado.nome,
                qtd: quantidade,
                tipo: "venda",
                valorTotal: valor,
                valorDoDesconto:(itemSelecionado.valorVenda * quantidade) - valor,
                valorUnitario: itemSelecionado.valorVenda,
                marca:itemSelecionado.marca
            }
        )
        setResultados([]);
        setItemSelecionado(null)
        setTermoBusca("")
    }

    const cancelarSelecaoItem = () => {
        setResultados([]);
        setItemSelecionado(null)
        setTermoBusca("")
    }

    return (
        <div className="modal-overlay">
            <div className="buscar-item-modal">
                {/* Cabeçalho */}
                <div className="modal-header">
                    <h3>Buscar Item</h3>
                    <button onClick={onClose} className="close-btn">
                        &times;
                    </button>
                </div>

                {/* Área de edição quando item está selecionado */}
                {itemSelecionado !== null && (
                    <div className="item-selecionado-container">
                        {msg && <div className="mensagem-alerta">{msg}</div>}
                        
                        <div className="info-produto">
                            <h4>{itemSelecionado.nome}</h4>
                            <div className="detalhes-produto">
                                <span>Marca: {itemSelecionado.marca || '-'}</span>
                                <span className={`estoque ${itemSelecionado.estoque > 0 ? 'em-estoque' : 'sem-estoque'}`}>
                                    Estoque: {itemSelecionado.estoque || 0}
                                </span>
                                <span>Preço: R$ {itemSelecionado.valorVenda.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="controles-quantidade">
                            <div className="input-group">
                                <label>Quantidade:</label>
                                <input
                                    type="number"
                                    min="1"
                                    max={itemSelecionado.estoque}
                                    value={quantidade}
                                    onChange={(e) => inserirQuantidade(e.target.value)}
                                    className="quantidade-input"
                                />
                            </div>

                            <div className="input-group">
                                <label>Desconto (%):</label>
                                <input
                                    type="number"
                                    min="0"
                                    max={itemSelecionado.descontoMaximo}
                                    value={desconto}
                                    onChange={(e) => inserirDesconto(e.target.value)}
                                    className="desconto-input"
                                />
                                <span className="max-desconto">Máx: {itemSelecionado.descontoMaximo}%</span>
                            </div>
                        </div>

                        <div className="resumo-valor">
                            <span>Valor Total:</span>
                            <span className="valor-total">R$ {valor.toFixed(2)}</span>
                        </div>

                        <div className="botoes-acao">
                            <button 
                                onClick={enviarParaABag} 
                                className="btn-confirmar"
                            >
                                Adicionar ao Carrinho
                            </button>
                            <button 
                                onClick={cancelarSelecaoItem} 
                                className="btn-cancelar"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {/* Área de busca quando nenhum item está selecionado */}
                {itemSelecionado === null && (
                    <>
                        <div className="busca-container">
                            <input
                                type="text"
                                value={termoBusca}
                                onChange={(e) => buscarItem(e.target.value)}
                                placeholder="Digite nome, código ou marca..."
                                autoFocus
                                className="busca-input"
                            />
                        </div>

                        <div className="resultados-container">
                            {resultados.length > 0 ? (
                                <table className="resultados-table">
                                    <thead>
                                        <tr>
                                            <th>Produto</th>
                                            <th>Marca</th>
                                            <th>Estoque</th>
                                            <th>Preço</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {resultados.map((item) => (
                                            <tr
                                                key={item._id.$oid}
                                                onClick={() => handleSelecionar(item)}
                                                className={`item-row ${itemSelecionado?._id.$oid === item._id.$oid ? 'selecionado' : ''}`}
                                            >
                                                <td>
                                                    <div className="produto-info">
                                                        <span className="produto-nome">{item.nome}</span>
                                                        {item.codigoBarra && <span className="produto-codigo">Cód: {item.codigoBarra}</span>}
                                                    </div>
                                                </td>
                                                <td>{item.marca || '-'}</td>
                                                <td className={item.estoque > 0 ? 'em-estoque' : 'sem-estoque'}>
                                                    {item.estoque || 0}
                                                </td>
                                                <td className="preco">R$ {item.valorVenda.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="sem-resultados">
                                    {termoBusca ? 'Nenhum item encontrado' : 'Digite para buscar itens'}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default BuscarItem;