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
    return `equipamentos.html#${produto.categoriaSlug || "trituradores"}`;
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
    const imagem = produto.imagem || "assets/main/tr-700.png";

    document.title = `${modelo} novo | Brutusmaq`;

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
        metaDescription.setAttribute("content", `${modelo} novo Brutusmaq - ${produto.descricao || "Solicite proposta tecnica personalizada."}`);
    }

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
        canonical.setAttribute("href", `https://www.brutusmaq.com.br/produto.html?produto=${encodeURIComponent(id)}`);
    }

    setTexto("produtoBreadcrumb", modelo);
    setTexto("produtoStatus", produto.status || "Lancamento");
    setTexto("produtoCategoria", produto.categoria || linha);
    setTexto("produtoDescricao", produto.descricao || "Equipamento novo Brutusmaq com configuracao definida conforme aplicacao.");
    setTexto("produtoLinha", modelo);
    setTexto("produtoAplicacao", produto.aplicacao || "A definir");
    setTexto("produtoGarantia", produto.garantia || "Garantia Brutusmaq");
    setTexto("produtoFabricacao", produto.fabricacao || "100% nacional");
    setTexto("produtoBadge", produto.badge || "Projeto sob medida para sua producao");
    setTexto("produtoMediaNote", textoNotaImagens(produto));

    const titulo = document.getElementById("produtoTitulo");
    if (titulo) {
        titulo.textContent = modelo;
    }

    const categoriaLink = document.getElementById("produtoCategoriaLink");
    if (categoriaLink) {
        categoriaLink.href = produto.categoriaHref || categoriaHref(produto);
        categoriaLink.textContent = linha;
    }

    const imagemPrincipal = document.getElementById("produtoImagemPrincipal");
    if (imagemPrincipal) {
        imagemPrincipal.src = imagem;
        imagemPrincipal.alt = produto.alt || `${modelo} novo Brutusmaq`;
    }

    const modalProduto = document.getElementById("modalProduto");
    if (modalProduto) {
        modalProduto.value = `${modelo} novo`;
    }

    atualizarGaleria(produto, imagem);
    atualizarEspecificacoes(produto);
    atualizarRecursos(produto);
    atualizarYoutube(produto);
    atualizarDownloads(produto);
    atualizarProdutosRelacionados(produto, id);
}

function atualizarGaleria(produto, imagemPadrao) {
    const imagens = produto.galeria?.length ? produto.galeria : [imagemPadrao, imagemPadrao, imagemPadrao, imagemPadrao, imagemPadrao];
    const itensGaleria = imagens.map((item, index) => {
        if (typeof item === "string") {
            return {
                src: item,
                alt: produto.alt || `${produto.modelo} novo Brutusmaq - imagem ${index + 1}`
            };
        }

        return {
            src: item.src || imagemPadrao,
            alt: item.alt || produto.alt || `${produto.modelo} novo Brutusmaq - imagem ${index + 1}`
        };
    });
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
                    <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}">
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

function atualizarYoutube(produto) {
    const iframe = document.getElementById("produtoYoutubeFrame");
    if (!iframe) {
        return;
    }

    if (produto.youtubeEmbed) {
        iframe.src = produto.youtubeEmbed;
        iframe.title = `Video do ${produto.modelo || "equipamento"} em funcionamento`;
        return;
    }

    if (produto.youtubeId) {
        iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(produto.youtubeId)}`;
        iframe.title = `Video do ${produto.modelo || "equipamento"} em funcionamento`;
        return;
    }

    const busca = encodeURIComponent(produto.youtubeBusca || `${produto.modelo || "Brutusmaq"} funcionando`);
    iframe.src = `https://www.youtube.com/embed?listType=search&list=${busca}`;
    iframe.title = `Video do ${produto.modelo || "equipamento"} novo em funcionamento`;
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
            <img src="${escapeHtml(item.imagem)}" alt="${escapeHtml(item.alt)}">
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
        imagem: produto.imagem || "assets/main/tr-700.png",
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
        imagem: produto.imagem || "assets/main/tr-700.png",
        alt: produto.alt || produto.modelo || "Equipamento usado Brutusmaq",
        url: produto.url || `maquina-usada.html?id=${encodeURIComponent(produto.id || slugDoProduto(produto))}`,
        cta: produto.cta || "Ver detalhes",
        etiqueta: produto.status || "Usado"
    }));

    const relacionados = [...novos, ...usados]
        .filter((item) => !(item.tipo === "novo" && item.id === idAtual))
        .filter((item) => (
            (categoriaAtual && item.categoriaSlug === categoriaAtual)
            || (!categoriaAtual && linhaAtual && item.linha === linhaAtual)
        ))
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
}

function configurarModal() {
    const modal = document.getElementById("solicitacaoVideoModal");
    const abrir = document.getElementById("abrirSolicitacaoVideo");
    const fechar = document.getElementById("fecharSolicitacaoVideo");
    const form = document.getElementById("formSolicitacaoVideo");

    if (!modal || !abrir || !fechar || !form) {
        return;
    }

    abrir.addEventListener("click", () => {
        if (typeof modal.showModal === "function") {
            modal.showModal();
        }
    });

    fechar.addEventListener("click", () => modal.close());

    form.addEventListener("submit", () => {
        const produto = document.getElementById("modalProduto")?.value || "equipamento novo";
        const material = document.getElementById("modalMaterial")?.value || "material";
        const detalhes = document.getElementById("modalDetalhes")?.value || "sem detalhes adicionais";
        const mensagem = `Ola, tenho interesse no ${produto}. Gostaria de solicitar proposta/teste para o material: ${material}. Detalhes: ${detalhes}`;
        window.open(`https://wa.me/5541988754003?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener");
    });
}

document.addEventListener("DOMContentLoaded", () => {
    carregarProdutoNovo();
    configurarGaleria();
    configurarModal();
});
