import React, { useState, useEffect } from 'react';
import './ModalCliente.css';
import api from '../../connection/connection';

const ModalCliente = ({ onSelecionarCliente, onCadastrarCliente, onClose }) => {
    const [modo, setModo] = useState('busca'); // 'busca', 'rapido' ou 'cadastro'
    const [rapido, setRapido] = useState({ nome: '', telefone: '' });
    const [salvandoRapido, setSalvandoRapido] = useState(false);
    const [termoBusca, setTermoBusca] = useState('');
    const [resultados, setResultados] = useState([]);
    const [clienteSelecionado, setClienteSelecionado] = useState(null);
    const [msg, setMsg] = useState();

    // Estado para o formulário de cadastro
    const [novoCliente, setNovoCliente] = useState({
        nome: '',
        cpf: '',
        telefone: '',
        email: ''
    });

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    function mascararCpfCnpj(valor) {
        // Remove tudo que não for número
        const numeros = valor.replace(/\D/g, '');



        if (numeros.length <= 11) {
          // CPF: 000.000.000-00
          return numeros
            .replace(/^(\d{3})(\d)/, '$1.$2')
            .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
        } else {
          // CNPJ: 00.000.000/0000-00
          return numeros
            .replace(/^(\d{2})(\d)/, '$1.$2')
            .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
            .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5');
        }
      }

    const buscarClientes = (busca) => {
        setTermoBusca(busca)
        api.get(`user-buscar?search=${busca}`).then((res) => {
            setResultados(res.data.valor)
        })

    };

    function mascararTelefone(valor) {
        const numeros = valor.replace(/\D/g, '');

        if (numeros.length <= 10) {
          // Telefone fixo: (99) 9999-9999
          return numeros
            .replace(/^(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{4})(\d)/, '$1-$2');
        } else {
          // Celular: (99) 99999-9999
          return numeros
            .replace(/^(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d)/, '$1-$2');
        }
      }



    const handleInputChange = (e) => {
        let { name, value } = e.target;

        if((name == "cpf" && value.length > 18) || (name == "telefone" && value.length > 15)){
            return
        }
        if(name == "cpf"){
            value = mascararCpfCnpj(value)
        }

        if(name == "telefone"){
            value = mascararTelefone(value)
        }

        setNovoCliente(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleCadastrar = () => {
        // Validação básica
        if (!novoCliente.nome || !novoCliente.cpf) {
            setMsg('Nome e CPF são obrigatórios!');
            return;
        }
        api.post("user",{
            nome:novoCliente.nome ,
            cpfCnpj:novoCliente.cpf ,
            tipo:"cliente",
            telefone:novoCliente.telefone,
            email:novoCliente.email
        }).then((res) => {

            // POST /user devolve { usuario, enderecos }.
            onSelecionarCliente(res.data.valor?.usuario || res.data.valor);
            onClose();

        }).catch((err) => {

            setMsg(err.response.data.valor)
        })

    };

    const abrirRapido = () => {
        // Aproveita o que foi digitado na busca: nome vira nome, número vira WhatsApp.
        const termo = termoBusca.trim();
        const soNumeros = termo.replace(/\D/g, '');
        const ehTelefone = termo !== '' && soNumeros.length === termo.replace(/[\s()-]/g, '').length;
        setRapido({
            nome: ehTelefone ? '' : termo,
            telefone: ehTelefone ? mascararTelefone(soNumeros.slice(0, 11)) : ''
        });
        setMsg(undefined);
        setModo('rapido');
    };

    const salvarRapido = (e) => {
        e.preventDefault();
        const telefone = rapido.telefone.replace(/\D/g, '');
        if (rapido.nome.trim().length < 2) {
            setMsg('Informe o nome do cliente.');
            return;
        }
        if (telefone.length < 10) {
            setMsg('Informe o WhatsApp com DDD.');
            return;
        }
        setSalvandoRapido(true);
        api.post('clientes/rapido', { nome: rapido.nome.trim(), telefone })
            .then((res) => {
                const cliente = res.data?.valor?.cliente;
                if (!cliente) {
                    setMsg(typeof res.data?.valor === 'string' ? res.data.valor : 'Não foi possível salvar o cliente.');
                    return;
                }
                onSelecionarCliente(cliente);
                onClose();
            })
            .catch((err) => setMsg(err.response?.data?.valor || 'Não foi possível salvar o cliente.'))
            .finally(() => setSalvandoRapido(false));
    };

    const titulo = { busca: 'Buscar Cliente', rapido: 'Cliente rápido', cadastro: 'Cadastro completo' }[modo];

    return (
        <div className="cli-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="cli-modal">
                <div className="cli-header">
                    <h3>{titulo}</h3>
                    <button onClick={onClose} className="cli-close-btn">
                        &times;
                    </button>
                </div>

                {modo === 'busca' ? (
                    <div className="cli-busca-container">
                        <div className="cli-busca-input-wrapper">
                            <span className="cli-busca-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                            </span>
                            <input
                                type="text"
                                value={termoBusca}
                                onChange={(e) => buscarClientes(e.target.value)}
                                placeholder="Digite nome, CPF ou WhatsApp..."
                                autoFocus
                                className="cli-busca-input"
                            />
                        </div>

                        <div className="cli-resultados-container">
                            {resultados.length > 0 ? (
                                <table className="cli-resultados-table">
                                    <thead>
                                        <tr>
                                            <th>Nome</th>
                                            <th>CPF/CNPJ</th>
                                            <th>Telefone</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {resultados.map(cliente => (
                                            <tr
                                                key={cliente._id}
                                                onClick={() => onSelecionarCliente(cliente)}
                                                className="cli-item-row"
                                            >
                                                <td>{cliente.nome}</td>
                                                <td>{cliente.cpfCnpj || <span className="cli-tag-rapido">Cadastro rápido</span>}</td>
                                                <td>{cliente.telefone ? mascararTelefone(String(cliente.telefone)) : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="cli-sem-resultados">
                                    {termoBusca ? 'Nenhum cliente encontrado' : 'Digite para buscar clientes'}
                                </div>
                            )}
                        </div>

                        <div className="cli-footer cli-footer-duplo">
                            <button
                                onClick={() => { setMsg(undefined); setModo('cadastro'); }}
                                className="cli-btn-voltar"
                            >
                                Cadastro completo (com CPF)
                            </button>
                            <button
                                onClick={abrirRapido}
                                className="cli-btn-novo"
                            >
                                Cliente rápido (nome + WhatsApp)
                            </button>
                        </div>
                    </div>
                ) : modo === 'rapido' ? (
                    <form className="cli-cadastro-container" onSubmit={salvarRapido}>
                        <p className="cli-rapido-descricao">
                            Só nome e WhatsApp. Use para fiado e para saber quem comprou, sem pedir CPF.
                        </p>
                        {msg && <div className="cli-mensagem-alerta">{msg}</div>}

                        <div className="cli-form-group">
                            <label>Nome*</label>
                            <input
                                type="text"
                                value={rapido.nome}
                                onChange={(e) => setRapido((r) => ({ ...r, nome: e.target.value }))}
                                placeholder="Como o cliente é conhecido"
                                autoFocus={rapido.nome === ''}
                            />
                        </div>

                        <div className="cli-form-group">
                            <label>WhatsApp*</label>
                            <input
                                type="text"
                                inputMode="tel"
                                value={rapido.telefone}
                                onChange={(e) => setRapido((r) => ({ ...r, telefone: mascararTelefone(e.target.value.replace(/\D/g, '').slice(0, 11)) }))}
                                placeholder="(11) 98765-4321"
                                autoFocus={rapido.nome !== ''}
                            />
                        </div>

                        <div className="cli-form-buttons">
                            <button type="button" onClick={() => { setMsg(undefined); setModo('busca'); }} className="cli-btn-voltar">
                                Voltar para Busca
                            </button>
                            <button type="submit" className="cli-btn-cadastrar" disabled={salvandoRapido}>
                                {salvandoRapido ? 'Salvando...' : 'Salvar e usar na venda'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="cli-cadastro-container">
                        {msg && <div className="cli-mensagem-alerta">{msg}</div>}

                        <div className="cli-form-group">
                            <label>Nome Completo*</label>
                            <input
                                type="text"
                                name="nome"
                                value={novoCliente.nome}
                                onChange={handleInputChange}
                                placeholder="Digite o nome completo"
                            />
                        </div>

                        <div className="cli-form-group">
                            <label>CPF/CNPJ*</label>
                            <input
                                type="text"
                                name="cpf"
                                value={novoCliente.cpf}
                                onChange={handleInputChange}
                                placeholder="Digite o CPF/CNPJ"
                            />
                        </div>

                        <div className="cli-form-group">
                            <label>Telefone</label>
                            <input
                                type="text"
                                name="telefone"
                                value={novoCliente.telefone}
                                onChange={handleInputChange}
                                placeholder="Digite o telefone"
                            />
                        </div>

                        <div className="cli-form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                name="email"
                                value={novoCliente.email}
                                onChange={handleInputChange}
                                placeholder="Digite o email"
                            />
                        </div>

                        <div className="cli-form-buttons">
                            <button
                                onClick={() => setModo('busca')}
                                className="cli-btn-voltar"
                            >
                                Voltar para Busca
                            </button>
                            <button
                                onClick={handleCadastrar}
                                className="cli-btn-cadastrar"
                            >
                                Cadastrar Cliente
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModalCliente;
