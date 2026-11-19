import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './pdv.css'; // Arquivo CSS para estilos
import moment from 'moment-timezone';
import api from '../../connection/connection';
import BuscarItem from '../../components/ModalBuscaItens/ModalBuscaItens';
import ModalCliente from '../../components/ModalCliente/ModalCliente';
import ModalBuscaVendas from '../../components/ModalBuscaVendas/ModalBuscaVendas';
import ModalListarOrcamentos from '../../components/ModalListarOrcamentos/ModalListarOrcamentos';
import ModalSelecionarVendedor from '../../components/ModalSelecionarVendedor/ModalSelecionarVendedor';
import ModalAuditoria from '../../components/ModalAuditoria/ModalAuditoria';
import ModalAbrirOS from '../../components/ModalAbrirOS/ModalAbrirOS';
import ModalListarOS from '../../components/ModalAbrirOS/ModalListarOS';
import ModalFaturados from '../../components/ModalFaturados/ModalFaturados';
import Modal from '../../components/modal/modal';
import useUsuarioStore from '../../store/useUsuarioStore';
import { useAuth } from '../../Contexts/AuthContext';
import { gerarEBaixarPdfVenda } from '../../utils/pdfVenda';
import { gerarEBaixarPdfOrcamento } from '../../utils/pdfOrcamento';
import { ehServico, tetoItem, tetoVenda, subtotalVenda, descontoTotalVenda, aplicarValorNoItem, aplicarDescontoNaVenda, recalcularItem } from '../../utils/descontos';
import { buscarTaxasPagamento, calcularTaxaPagamento, calcularTaxasPagamentos, mensagemTaxaPendente, mensagemTaxasPendentes } from '../../utils/taxasPagamento';

const obterIdCliente = (cliente) => cliente?._id?.$oid || cliente?._id;
const obterIdRegistro = (doc) => doc?._id?.$oid || doc?._id;
const DIAS_VALIDADE_ORCAMENTO = 30;

// valorPagamentoAtual guarda só os dígitos digitados (representando centavos), ex: "4730" = R$ 47,30
const digitosParaNumero = (digitos) => parseInt(digitos || '0', 10) / 100;
const numeroParaDigitos = (numero) => String(Math.round(numero * 100));
const formatarMoeda = (digitos) => digitosParaNumero(digitos).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PDV = () => {

    const [itensSelecionados, setItensSelecionados] = useState([])
    const [mostraModal, setMostraModal] = useState(false)
    const [clienteSelecionado, setClienteSelecionado] = useState(null)
    const [mostrarModalCliente, setMostrarModalCliente] = useState(false);
    const [avisoQtd, setAvisoQtd] = useState(null); // { index, mensagem }
    const [mostrarModalFinalizar, setMostrarModalFinalizar] = useState(false);
    const [mostrarModalVendas, setMostrarModalVendas] = useState(false);
    const [metodoAtual, setMetodoAtual] = useState('dinheiro');
    const [valorPagamentoAtual, setValorPagamentoAtual] = useState('');
    const [pagamentosAdicionados, setPagamentosAdicionados] = useState([]); // { metodo, valor, troco, qtdParcelas }
    // Taxas da maquininha: prévia do líquido e bloqueio quando o cartão não tem taxa cadastrada.
    const [taxasPagamento, setTaxasPagamento] = useState([]);
    const [parcelasCredito, setParcelasCredito] = useState(1);
    // Override da taxa: dígitos em centavos, vazio = usa a taxa cadastrada.
    const [taxaManualDigitos, setTaxaManualDigitos] = useState('');
    const [editandoTaxa, setEditandoTaxa] = useState(false);
    const [finalizando, setFinalizando] = useState(false);
    const [msgFinalizar, setMsgFinalizar] = useState('');
    const [msgModal, setMsgModal] = useState('');
    const [modalAberto, setModalAberto] = useState(false);
    const [mostrarPerguntaNota, setMostrarPerguntaNota] = useState(false);
    const [dadosParaNota, setDadosParaNota] = useState(null);
    const [gerandoNota, setGerandoNota] = useState(false);
    const [gerandoOrcamento, setGerandoOrcamento] = useState(false);
    const [mostrarModalOrcamentos, setMostrarModalOrcamentos] = useState(false);
    // modalDesconto: null | { escopo: 'venda' } | { escopo: 'item', index }
    const [modalDesconto, setModalDesconto] = useState(null);
    const [tipoDesconto, setTipoDesconto] = useState('percentual'); // 'percentual' | 'valor'
    // percentual: texto com vírgula (ex "10,5"); valor: dígitos em centavos (ex "1250" = R$ 12,50)
    const [entradaDesconto, setEntradaDesconto] = useState('');
    // Pedido acima do teto: { escopo, index, pedido, possivel }
    const [limiteDesconto, setLimiteDesconto] = useState(null);
    // modoVisualizacao: null | { tipo: 'venda' | 'orcamento', dados: objeto carregado da listagem }
    const [modoVisualizacao, setModoVisualizacao] = useState(null);
    const [gerandoNotaVisualizacao, setGerandoNotaVisualizacao] = useState(false);
    const [verificandoConversao, setVerificandoConversao] = useState(false);
    const [dadosConversaoPendente, setDadosConversaoPendente] = useState(null); // { itensComEstoque, itensSemEstoque }
    const [mostrarConfirmSemEstoque, setMostrarConfirmSemEstoque] = useState(false);
    // vendedorSelecionado: quem está realizando a venda, diferente do operador logado no terminal
    const [vendedorSelecionado, setVendedorSelecionado] = useState(null);
    const [mostrarModalVendedor, setMostrarModalVendedor] = useState(false);
    const [itensPendentesAposVendedor, setItensPendentesAposVendedor] = useState(null);
    // autenticação de administrador (gate para ações sensíveis: desconto geral, cancelar venda, ver auditoria)
    const [mostrarModalAutenticacao, setMostrarModalAutenticacao] = useState(false);
    const [autenticacaoPendente, setAutenticacaoPendente] = useState(null); // { descricao, onSucesso }
    const [cancelandoVenda, setCancelandoVenda] = useState(false);
    const [motivoCancelamento, setMotivoCancelamento] = useState(null); // null = modal fechado
    const [erroMotivoCancelamento, setErroMotivoCancelamento] = useState('');
    const [mostrarModalAuditoria, setMostrarModalAuditoria] = useState(false);
    const [auditoriaToken, setAuditoriaToken] = useState(null);
    // OS carregada no PDV: o carrinho passa a ser os itens dela (estoque reservado no back).
    const [osAtual, setOsAtual] = useState(null);
    const [mostrarModalAbrirOS, setMostrarModalAbrirOS] = useState(false);
    const [mostrarModalFaturados, setMostrarModalFaturados] = useState(false);
    const [mostrarModalListarOS, setMostrarModalListarOS] = useState(false);
    const [salvandoOS, setSalvandoOS] = useState(false);
    const [motivoCancelamentoOS, setMotivoCancelamentoOS] = useState(null); // null = modal fechado
    const [erroMotivoOS, setErroMotivoOS] = useState('');
    const osAtualRef = useRef(osAtual);
    osAtualRef.current = osAtual;
    const acaoAposVendedorRef = useRef(null);
    const horaAtualRef = useRef(moment());
    const avisoQtdTimeoutRef = useRef(null);
    const itensSelecionadosRef = useRef(itensSelecionados);
    itensSelecionadosRef.current = itensSelecionados;
    const modoVisualizacaoRef = useRef(modoVisualizacao);
    modoVisualizacaoRef.current = modoVisualizacao;
    const vendedorSelecionadoRef = useRef(vendedorSelecionado);
    vendedorSelecionadoRef.current = vendedorSelecionado;
    const usuario = useUsuarioStore((state) => state.usuario);
    const nomeOperador = usuario?.nome || "Operador";
    const { logout } = useAuth();
    const navigate = useNavigate();

    const sair = () => {
        logout();
        navigate('/login');
    }

    useEffect(() => {
        buscarTaxasPagamento()
            .then(setTaxasPagamento)
            .catch((erro) => console.error('Erro ao carregar taxas de pagamento:', erro));
    }, []);

    useEffect(() => {
        const intervalo = setInterval(() => {
            horaAtualRef.current = moment();
        }, 1000);
        const handleKeyDown = (e) => {
            if (modoVisualizacaoRef.current) {
                if (e.key === "Escape") {
                    e.preventDefault();
                    fecharVisualizacao();
                }
                return;
            }
            if (e.key === "F1") {
                e.preventDefault();
                setMostraModal(true)

            }
            if (e.key === "F2") {
                e.preventDefault();
                setMostrarModalCliente(true)
            }
            if (e.key === "F3") {
                e.preventDefault();
                abrirFinalizar()
            }
            if (osAtualRef.current) {
                if (e.key === "F8") {
                    e.preventDefault();
                    abrirModalDesconto()
                }
                if (e.key === "F9") {
                    e.preventDefault();
                    salvarOSeLiberar()
                }
                return;
            }
            if (e.key === "F4") {
                e.preventDefault();
                limparBag()

            }
            if (e.key === "F5") {
                e.preventDefault();
                setMostrarModalVendas(true)
            }
            if (e.key === "F6") {
                e.preventDefault();
                gerarOrcamento()
            }
            if (e.key === "F7") {
                e.preventDefault();
                setMostrarModalOrcamentos(true)
            }
            if (e.key === "F9") {
                e.preventDefault();
                iniciarAberturaOS()
            }
            if (e.key === "F10") {
                e.preventDefault();
                setMostrarModalListarOS(true)
            }
            if (e.key === "F8") {
                e.preventDefault();
                abrirModalDesconto()
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown)
            clearInterval(intervalo)
            clearTimeout(avisoQtdTimeoutRef.current)
        }
    }, []);

    const limparBag = () => {
        setItensSelecionados([])
    }

    const arredondar = (valor) => Math.round((valor + Number.EPSILON) * 100) / 100;

    const carregarVenda = (venda) => {
        setItensSelecionados(Array.isArray(venda.produtos) ? venda.produtos : []);
        setClienteSelecionado(venda.clienteId ? { _id: venda.clienteId, nome: venda.clienteNome } : null);
        setModoVisualizacao({ tipo: 'venda', dados: venda });
        setMostrarModalVendas(false);
    }

    const carregarOrcamento = (orcamento) => {
        setItensSelecionados(Array.isArray(orcamento.produtos) ? orcamento.produtos : []);
        setClienteSelecionado(orcamento.clienteId ? { _id: orcamento.clienteId, nome: orcamento.clienteNome } : null);
        setModoVisualizacao({ tipo: 'orcamento', dados: orcamento });
        setMostrarModalOrcamentos(false);
    }

    const fecharVisualizacao = () => {
        setModoVisualizacao(null);
        setMotivoCancelamento(null);
        setItensSelecionados([]);
        setClienteSelecionado(null);
        setDadosConversaoPendente(null);
        setMostrarConfirmSemEstoque(false);
    }

    const orcamentoExpirado = (orcamento) => moment().isAfter(moment(orcamento.data).add(DIAS_VALIDADE_ORCAMENTO, 'days'));

    const gerarNotaNovamenteVisualizacao = async () => {
        if (!modoVisualizacao || modoVisualizacao.tipo !== 'venda') return;
        const venda = modoVisualizacao.dados;
        setGerandoNotaVisualizacao(true);
        try {
            await gerarEBaixarPdfVenda({
                venda: { vendaId: venda.vendaId, cliente: venda.clienteNome },
                vendedor: { nome: venda.vendedorNome },
                itens: venda.produtos || [],
                pagamentos: venda.pagamento || [],
                dataVenda: venda.data
            });
        } catch (e) {
            console.log('Erro ao gerar PDF da venda', e);
        } finally {
            setGerandoNotaVisualizacao(false);
        }
    }

    const cancelarConversaoSemEstoque = () => {
        setMostrarConfirmSemEstoque(false);
        setDadosConversaoPendente(null);
    }

    const confirmarConversaoSomenteComEstoque = () => {
        if (!dadosConversaoPendente || dadosConversaoPendente.itensComEstoque.length === 0) {
            setMostrarConfirmSemEstoque(false);
            setMsgModal('Nenhum item do orçamento possui estoque disponível.');
            setModalAberto(true);
            return;
        }
        setItensSelecionados(dadosConversaoPendente.itensComEstoque);
        setMostrarConfirmSemEstoque(false);
        abrirFinalizar(dadosConversaoPendente.itensComEstoque);
    }

    const iniciarConversaoOrcamento = () => {
        if (!modoVisualizacao || modoVisualizacao.tipo !== 'orcamento') return;
        const orcamento = modoVisualizacao.dados;

        if (orcamentoExpirado(orcamento)) {
            setMsgModal('Orçamento expirado (mais de 30 dias), não é possível converter em venda.');
            setModalAberto(true);
            return;
        }

        const itens = Array.isArray(orcamento.produtos) ? orcamento.produtos : [];
        if (itens.length === 0) {
            setMsgModal('Orçamento sem itens.');
            setModalAberto(true);
            return;
        }

        setVerificandoConversao(true);
        const produtoIds = itens.map((item) => item.produtoId).filter(Boolean);

        api.post('produtos/estoque-lote', { produtoIds }).then((res) => {
            const estoqueMap = new Map((res.data?.valor || []).map((p) => [p._id, p]));
            const itensSemEstoque = [];
            const itensComEstoque = [];

            itens.forEach((item) => {
                const produtoAtual = estoqueMap.get(item.produtoId);
                const estoqueAtual = produtoAtual?.estoque ?? 0;
                const ehServico = (produtoAtual?.tipo || item.tipo) === 'servico';
                const qtd = item.qtd || 1;

                if (!ehServico && estoqueAtual < qtd) {
                    itensSemEstoque.push({ ...item, estoqueAtual });
                } else {
                    itensComEstoque.push({ ...item, estoque: estoqueAtual });
                }
            });

            if (itensSemEstoque.length === 0) {
                setItensSelecionados(itensComEstoque);
                abrirFinalizar(itensComEstoque);
            } else {
                setDadosConversaoPendente({ itensComEstoque, itensSemEstoque });
                setMostrarConfirmSemEstoque(true);
            }
        }).catch((err) => {
            setMsgModal(err.response?.data?.valor || 'Erro ao verificar estoque dos itens.');
            setModalAberto(true);
        }).finally(() => {
            setVerificandoConversao(false);
        });
    }

    const gerarOrcamento = () => {
        if (itensSelecionadosRef.current.length === 0) {
            setMsgModal('Nenhum item na venda.');
            setModalAberto(true);
            return;
        }

        setGerandoOrcamento(true);

        const payload = {
            userId: usuario?.id,
            tipoVenda: 'pdv',
            user: usuario?.nome,
            produtos: itensSelecionadosRef.current.map((item) => ({
                produtoId: item.produtoId,
                produtoNome: item.produtoNome,
                qtd: item.qtd || 1,
                valorUnitario: item.valorUnitario,
                valorTotal: item.valorTotal,
                desconto: item.desconto || 0,
                valorDoDesconto: item.valorDoDesconto || 0,
                marca: item.marca,
                tipo: item.tipo || 'venda'
            }))
        };

        api.post('orcamento/salvar', payload).then((res) => {
            const orcamentoSalvo = res.data?.valor;
            gerarEBaixarPdfOrcamento({
                orcamento: orcamentoSalvo,
                vendedor: usuario,
                cliente: clienteSelecionado,
                itens: itensSelecionadosRef.current,
                dataOrcamento: orcamentoSalvo?.data
            }).catch((err) => console.log('Erro ao gerar PDF do orçamento', err));
            limparBag();
            setMsgModal('Orçamento salvo com sucesso!');
            setModalAberto(true);
        }).catch((err) => {
            setMsgModal(err.response?.data?.valor || 'Erro ao salvar orçamento.');
            setModalAberto(true);
        }).finally(() => {
            setGerandoOrcamento(false);
        });
    }

    const abrirModalVendedorManual = () => {
        setItensPendentesAposVendedor(null);
        setMostrarModalVendedor(true);
    }

    const vendedorSelecionadoConfirmado = (vendedor) => {
        setVendedorSelecionado(vendedor);
        setMostrarModalVendedor(false);

        const itensPendentes = itensPendentesAposVendedor;
        setItensPendentesAposVendedor(null);

        const acaoPendente = acaoAposVendedorRef.current;
        acaoAposVendedorRef.current = null;

        if (itensPendentes) {
            abrirFinalizar(itensPendentes);
        } else if (acaoPendente) {
            acaoPendente();
        }
    }

    const solicitarAutenticacaoAdmin = ({ descricao, permissao, onSucesso }) => {
        setAutenticacaoPendente({ descricao, permissao, onSucesso });
        setMostrarModalAutenticacao(true);
    }

    const percentualParaTexto = (valor) => (valor ? String(arredondar(valor)).replace('.', ',') : '');

    const abrirModalDesconto = (escopo = 'venda', index = null) => {
        if (modoVisualizacaoRef.current) return;
        const itens = itensSelecionadosRef.current;
        if (itens.length === 0) {
            setMsgModal('Nenhum item na venda.');
            setModalAberto(true);
            return;
        }

        const alvo = escopo === 'item' ? [itens[index]] : itens;
        if (!alvo[0]) return;
        if (alvo.every(ehServico)) {
            setMsgModal('Serviço não recebe desconto.');
            setModalAberto(true);
            return;
        }

        const base = subtotalVenda(alvo);
        const descontoAtual = descontoTotalVenda(alvo);
        setTipoDesconto('percentual');
        setEntradaDesconto(base > 0 && descontoAtual > 0 ? percentualParaTexto((descontoAtual / base) * 100) : '');
        setModalDesconto(escopo === 'item' ? { escopo, index } : { escopo: 'venda' });
    }

    const trocarTipoDesconto = (tipo) => {
        if (tipo === tipoDesconto) return;
        const pedido = calcularDescontoPedido();
        const base = calcularBaseDesconto();
        setTipoDesconto(tipo);
        if (tipo === 'valor') {
            setEntradaDesconto(pedido > 0 ? numeroParaDigitos(pedido) : '');
        } else {
            setEntradaDesconto(base > 0 && pedido > 0 ? percentualParaTexto((pedido / base) * 100) : '');
        }
    }

    const alterarEntradaDesconto = (texto) => {
        if (tipoDesconto === 'valor') {
            setEntradaDesconto(texto.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9));
            return;
        }
        // Só dígitos e uma vírgula, com até 2 casas, limitado a 100.
        let limpo = texto.replace('.', ',').replace(/[^\d,]/g, '');
        const [inteiro, ...resto] = limpo.split(',');
        limpo = resto.length ? `${inteiro},${resto.join('').slice(0, 2)}` : inteiro;
        if (parseFloat(limpo.replace(',', '.')) > 100) limpo = '100';
        setEntradaDesconto(limpo);
    }

    const itensDoEscopo = (escopo = modalDesconto) => {
        if (!escopo) return [];
        const itens = itensSelecionadosRef.current;
        return escopo.escopo === 'item' ? [itens[escopo.index]].filter(Boolean) : itens;
    }

    const calcularBaseDesconto = () => subtotalVenda(itensDoEscopo());

    // Desconto pedido em R$, a partir do que foi digitado.
    const calcularDescontoPedido = () => {
        if (tipoDesconto === 'valor') return digitosParaNumero(entradaDesconto);
        const percentual = parseFloat(String(entradaDesconto).replace(',', '.')) || 0;
        return arredondar(calcularBaseDesconto() * (percentual / 100));
    }

    const efetivarDesconto = ({ escopo, index }, valor, admin = null) => {
        const autorizado = Boolean(admin);
        setItensSelecionados((itens) => (
            escopo === 'item'
                ? itens.map((item, i) => (i === index ? aplicarValorNoItem(item, Math.min(valor, tetoItem(item, autorizado)), autorizado) : item))
                : aplicarDescontoNaVenda(itens, valor, autorizado)
        ));
        setModalDesconto(null);
        setLimiteDesconto(null);

        if (admin?.token) {
            const alvo = escopo === 'item' ? `no item "${itensSelecionadosRef.current[index]?.produtoNome}"` : 'na venda';
            api.post('auditoria', {
                tipo: 'desconto_aplicado',
                detalhes: `Desconto de R$ ${valor.toFixed(2).replace('.', ',')} ${alvo}, acima do teto, autorizado por administrador.`
            }, {
                headers: { Authorization: `Bearer ${admin.token}` }
            }).catch((err) => console.log('Erro ao registrar auditoria do desconto', err));
        }
    }

    const confirmarDesconto = () => {
        if (!modalDesconto) return;
        const itens = itensDoEscopo();
        const pedido = calcularDescontoPedido();
        const teto = modalDesconto.escopo === 'item' ? tetoItem(itens[0]) : tetoVenda(itens);

        if (pedido <= 0) {
            efetivarDesconto(modalDesconto, 0);
            return;
        }

        if (pedido > teto + 0.005) {
            setLimiteDesconto({ ...modalDesconto, pedido, possivel: teto });
            return;
        }

        efetivarDesconto(modalDesconto, pedido);
    }

    const removerDesconto = () => {
        if (!modalDesconto) return;
        efetivarDesconto(modalDesconto, 0);
    }

    const aplicarDescontoPossivel = () => {
        if (!limiteDesconto) return;
        efetivarDesconto(limiteDesconto, limiteDesconto.possivel);
    }

    // Acima do teto: administrador autoriza com login e senha (permissão vendas/autorizar_desconto).
    const liberarDescontoComAdmin = () => {
        if (!limiteDesconto) return;
        const pendente = limiteDesconto;
        setLimiteDesconto(null);
        setModalDesconto(null);
        solicitarAutenticacaoAdmin({
            descricao: `Autorização de administrador para desconto de R$ ${pendente.pedido.toFixed(2).replace('.', ',')} (máximo permitido: R$ ${pendente.possivel.toFixed(2).replace('.', ',')}).`,
            permissao: ['vendas', 'autorizar_desconto'],
            onSucesso: (admin) => efetivarDesconto(pendente, pendente.pedido, admin)
        });
    }

    const abrirAuditoria = () => {
        solicitarAutenticacaoAdmin({
            descricao: 'Autorização de administrador para visualizar a auditoria.',
            permissao: ['auditoria', 'visualizar'],
            onSucesso: (admin) => {
                setAuditoriaToken(admin.token);
                setMostrarModalAuditoria(true);
            }
        });
    }

    const cancelarVendaAtual = () => {
        if (!modoVisualizacao || modoVisualizacao.tipo !== 'venda') return;
        setErroMotivoCancelamento('');
        setMotivoCancelamento('');
    }

    // O motivo vem antes da senha do administrador; ele autoriza já sabendo o porquê.
    const confirmarMotivoCancelamento = (e) => {
        e.preventDefault();
        const motivo = (motivoCancelamento || '').trim();
        if (!motivo) {
            setErroMotivoCancelamento('Informe o motivo do cancelamento.');
            return;
        }
        setMotivoCancelamento(null);
        if (!modoVisualizacao || modoVisualizacao.tipo !== 'venda') return;
        const venda = modoVisualizacao.dados;

        solicitarAutenticacaoAdmin({
            descricao: `Autorização de administrador para cancelar a Venda Nº ${venda.vendaId}. Motivo: ${motivo}`,
            permissao: ['vendas', 'cancelar'],
            onSucesso: (admin) => {
                setCancelandoVenda(true);
                api.post(`venda/${obterIdRegistro(venda)}/cancelar`, { motivo }, {
                    headers: { Authorization: `Bearer ${admin.token}` }
                }).then(() => {
                    setMsgModal('Venda cancelada com sucesso.');
                    setModalAberto(true);
                    fecharVisualizacao();
                }).catch((err) => {
                    setMsgModal(err.response?.data?.valor || 'Erro ao cancelar venda.');
                    setModalAberto(true);
                }).finally(() => {
                    setCancelandoVenda(false);
                });
            }
        });
    }

    const abrirFinalizar = (itensParaFinalizar, osJaSalva = false) => {
        // OS: grava os itens atuais antes de cobrar, porque o back finaliza pelo que está salvo.
        if (osAtualRef.current && !osJaSalva) {
            salvarItensOS().then((ok) => { if (ok) abrirFinalizar(null, true); });
            return;
        }

        const itens = Array.isArray(itensParaFinalizar) ? itensParaFinalizar : itensSelecionadosRef.current;

        if (itens.length === 0) {
            setMsgModal('Nenhum item na venda.');
            setModalAberto(true);
            return;
        }

        if (!vendedorSelecionadoRef.current) {
            setItensPendentesAposVendedor(itens);
            setMostrarModalVendedor(true);
            return;
        }

        const totalComDesconto = arredondar(itens.reduce((total, item) => total + calcularTotalItem(item), 0));

        setMsgFinalizar('');
        setPagamentosAdicionados([]);
        setMetodoAtual('dinheiro');
        setParcelasCredito(1);
        setTaxaManualDigitos('');
        setEditandoTaxa(false);
        setValorPagamentoAtual(numeroParaDigitos(totalComDesconto));
        setMostrarModalFinalizar(true);
    }

    // ---- Ordem de serviço ----
    const itemParaOS = (item) => ({
        ...item,
        qtd: Number(item.qtd) || 1,
        tipo: ehServico(item) ? 'servico' : (item.tipo || 'venda'),
        valorTotal: Number(item.valorTotal) || 0,
    });

    const mensagemItensSemEstoque = (lista) => (
        'Estes itens não entraram na OS por falta de estoque:\n' +
        lista.map((i) => `• ${i.nome || i.produtoId}${i.disponivel !== undefined ? ` (disponível: ${i.disponivel})` : ''}`).join('\n')
    );

    const limparEstadoOS = () => {
        setOsAtual(null);
        limparBag();
        setClienteSelecionado(null);
        setVendedorSelecionado(null);
    };

    const iniciarAberturaOS = () => {
        if (modoVisualizacaoRef.current || osAtualRef.current) return;
        if (!vendedorSelecionadoRef.current) {
            acaoAposVendedorRef.current = () => setMostrarModalAbrirOS(true);
            setMostrarModalVendedor(true);
            return;
        }
        setMostrarModalAbrirOS(true);
    };

    const confirmarAberturaOS = (dados) => {
        const vendedor = vendedorSelecionadoRef.current;
        if (!vendedor) return;
        const itens = itensSelecionadosRef.current.map(itemParaOS);
        const cliente = clienteSelecionado;

        setSalvandoOS(true);
        api.post('ordem-servico/salvar', {
            placa: dados.placa,
            marca: dados.marca,
            modelo: dados.modelo,
            cor: dados.cor,
            quilometragem: dados.km,
            servicoASerExecutado: dados.servicoASerExecutado,
            checkList: dados.checkList,
            produtos: itens,
            valorTotal: arredondar(itens.reduce((t, i) => t + i.valorTotal, 0)),
            mecanico: [],
            status: 'aberto',
            vendedorId: vendedor.id,
            vendedorNome: vendedor.nome,
            ...(obterIdCliente(cliente) ? { clienteId: obterIdCliente(cliente), clienteNome: cliente.nome } : {}),
        }).then(async (res) => {
            let ordem = res.data?.valor?.ordem;
            const semEstoque = res.data?.valor?.itensSemEstoque || [];

            // Itens recusados por estoque saem da OS, mas o valorTotal salvo ainda os conta: recalcula.
            if (semEstoque.length > 0 && ordem?._id) {
                const r = await api.post('ordem-servico/itens', {
                    _id: ordem._id,
                    itens: ordem.produtos || [],
                    usuarioId: usuario?.id,
                    usuarioNome: usuario?.nome,
                });
                ordem = r.data?.valor?.ordem || ordem;
            }

            setMostrarModalAbrirOS(false);

            // Volta para o carrinho já em modo OS: daí o balconista adiciona itens,
            // salva e libera o PDV (F9) ou finaliza (F3).
            if (ordem) {
                setOsAtual(ordem);
                osAtualRef.current = ordem;
                setItensSelecionados(ordem.produtos || []);
                itensSelecionadosRef.current = ordem.produtos || [];
            }
            setMsgModal(`OS Nº ${ordem?.ordemServicoId ?? ''} criada.` + (semEstoque.length > 0 ? `\n\n${mensagemItensSemEstoque(semEstoque)}` : ''));
            setModalAberto(true);
        }).catch((err) => {
            setMsgModal(err.response?.data?.valor || 'Erro ao abrir a ordem de serviço.');
            setModalAberto(true);
        }).finally(() => setSalvandoOS(false));
    };

    // Com OS aberta, trocar/remover o cliente grava na própria OS.
    const alterarCliente = (cliente) => {
        const ordem = osAtualRef.current;
        if (!ordem) {
            setClienteSelecionado(cliente);
            return;
        }
        const clienteId = obterIdCliente(cliente);
        const anterior = clienteSelecionado;
        setClienteSelecionado(cliente);
        api.post('ordem-servico/atualizar', {
            _id: ordem._id,
            clienteId: clienteId || '',
            clienteNome: clienteId ? cliente.nome : '',
            usuarioId: usuario?.id,
            usuarioNome: usuario?.nome,
        }).then((res) => {
            const atualizada = res.data?.valor?.ordem;
            if (atualizada) {
                setOsAtual(atualizada);
                osAtualRef.current = atualizada;
            }
        }).catch((err) => {
            setClienteSelecionado(anterior);
            setMsgModal(err.response?.data?.valor || 'Erro ao alterar o cliente da OS.');
            setModalAberto(true);
        });
    };

    const carregarOS = (ordem) => {
        if (itensSelecionadosRef.current.length > 0) {
            setMsgModal('Finalize ou limpe a venda atual antes de abrir uma OS.');
            setModalAberto(true);
            return;
        }
        setMostrarModalListarOS(false);
        setOsAtual(ordem);
        setItensSelecionados(Array.isArray(ordem.produtos) ? ordem.produtos : []);
        setClienteSelecionado(ordem.clienteId ? { _id: ordem.clienteId, nome: ordem.clienteNome } : null);
        setVendedorSelecionado(ordem.vendedorId ? { id: ordem.vendedorId, nome: ordem.vendedorNome } : null);
    };

    // Grava a lista atual de itens na OS. Devolve true se entrou tudo.
    const salvarItensOS = () => {
        const ordem = osAtualRef.current;
        if (!ordem) return Promise.resolve(false);
        setSalvandoOS(true);
        return api.post('ordem-servico/itens', {
            _id: ordem._id,
            itens: itensSelecionadosRef.current.map(itemParaOS),
            usuarioId: usuario?.id,
            usuarioNome: usuario?.nome,
        }).then((res) => {
            const atualizada = res.data?.valor?.ordem;
            const semEstoque = res.data?.valor?.itensSemEstoque || [];
            if (atualizada) {
                setOsAtual(atualizada);
                osAtualRef.current = atualizada;
                setItensSelecionados(atualizada.produtos || []);
                itensSelecionadosRef.current = atualizada.produtos || [];
            }
            if (semEstoque.length > 0) {
                setMsgModal(mensagemItensSemEstoque(semEstoque));
                setModalAberto(true);
                return false;
            }
            return true;
        }).catch((err) => {
            setMsgModal(err.response?.data?.valor || 'Erro ao salvar os itens da OS.');
            setModalAberto(true);
            return false;
        }).finally(() => setSalvandoOS(false));
    };

    const salvarOSeLiberar = () => {
        const ordem = osAtualRef.current;
        if (!ordem) return;
        salvarItensOS().then((ok) => {
            if (!ok) return;
            limparEstadoOS();
            setMsgModal(`OS Nº ${ordem.ordemServicoId ?? ''} salva. PDV liberado.`);
            setModalAberto(true);
        });
    };

    // Cancelar OS: motivo primeiro, depois o administrador autoriza (mesmo fluxo de cancelar venda).
    // O back devolve o estoque reservado e mantém a OS no histórico como cancelada.
    const iniciarCancelamentoOS = () => {
        if (!osAtualRef.current) return;
        setErroMotivoOS('');
        setMotivoCancelamentoOS('');
    };

    const confirmarMotivoCancelamentoOS = (e) => {
        e.preventDefault();
        const motivo = (motivoCancelamentoOS || '').trim();
        if (!motivo) {
            setErroMotivoOS('Informe o motivo do cancelamento.');
            return;
        }
        setMotivoCancelamentoOS(null);
        const ordem = osAtualRef.current;
        if (!ordem) return;

        solicitarAutenticacaoAdmin({
            descricao: `Autorização de administrador para cancelar a OS Nº ${ordem.ordemServicoId}. Motivo: ${motivo}`,
            permissao: ['ordem_servico', 'cancelar'],
            onSucesso: (admin) => {
                setSalvandoOS(true);
                api.post('ordem-servico/cancelar', {
                    _id: ordem._id,
                    motivo,
                    usuarioId: admin.id,
                    usuarioNome: admin.nome,
                }, {
                    headers: { Authorization: `Bearer ${admin.token}` }
                }).then(() => {
                    limparEstadoOS();
                    setMsgModal(`OS Nº ${ordem.ordemServicoId} cancelada. O estoque reservado foi devolvido.`);
                    setModalAberto(true);
                }).catch((err) => {
                    setMsgModal(err.response?.data?.valor || 'Erro ao cancelar a OS.');
                    setModalAberto(true);
                }).finally(() => setSalvandoOS(false));
            }
        });
    };

    const sairDaOSSemSalvar = () => {
        limparEstadoOS();
    };

    const calcularFaltante = (lista = pagamentosAdicionados) => {
        const totalPago = lista.reduce((total, p) => total + p.valor, 0);
        return arredondar(calcularTotalVenda() - totalPago);
    }

    const adicionarPagamento = () => {
        const valor = digitosParaNumero(valorPagamentoAtual);

        if (!valor || valor <= 0) {
            setMsgFinalizar('Informe um valor válido.');
            return;
        }

        if (metodoAtual === 'faturado' && !obterIdCliente(clienteSelecionado)) {
            setMsgFinalizar('Selecione um cliente para faturar.');
            return;
        }

        const faltanteAtual = calcularFaltante();
        if (faltanteAtual <= 0) return;

        // Só permite passar do faltante (e calcular troco) quando for dinheiro
        // e for o único pagamento da venda até agora.
        const permiteExcedente = metodoAtual === 'dinheiro' && pagamentosAdicionados.length === 0;

        if (!permiteExcedente && valor > faltanteAtual + 0.001) {
            setMsgFinalizar('Valor não pode ser maior que o faltante.');
            return;
        }

        const valorAplicado = Math.min(valor, faltanteAtual);
        const troco = permiteExcedente ? arredondar(Math.max(0, valor - faltanteAtual)) : 0;
        const qtdParcelas = metodoAtual === 'credito' ? parcelasCredito : 1;
        const valorTaxaManual = editandoTaxa && taxaManualDigitos !== ''
            ? digitosParaNumero(taxaManualDigitos)
            : undefined;

        if (valorTaxaManual !== undefined && valorTaxaManual > valorAplicado) {
            setMsgFinalizar('A taxa não pode ser maior que o valor do pagamento.');
            return;
        }

        // Cartão sem taxa cadastrada nem taxa manual não entra na venda.
        const taxaCalculada = calcularTaxaPagamento(taxasPagamento, {
            metodo: metodoAtual,
            valor: valorAplicado,
            qtdParcelas,
            valorTaxaManual
        });

        if (taxaCalculada.exigeTaxa && !taxaCalculada.taxaCadastrada) {
            setMsgFinalizar(mensagemTaxaPendente(metodoAtual, qtdParcelas));
            return;
        }

        const novoPagamento = {
            metodo: metodoAtual,
            valor: arredondar(valorAplicado),
            valorRecebido: arredondar(valor),
            troco,
            qtdParcelas,
            valorTaxa: taxaCalculada.valorTaxa,
            valorLiquido: taxaCalculada.valorLiquido,
            percentualTaxa: taxaCalculada.percentual,
            taxaManual: taxaCalculada.taxaManual,
            ...(valorTaxaManual !== undefined ? { valorTaxaManual } : {})
        };

        if (metodoAtual === 'credito') {
            novoPagamento.tipoCredito = qtdParcelas === 1 ? 'avista' : 'parcelado';
            novoPagamento.descricaoMetodo = qtdParcelas === 1 ? 'Crédito à vista (1x)' : `Crédito parcelado (${qtdParcelas}x)`;
        }

        const novaLista = [...pagamentosAdicionados, novoPagamento];
        setPagamentosAdicionados(novaLista);
        setMsgFinalizar('');
        setParcelasCredito(1);
        setTaxaManualDigitos('');
        setEditandoTaxa(false);

        const novoFaltante = calcularFaltante(novaLista);
        setValorPagamentoAtual(novoFaltante > 0 ? numeroParaDigitos(novoFaltante) : '');
    }

    // Resumo de taxa/líquido dos pagamentos já adicionados.
    const resumoTaxas = calcularTaxasPagamentos(taxasPagamento, pagamentosAdicionados);

    const montarPagamentoPayload = (p) => ({
        metodo: p.metodo,
        valor: p.valor,
        ...(typeof p.valorTaxaManual === 'number' ? { valorTaxaManual: p.valorTaxaManual } : {}),
        ...(p.metodo === 'credito'
            ? {
                qtdParcelas: p.qtdParcelas || 1,
                tipoCredito: p.tipoCredito || ((p.qtdParcelas || 1) === 1 ? 'avista' : 'parcelado'),
                descricaoMetodo: p.descricaoMetodo
            }
            : {})
    });

    const removerPagamento = (index) => {
        const novaLista = pagamentosAdicionados.filter((_, i) => i !== index);
        setPagamentosAdicionados(novaLista);

        const novoFaltante = calcularFaltante(novaLista);
        setValorPagamentoAtual(novoFaltante > 0 ? numeroParaDigitos(novoFaltante) : '');
        setMsgFinalizar('');
    }

    const finalizarVenda = () => {
        if (itensSelecionados.length === 0) {
            setMsgFinalizar('Nenhum item na venda.');
            return;
        }

        if (pagamentosAdicionados.length === 0 || calcularFaltante() > 0.001) {
            setMsgFinalizar('Adicione pagamentos até cobrir o valor total.');
            return;
        }

        // Revalida contra as taxas carregadas antes de mandar pro backend.
        if (resumoTaxas.pendentes.length > 0) {
            setMsgFinalizar(mensagemTaxasPendentes(resumoTaxas.pendentes));
            return;
        }

        setMsgFinalizar('');
        setFinalizando(true);

        const clienteId = obterIdCliente(clienteSelecionado);
        const total = calcularTotalVenda();
        const produtosPayload = itensSelecionados.map((item) => ({
            produtoId: item.produtoId,
            produtoNome: item.produtoNome,
            qtd: item.qtd || 1,
            valorUnitario: item.valorUnitario,
            valorTotal: item.valorTotal,
            desconto: item.desconto || 0,
            valorDoDesconto: item.valorDoDesconto || 0,
            marca: item.marca,
            tipo: item.tipo || 'venda'
        }));

        const emConversaoOrcamento = modoVisualizacao?.tipo === 'orcamento';
        const orcamentoAtual = emConversaoOrcamento ? modoVisualizacao.dados : null;
        const ordemAtual = osAtual;

        // Na conversão de orçamento, preço/qtd vêm sempre do orçamento salvo no servidor;
        // o front só informa QUAIS produtoIds entram (ex: itens sem estoque ficam de fora).
        const requisicao = ordemAtual
            ? api.post('ordem-servico/finalizar', {
                _id: ordemAtual._id,
                pagamento: pagamentosAdicionados.map(montarPagamentoPayload),
            })
            : emConversaoOrcamento
            ? api.post(`orcamento/${obterIdRegistro(orcamentoAtual)}/finalizar`, {
                pagamento: pagamentosAdicionados.map(montarPagamentoPayload),
                produtoIdsIncluidos: itensSelecionados.map((item) => item.produtoId),
                // Só tem efeito quando o token é de administrador (venda em nome de outro vendedor).
                ...(vendedorSelecionado?.id ? { vendedorId: vendedorSelecionado.id } : {}),
                ...(clienteId ? { clienteId } : {})
            }, {
                headers: vendedorSelecionado?.token ? { Authorization: `Bearer ${vendedorSelecionado.token}` } : undefined
            })
            : api.post('venda', {
                vendedorId: vendedorSelecionado?.id,
                vendedorNome: vendedorSelecionado?.nome,
                tipoVenda: 'pdv',
                status: 'finalizado',
                pagamento: pagamentosAdicionados.map(montarPagamentoPayload),
                produtos: produtosPayload,
                valor: total,
                ...(clienteId ? { clienteId } : {})
            });

        requisicao.then((res) => {
            const vendaSalva = emConversaoOrcamento ? res.data?.valor?.venda : res.data?.valor;
            setDadosParaNota({
                venda: {
                    vendaId: ordemAtual ? `OS ${ordemAtual.ordemServicoId}` : vendaSalva?.vendaId,
                    cliente: clienteSelecionado?.nome
                },
                vendedorNome: vendedorSelecionado?.nome,
                itens: itensSelecionados,
                pagamentos: pagamentosAdicionados.map((p) => ({ metodo: p.metodo, valor: p.valor, valorRecebido: p.valorRecebido, troco: p.troco })),
                data: vendaSalva?.data
            });
            setMostrarModalFinalizar(false);
            setMetodoAtual('dinheiro');
            setParcelasCredito(1);
            setTaxaManualDigitos('');
            setEditandoTaxa(false);
            setPagamentosAdicionados([]);
            limparBag();
            setClienteSelecionado(null);
            setModoVisualizacao(null);
            setOsAtual(null);
            setDadosConversaoPendente(null);
            setVendedorSelecionado(null);
            setMostrarPerguntaNota(true);
        }).catch((err) => {
            setMsgFinalizar(err.response?.data?.valor || (ordemAtual ? 'Erro ao finalizar a ordem de serviço.' : emConversaoOrcamento ? 'Erro ao converter orçamento em venda.' : 'Erro ao finalizar venda.'));
        }).finally(() => {
            setFinalizando(false);
        });
    }

    const fecharPerguntaNota = () => {
        setMostrarPerguntaNota(false);
        setDadosParaNota(null);
    }

    const naoGerarNota = () => {
        fecharPerguntaNota();
    }

    const simGerarNota = async () => {
        if (!dadosParaNota) return;
        setGerandoNota(true);
        try {
            await gerarEBaixarPdfVenda({
                venda: dadosParaNota.venda,
                vendedor: { nome: dadosParaNota.vendedorNome },
                itens: dadosParaNota.itens,
                pagamentos: dadosParaNota.pagamentos,
                dataVenda: dadosParaNota.data
            });
        } catch (e) {
            console.log('Erro ao gerar PDF da venda', e);
        } finally {
            setGerandoNota(false);
            fecharPerguntaNota();
        }
    }

    const removerItem = (index) => {
        setItensSelecionados((itens) => itens.filter((_, i) => i !== index))
    }

    const alterarQuantidadeItem = (index, valorInput) => {
        const numeros = valorInput.replace(/[^\d]/g, '');
        // Vazio é permitido enquanto digita; normalizarQuantidadeItem volta para 1 no blur.
        let qtd = numeros === '' ? '' : parseInt(numeros, 10);

        if (qtd !== '' && qtd < 1) qtd = 1;

        setItensSelecionados((itens) => itens.map((item, i) => {
            if (i !== index) return item;

            // Serviço não tem estoque real (o back só conta vendas), então não limita.
            const ehServico = item.ehServico || item.tipo === 'servico';
            if (qtd !== '' && !ehServico && item.estoque && qtd > item.estoque) {
                qtd = item.estoque;

                clearTimeout(avisoQtdTimeoutRef.current);
                setAvisoQtd({ index, mensagem: `Estoque disponível: ${item.estoque}` });
                avisoQtdTimeoutRef.current = setTimeout(() => setAvisoQtd(null), 3000);
            } else if (avisoQtd?.index === index) {
                clearTimeout(avisoQtdTimeoutRef.current);
                setAvisoQtd(null);
            }

            return recalcularItem({ ...item, qtd });
        }))
    }

    const normalizarQuantidadeItem = (index) => {
        setItensSelecionados((itens) => itens.map((item, i) => (
            i === index && item.qtd === ''
                ? recalcularItem({ ...item, qtd: 1 })
                : item
        )))
    }

    // valorTotal do item já é o líquido (subtotal - desconto do item).
    const calcularTotalItem = (item) => Number(item.valorTotal) || 0;

    const calcularTotalVenda = () => {
        return arredondar(itensSelecionados.reduce((total, item) => total + calcularTotalItem(item), 0));
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
                        <div className="info-line cliente-info">
                            <span className="info-label">Vendedor:</span>
                            {vendedorSelecionado ? (
                                <div className="cliente-valor-linha">
                                    <span className="info-value" title={vendedorSelecionado.autorizadoPor ? `Escolhido pelo administrador ${vendedorSelecionado.autorizadoPor.nome}` : undefined}>
                                        {vendedorSelecionado.nome}{vendedorSelecionado.autorizadoPor ? ' (via admin)' : ''}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn-remover-cliente"
                                        onClick={() => setVendedorSelecionado(null)}
                                        aria-label="Remover vendedor"
                                        title="Remover vendedor"
                                    >
                                        &times;
                                    </button>
                                </div>
                            ) : (
                                <button type="button" className="btn-selecionar-vendedor" onClick={abrirModalVendedorManual}>
                                    Selecionar
                                </button>
                            )}
                        </div>
                        {clienteSelecionado && (
                            <div className="info-line cliente-info">
                                <span className="info-label">Cliente:</span>
                                <div className="cliente-valor-linha">
                                    <span className="info-value">{clienteSelecionado.nome}</span>
                                    <button
                                        type="button"
                                        className="btn-remover-cliente"
                                        onClick={() => alterarCliente(null)}
                                        aria-label="Remover cliente"
                                        title="Remover cliente"
                                    >
                                        &times;
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="menu-atalhos">
                    <h3>Atalhos</h3>
                    {osAtual ? (
                        <ul>
                            <li>
                                <button className="atalho-btn" onClick={() => setMostraModal(true)} disabled={salvandoOS}>
                                    <span className="atalho-key">F1</span>
                                    <span className="atalho-label">Adicionar item</span>
                                </button>
                            </li>
                            <li>
                                <button className="atalho-btn" onClick={() => abrirFinalizar()} disabled={salvandoOS}>
                                    <span className="atalho-key">F3</span>
                                    <span className="atalho-label">Finalizar OS</span>
                                </button>
                            </li>
                            <li>
                                <button className="atalho-btn" onClick={() => abrirModalDesconto('venda')} disabled={salvandoOS}>
                                    <span className="atalho-key">F8</span>
                                    <span className="atalho-label">Desconto</span>
                                </button>
                            </li>
                            <li>
                                <button className="atalho-btn" onClick={salvarOSeLiberar} disabled={salvandoOS}>
                                    <span className="atalho-key">F9</span>
                                    <span className="atalho-label">{salvandoOS ? 'Salvando...' : 'Salvar e liberar'}</span>
                                </button>
                            </li>
                            <li>
                                <button className="atalho-btn" onClick={sairDaOSSemSalvar} disabled={salvandoOS}>
                                    <span className="atalho-label">Sair sem salvar</span>
                                </button>
                            </li>
                            <li>
                                <button className="atalho-btn atalho-btn-perigo" onClick={iniciarCancelamentoOS} disabled={salvandoOS}>
                                    <span className="atalho-label">Cancelar OS</span>
                                </button>
                            </li>
                        </ul>
                    ) : modoVisualizacao ? (
                        <ul>
                            <li>
                                <button className="atalho-btn" onClick={fecharVisualizacao}>
                                    <span className="atalho-key">Esc</span>
                                    <span className="atalho-label">Fechar</span>
                                </button>
                            </li>
                            {modoVisualizacao.tipo === 'venda' && (
                                <li>
                                    <button className="atalho-btn" onClick={gerarNotaNovamenteVisualizacao} disabled={gerandoNotaVisualizacao}>
                                        <span className="atalho-label">{gerandoNotaVisualizacao ? 'Gerando...' : 'Gerar nota novamente'}</span>
                                    </button>
                                </li>
                            )}
                            {modoVisualizacao.tipo === 'venda' && modoVisualizacao.dados.status !== 'cancelado' && (
                                <li>
                                    <button className="atalho-btn atalho-btn-perigo" onClick={cancelarVendaAtual} disabled={cancelandoVenda}>
                                        <span className="atalho-label">{cancelandoVenda ? 'Cancelando...' : 'Cancelar venda'}</span>
                                    </button>
                                </li>
                            )}
                            {modoVisualizacao.tipo === 'orcamento' && modoVisualizacao.dados.status !== 'finalizado' && (
                                <li>
                                    <button
                                        className="atalho-btn"
                                        onClick={iniciarConversaoOrcamento}
                                        disabled={verificandoConversao || orcamentoExpirado(modoVisualizacao.dados)}
                                        title={orcamentoExpirado(modoVisualizacao.dados) ? 'Orçamento expirado (mais de 30 dias)' : undefined}
                                    >
                                        <span className="atalho-label">{verificandoConversao ? 'Verificando estoque...' : 'Converter p/ venda'}</span>
                                    </button>
                                </li>
                            )}
                        </ul>
                    ) : (
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
                                <button className="atalho-btn" onClick={abrirFinalizar}>
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
                            <li>
                                <button className="atalho-btn" onClick={() => setMostrarModalVendas(true)}>
                                    <span className="atalho-key">F5</span>
                                    <span className="atalho-label">Vendas</span>
                                </button>
                            </li>
                            <li>
                                <button className="atalho-btn" onClick={gerarOrcamento} disabled={gerandoOrcamento}>
                                    <span className="atalho-key">F6</span>
                                    <span className="atalho-label">{gerandoOrcamento ? 'Salvando...' : 'Orçamento'}</span>
                                </button>
                            </li>
                            <li>
                                <button className="atalho-btn" onClick={() => setMostrarModalOrcamentos(true)}>
                                    <span className="atalho-key">F7</span>
                                    <span className="atalho-label">Lista Orç.</span>
                                </button>
                            </li>
                            <li>
                                <button className="atalho-btn" onClick={() => abrirModalDesconto('venda')}>
                                    <span className="atalho-key">F8</span>
                                    <span className="atalho-label">Desconto</span>
                                </button>
                            </li>
                            <li>
                                <button className="atalho-btn" onClick={iniciarAberturaOS}>
                                    <span className="atalho-key">F9</span>
                                    <span className="atalho-label">Abrir OS</span>
                                </button>
                            </li>
                            <li>
                                <button className="atalho-btn" onClick={() => setMostrarModalListarOS(true)}>
                                    <span className="atalho-key">F10</span>
                                    <span className="atalho-label">OS abertas</span>
                                </button>
                            </li>
                            <li>
                                <button className="atalho-btn" onClick={() => setMostrarModalFaturados(true)}>
                                    <span className="atalho-label">Faturados</span>
                                </button>
                            </li>
                            <li>
                                <button className="atalho-btn" onClick={abrirAuditoria}>
                                    <span className="atalho-label">Auditoria</span>
                                </button>
                            </li>
                        </ul>
                    )}
                </div>

                <div className="menu-footer">
                    <button className="btn-sair" onClick={sair}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        <span>Sair</span>
                    </button>
                </div>
            </aside>

            {/* Área Principal */}
            <main className="pdv-main">
                {osAtual && (
                    <div className="visualizacao-banner">
                        <span>
                            <strong>OS Nº {osAtual.ordemServicoId}</strong> · {osAtual.placa}
                            {[osAtual.marca, osAtual.modelo, osAtual.cor].filter(Boolean).length > 0 ? ` · ${[osAtual.marca, osAtual.modelo, osAtual.cor].filter(Boolean).join(' ')}` : ''}
                            {osAtual.km ? ` · ${osAtual.km} km` : ''}
                            {` — aberta em ${moment(osAtual.dataAbertura || osAtual.createdAt).format('DD/MM/YYYY HH:mm')}. Adicione itens e use "Salvar e liberar" ou "Finalizar OS".`}
                        </span>
                    </div>
                )}
                {modoVisualizacao && (
                    <div className="visualizacao-banner">
                        {modoVisualizacao.tipo === 'venda' ? (
                            <span>
                                Visualizando <strong>Venda Nº {modoVisualizacao.dados.vendaId}</strong> de {moment(modoVisualizacao.dados.data).format('DD/MM/YYYY HH:mm')} — somente leitura.
                            </span>
                        ) : (
                            <span>
                                Visualizando <strong>Orçamento Nº {modoVisualizacao.dados.orcamentoId}</strong> de {moment(modoVisualizacao.dados.data).format('DD/MM/YYYY HH:mm')}
                                {modoVisualizacao.dados.status === 'finalizado'
                                    ? ' — já convertido em venda.'
                                    : orcamentoExpirado(modoVisualizacao.dados)
                                        ? ' — expirado (mais de 30 dias).'
                                        : ` — válido até ${moment(modoVisualizacao.dados.data).add(DIAS_VALIDADE_ORCAMENTO, 'days').format('DD/MM/YYYY')}.`}
                            </span>
                        )}
                    </div>
                )}
                <div className="tabela-container">
                    {itensSelecionados.length === 0 ? (
                        <div className="tabela-vazia">
                            <strong>Nenhum item na venda</strong>
                            <span>Pressione F1 ou use o atalho "Pesquisar" para adicionar produtos.</span>
                        </div>
                    ) : (
                        <table className="tabela-venda">
                            <thead>
                                <tr>
                                    <th width="40%">Produto</th>
                                    <th width="10%">Qtd</th>
                                    <th width="15%">Unitário</th>
                                    <th width="15%">Desconto (%)</th>
                                    <th width="15%">Total</th>
                                    <th width="5%"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {itensSelecionados.map((item, index) => (
                                    <tr key={index}>
                                        <td>
                                            <div className="produto-info">
                                                <span className="produto-nome">{item.produtoNome}</span>
                                                {item.marca && <span className="produto-marca">{item.marca}</span>}
                                            </div>
                                        </td>
                                        <td className="text-center">
                                            <div className="qtd-input-wrapper">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={item.qtd ?? 1}
                                                    onFocus={(e) => e.target.select()}
                                                    onBlur={() => normalizarQuantidadeItem(index)}
                                                    onChange={(e) => alterarQuantidadeItem(index, e.target.value)}
                                                    className="qtd-input-tabela"
                                                    disabled={!!modoVisualizacao}
                                                />
                                                {avisoQtd?.index === index && (
                                                    <span className="qtd-aviso">{avisoQtd.mensagem}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-right">R$ {item.valorUnitario.toFixed(2).replace(".", ",")}</td>
                                        <td className="text-right">
                                            {modoVisualizacao || ehServico(item) ? (
                                                Number(item.desconto || 0).toFixed(2).replace(".", ",")
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="btn-desconto-item"
                                                    onClick={() => abrirModalDesconto('item', index)}
                                                    title="Dar desconto neste item"
                                                >
                                                    {Number(item.desconto || 0).toFixed(2).replace(".", ",")}
                                                </button>
                                            )}
                                        </td>
                                        <td className="text-right">R$ {calcularTotalItem(item).toFixed(2).replace(".", ",")}</td>
                                        <td className="text-center">
                                            {!modoVisualizacao && (
                                                <button
                                                    type="button"
                                                    className="btn-remover-item"
                                                    onClick={() => removerItem(index)}
                                                    aria-label="Remover item"
                                                    title="Remover item"
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6" />
                                                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                        <line x1="10" y1="11" x2="10" y2="17" />
                                                        <line x1="14" y1="11" x2="14" y2="17" />
                                                    </svg>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="resumo-venda">
                    <div className="total-linha">
                        <span>Subtotal:</span>
                        <span>R$ {itensSelecionados.reduce((total, item) => total + (item.valorUnitario * (item.qtd || 1)), 0).toFixed(2).replace(".", ",")}</span>
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
                            alterarCliente(cliente);
                            setMostrarModalCliente(false);
                        }}

                        onClose={() => setMostrarModalCliente(false)}
                    />

                )
            }
            {
                mostrarModalVendedor && (
                    <ModalSelecionarVendedor
                        permitirAdminEscolher
                        onSelecionar={vendedorSelecionadoConfirmado}
                        onClose={() => { setMostrarModalVendedor(false); setItensPendentesAposVendedor(null); acaoAposVendedorRef.current = null; }}
                    />
                )
            }
            {
                motivoCancelamento !== null && (
                    <div className="vnd-overlay" onClick={(e) => { if (e.target === e.currentTarget) setMotivoCancelamento(null); }}>
                        <div className="vnd-modal">
                            <div className="vnd-header">
                                <h3>Cancelar Venda Nº {modoVisualizacao?.dados?.vendaId}</h3>
                                <button onClick={() => setMotivoCancelamento(null)} className="vnd-close-btn">&times;</button>
                            </div>
                            <form className="vnd-form" onSubmit={confirmarMotivoCancelamento}>
                                <div className="vnd-form-group">
                                    <label htmlFor="motivo-cancelamento">Motivo do cancelamento</label>
                                    <textarea
                                        id="motivo-cancelamento"
                                        rows={3}
                                        maxLength={500}
                                        value={motivoCancelamento}
                                        onChange={(e) => setMotivoCancelamento(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                {erroMotivoCancelamento && <div className="vnd-erro">{erroMotivoCancelamento}</div>}
                                <div className="vnd-footer">
                                    <button type="button" className="vnd-btn-cancelar" onClick={() => setMotivoCancelamento(null)}>
                                        Voltar
                                    </button>
                                    <button type="submit" className="vnd-btn-confirmar">
                                        Continuar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            {
                motivoCancelamentoOS !== null && (
                    <div className="vnd-overlay" onClick={(e) => { if (e.target === e.currentTarget) setMotivoCancelamentoOS(null); }}>
                        <div className="vnd-modal">
                            <div className="vnd-header">
                                <h3>Cancelar OS Nº {osAtual?.ordemServicoId}</h3>
                                <button onClick={() => setMotivoCancelamentoOS(null)} className="vnd-close-btn">&times;</button>
                            </div>
                            <form className="vnd-form" onSubmit={confirmarMotivoCancelamentoOS}>
                                <p className="vnd-descricao">O estoque reservado volta para o disponível e a OS fica no histórico como cancelada.</p>
                                <div className="vnd-form-group">
                                    <label htmlFor="motivo-cancelamento-os">Motivo do cancelamento</label>
                                    <textarea
                                        id="motivo-cancelamento-os"
                                        rows={3}
                                        maxLength={500}
                                        value={motivoCancelamentoOS}
                                        onChange={(e) => setMotivoCancelamentoOS(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                {erroMotivoOS && <div className="vnd-erro">{erroMotivoOS}</div>}
                                <div className="vnd-footer">
                                    <button type="button" className="vnd-btn-cancelar" onClick={() => setMotivoCancelamentoOS(null)}>
                                        Voltar
                                    </button>
                                    <button type="submit" className="vnd-btn-confirmar">
                                        Continuar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            {
                mostrarModalAutenticacao && autenticacaoPendente && (
                    <ModalSelecionarVendedor
                        titulo="Autorização necessária"
                        descricao={autenticacaoPendente.descricao}
                        cargosPermitidos={['administrador']}
                        permissao={autenticacaoPendente.permissao}
                        mensagemSemPermissao="Este usuário não tem permissão para autorizar esta ação."
                        onSelecionar={(admin) => {
                            setMostrarModalAutenticacao(false);
                            const pendente = autenticacaoPendente;
                            setAutenticacaoPendente(null);
                            pendente.onSucesso(admin);
                        }}
                        onClose={() => { setMostrarModalAutenticacao(false); setAutenticacaoPendente(null); }}
                    />
                )
            }
            {
                mostrarModalAuditoria && (
                    <ModalAuditoria
                        token={auditoriaToken}
                        onClose={() => { setMostrarModalAuditoria(false); setAuditoriaToken(null); }}
                    />
                )
            }
            {
                mostrarModalFinalizar && (
                    <div className="finalizar-overlay" onClick={(e) => { if (e.target === e.currentTarget && !finalizando) setMostrarModalFinalizar(false); }}>
                        <div className="finalizar-modal">
                            <div className="finalizar-header">
                                <h3>{osAtual ? `Finalizar OS Nº ${osAtual.ordemServicoId}` : 'Finalizar Venda'}</h3>
                                <button
                                    className="finalizar-close-btn"
                                    onClick={() => setMostrarModalFinalizar(false)}
                                    disabled={finalizando}
                                >
                                    &times;
                                </button>
                            </div>

                            <div className="finalizar-body">
                                <div className="finalizar-totais">
                                    <div className="finalizar-total-item">
                                        <span>Total da venda</span>
                                        <strong>R$ {calcularTotalVenda().toFixed(2).replace(".", ",")}</strong>
                                    </div>
                                    <div className={`finalizar-total-item ${calcularFaltante() <= 0.001 ? 'finalizar-faltante-zerado' : 'finalizar-faltante'}`}>
                                        <span>Faltante</span>
                                        <strong>R$ {Math.max(0, calcularFaltante()).toFixed(2).replace(".", ",")}</strong>
                                    </div>
                                </div>

                                {clienteSelecionado && (
                                    <div className="finalizar-cliente">Cliente: {clienteSelecionado.nome}</div>
                                )}

                                {pagamentosAdicionados.length > 0 && (
                                    <div className="finalizar-lista-pagamentos">
                                        {pagamentosAdicionados.map((p, index) => (
                                            <div key={index} className="finalizar-pagamento-linha">
                                                <span className="finalizar-pagamento-metodo">
                                                    {({ dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Débito', credito: 'Crédito', faturado: 'Faturado' })[p.metodo]}
                                                    {p.metodo === 'credito' && ` ${p.qtdParcelas || 1}x`}
                                                </span>
                                                <span className="finalizar-pagamento-valor">R$ {p.valor.toFixed(2).replace(".", ",")}</span>
                                                {p.valorTaxa > 0 && (
                                                    <span className="finalizar-pagamento-taxa">
                                                        Taxa {Number(p.percentualTaxa || 0).toFixed(2).replace(".", ",")}%: -R$ {Number(p.valorTaxa).toFixed(2).replace(".", ",")}
                                                        {p.taxaManual && ' (manual)'}
                                                    </span>
                                                )}
                                                {p.troco > 0 && (
                                                    <span className="finalizar-pagamento-troco">Troco: R$ {p.troco.toFixed(2).replace(".", ",")}</span>
                                                )}
                                                <button
                                                    type="button"
                                                    className="finalizar-remover-pagamento"
                                                    onClick={() => removerPagamento(index)}
                                                    disabled={finalizando}
                                                    aria-label="Remover pagamento"
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        ))}

                                        {resumoTaxas.valorTaxaTotal > 0 && (
                                            <div className="finalizar-resumo-liquido">
                                                <span>Taxas da maquininha: <strong>-R$ {resumoTaxas.valorTaxaTotal.toFixed(2).replace(".", ",")}</strong></span>
                                                <span>Entra no banco: <strong>R$ {resumoTaxas.valorLiquido.toFixed(2).replace(".", ",")}</strong></span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {calcularFaltante() > 0.001 && (
                                    <>
                                        <div className="finalizar-label">Forma de pagamento</div>
                                        <div className="finalizar-metodos">
                                            {[
                                                { valor: 'dinheiro', label: 'Dinheiro' },
                                                { valor: 'pix', label: 'Pix' },
                                                { valor: 'debito', label: 'Débito' },
                                                { valor: 'credito', label: 'Crédito' },
                                                { valor: 'faturado', label: 'Faturado' },
                                            ].map((opcao) => {
                                                const desabilitado = opcao.valor === 'faturado' && !obterIdCliente(clienteSelecionado);
                                                return (
                                                    <button
                                                        key={opcao.valor}
                                                        type="button"
                                                        className={`finalizar-metodo-btn ${metodoAtual === opcao.valor ? 'ativo' : ''}`}
                                                        onClick={() => setMetodoAtual(opcao.valor)}
                                                        disabled={desabilitado}
                                                        title={desabilitado ? 'Selecione um cliente para faturar' : undefined}
                                                    >
                                                        {opcao.label}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {metodoAtual === 'credito' && (
                                            <div className="finalizar-parcelas">
                                                <span className="finalizar-label">Parcelamento</span>
                                                <select
                                                    className="finalizar-parcelas-select"
                                                    value={parcelasCredito}
                                                    onChange={(e) => setParcelasCredito(Number(e.target.value))}
                                                >
                                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((parcela) => (
                                                        <option key={parcela} value={parcela}>
                                                            {parcela === 1 ? 'À vista (1x)' : `${parcela}x`}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {(() => {
                                            const valorPrevia = digitosParaNumero(valorPagamentoAtual);
                                            const previa = calcularTaxaPagamento(taxasPagamento, {
                                                metodo: metodoAtual,
                                                valor: valorPrevia,
                                                qtdParcelas: metodoAtual === 'credito' ? parcelasCredito : 1,
                                                valorTaxaManual: editandoTaxa && taxaManualDigitos !== ''
                                                    ? digitosParaNumero(taxaManualDigitos)
                                                    : undefined
                                            });

                                            const podeEditarTaxa = metodoAtual === 'debito' || metodoAtual === 'credito';

                                            return (
                                                <>
                                                    {previa.exigeTaxa && !previa.taxaCadastrada && (
                                                        <div className="finalizar-taxa-alerta">
                                                            {mensagemTaxaPendente(metodoAtual, previa.qtdParcelas)}
                                                        </div>
                                                    )}

                                                    {previa.valorTaxa > 0 && (
                                                        <div className="finalizar-taxa-previa">
                                                            Taxa {previa.percentual.toFixed(2).replace(".", ",")}%: -R$ {previa.valorTaxa.toFixed(2).replace(".", ",")}
                                                            {" · "}Líquido: R$ {previa.valorLiquido.toFixed(2).replace(".", ",")}
                                                            {!previa.taxaManual && previa.prazoDias > 0 && ` · recebe em D+${previa.prazoDias}`}
                                                            {previa.taxaManual && " · taxa informada na mão"}
                                                        </div>
                                                    )}

                                                    {podeEditarTaxa && !editandoTaxa && (
                                                        <button
                                                            type="button"
                                                            className="finalizar-taxa-editar"
                                                            onClick={() => {
                                                                setEditandoTaxa(true);
                                                                setTaxaManualDigitos(previa.valorTaxa > 0 ? numeroParaDigitos(previa.valorTaxa) : '');
                                                            }}
                                                        >
                                                            Outra maquininha? Informar taxa
                                                        </button>
                                                    )}

                                                    {podeEditarTaxa && editandoTaxa && (
                                                        <div className="finalizar-taxa-editor">
                                                            <span className="finalizar-label">Taxa desta venda</span>
                                                            <div className="finalizar-taxa-editor-linha">
                                                                <div className="finalizar-valor-input-wrapper">
                                                                    <span className="finalizar-valor-prefixo">R$</span>
                                                                    <input
                                                                        type="text"
                                                                        inputMode="numeric"
                                                                        value={formatarMoeda(taxaManualDigitos)}
                                                                        onChange={(e) => setTaxaManualDigitos(e.target.value.replace(/\D/g, ''))}
                                                                        className="finalizar-valor-input"
                                                                        placeholder="0,00"
                                                                    />
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="finalizar-taxa-cancelar"
                                                                    onClick={() => {
                                                                        setEditandoTaxa(false);
                                                                        setTaxaManualDigitos('');
                                                                    }}
                                                                >
                                                                    Usar taxa cadastrada
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}

                                        <div className="finalizar-valor-linha">
                                            <div className="finalizar-valor-input-wrapper">
                                                <span className="finalizar-valor-prefixo">R$</span>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formatarMoeda(valorPagamentoAtual)}
                                                    onChange={(e) => setValorPagamentoAtual(e.target.value.replace(/\D/g, ''))}
                                                    className="finalizar-valor-input"
                                                    placeholder="0,00"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className="finalizar-btn-adicionar"
                                                onClick={adicionarPagamento}
                                            >
                                                Adicionar
                                            </button>
                                        </div>
                                    </>
                                )}

                                {msgFinalizar && <div className="finalizar-erro">{msgFinalizar}</div>}
                            </div>

                            <div className="finalizar-footer">
                                <button
                                    className="finalizar-btn-cancelar"
                                    onClick={() => setMostrarModalFinalizar(false)}
                                    disabled={finalizando}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="finalizar-btn-confirmar"
                                    onClick={finalizarVenda}
                                    disabled={finalizando || pagamentosAdicionados.length === 0 || calcularFaltante() > 0.001}
                                >
                                    {finalizando ? 'Finalizando...' : 'Confirmar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {
                mostrarModalVendas && (
                    <ModalBuscaVendas
                        onClose={() => setMostrarModalVendas(false)}
                        onSelecionarVenda={carregarVenda}
                    />
                )
            }
            {
                mostrarModalAbrirOS && (
                    <ModalAbrirOS
                        salvando={salvandoOS}
                        totalItens={itensSelecionados.length}
                        cliente={clienteSelecionado}
                        onAlterarCliente={setClienteSelecionado}
                        onConfirmar={confirmarAberturaOS}
                        onClose={() => setMostrarModalAbrirOS(false)}
                    />
                )
            }
            {
                mostrarModalFaturados && (
                    <ModalFaturados onClose={() => setMostrarModalFaturados(false)} />
                )
            }
            {
                mostrarModalListarOS && (
                    <ModalListarOS
                        onClose={() => setMostrarModalListarOS(false)}
                        onSelecionar={carregarOS}
                    />
                )
            }
            {
                mostrarModalOrcamentos && (
                    <ModalListarOrcamentos
                        onClose={() => setMostrarModalOrcamentos(false)}
                        onSelecionarOrcamento={carregarOrcamento}
                    />
                )
            }
            {
                modalDesconto && (() => {
                    const itensAlvo = itensDoEscopo();
                    const base = subtotalVenda(itensAlvo);
                    const teto = modalDesconto.escopo === 'item' ? tetoItem(itensAlvo[0]) : tetoVenda(itensAlvo);
                    const pedido = calcularDescontoPedido();
                    const fmt = (v) => v.toFixed(2).replace('.', ',');
                    return (
                        <div className="desconto-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalDesconto(null); }}>
                            <div className="desconto-modal">
                                <div className="desconto-header">
                                    <h3>{modalDesconto.escopo === 'item' ? `Desconto: ${itensAlvo[0]?.produtoNome || 'item'}` : 'Desconto na venda'}</h3>
                                    <button className="desconto-close-btn" onClick={() => setModalDesconto(null)}>&times;</button>
                                </div>
                                <div className="desconto-body">
                                    <div className="desconto-tipo">
                                        <button type="button" className={tipoDesconto === 'percentual' ? 'ativo' : ''} onClick={() => trocarTipoDesconto('percentual')}>%</button>
                                        <button type="button" className={tipoDesconto === 'valor' ? 'ativo' : ''} onClick={() => trocarTipoDesconto('valor')}>R$</button>
                                    </div>
                                    <div className="desconto-input-wrapper">
                                        {tipoDesconto === 'valor' && <span className="desconto-simbolo">R$</span>}
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            autoFocus
                                            value={tipoDesconto === 'valor' ? (entradaDesconto ? formatarMoeda(entradaDesconto) : '') : entradaDesconto}
                                            onChange={(e) => alterarEntradaDesconto(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') confirmarDesconto(); }}
                                            placeholder={tipoDesconto === 'valor' ? '0,00' : '0'}
                                            className="desconto-input"
                                        />
                                        {tipoDesconto === 'percentual' && <span className="desconto-simbolo">%</span>}
                                    </div>
                                    <p className="desconto-preview">
                                        Desconto: R$ {fmt(pedido)} · Novo total: R$ {fmt(Math.max(base - pedido, 0))}
                                    </p>
                                    <p className="desconto-preview">
                                        Máximo sem autorização: R$ {fmt(teto)}{base > 0 ? ` (${fmt((teto / base) * 100)}%)` : ''}
                                        {itensAlvo.some(ehServico) && modalDesconto.escopo === 'venda' ? ' · serviços não recebem desconto' : ''}
                                    </p>
                                </div>
                                <div className="desconto-footer">
                                    <button className="desconto-btn-remover" onClick={removerDesconto}>
                                        Remover desconto
                                    </button>
                                    <button className="desconto-btn-aplicar" onClick={confirmarDesconto}>
                                        Aplicar
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()
            }
            {
                limiteDesconto && (
                    <div className="desconto-overlay" onClick={(e) => { if (e.target === e.currentTarget) setLimiteDesconto(null); }}>
                        <div className="desconto-modal">
                            <div className="desconto-header">
                                <h3>Desconto acima do permitido</h3>
                                <button className="desconto-close-btn" onClick={() => setLimiteDesconto(null)}>&times;</button>
                            </div>
                            <div className="desconto-body">
                                <p className="desconto-preview">O desconto pedido passa do limite dos itens.</p>
                                <p className="desconto-preview">
                                    Você pediu: <strong>R$ {limiteDesconto.pedido.toFixed(2).replace('.', ',')}</strong> · Máximo possível: <strong>R$ {limiteDesconto.possivel.toFixed(2).replace('.', ',')}</strong>
                                </p>
                            </div>
                            <div className="desconto-footer">
                                <button className="desconto-btn-remover" onClick={() => setLimiteDesconto(null)}>
                                    Cancelar
                                </button>
                                <button className="desconto-btn-remover" onClick={liberarDescontoComAdmin}>
                                    Liberar com admin
                                </button>
                                <button className="desconto-btn-aplicar" onClick={aplicarDescontoPossivel} disabled={limiteDesconto.possivel <= 0}>
                                    Aplicar o máximo
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {
                mostrarConfirmSemEstoque && dadosConversaoPendente && (
                    <div className="estoque-overlay" onClick={(e) => { if (e.target === e.currentTarget) cancelarConversaoSemEstoque(); }}>
                        <div className="estoque-modal">
                            <div className="estoque-header">
                                <h3>Itens sem estoque suficiente</h3>
                            </div>
                            <div className="estoque-body">
                                <p>Os itens abaixo não têm estoque suficiente para a conversão em venda:</p>
                                <ul className="estoque-lista">
                                    {dadosConversaoPendente.itensSemEstoque.map((item, index) => (
                                        <li key={index}>
                                            <span>{item.produtoNome}</span>
                                            <span className="item-sem-estoque">Pedido: {item.qtd || 1} · Disponível: {item.estoqueAtual || 0}</span>
                                        </li>
                                    ))}
                                </ul>
                                <p>Deseja finalizar a venda apenas com os {dadosConversaoPendente.itensComEstoque.length} item(ns) que possuem estoque?</p>
                            </div>
                            <div className="estoque-footer">
                                <button className="estoque-btn-cancelar" onClick={cancelarConversaoSemEstoque}>
                                    Cancelar
                                </button>
                                <button
                                    className="estoque-btn-confirmar"
                                    onClick={confirmarConversaoSomenteComEstoque}
                                    disabled={dadosConversaoPendente.itensComEstoque.length === 0}
                                >
                                    Finalizar somente com estoque
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {
                mostrarPerguntaNota && (
                    <div className="nota-overlay" onClick={(e) => { if (e.target === e.currentTarget && !gerandoNota) naoGerarNota(); }}>
                        <div className="nota-modal">
                            <div className="nota-icone-sucesso">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 6L9 17l-5-5" />
                                </svg>
                            </div>
                            <h3>Venda finalizada!</h3>
                            <p>Deseja gerar a nota em PDF?</p>
                            <div className="nota-botoes">
                                <button className="nota-btn-nao" onClick={naoGerarNota} disabled={gerandoNota}>
                                    Não
                                </button>
                                <button className="nota-btn-sim" onClick={simGerarNota} disabled={gerandoNota}>
                                    {gerandoNota ? 'Gerando...' : 'Sim, gerar nota'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <Modal
                msg={msgModal}
                showModal={modalAberto}
                handleClose={() => setModalAberto(false)}
            />

        </div>
    );
}

export default PDV;
