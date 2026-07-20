function pegarParametroUrl(nome) {
    return new URLSearchParams(window.location.search).get(nome);
}

function atualizarTexto(id, texto) {
    const elemento = document.getElementById(id);
    if (elemento) {
        elemento.textContent = texto;
    }
}

function escaparHtml(valor) {
    return String(valor).replace(/[&<>"']/g, (caractere) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[caractere]));
}

function normalizarRotulo(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function valoresDaLista(itens) {
    if (!Array.isArray(itens)) return [];
    return itens.map((item) => {
        if (typeof item === "string") return item.trim();
        if (!item || typeof item !== "object") return "";
        return String(item.nome || item.titulo || item.label || item.texto || "").trim();
    }).filter(Boolean);
}

const cardsInformativosPadrao = ["ano", "condicao", "garantia", "localizacao"];

const iconesCardsInformativos = {
    ano: "icone-relogio-laranja.svg",
    condicao: "icone-avaliacao-laranja.svg",
    garantia: "icone-garantia-laranja.svg",
    localizacao: "icone-mapa-brasil-laranja.svg",
    disponibilidade: "icone-atendimento-laranja.svg",
    preco: "icone-necessidade-laranja.svg",
    entrega: "icone-relogio-laranja.svg",
    pagamento: "icone-fechamento-laranja.svg",
    transporte: "icone-mapa-laranja.svg",
    "horas-uso": "icone-relogio-laranja.svg",
    potencia: "icone-desempenho-laranja.svg",
    "boca-alimentacao": "icone-robustez-laranja.svg"
};

function encontrarValorEmPares(pares, aliases) {
    const itens = (Array.isArray(pares) ? pares : [])
        .filter((item) => Array.isArray(item) && item[0] && item[1])
        .map((item) => ({ rotulo: normalizarRotulo(item[0]), valor: String(item[1]).trim() }));
    const termos = aliases.map(normalizarRotulo);
    const exato = itens.find((item) => termos.includes(item.rotulo));
    const aproximado = itens.find((item) => termos.some((termo) => item.rotulo.includes(termo)));
    return (exato || aproximado)?.valor || "";
}

function resolverCardInformativo(chave, produto) {
    const comercial = produto.informacoesComerciais;
    const specs = produto.specs;
    const cards = {
        ano: { rotulo: "Ano", valor: produto.ano || "A consultar" },
        condicao: { rotulo: "Condição", valor: produto.condicao || produto.status || "A consultar" },
        garantia: { rotulo: "Garantia", valor: produto.garantia || "A consultar" },
        localizacao: { rotulo: "Localização", valor: produto.localizacao || "A consultar" },
        disponibilidade: { rotulo: "Disponibilidade", valor: produto.status || "A consultar" },
        preco: { rotulo: "Preço", valor: encontrarValorEmPares(comercial, ["preço", "valor"]) },
        entrega: { rotulo: "Prazo de entrega", valor: encontrarValorEmPares(comercial, ["prazo de entrega", "entrega"]) },
        pagamento: { rotulo: "Pagamento", valor: encontrarValorEmPares(comercial, ["condições de pagamento", "pagamento"]) },
        transporte: { rotulo: "Transporte", valor: encontrarValorEmPares(comercial, ["transporte", "frete"]) },
        "horas-uso": { rotulo: "Horas de uso", valor: encontrarValorEmPares(specs, ["horas de uso", "horímetro", "horimetro"]) },
        potencia: { rotulo: "Potência", valor: encontrarValorEmPares(specs, ["potência instalada", "potência", "potencia"]) },
        "boca-alimentacao": { rotulo: "Boca de alimentação", valor: encontrarValorEmPares(specs, ["boca de alimentação", "abertura de alimentação", "boca"]) }
    };
    const card = cards[chave];
    if (!card || !String(card.valor || "").trim()) return null;
    return { ...card, icone: iconesCardsInformativos[chave] };
}

function atualizarCardsResumo(produto) {
    const container = document.getElementById("produtoCardsResumo");
    if (!container) return [];
    const configuracao = Array.isArray(produto.cardsInformativos) && produto.cardsInformativos.length
        ? produto.cardsInformativos
        : cardsInformativosPadrao;
    const chaves = [...new Set(configuracao.map((item) => String(item || "").trim()))].slice(0, 4);
    const cards = chaves.map((chave) => resolverCardInformativo(chave, produto)).filter(Boolean);

    container.innerHTML = cards.map((card) => `
        <div>
            <span aria-hidden="true"><img src="assets/icones-laranjas/${escaparHtml(card.icone)}" alt=""></span>
            <strong>${escaparHtml(card.rotulo)}</strong>
            <small>${escaparHtml(card.valor)}</small>
        </div>
    `).join("");
    container.hidden = !cards.length;
    return cards;
}

function resumoCurtoProduto(produto) {
    const resumoCadastrado = String(produto.resumo || "").trim();
    const descricao = String(produto.descricao || "").trim();
    const primeiraFrase = descricao.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || descricao;
    const texto = resumoCadastrado || primeiraFrase || "Consulte a condição atual e as informações desta unidade.";
    if (texto.length <= 120) return texto;
    const corte = texto.slice(0, 119).replace(/\s+\S*$/, "").trim() || texto.slice(0, 119).trim();
    return `${corte}…`;
}

function slugStatusProduto(produto) {
    const status = normalizarRotulo(produto?.statusSlug || produto?.status);
    if (status.includes("vendid") || status.includes("indisponivel")) return "vendido";
    if (status.includes("revisao")) return "revisao";
    if (status.includes("reservad")) return "reservado";
    if (status.includes("disponivel")) return "disponivel";
    return status.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sob-consulta";
}

function atualizarListaOpcional(id, itens, cardId) {
    const lista = document.getElementById(id);
    const card = document.getElementById(cardId);
    const valores = valoresDaLista(itens);
    if (lista) {
        lista.innerHTML = valores.map((item) => `<li>${escaparHtml(item)}</li>`).join("");
    }
    if (card) {
        card.hidden = !valores.length;
    }
    return valores.length > 0;
}

function atualizarInformacoesComerciais(produto) {
    const lista = document.getElementById("produtoInfoComercial");
    if (!lista) return;

    const informacoesCadastradas = Array.isArray(produto.informacoesComerciais)
        ? produto.informacoesComerciais
            .filter((item) => Array.isArray(item) && item[0] && item[1])
            .map((item) => [String(item[0]).trim(), String(item[1]).trim()])
        : [];
    const informacoes = informacoesCadastradas.length
        ? informacoesCadastradas
        : [
            ["Preço", "Consultar valor"],
            ["Prazo de entrega", "A combinar"],
            ["Condições de pagamento", "Conforme proposta"],
            ["Transporte", "A combinar"]
        ];
    const availabilityIndex = informacoes.findIndex(([rotulo]) => normalizarRotulo(rotulo) === "disponibilidade");
    const availabilityRow = ["Disponibilidade", produto.status || "A consultar"];

    if (availabilityIndex >= 0) {
        informacoes[availabilityIndex] = availabilityRow;
    } else {
        const priceIndex = informacoes.findIndex(([rotulo]) => normalizarRotulo(rotulo) === "preco");
        informacoes.splice(priceIndex >= 0 ? priceIndex + 1 : 0, 0, availabilityRow);
    }

    lista.innerHTML = informacoes
        .map(([rotulo, valor]) => `<div><strong>${escaparHtml(rotulo)}</strong><span>${escaparHtml(valor)}</span></div>`)
        .join("");
}

function atualizarSeoProduto(produto, breadcrumb) {
    const descricaoBase = produto.resumo || produto.descricao || "Consulte condição e informações técnicas.";
    const descricao = `${breadcrumb} - ${descricaoBase}`;
    const url = `https://www.brutusmaq.com.br/maquina-usada.html?id=${encodeURIComponent(produto.id)}`;
    const imagem = new URL(produto.imagemPrincipal || produto.imagem || "assets/main/tr-700.webp", "https://www.brutusmaq.com.br/").href;
    const disponibilidade = {
        vendido: "https://schema.org/SoldOut",
        revisao: "https://schema.org/PreOrder",
        reservado: "https://schema.org/LimitedAvailability"
    };
    const statusSlug = slugStatusProduto(produto);

    document.title = `${breadcrumb} | Brutusmaq`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", `${descricao} Solicite fotos, vídeo ou proposta.`);
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", url);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", `${breadcrumb} | Brutusmaq`);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", descricao);
    document.querySelector('meta[property="og:image"]')?.setAttribute("content", imagem);

    const jsonLd = document.getElementById("produtoUsadoJsonLd");
    if (jsonLd) {
        jsonLd.textContent = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: breadcrumb,
            description: produto.descricao || produto.resumo || "Equipamento industrial usado Brutusmaq",
            category: produto.categoria || "Equipamento usado",
            image: imagem,
            brand: { "@type": "Brand", name: "Brutusmaq" },
            url,
            itemCondition: "https://schema.org/UsedCondition",
            offers: {
                "@type": "Offer",
                priceCurrency: "BRL",
                availability: disponibilidade[statusSlug] || "https://schema.org/InStock",
                url
            }
        });
    }
}

function atualizarLinksWhatsAppProdutoUsado(produto, breadcrumb) {
    const categoria = produto.categoria || "equipamento industrial usado";
    const condicao = produto.condicao || produto.status || "sob consulta";
    const pagina = `https://www.brutusmaq.com.br/maquina-usada.html?id=${encodeURIComponent(produto.id)}`;
    const mensagem = `Olá, visitei a página do equipamento ${breadcrumb} (${categoria}). Condição informada: ${condicao}. Gostaria de receber mais informações sobre disponibilidade e negociação. Link do equipamento: ${pagina}`;
    const href = `https://wa.me/5541988754003?text=${encodeURIComponent(mensagem)}`;

    document.querySelectorAll("[data-whatsapp-produto-usado]").forEach((link) => {
        link.href = href;
        link.setAttribute("aria-label", `Falar no WhatsApp sobre ${breadcrumb}`);
    });
}

function atualizarLinksProposta(produto, breadcrumb) {
    document.querySelectorAll("[data-produto-proposta]").forEach((link) => {
        const parametros = new URLSearchParams({
            tipo: "equipamento-usado",
            produto: produto.id,
            modelo: breadcrumb,
            categoria: produto.categoria || "Equipamento usado",
            pagina: `maquina-usada.html?id=${produto.id}`,
            origem: "maquina-usada"
        });
        link.href = `contato.html?${parametros.toString()}#proposta-tecnica`;
    });
}

function definirEstadoVazio() {
    const pagina = document.querySelector(".product-page--used");
    pagina?.classList.add("is-empty");
    document.title = "Máquina usada não encontrada | Brutusmaq";
    atualizarTexto("produtoStatus", "Cadastro indisponível");
    atualizarTexto("produtoCategoria", "Nenhuma máquina usada encontrada");
    atualizarTexto("produtoResumo", "Ainda não há uma máquina usada publicada com este endereço.");
    atualizarTexto("produtoBreadcrumb", "Cadastro indisponível");
    atualizarTexto("produtoTitulo", "Equipamento usado");

    const status = document.getElementById("produtoStatus");
    if (status) status.className = "product-badge status-sob-consulta";

    const imagem = document.getElementById("produtoImagemPrincipal");
    if (imagem) {
        imagem.src = imagem.dataset.fallbackSrc || "assets/main/tr-700.webp";
        imagem.alt = "Equipamento usado Brutusmaq";
    }
}

function carregarProdutoUsado() {
    const idProduto = pegarParametroUrl("id");
    const maquinasUsadas = Array.isArray(window.brutusmaqMaquinasUsadas)
        ? window.brutusmaqMaquinasUsadas
        : [];
    const produto = maquinasUsadas.find((item) => item.id === idProduto) || (!idProduto ? maquinasUsadas[0] : null);

    if (!produto) {
        definirEstadoVazio();
        return;
    }

    document.querySelector(".product-page--used")?.classList.remove("is-empty");
    const breadcrumb = produto.breadcrumb || `${produto.modelo} usado`;
    const status = document.getElementById("produtoStatus");
    const titulo = document.getElementById("produtoTitulo");
    const modalProduto = document.getElementById("modalProduto");

    atualizarSeoProduto(produto, breadcrumb);

    if (status) {
        status.textContent = produto.status || "Disponível";
        status.className = `product-badge status-${slugStatusProduto(produto)}`;
    }

    if (titulo) {
        titulo.innerHTML = `${escaparHtml(produto.modelo || "Máquina")} <strong>usado</strong>`;
    }

    atualizarTexto("produtoLinhaResumo", "Equipamento usado Brutusmaq");
    atualizarTexto("produtoCategoria", produto.categoria || "Equipamento usado");
    atualizarTexto("produtoBreadcrumb", breadcrumb);
    atualizarTexto("produtoGuaranteeNote", `Garantia: ${produto.garantia || "condições sob consulta"}.`);

    if (modalProduto) {
        modalProduto.value = breadcrumb;
    }

    atualizarLinksProposta(produto, breadcrumb);
    atualizarLinksWhatsAppProdutoUsado(produto, breadcrumb);
    atualizarCardsResumo(produto);
    atualizarConteudoProdutoUsado(produto);
    atualizarGaleria(produto);
    atualizarEspecificacoes(produto);
    atualizarYoutube(produto);
    atualizarListaOpcional("produtoItensInclusos", produto.oQueAcompanha || produto.itensInclusos, "produtoIncludedCard");
    atualizarListaOpcional("produtoRevisoes", produto.avaliacaoTecnica || produto.revisoes, "produtoAssessmentCard");
    atualizarInformacoesComerciais(produto);
    atualizarRelacionadosUsados(produto);
}

function atualizarConteudoProdutoUsado(produto) {
    const resumo = resumoCurtoProduto(produto);
    const descricao = String(produto.descricao || resumo).trim();
    const modelo = produto.modelo || "Equipamento usado";
    const aplicacoes = valoresDaLista(produto.aplicacoes);
    const materiais = valoresDaLista(produto.materiais);
    const gridAplicacoes = document.getElementById("produtoAplicacoes");
    const listaMateriais = document.getElementById("produtoMateriais");
    const cardAplicacoes = document.getElementById("produtoApplicationsCard");
    const cardMateriais = document.getElementById("produtoMaterialsCard");

    atualizarTexto("produtoResumo", resumo);
    atualizarTexto("produtoSobreTitulo", `${modelo}: detalhes desta unidade`);
    atualizarTexto("produtoDescricao", descricao);
    atualizarTexto("produtoAplicacoesTexto", aplicacoes.length
        ? "Aplicações informadas no cadastro desta unidade."
        : "A aplicação final deve ser validada conforme o material e o processo.");

    if (gridAplicacoes) {
        gridAplicacoes.innerHTML = aplicacoes.map((aplicacao) => `<span>${escaparHtml(aplicacao)}</span>`).join("");
    }
    if (cardAplicacoes) cardAplicacoes.hidden = !aplicacoes.length;

    if (listaMateriais) {
        listaMateriais.innerHTML = materiais.map((material) => `<li>${escaparHtml(material)}</li>`).join("");
    }
    if (cardMateriais) cardMateriais.hidden = !materiais.length;

    const materialSelect = document.getElementById("modalMaterial");
    if (materialSelect) {
        materialSelect.innerHTML = "";
        const unknownOption = document.createElement("option");
        unknownOption.value = "Ainda não sei - preciso de orientação";
        unknownOption.textContent = "Ainda não sei / preciso de orientação";
        materialSelect.appendChild(unknownOption);

        materiais.forEach((material) => {
            const option = document.createElement("option");
            option.value = material;
            option.textContent = material;
            materialSelect.appendChild(option);
        });

        const otherOption = document.createElement("option");
        otherOption.value = "Outro material";
        otherOption.textContent = "Outro material";
        materialSelect.appendChild(otherOption);
    }
}

function normalizarGaleriaUsado(produto) {
    const imagemPadrao = produto.imagemPrincipal || produto.imagem || "assets/main/tr-700.webp";
    const fontes = [{ src: imagemPadrao, alt: produto.alt }, ...(Array.isArray(produto.galeria) ? produto.galeria : [])];

    return fontes
        .map((item, indice) => ({
            src: typeof item === "string" ? item : item.src,
            alt: typeof item === "string"
                ? `${produto.modelo || "Equipamento"} usado - imagem ${indice + 1}`
                : item.alt || produto.alt || produto.modelo || "Máquina usada Brutusmaq"
        }))
        .filter((item) => item.src)
        .filter((item, index, items) => items.findIndex((candidate) => candidate.src === item.src) === index);
}

function atualizarGaleria(produto) {
    const imagens = normalizarGaleriaUsado(produto);
    const principal = document.querySelector(".product-main-photo img") || document.querySelector(".produto-main-photo img");
    const thumbs = document.getElementById("produtoGaleriaThumbs");

    if (principal && imagens[0]) {
        principal.src = imagens[0].src;
        principal.alt = imagens[0].alt;
    }

    if (thumbs) {
        thumbs.innerHTML = "";
        thumbs.hidden = !imagens.length;
        imagens.forEach((imagem, indice) => {
            const botao = document.createElement("button");
            const miniatura = document.createElement("img");
            botao.type = "button";
            botao.className = indice === 0 ? "active" : "";
            botao.setAttribute("aria-label", `Exibir imagem ${indice + 1} de ${imagens.length}`);
            botao.setAttribute("aria-current", indice === 0 ? "true" : "false");
            miniatura.src = imagem.src;
            miniatura.alt = imagem.alt;
            miniatura.loading = indice === 0 ? "eager" : "lazy";
            miniatura.decoding = "async";
            botao.appendChild(miniatura);
            thumbs.appendChild(botao);
        });
    }

    atualizarTexto("produtoMediaNote", produto.observacaoImagens || "Solicite fotos reais e atualizadas desta unidade.");
}

function atualizarEspecificacoes(produto) {
    const tabela = document.getElementById("produtoSpecTable");
    if (!tabela) return;

    const specsOriginais = produto.specs?.length ? produto.specs : [["Modelo", produto.modelo || "A consultar"]];
    const specsSemAno = specsOriginais.filter(([label]) => {
        const rotulo = normalizarRotulo(label);
        return rotulo !== "ano" && !rotulo.startsWith("ano de ");
    });
    const specs = specsSemAno.length ? specsSemAno : [["Modelo", produto.modelo || "A consultar"]];
    tabela.innerHTML = specs
        .map(([label, value]) => `<div><strong>${escaparHtml(label)}</strong><span>${escaparHtml(value)}</span></div>`)
        .join("");

    const note = document.getElementById("produtoSpecNote");
    if (note) {
        note.textContent = produto.notaTecnica || "";
        note.hidden = !produto.notaTecnica;
    }
}

function atualizarRelacionadosUsados(produtoAtual) {
    const container = document.getElementById("productRelatedRow");
    if (!container) return;

    const relacionados = (Array.isArray(window.brutusmaqMaquinasUsadas) ? window.brutusmaqMaquinasUsadas : [])
        .filter((produto) => produto && produto.id && produto.id !== produtoAtual.id)
        .slice(0, 5);

    if (!relacionados.length) {
        container.innerHTML = '<p class="product-related-empty">Nenhum outro equipamento usado está publicado no momento.</p>';
        return;
    }

    container.innerHTML = relacionados.map((produto) => {
        const imagem = produto.imagemPrincipal || produto.imagem || "assets/main/tr-700.webp";
        const modelo = produto.modelo || "Equipamento usado";
        return `
            <a class="product-related-card" href="maquina-usada.html?id=${encodeURIComponent(produto.id)}" aria-label="Ver ${escaparHtml(modelo)} usado">
                <span>${escaparHtml(produto.status || "Sob consulta")}</span>
                <img src="${escaparHtml(imagem)}" alt="${escaparHtml(produto.alt || modelo)}" loading="lazy">
                <h3>${escaparHtml(modelo)}</h3>
                <p>${escaparHtml(produto.categoria || "Equipamento usado")}</p>
                <strong>Ver equipamento</strong>
            </a>
        `;
    }).join("");
}

function youtubeIdSeguro(value) {
    const input = String(value || "").trim();
    if (/^[a-z0-9_-]{6,20}$/i.test(input)) return input;

    try {
        const url = new URL(input);
        const hosts = new Set(["youtube.com", "www.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);
        const match = url.pathname.match(/^\/embed\/([a-z0-9_-]{6,20})\/?$/i);
        return hosts.has(url.hostname) && match ? match[1] : "";
    } catch (error) {
        return "";
    }
}

function carregarYoutubeDireto(iframe, source, title) {
    const id = youtubeIdSeguro(source);
    if (!id) return false;
    iframe.removeAttribute("srcdoc");
    iframe.removeAttribute("tabindex");
    delete iframe.dataset.externalSrc;
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
    iframe.hidden = false;
    iframe.title = title;
    return true;
}

function atualizarYoutube(produto) {
    const iframe = document.getElementById("produtoYoutubeFrame");
    if (!iframe) return;

    const title = `Vídeo do ${produto.modelo || "equipamento"} em funcionamento`;
    if (carregarYoutubeDireto(iframe, produto.youtubeId, title)
        || carregarYoutubeDireto(iframe, produto.youtubeEmbed, title)) {
        return;
    }

    iframe.removeAttribute("src");
    delete iframe.dataset.externalSrc;
    iframe.hidden = false;
    iframe.setAttribute("tabindex", "-1");
    iframe.title = `Vídeo do ${produto.modelo || "equipamento"} disponível sob solicitação`;
    iframe.srcdoc = `
        <!doctype html>
        <html lang="pt-br">
            <head><meta charset="utf-8"><link rel="stylesheet" href="/css/video-placeholder.css"></head>
            <body><div class="video-placeholder"><strong>Vídeo sob solicitação</strong><span>Peça um vídeo atualizado ou um teste com o material da sua operação.</span></div></body>
        </html>`;
}

function configurarGaleria() {
    const principal = document.querySelector(".product-main-photo img") || document.querySelector(".produto-main-photo img");
    const fotoPrincipal = document.querySelector(".product-main-photo") || document.querySelector(".produto-main-photo");
    const botaoAnterior = document.querySelector(".product-gallery-prev");
    const botaoProximo = document.querySelector(".product-gallery-next");
    const botoes = [...document.querySelectorAll(".produto-galeria-thumbs button")].filter((botao) => !botao.hidden);
    let indiceAtual = 0;

    if (!principal || !botoes.length) {
        if (botaoAnterior) botaoAnterior.hidden = true;
        if (botaoProximo) botaoProximo.hidden = true;
        fotoPrincipal?.removeAttribute("tabindex");
        return;
    }

    [principal, ...botoes.map((botao) => botao.querySelector("img"))].filter(Boolean).forEach((imagem) => {
        imagem.addEventListener("error", () => {
            if (imagem.dataset.fallbackAplicado === "true") return;
            imagem.dataset.fallbackAplicado = "true";
            imagem.src = "assets/main/tr-700.webp";
            imagem.alt = "Imagem provisória de equipamento Brutusmaq";
        });
    });

    function mostrarImagem(indice) {
        indiceAtual = (indice + botoes.length) % botoes.length;
        botoes.forEach((botao, index) => {
            const ativo = index === indiceAtual;
            botao.classList.toggle("active", ativo);
            botao.setAttribute("aria-current", ativo ? "true" : "false");
        });

        const imagem = botoes[indiceAtual].querySelector("img");
        if (imagem) {
            principal.src = imagem.src;
            principal.alt = imagem.alt;
        }

        botoes[indiceAtual].scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center"
        });
    }

    botoes.forEach((botao, index) => {
        botao.addEventListener("click", () => mostrarImagem(index));
    });
    botaoAnterior?.addEventListener("click", () => mostrarImagem(indiceAtual - 1));
    botaoProximo?.addEventListener("click", () => mostrarImagem(indiceAtual + 1));

    fotoPrincipal?.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            mostrarImagem(indiceAtual - 1);
        }
        if (event.key === "ArrowRight") {
            event.preventDefault();
            mostrarImagem(indiceAtual + 1);
        }
    });

    let toqueInicialX = 0;
    fotoPrincipal?.addEventListener("touchstart", (event) => {
        toqueInicialX = event.touches[0]?.clientX || 0;
    }, { passive: true });
    fotoPrincipal?.addEventListener("touchend", (event) => {
        const toqueFinalX = event.changedTouches[0]?.clientX || 0;
        const diferenca = toqueFinalX - toqueInicialX;
        if (Math.abs(diferenca) >= 40) {
            mostrarImagem(diferenca > 0 ? indiceAtual - 1 : indiceAtual + 1);
        }
    }, { passive: true });

    const esconderSetas = botoes.length <= 1;
    if (botaoAnterior) botaoAnterior.hidden = esconderSetas;
    if (botaoProximo) botaoProximo.hidden = esconderSetas;
    if (esconderSetas) {
        fotoPrincipal?.removeAttribute("tabindex");
        fotoPrincipal?.setAttribute("aria-label", "Imagem principal do equipamento");
    }
}

function configurarModalVideo() {
    const modal = document.getElementById("solicitacaoVideoModal");
    const botoesAbrir = document.querySelectorAll("[data-open-video-modal]");
    const fechar = document.getElementById("fecharSolicitacaoVideo");
    const form = document.getElementById("formSolicitacaoVideo");
    if (!modal) return;

    const abrirModal = () => {
        if (typeof modal.showModal === "function") modal.showModal();
        else modal.setAttribute("open", "");
    };

    botoesAbrir.forEach((botao) => botao.addEventListener("click", abrirModal));
    fechar?.addEventListener("click", () => modal.close());
    modal.addEventListener("click", (event) => {
        if (event.target === modal) modal.close();
    });

    form?.addEventListener("submit", (event) => {
        event.preventDefault();
        const produto = document.getElementById("modalProduto")?.value || "equipamento usado";
        const material = document.getElementById("modalMaterial")?.value || "material a definir";
        const detalhes = document.getElementById("modalDetalhes")?.value.trim() || "Gostaria de receber um vídeo do equipamento em funcionamento.";
        const idProduto = pegarParametroUrl("id");
        const pagina = idProduto
            ? `https://www.brutusmaq.com.br/maquina-usada.html?id=${encodeURIComponent(idProduto)}`
            : window.location.href;
        const mensagem = `Olá, tenho interesse no ${produto}. Gostaria de solicitar um vídeo/teste com o material: ${material}. Detalhes: ${detalhes}. Página consultada: ${pagina}`;
        window.open(`https://wa.me/5541988754003?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener");
        modal.close();
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    await Promise.resolve(window.BrutusmaqCatalogReady);
    carregarProdutoUsado();
    configurarGaleria();
    configurarModalVideo();
});
