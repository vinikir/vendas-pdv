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
import Modal from '../../components/modal/modal';
import useUsuarioStore from '../../store/useUsuarioStore';
import { useAuth } from '../../Contexts/AuthContext';
import { gerarEBaixarPdfVenda } from '../../utils/pdfVenda';
import { gerarEBaixarPdfOrcamento } from '../../utils/pdfOrcamento';
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
    const [mostrarModalDesconto, setMostrarModalDesconto] = useState(false);
    const [descontoGeral, setDescontoGeral] = useState(0); // percentual (0-100) aplicado sobre o total
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
    const [autorizacaoDesconto, setAutorizacaoDesconto] = useState(null);
    const [cancelandoVenda, setCancelandoVenda] = useState(false);
    const [mostrarModalAuditoria, setMostrarModalAuditoria] = useState(false);
    const [auditoriaToken, setAuditoriaToken] = useState(null);
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

        if (itensPendentes) {
            abrirFinalizar(itensPendentes);
        }
    }

    const solicitarAutenticacaoAdmin = ({ descricao, onSucesso }) => {
        setAutenticacaoPendente({ descricao, onSucesso });
        setMostrarModalAutenticacao(true);
    }

    const abrirModalDesconto = () => {
        solicitarAutenticacaoAdmin({
            descricao: 'Autorização de administrador para alterar o desconto geral.',
            onSucesso: (admin) => {
                setAutorizacaoDesconto(admin);
                setMostrarModalDesconto(true);
            }
        });
    }

    const aplicarDesconto = () => {
        setMostrarModalDesconto(false);

        if (descontoGeral > 0 && autorizacaoDesconto?.token) {
            api.post('auditoria', {
                tipo: 'desconto_aplicado',
                detalhes: `Desconto geral de ${descontoGeral}% aplicado (R$ ${calcularValorDescontoGeral().toFixed(2).replace('.', ',')}).`
            }, {
                headers: { Authorization: `Bearer ${autorizacaoDesconto.token}` }
            }).catch((err) => console.log('Erro ao registrar auditoria do desconto', err));
        }
    }

    const abrirAuditoria = () => {
        solicitarAutenticacaoAdmin({
            descricao: 'Autorização de administrador para visualizar a auditoria.',
            onSucesso: (admin) => {
                setAuditoriaToken(admin.token);
                setMostrarModalAuditoria(true);
            }
        });
    }

    const cancelarVendaAtual = () => {
        if (!modoVisualizacao || modoVisualizacao.tipo !== 'venda') return;
        const venda = modoVisualizacao.dados;

        solicitarAutenticacaoAdmin({
            descricao: `Autorização de administrador para cancelar a Venda Nº ${venda.vendaId}.`,
            onSucesso: (admin) => {
                setCancelandoVenda(true);
                api.post(`venda/${obterIdRegistro(venda)}/cancelar`, {}, {
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

    const abrirFinalizar = (itensParaFinalizar) => {
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

        const subtotal = itens.reduce((total, item) => total + calcularTotalItem(item), 0);
        const totalComDesconto = arredondar(subtotal - arredondar(subtotal * (descontoGeral / 100)));

        setMsgFinalizar('');
        setPagamentosAdicionados([]);
        setMetodoAtual('dinheiro');
        setParcelasCredito(1);
        setTaxaManualDigitos('');
        setEditandoTaxa(false);
        setValorPagamentoAtual(numeroParaDigitos(totalComDesconto));
        setMostrarModalFinalizar(true);
    }

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

        // Na conversão de orçamento, preço/qtd vêm sempre do orçamento salvo no servidor;
        // o front só informa QUAIS produtoIds entram (ex: itens sem estoque ficam de fora).
        const requisicao = emConversaoOrcamento
            ? api.post(`orcamento/${obterIdRegistro(orcamentoAtual)}/finalizar`, {
                pagamento: pagamentosAdicionados.map(montarPagamentoPayload),
                produtoIdsIncluidos: itensSelecionados.map((item) => item.produtoId),
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
                venda: { vendaId: vendaSalva?.vendaId, cliente: clienteSelecionado?.nome },
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
            setDescontoGeral(0);
            setModoVisualizacao(null);
            setDadosConversaoPendente(null);
            setVendedorSelecionado(null);
            setMostrarPerguntaNota(true);
        }).catch((err) => {
            setMsgFinalizar(err.response?.data?.valor || (emConversaoOrcamento ? 'Erro ao converter orçamento em venda.' : 'Erro ao finalizar venda.'));
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
        let qtd = parseInt(numeros, 10);

        if (isNaN(qtd) || qtd < 1) qtd = 1;

        setItensSelecionados((itens) => itens.map((item, i) => {
            if (i !== index) return item;

            if (item.estoque && qtd > item.estoque) {
                qtd = item.estoque;

                clearTimeout(avisoQtdTimeoutRef.current);
                setAvisoQtd({ index, mensagem: `Estoque disponível: ${item.estoque}` });
                avisoQtdTimeoutRef.current = setTimeout(() => setAvisoQtd(null), 3000);
            } else if (avisoQtd?.index === index) {
                clearTimeout(avisoQtdTimeoutRef.current);
                setAvisoQtd(null);
            }

            return {
                ...item,
                qtd,
                valorTotal: item.valorUnitario * qtd - (item.valorDoDesconto || 0)
            };
        }))
    }

    const calcularTotalItem = (item) => {
        return (item.valorTotal * (item.quantidade || 1)) - (item.desconto || 0);
    };

    const calcularSubtotalItens = () => {
        return itensSelecionados.reduce((total, item) => total + calcularTotalItem(item), 0);
    };

    const calcularValorDescontoGeral = () => {
        return arredondar(calcularSubtotalItens() * (descontoGeral / 100));
    };

    const calcularTotalVenda = () => {
        return arredondar(calcularSubtotalItens() - calcularValorDescontoGeral());
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
                                    <span className="info-value">{vendedorSelecionado.nome}</span>
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
                                        onClick={() => setClienteSelecionado(null)}
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
                    {modoVisualizacao ? (
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
                                <button className="atalho-btn" onClick={abrirModalDesconto}>
                                    <span className="atalho-key">F8</span>
                                    <span className="atalho-label">Desconto{descontoGeral > 0 ? ` (${descontoGeral}%)` : ''}</span>
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
                                                    type="number"
                                                    min="1"
                                                    max={item.estoque || undefined}
                                                    value={item.qtd || 1}
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
                                        <td className="text-right">{(item.desconto || 0).toFixed(2).replace(".", ",")}</td>
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
                    {descontoGeral > 0 && (
                        <div className="total-linha desconto">
                            <span>Desconto geral ({descontoGeral}%):</span>
                            <span>- R$ {calcularValorDescontoGeral().toFixed(2).replace(".", ",")}</span>
                        </div>
                    )}
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
            {
                mostrarModalVendedor && (
                    <ModalSelecionarVendedor
                        onSelecionar={vendedorSelecionadoConfirmado}
                        onClose={() => { setMostrarModalVendedor(false); setItensPendentesAposVendedor(null); }}
                    />
                )
            }
            {
                mostrarModalAutenticacao && autenticacaoPendente && (
                    <ModalSelecionarVendedor
                        titulo="Autorização necessária"
                        descricao={autenticacaoPendente.descricao}
                        cargosPermitidos={['administrador']}
                        mensagemSemPermissao="Apenas administradores podem autorizar esta ação."
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
                                <h3>Finalizar Venda</h3>
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
                mostrarModalOrcamentos && (
                    <ModalListarOrcamentos
                        onClose={() => setMostrarModalOrcamentos(false)}
                        onSelecionarOrcamento={carregarOrcamento}
                    />
                )
            }
            {
                mostrarModalDesconto && (
                    <div className="desconto-overlay" onClick={(e) => { if (e.target === e.currentTarget) setMostrarModalDesconto(false); }}>
                        <div className="desconto-modal">
                            <div className="desconto-header">
                                <h3>Desconto Geral</h3>
                                <button className="desconto-close-btn" onClick={() => setMostrarModalDesconto(false)}>&times;</button>
                            </div>
                            <div className="desconto-body">
                                <label>Percentual sobre o total</label>
                                <div className="desconto-input-wrapper">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={descontoGeral || ''}
                                        onChange={(e) => {
                                            let v = parseFloat(e.target.value);
                                            if (isNaN(v) || v < 0) v = 0;
                                            if (v > 100) v = 100;
                                            setDescontoGeral(v);
                                        }}
                                        placeholder="0"
                                        className="desconto-input"
                                    />
                                    <span className="desconto-simbolo">%</span>
                                </div>
                                <p className="desconto-preview">
                                    Desconto: R$ {calcularValorDescontoGeral().toFixed(2).replace(".", ",")} · Novo total: R$ {calcularTotalVenda().toFixed(2).replace(".", ",")}
                                </p>
                            </div>
                            <div className="desconto-footer">
                                <button className="desconto-btn-remover" onClick={() => { setDescontoGeral(0); setMostrarModalDesconto(false); }}>
                                    Remover desconto
                                </button>
                                <button className="desconto-btn-aplicar" onClick={aplicarDesconto}>
                                    Aplicar
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
