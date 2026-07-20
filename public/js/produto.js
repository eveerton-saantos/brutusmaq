function produtoParametro(nome) {
    return new URLSearchParams(window.location.search).get(nome);
}

function setTexto(id, texto) {
    const elemento = document.getElementById(id);
    if (elemento) {
        elemento.textContent = texto;
    }
}

function escapeHtml(valor) {
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function slugDoProduto(produto) {
    return produto.id || produto.modelo.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function categoriaHref(produto) {
    return produto.categoriaSlug ? `equipamentos.html#${produto.categoriaSlug}` : "equipamentos.html";
}

function normalizarTexto(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function extensaoArquivo(url) {
    const caminho = String(url || "").split("?")[0].split("#")[0];
    const extensao = caminho.includes(".") ? caminho.split(".").pop() : "PDF";
    return extensao.toUpperCase();
}

function urlAbsoluta(caminho) {
    try {
        return new URL(caminho, "https://www.brutusmaq.com.br/").href;
    } catch (error) {
        return caminho;
    }
}

function listaDeTextos(valor) {
    if (Array.isArray(valor)) {
        return valor.filter(Boolean).map(String);
    }

    return valor ? [String(valor)] : [];
}

function textoNotaImagens(produto) {
    if (produto.observacaoImagens) {
        return produto.observacaoImagens;
    }

    if (produto.imagensReais === true || produto.tipoImagem === "real" || produto.tipoImagem === "reais") {
        return "Imagens reais do equipamento. Configuracoes podem variar conforme projeto.";
    }

    if (produto.tipoImagem === "mista" || produto.tipoImagem === "real-ilustrativa" || produto.tipoImagem === "reais-ilustrativas") {
        return "Galeria com imagens reais e ilustrativas. Configuracoes podem variar conforme projeto.";
    }

    return "Imagens ilustrativas do equipamento. Configuracoes podem variar conforme projeto.";
}

function produtoVazio() {
    document.title = "Produto nao encontrado | Brutusmaq";
    setTexto("produtoBreadcrumb", "Produto nao encontrado");
    setTexto("produtoStatus", "Cadastro vazio");
    setTexto("produtoCategoria", "Nenhum produto cadastrado");
    setTexto("produtoDescricao", "Ainda nao ha equipamentos reais cadastrados. Adicione os produtos no arquivo js/catalogo-produtos.js para que esta pagina seja preenchida automaticamente.");
    setTexto("produtoLinha", "Produto");
    setTexto("produtoAplicacao", "A cadastrar");
    setTexto("produtoGarantia", "A cadastrar");
    setTexto("produtoFabricacao", "A cadastrar");
    setTexto("produtoBadge", "Aguardando cadastro real");
    setTexto("produtoMediaNote", "Cadastre o produto para informar se as imagens sao reais ou ilustrativas.");
    setTexto("produtoLinhaResumo", "Equipamentos Brutusmaq");
    setTexto("produtoAplicacoesTexto", "Nenhuma aplicacao foi cadastrada para este equipamento.");

    const titulo = document.getElementById("produtoTitulo");
    if (titulo) {
        titulo.textContent = "Produto";
    }

    const tabela = document.getElementById("produtoSpecTable");
    if (tabela) {
        tabela.innerHTML = `<div><strong>Status</strong><span>Nenhum produto real cadastrado</span></div>`;
    }

    const recursos = document.getElementById("produtoRecursos");
    if (recursos) {
        recursos.innerHTML = `<li>Cadastre os produtos reais em js/catalogo-produtos.js</li>`;
    }
}

function carregarProdutoNovo() {
    const produtos = window.brutusmaqProdutosNovos || [];
    const idProduto = produtoParametro("produto");
    const produto = produtos.find((item) => slugDoProduto(item) === idProduto) || produtos[0];

    if (!produto) {
        produtoVazio();
        return;
    }

    const id = slugDoProduto(produto);
    const modelo = produto.modelo || "Produto";
    const linha = produto.linha || produto.categoria || "Equipamentos";
    const imagem = produto.imagemPrincipal || produto.imagem || "assets/main/tr-700.webp";

    atualizarSeo(produto, id, imagem);

    setTexto("produtoBreadcrumb", modelo);
    setTexto("produtoStatus", produto.status || "Lancamento");
    setTexto("produtoCategoria", produto.categoria || linha);
    setTexto("produtoDescricao", produto.resumo || produto.descricao || "Equipamento novo Brutusmaq com configuracao definida conforme aplicacao.");
    setTexto("produtoLinha", modelo);
    setTexto("produtoAplicacao", produto.aplicacao || "A definir");
    setTexto("produtoGarantia", produto.garantia || "Garantia Brutusmaq");
    setTexto("produtoFabricacao", produto.fabricacao || "100% nacional");
    setTexto("produtoBadge", produto.badge || "Projeto sob medida para sua producao");
    setTexto("produtoMediaNote", textoNotaImagens(produto));
    setTexto("produtoLinhaResumo", linha);
    setTexto("produtoNotaTecnica", produto.notaTecnica || "* Capacidades e configuracoes podem variar conforme material e condicoes de operacao.");

    const titulo = document.getElementById("produtoTitulo");
    if (titulo) {
        titulo.textContent = modelo;
    }

    const categoriaLink = document.getElementById("produtoCategoriaLink");
    if (categoriaLink) {
        categoriaLink.href = produto.categoriaHref || categoriaHref(produto);
        categoriaLink.textContent = linha;
    }

    const modalProduto = document.getElementById("modalProduto");
    if (modalProduto) {
        modalProduto.value = `${modelo} novo`;
    }

    atualizarLinksWhatsAppProduto(produto, id);

    atualizarGaleria(produto, imagem);
    atualizarEspecificacoes(produto);
    atualizarRecursos(produto);
    atualizarConteudoTecnico(produto);
    atualizarAplicacoes(produto);
    atualizarDestaques(produto);
    atualizarYoutube(produto);
    atualizarDownloads(produto);
    atualizarProdutosRelacionados(produto, id);
}

function atualizarLinksWhatsAppProduto(produto, id) {
    const modelo = produto.modelo || "equipamento";
    const categoria = produto.categoria || produto.linha || "equipamento industrial";
    const pagina = `https://www.brutusmaq.com.br/produto.html?produto=${encodeURIComponent(id)}`;
    const mensagem = `Ola, visitei a pagina do equipamento novo ${modelo} (${categoria}) e gostaria de receber mais informacoes e orientacao para a minha aplicacao. Link do equipamento: ${pagina}`;
    const href = `https://wa.me/5541988754003?text=${encodeURIComponent(mensagem)}`;

    document.querySelectorAll("[data-whatsapp-produto]").forEach((link) => {
        link.href = href;
        link.setAttribute("aria-label", `Falar no WhatsApp sobre o ${modelo}`);
    });
}

function atualizarSeo(produto, id, imagem) {
    const modelo = produto.modelo || "Equipamento";
    const descricaoCompleta = produto.descricao || produto.resumo || "Equipamento novo Brutusmaq com projeto tecnico personalizado.";
    const descricaoResumo = (produto.resumo || descricaoCompleta).slice(0, 180);
    const canonicalUrl = `https://www.brutusmaq.com.br/produto.html?produto=${encodeURIComponent(id)}`;
    const imagemUrl = urlAbsoluta(imagem);

    document.title = `${modelo} novo | Brutusmaq`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", `${modelo} novo Brutusmaq - ${descricaoResumo}`);
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonicalUrl);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", `${modelo} novo | Brutusmaq`);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", descricaoResumo);
    document.querySelector('meta[property="og:image"]')?.setAttribute("content", imagemUrl);

    const jsonLd = document.getElementById("produtoNovoJsonLd");
    if (!jsonLd) {
        return;
    }

    const imagens = normalizarGaleria(produto, imagem).map((item) => urlAbsoluta(item.src));
    const dados = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: modelo,
        description: descricaoCompleta,
        image: imagens,
        sku: id,
        category: produto.categoria || produto.linha || "Equipamento industrial",
        url: canonicalUrl,
        brand: { "@type": "Brand", name: "Brutusmaq" },
        manufacturer: { "@type": "Organization", name: "Brutusmaq" }
    };

    if (produto.specs?.length) {
        dados.additionalProperty = produto.specs.map(([nome, valor]) => ({
            "@type": "PropertyValue",
            name: String(nome),
            value: String(valor)
        }));
    }

    jsonLd.textContent = JSON.stringify(dados);
}

function normalizarGaleria(produto, imagemPadrao) {
    const cadastradas = produto.galeria?.length ? produto.galeria : [imagemPadrao];
    const principal = produto.imagemPrincipal || produto.imagem || imagemPadrao;
    const fontes = [principal, ...cadastradas];
    const vistas = [];
    const caminhos = new Set();

    fontes.forEach((item, index) => {
        const src = typeof item === "string" ? item : item?.src;
        if (!src || caminhos.has(src)) {
            return;
        }

        caminhos.add(src);
        vistas.push({
            src,
            alt: typeof item === "object" && item.alt
                ? item.alt
                : (produto.alt || `${produto.modelo || "Equipamento"} novo Brutusmaq - imagem ${index + 1}`)
        });
    });

    return vistas.length ? vistas : [{
        src: imagemPadrao,
        alt: produto.alt || `${produto.modelo || "Equipamento"} novo Brutusmaq`
    }];
}

function atualizarGaleria(produto, imagemPadrao) {
    const itensGaleria = normalizarGaleria(produto, imagemPadrao);
    const miniaturas = document.querySelector(".produto-galeria-thumbs");

    const imagemPrincipal = document.querySelector(".product-main-photo img");
    if (imagemPrincipal && itensGaleria[0]) {
        imagemPrincipal.src = itensGaleria[0].src;
        imagemPrincipal.alt = itensGaleria[0].alt;
    }

    if (miniaturas) {
        miniaturas.innerHTML = itensGaleria
            .map((item, index) => `
                <button type="button" class="${index === 0 ? "active" : ""}" aria-label="Ver imagem ${index + 1}" aria-current="${index === 0 ? "true" : "false"}">
                    <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}" ${index === 0 ? "" : 'loading="lazy"'}>
                </button>
            `)
            .join("");
    }
}

function atualizarEspecificacoes(produto) {
    const tabela = document.getElementById("produtoSpecTable");
    if (!tabela) {
        return;
    }

    const specs = produto.specs?.length ? produto.specs : [["Modelo", produto.modelo || "A definir"]];
    tabela.innerHTML = specs
        .map(([label, valor]) => `<div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(valor)}</span></div>`)
        .join("");
}

function atualizarRecursos(produto) {
    const lista = document.getElementById("produtoRecursos");
    if (!lista) {
        return;
    }

    const recursos = produto.recursos?.length ? produto.recursos : ["Configuracao conforme projeto"];
    lista.innerHTML = recursos
        .map((recurso) => `<li>${escapeHtml(recurso)}</li>`)
        .join("");
}

function atualizarConteudoTecnico(produto) {
    const titulo = document.getElementById("produtoSobreTitulo");
    const texto = document.getElementById("produtoSobreTexto");
    const beneficios = document.getElementById("produtoBeneficios");
    const modelo = produto.modelo || "O equipamento";
    const paragrafosCadastrados = listaDeTextos(produto.sobre || produto.descricaoLonga);
    const paragrafos = [produto.descricao, ...paragrafosCadastrados]
        .map((item) => String(item || "").trim())
        .filter((item, index, items) => item && items.indexOf(item) === index);
    if (!paragrafos.length) {
        paragrafos.push(`${modelo} recebe configuracao tecnica conforme as necessidades da operacao.`);
    }
    if (!paragrafosCadastrados.length) {
        paragrafos.push("Cada fornecimento pode ser dimensionado conforme material, capacidade, alimentacao, saida e condicoes de instalacao.");
    }

    if (titulo) {
        titulo.textContent = produto.sobreTitulo || `${modelo}: engenharia definida para a sua operacao`;
    }

    if (texto) {
        texto.innerHTML = paragrafos
            .map((paragrafo) => `<p>${escapeHtml(paragrafo)}</p>`)
            .join("");
    }

    if (!beneficios) return;

    const benefitItems = Array.isArray(produto.beneficios) ? produto.beneficios.slice(0, 4) : [];
    beneficios.innerHTML = "";
    beneficios.hidden = benefitItems.length === 0;
    if (!benefitItems.length) return;

    function benefitIcon(item) {
        const title = normalizarTexto(item.titulo || item.nome || "");
        if (title.includes("manutencao")) return "icone-baixa-manutencao-laranja.svg";
        if (title.includes("seguranca")) return "icone-seguranca-laranja.svg";
        if (title.includes("suporte") || title.includes("assistencia")) return "icone-assistencia-tecnica-laranja.svg";
        if (title.includes("construcao") || title.includes("robust")) return "icone-robustez-laranja.svg";
        if (title.includes("produtividade") || title.includes("desempenho")) return "icone-desempenho-laranja.svg";
        if (title.includes("eficiencia") || title.includes("energia")) return "icone-alvo-laranja.svg";
        if (title.includes("integracao")) return "icone-necessidade-laranja.svg";
        return "icone-solucao-laranja.svg";
    }

    beneficios.innerHTML = benefitItems.map((beneficio) => {
        let item = beneficio || {};
        if (typeof beneficio === "string") {
            const separatorIndex = beneficio.indexOf("|");
            item = separatorIndex === -1
                ? { titulo: beneficio }
                : {
                    titulo: beneficio.slice(0, separatorIndex).trim(),
                    texto: beneficio.slice(separatorIndex + 1).trim()
                };
        }
        const icon = benefitIcon(item || {});
        return `
            <div>
                <span class="product-benefit-icon" aria-hidden="true"><img src="assets/icones-laranjas/${icon}" alt=""></span>
                <strong>${escapeHtml(item.titulo || item.nome || "Diferencial")}</strong>
                <small>${escapeHtml(item.texto || item.descricao || "Configuracao conforme o projeto.")}</small>
            </div>
        `;
    }).join("");
}

function normalizarAplicacoes(produto) {
    const origem = Array.isArray(produto.aplicacoes) && produto.aplicacoes.length
        ? produto.aplicacoes
        : (Array.isArray(produto.materiais) && produto.materiais.length ? produto.materiais : listaDeTextos(produto.aplicacao));

    return origem.filter(Boolean).map((aplicacao) => {
        const item = typeof aplicacao === "string" ? { nome: aplicacao } : aplicacao;
        const nome = item.nome || item.titulo || item.material || "Aplicacao sob avaliacao";
        return { nome };
    });
}

function atualizarAplicacoes(produto) {
    const grid = document.getElementById("produtoAplicacoes");
    const texto = document.getElementById("produtoAplicacoesTexto");
    const aplicacoes = normalizarAplicacoes(produto);

    if (texto) {
        texto.textContent = produto.aplicacoesTexto || "A aplicacao final e validada pela equipe tecnica conforme o material, a capacidade e o processo.";
    }

    if (grid) {
        grid.innerHTML = (aplicacoes.length ? aplicacoes : [{ nome: "Aplicacao sob avaliacao tecnica" }]).map((item, index) => `
            <div>
                <span class="product-application-marker" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
                <strong>${escapeHtml(item.nome)}</strong>
            </div>
        `).join("");
    }

    if (Array.isArray(produto.materiais) && produto.materiais.length) {
        const select = document.getElementById("modalMaterial");
        if (select) {
            const materiais = normalizarAplicacoes({ materiais: produto.materiais });
            select.innerHTML = ['<option value="Ainda nao sei - preciso de orientacao">Ainda nao sei / preciso de orientacao</option>']
                .concat(materiais.map((item) => `<option value="${escapeHtml(item.nome)}">${escapeHtml(item.nome)}</option>`))
                .concat('<option value="Outro material">Outro material</option>')
                .join("");
        }
    }
}

function atualizarDestaques(produto) {
    const lista = document.getElementById("produtoDestaques");
    if (!lista) {
        return;
    }

    const destaques = listaDeTextos(produto.destaques?.length ? produto.destaques : produto.recursos).slice(0, 6);
    lista.innerHTML = (destaques.length ? destaques : ["Configuracao tecnica conforme o projeto"])
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
}

function normalizarYoutubePrivado(value) {
    try {
        const url = new URL(String(value || ""), window.location.origin);
        const hosts = new Set(["youtube.com", "www.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);
        const match = url.pathname.match(/^\/embed\/([a-z0-9_-]{6,20})\/?$/i);
        if (!hosts.has(url.hostname) || !match) return "";
        url.protocol = "https:";
        url.hostname = "www.youtube-nocookie.com";
        url.pathname = `/embed/${match[1]}`;
        url.port = "";
        url.username = "";
        url.password = "";
        url.hash = "";
        const allowedParameters = new Set(["start", "end", "cc_load_policy", "cc_lang_pref", "hl"]);
        [...url.searchParams.keys()].forEach((key) => {
            if (!allowedParameters.has(key)) url.searchParams.delete(key);
        });
        return url.href;
    } catch (error) {
        return "";
    }
}

function carregarYoutubeDireto(iframe, source, title) {
    const url = normalizarYoutubePrivado(source);
    if (!url) return false;
    iframe.removeAttribute("srcdoc");
    iframe.removeAttribute("tabindex");
    delete iframe.dataset.externalSrc;
    iframe.src = url;
    iframe.hidden = false;
    iframe.title = title;
    return true;
}

function atualizarYoutube(produto) {
    const iframe = document.getElementById("produtoYoutubeFrame");
    if (!iframe) {
        return;
    }

    const title = `Video do ${produto.modelo || "equipamento"} em funcionamento`;
    const idSource = produto.youtubeId
        ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(produto.youtubeId)}`
        : "";
    if (carregarYoutubeDireto(iframe, produto.youtubeEmbed, title)
        || carregarYoutubeDireto(iframe, idSource, title)) {
        return;
    }

    iframe.removeAttribute("src");
    delete iframe.dataset.externalSrc;
    iframe.hidden = false;
    iframe.setAttribute("tabindex", "-1");
    iframe.title = `Video do ${produto.modelo || "equipamento"} sob solicitacao`;
    iframe.srcdoc = `
        <!doctype html>
        <html lang="pt-br">
            <head><meta charset="utf-8"><link rel="stylesheet" href="/css/video-placeholder.css"></head>
            <body><div class="video-placeholder"><span class="video-placeholder-icon" aria-hidden="true">&#9654;</span><strong>Video sob solicitacao</strong><small>Peca uma demonstracao deste equipamento para a equipe Brutusmaq.</small></div></body>
        </html>`;
}

function normalizarDownloads(produto) {
    const downloads = produto.downloads || {};

    if (Array.isArray(downloads)) {
        return downloads
            .filter((item) => item?.url)
            .map((item) => ({
                titulo: item.titulo || item.label || "Documento tecnico",
                url: item.url,
                tipo: item.tipo || item.formato || extensaoArquivo(item.url),
                icone: item.icone || "▤"
            }));
    }

    const padroes = [
        ["catalogoTecnico", "Catalogo tecnico", "▤"],
        ["manualOperacao", "Manual de operacao", "▧"],
        ["desenhoTecnico", "Desenho tecnico", "▥"],
        ["certificadoNr12", "Certificado NR12", "▦"]
    ];

    return padroes
        .filter(([chave]) => downloads[chave])
        .map(([chave, titulo, icone]) => {
            const valor = downloads[chave];
            const url = typeof valor === "string" ? valor : valor.url;

            return {
                titulo: typeof valor === "string" ? titulo : (valor.titulo || titulo),
                url,
                tipo: typeof valor === "string" ? extensaoArquivo(url) : (valor.tipo || extensaoArquivo(url)),
                icone: typeof valor === "string" ? icone : (valor.icone || icone)
            };
        })
        .filter((item) => item.url);
}

function atualizarDownloads(produto) {
    const secao = document.querySelector(".product-downloads");
    const grid = document.getElementById("produtoDownloadGrid");

    if (!secao || !grid) {
        return;
    }

    const downloads = normalizarDownloads(produto);
    secao.hidden = downloads.length === 0;

    if (!downloads.length) {
        grid.innerHTML = "";
        return;
    }

    grid.innerHTML = downloads
        .map((item) => `
            <a href="${escapeHtml(item.url)}" download>
                <span aria-hidden="true">${escapeHtml(item.icone)}</span>
                <strong>${escapeHtml(item.titulo)}</strong>
                <small>${escapeHtml(item.tipo)}</small>
            </a>
        `)
        .join("");
}

function produtoRelacionadoCard(item) {
    const etiqueta = item.etiqueta ? `<span>${escapeHtml(item.etiqueta)}</span>` : "";

    return `
        <a class="product-related-card ${item.tipo === "usado" ? "product-related-card-used" : ""}" href="${escapeHtml(item.url)}" aria-label="Ver detalhes do ${escapeHtml(item.modelo)}">
            ${etiqueta}
            <img src="${escapeHtml(item.imagem)}" alt="${escapeHtml(item.alt)}" loading="lazy">
            <h3>${escapeHtml(item.modelo)}</h3>
            <p>${escapeHtml(item.categoria)}</p>
            <strong>${escapeHtml(item.cta)}</strong>
        </a>
    `;
}

function atualizarProdutosRelacionados(produtoAtual, idAtual) {
    const container = document.getElementById("productRelatedRow");
    const secao = document.querySelector(".product-related");

    if (!container || !secao) {
        return;
    }

    const categoriaAtual = produtoAtual.categoriaSlug || "";
    const linhaAtual = normalizarTexto(produtoAtual.linha || produtoAtual.categoria || "");

    const novos = (window.brutusmaqProdutosNovos || []).map((produto) => ({
        tipo: "novo",
        id: slugDoProduto(produto),
        categoriaSlug: produto.categoriaSlug || "",
        linha: normalizarTexto(produto.linha || produto.categoria || ""),
        modelo: produto.modelo || "Produto",
        categoria: produto.categoria || produto.linha || "Equipamento novo",
        imagem: produto.imagemPrincipal || produto.imagem || "assets/main/tr-700.webp",
        alt: produto.alt || produto.modelo || "Equipamento Brutusmaq",
        url: `produto.html?produto=${encodeURIComponent(slugDoProduto(produto))}`,
        cta: produto.cta || "Ver detalhes",
        etiqueta: produto.etiqueta || produto.badgeRelacionado || ""
    }));

    const usados = (window.brutusmaqMaquinasUsadas || []).map((produto) => ({
        tipo: "usado",
        id: produto.id || slugDoProduto(produto),
        categoriaSlug: produto.categoriaSlug || "",
        linha: normalizarTexto(produto.linha || produto.categoria || ""),
        modelo: produto.modelo || "Maquina usada",
        categoria: produto.categoria || "Equipamento usado",
        imagem: produto.imagem || "assets/main/tr-700.webp",
        alt: produto.alt || produto.modelo || "Equipamento usado Brutusmaq",
        url: produto.url || `maquina-usada.html?id=${encodeURIComponent(produto.id || slugDoProduto(produto))}`,
        cta: produto.cta || "Ver detalhes",
        etiqueta: produto.status || "Usado"
    }));

    const idsRelacionados = new Set();
    const relacionados = [...novos, ...usados]
        .filter((item) => !(item.tipo === "novo" && item.id === idAtual))
        .filter((item) => (
            (categoriaAtual && item.categoriaSlug === categoriaAtual)
            || (!categoriaAtual && linhaAtual && item.linha === linhaAtual)
        ))
        .filter((item) => {
            const chave = `${item.tipo}:${item.id}`;
            if (idsRelacionados.has(chave)) {
                return false;
            }
            idsRelacionados.add(chave);
            return true;
        })
        .slice(0, 5);

    if (!relacionados.length) {
        container.innerHTML = `<p class="product-related-empty">Nenhum produto relacionado cadastrado no momento.</p>`;
        return;
    }

    container.innerHTML = relacionados.map(produtoRelacionadoCard).join("");
}

function configurarGaleria() {
    const principal = document.querySelector(".product-main-photo img");
    const fotoPrincipal = document.querySelector(".product-main-photo");
    const botaoAnterior = document.querySelector(".product-gallery-prev");
    const botaoProximo = document.querySelector(".product-gallery-next");
    const botoes = [...document.querySelectorAll(".produto-galeria-thumbs button")].filter((botao) => !botao.hidden);
    let indiceAtual = 0;

    if (!principal || !botoes.length) {
        return;
    }

    [principal, ...botoes.map((botao) => botao.querySelector("img"))].filter(Boolean).forEach((imagem) => {
        imagem.addEventListener("error", () => {
            if (imagem.dataset.fallbackAplicado === "true") {
                return;
            }

            imagem.dataset.fallbackAplicado = "true";
            imagem.src = "assets/main/tr-700.webp";
            imagem.alt = "Imagem provisoria de equipamento Brutusmaq";
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
        botao.addEventListener("click", () => {
            mostrarImagem(index);
        });
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

        if (Math.abs(diferenca) < 40) {
            return;
        }

        mostrarImagem(diferenca > 0 ? indiceAtual - 1 : indiceAtual + 1);
    }, { passive: true });

    const esconderSetas = botoes.length <= 1;
    if (botaoAnterior) {
        botaoAnterior.hidden = esconderSetas;
    }

    if (botaoProximo) {
        botaoProximo.hidden = esconderSetas;
    }

    if (fotoPrincipal && esconderSetas) {
        fotoPrincipal.removeAttribute("tabindex");
        fotoPrincipal.setAttribute("aria-label", "Imagem principal do equipamento");
    }
}

function configurarModal() {
    const modal = document.getElementById("solicitacaoVideoModal");
    const abrir = document.getElementById("abrirSolicitacaoVideo");
    const abrirProposta = [...document.querySelectorAll("[data-open-proposal-modal]")];
    const fechar = document.getElementById("fecharSolicitacaoVideo");
    const form = document.getElementById("formSolicitacaoVideo");
    const continuarFormulario = document.getElementById("continuarFormularioProposta");
    const materialInput = document.getElementById("modalMaterial");
    const detalhesInput = document.getElementById("modalDetalhes");

    if (!modal || !fechar || !form) {
        return;
    }

    function obterContextoProposta() {
        return {
            tipo: "proposta-tecnica",
            produto: produtoParametro("id") || produtoParametro("produto") || "",
            modelo: document.getElementById("modalProduto")?.value || document.getElementById("produtoTitulo")?.textContent || "Equipamento novo",
            categoria: document.getElementById("produtoCategoria")?.textContent || "",
            material: materialInput?.value || "",
            detalhes: detalhesInput?.value.trim() || "",
            pagina: window.location.href,
            origem: "Página do produto"
        };
    }

    function atualizarContinuacaoFormulario() {
        if (!continuarFormulario) {
            return;
        }

        const contexto = obterContextoProposta();
        const urlFormulario = new URL("contato.html", window.location.href);

        ["tipo", "produto", "modelo", "categoria", "material", "pagina", "origem"].forEach((chave) => {
            if (contexto[chave]) {
                urlFormulario.searchParams.set(chave, contexto[chave]);
            }
        });

        urlFormulario.hash = "proposta-tecnica";
        continuarFormulario.href = urlFormulario.href;
    }

    function abrirModal(event) {
        event?.preventDefault();
        if (modal.open) {
            return;
        }

        atualizarContinuacaoFormulario();

        if (typeof modal.showModal === "function") {
            modal.showModal();
        } else {
            modal.setAttribute("open", "");
        }
    }

    abrir?.addEventListener("click", abrirModal);
    abrirProposta.forEach((botao) => {
        botao.addEventListener("click", abrirModal);
    });

    fechar.addEventListener("click", () => modal.close());

    materialInput?.addEventListener("change", atualizarContinuacaoFormulario);
    detalhesInput?.addEventListener("input", atualizarContinuacaoFormulario);

    continuarFormulario?.addEventListener("click", () => {
        try {
            window.sessionStorage.setItem("brutusmaq:proposta-contexto", JSON.stringify(obterContextoProposta()));
        } catch (error) {
            // Os parametros essenciais continuam na URL quando o armazenamento estiver indisponivel.
        }
    });

    form.addEventListener("submit", () => {
        const contexto = obterContextoProposta();
        const produto = contexto.modelo;
        const material = contexto.material || "material";
        const detalhes = contexto.detalhes || "sem detalhes adicionais";
        const mensagem = `Ola, tenho interesse no ${produto}. Gostaria de solicitar uma proposta para o material: ${material}. Detalhes: ${detalhes}. Pagina consultada: ${contexto.pagina}`;
        window.open(`https://wa.me/5541988754003?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener");
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    await Promise.resolve(window.BrutusmaqCatalogReady);
    carregarProdutoNovo();
    configurarGaleria();
    configurarModal();
});
