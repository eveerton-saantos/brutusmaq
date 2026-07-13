const maquinasUsadas = window.brutusmaqMaquinasUsadas || [];

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

function carregarProdutoUsado() {
    const idProduto = pegarParametroUrl("id");
    const produto = maquinasUsadas.find((item) => item.id === idProduto) || maquinasUsadas[0];

    if (!produto) {
        document.title = "Maquina usada nao encontrada | Brutusmaq";
        atualizarTexto("produtoStatus", "Cadastro vazio");
        atualizarTexto("produtoCategoria", "Nenhuma maquina usada cadastrada");
        atualizarTexto("produtoDescricao", "Ainda nao ha maquinas usadas reais cadastradas. Adicione os equipamentos no arquivo js/catalogo-produtos.js para preencher esta pagina.");
        atualizarTexto("produtoBreadcrumb", "Cadastro vazio");
        atualizarTexto("produtoAno", "A cadastrar");
        atualizarTexto("produtoCondicao", "A cadastrar");
        atualizarTexto("produtoGarantia", "A cadastrar");
        atualizarTexto("produtoLocalizacao", "A cadastrar");

        const tituloVazio = document.getElementById("produtoTitulo");
        if (tituloVazio) {
            tituloVazio.innerHTML = "Maquina <strong>usada</strong>";
        }

        const tabela = document.getElementById("produtoSpecTable");
        if (tabela) {
            tabela.innerHTML = `<div><strong>Status</strong><span>Nenhuma maquina usada real cadastrada</span></div>`;
        }

        return;
    }

    const breadcrumb = produto.breadcrumb || `${produto.modelo} usado`;
    document.title = `${breadcrumb} | Brutusmaq`;

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
        metaDescription.setAttribute("content", `${breadcrumb} - ${produto.descricao || ""} Solicite video, teste com material e proposta tecnica.`);
    }

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
        canonical.setAttribute("href", `https://www.brutusmaq.com.br/maquina-usada.html?id=${encodeURIComponent(produto.id)}`);
    }

    const status = document.getElementById("produtoStatus");
    const titulo = document.getElementById("produtoTitulo");
    const imagemPrincipal = document.getElementById("produtoImagemPrincipal");
    const modalProduto = document.getElementById("modalProduto");

    if (status) {
        status.textContent = produto.status || "Disponivel";
        status.className = `produto-status ${produto.statusClasse || "status-disponivel"}`;
    }

    if (titulo) {
        titulo.innerHTML = `${escaparHtml(produto.modelo || "Maquina")} <strong>usado</strong>`;
    }

    atualizarTexto("produtoCategoria", produto.categoria || "Equipamento usado");
    atualizarTexto("produtoDescricao", produto.descricao || "");
    atualizarTexto("produtoBreadcrumb", breadcrumb);
    atualizarTexto("produtoAno", produto.ano || "A consultar");
    atualizarTexto("produtoCondicao", produto.condicao || produto.status || "A consultar");
    atualizarTexto("produtoGarantia", produto.garantia || "A consultar");
    atualizarTexto("produtoLocalizacao", produto.localizacao || "Contenda - PR");

    if (imagemPrincipal) {
        imagemPrincipal.src = produto.imagem || "assets/main/tr-700.png";
        imagemPrincipal.alt = `${breadcrumb} Brutusmaq`;
    }

    if (modalProduto) {
        modalProduto.value = breadcrumb;
    }

    atualizarGaleria(produto);
    atualizarEspecificacoes(produto);
    atualizarYoutube(produto);
}

function atualizarGaleria(produto) {
    const imagem = produto.imagem || "assets/main/tr-700.png";
    document.querySelectorAll(".produto-galeria-layout img").forEach((item) => {
        item.src = imagem;
        item.alt = produto.alt || produto.modelo || "Maquina usada Brutusmaq";
    });
}

function atualizarEspecificacoes(produto) {
    const tabela = document.getElementById("produtoSpecTable");
    if (!tabela) {
        return;
    }

    const specs = produto.specs?.length ? produto.specs : [["Modelo", produto.modelo || "A consultar"]];
    tabela.innerHTML = specs
        .map(([label, value]) => `<div><strong>${escaparHtml(label)}</strong><span>${escaparHtml(value)}</span></div>`)
        .join("");
}

function atualizarYoutube(produto) {
    const iframe = document.getElementById("produtoYoutubeFrame");
    if (!iframe) {
        return;
    }

    const busca = encodeURIComponent(produto.youtubeBusca || `${produto.modelo || "Brutusmaq"} funcionando`);
    iframe.src = `https://www.youtube.com/embed?listType=search&list=${busca}`;
    iframe.title = `Video do ${produto.modelo || "equipamento"} em funcionamento`;
}

function configurarGaleria() {
    const principal = document.querySelector(".produto-main-photo img");
    const botoes = document.querySelectorAll(".produto-galeria-thumbs button");

    botoes.forEach((botao) => {
        botao.addEventListener("click", () => {
            const imagem = botao.querySelector("img");
            if (principal && imagem) {
                principal.src = imagem.src;
                principal.alt = imagem.alt;
            }

            botoes.forEach((item) => item.classList.remove("active"));
            botao.classList.add("active");
        });
    });
}

function configurarModalVideo() {
    const modal = document.getElementById("solicitacaoVideoModal");
    const abrirVideo = document.getElementById("abrirSolicitacaoVideo");
    const abrirProposta = document.getElementById("abrirPropostaVideo");
    const fechar = document.getElementById("fecharSolicitacaoVideo");
    const form = document.getElementById("formSolicitacaoVideo");

    if (!modal) {
        return;
    }

    const abrirModal = () => {
        if (typeof modal.showModal === "function") {
            modal.showModal();
        } else {
            modal.setAttribute("open", "");
        }
    };

    abrirVideo?.addEventListener("click", abrirModal);
    abrirProposta?.addEventListener("click", abrirModal);
    fechar?.addEventListener("click", () => modal.close());

    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            modal.close();
        }
    });

    form?.addEventListener("submit", (event) => {
        event.preventDefault();

        const produto = document.getElementById("modalProduto")?.value || "equipamento usado";
        const material = document.getElementById("modalMaterial")?.value || "material a definir";
        const detalhes = document.getElementById("modalDetalhes")?.value.trim() || "Gostaria de receber um video do equipamento em funcionamento.";
        const mensagem = `Ola, tenho interesse no ${produto}. Gostaria de solicitar um video/teste com o material: ${material}. Detalhes: ${detalhes}`;
        const url = `https://wa.me/5541988754003?text=${encodeURIComponent(mensagem)}`;

        window.open(url, "_blank", "noopener");
        modal.close();
    });
}

document.addEventListener("DOMContentLoaded", () => {
    carregarProdutoUsado();
    configurarGaleria();
    configurarModalVideo();
});
