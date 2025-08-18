import React, { useState } from 'react';
import './ModalCliente.css';
import api from '../../connection/connection';

const ModalCliente = ({ onSelecionarCliente, onCadastrarCliente, onClose }) => {
    const [modo, setModo] = useState('busca'); // 'busca' ou 'cadastro'
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
            alert('Nome e CPF são obrigatórios!');
            return;
        }
        api.post("user",{
            nome:novoCliente.nome ,
            cpfCnpj:novoCliente.cpf ,
            tipo:"cliente",
            telefone:novoCliente.telefone,
            email:novoCliente.email
        }).then((res) => {
            
            onSelecionarCliente(res.data.valor);
            onClose();

        }).catch((err) => {
            
            setMsg(err.response.data.valor)
        })
        
    };

    return (
        <div className="modal-overlay">
            <div className="modal-cliente" style={{ maxHeight: '90vh' }}>
                <div className="modal-header">
                    <h3>{modo === 'busca' ? 'Buscar Cliente' : 'Cadastrar Cliente'}</h3>
                    <button onClick={onClose} className="close-btn">
                        &times;
                    </button>
                </div>

                {modo === 'busca' ? (
                    <div className="busca-container">
                        <div className="busca-input-container">
                            <input
                                type="text"
                                value={termoBusca}
                                onChange={(e) => buscarClientes(e.target.value)}
                                placeholder="Digite nome ou CPF..."
                                className="busca-input"
                            />
                           
                        </div>

                        <div className="resultados-container">
                            {resultados.length > 0 ? (
                                <table className="resultados-table">
                                    <thead>
                                        <tr>
                                            <th>Nome</th>
                                            <th>CPF</th>
                                            <th>Telefone</th>
                                            
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {resultados.map(cliente => (
                                            <tr key={cliente._id} onClick={() => {
                                                onSelecionarCliente(cliente)
                                            }} style={{ cursor:'pointer'}}>
                                                <td>{cliente.nome}</td>
                                                <td>{cliente.cpfCnpj}</td>
                                                <td>{cliente.telefone}</td>
                                                
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="sem-resultados">
                                    {termoBusca ? 'Nenhum cliente encontrado' : 'Digite para buscar clientes'}
                                </div>
                            )}
                        </div>

                        <div className="novo-cliente-footer">
                            <button 
                                onClick={() => setModo('cadastro')}
                                className="btn-novo-cliente"
                            >
                                Cadastrar Novo Cliente
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="cadastro-container">
                        {msg && <div className="mensagem-alerta">{msg}</div>}

                        <div className="form-group">
                            <label>Nome Completo*</label>
                            <input
                                type="text"
                                name="nome"
                                value={novoCliente.nome}
                                onChange={handleInputChange}
                                placeholder="Digite o nome completo"
                            />
                        </div>

                        <div className="form-group">
                            <label>CPF/CNPJ*</label>
                            <input
                                type="text"
                                name="cpf"
                                value={novoCliente.cpf}
                                onChange={handleInputChange}
                                placeholder="Digite o CPF/CNPJ"
                            />
                        </div>

                        <div className="form-group">
                            <label>Telefone</label>
                            <input
                                type="text"
                                name="telefone"
                                value={novoCliente.telefone}
                                onChange={handleInputChange}
                                placeholder="Digite o telefone"
                            />
                        </div>

                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                name="email"
                                value={novoCliente.email}
                                onChange={handleInputChange}
                                placeholder="Digite o email"
                            />
                        </div>

                        <div className="form-buttons">
                            <button 
                                onClick={() => setModo('busca')}
                                className="btn-voltar"
                            >
                                Voltar para Busca
                            </button>
                            <button 
                                onClick={handleCadastrar}
                                className="btn-cadastrar"
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