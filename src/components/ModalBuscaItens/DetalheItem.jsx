import React, { useState } from 'react';
import imagemPadrao from '../../assets/noimage.png';
import imagemPadraoServico from '../../assets/noimage_servico.png';

// Aplicação pode vir com HTML do cadastro; mostra só o texto, preservando as quebras de linha.
const htmlParaTexto = (valor) => {
    const texto = (valor ?? '').toString();
    if (!/<\/?[a-z][\s\S]*>/i.test(texto)) return texto.trim();

    const comQuebras = texto
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ');

    const doc = new DOMParser().parseFromString(comQuebras, 'text/html');
    return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
};

const formatarLocalizacao = (localizacao) => {
    if (!Array.isArray(localizacao)) return '';
    return localizacao
        .map((l) => (typeof l === 'string' ? l : Object.values(l || {}).filter((v) => typeof v === 'string' || typeof v === 'number').join(' ')))
        .filter((l) => l && l.trim() !== '')
        .join(' / ');
};

const DetalheItem = ({ item, onClose }) => {
    const ehServico = item.tipo === 'servico';
    const padrao = ehServico ? imagemPadraoServico : imagemPadrao;

    const imagens = [item.img, ...(Array.isArray(item.imgAdicional) ? item.imgAdicional : [])]
        .filter((url, i, lista) => url && lista.indexOf(url) === i);

    const [imagemAtual, setImagemAtual] = useState(imagens[0] || null);
    const [imagensComErro, setImagensComErro] = useState({});

    const marcarErro = (url) => setImagensComErro((atual) => ({ ...atual, [url]: true }));
    const srcDe = (url) => (!url || imagensComErro[url] ? padrao : url);

    const aplicacao = htmlParaTexto(item.aplicacao ?? item['aplicação']);
    const observacao = (item.observacao ?? '').toString().trim();
    const descricao = (item.descricao ?? '').toString().trim();
    const localizacao = formatarLocalizacao(item.localizacao);

    const infos = [
        ['Marca', item.marca],
        ['Código de barras', item.codigoBarra],
        ['Cód. fabricante', item.codFabricante],
        ['Estoque', ehServico ? null : (item.estoque ?? 0)],
        ['Preço', typeof item.valorVenda === 'number' ? `R$ ${item.valorVenda.toFixed(2)}` : null],
        ['Desconto máx.', item.descontoMaximo ? `${item.descontoMaximo}%` : null],
        ['Localização', localizacao],
    ].filter(([, valor]) => valor !== null && valor !== undefined && String(valor).trim() !== '');

    return (
        <div className="bi-detalhe-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bi-detalhe-modal">
                <div className="bi-modal-header">
                    <h3>{item.nome}</h3>
                    <button onClick={onClose} className="bi-close-btn" aria-label="Fechar">&times;</button>
                </div>

                <div className="bi-detalhe-corpo">
                    <div className="bi-detalhe-imagens">
                        <img
                            className="bi-detalhe-imagem-principal"
                            src={srcDe(imagemAtual)}
                            alt={item.nome}
                            onError={() => imagemAtual && marcarErro(imagemAtual)}
                        />
                        {imagens.length > 1 && (
                            <div className="bi-detalhe-miniaturas">
                                {imagens.map((url) => (
                                    <img
                                        key={url}
                                        src={srcDe(url)}
                                        alt=""
                                        className={`bi-detalhe-miniatura ${url === imagemAtual ? 'bi-ativa' : ''}`}
                                        onClick={() => setImagemAtual(url)}
                                        onError={() => marcarErro(url)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bi-detalhe-infos">
                        <dl className="bi-detalhe-lista">
                            {infos.map(([rotulo, valor]) => (
                                <React.Fragment key={rotulo}>
                                    <dt>{rotulo}</dt>
                                    <dd>{valor}</dd>
                                </React.Fragment>
                            ))}
                        </dl>

                        {aplicacao && (
                            <section className="bi-detalhe-secao">
                                <h4>Aplicação</h4>
                                <p>{aplicacao}</p>
                            </section>
                        )}
                        {observacao && (
                            <section className="bi-detalhe-secao">
                                <h4>Observação</h4>
                                <p>{observacao}</p>
                            </section>
                        )}
                        {descricao && (
                            <section className="bi-detalhe-secao">
                                <h4>Descrição</h4>
                                <p>{descricao}</p>
                            </section>
                        )}
                        {!aplicacao && !observacao && !descricao && (
                            <p className="bi-detalhe-vazio">Sem aplicação, observação ou descrição cadastradas.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DetalheItem;
