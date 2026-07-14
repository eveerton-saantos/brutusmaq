const maquinasUsadasCatalogo = window.brutusmaqMaquinasUsadas || [];

function escaparHtml(valor) {
    return String(valor).replace(/[&<>"']/g, (caractere) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[caractere]));
}

function anoCorresponde(produtoAno, filtroAno) {
    if (!filtroAno) {
        return true;
    }

    if (filtroAno === "2020-ou-anterior") {
        return Number(produtoAno) <= 2020;
    }

    return produtoAno === filtroAno;
}

function normalizarBusca(valor) {
    return String(valor)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[-_]/g, " ")
        .toLowerCase()
        .trim();
}

function criarCardMaquinaUsada(produto) {
    const especificacoes = (produto.especificacoes || [])
        .map((item) => `<li>${escaparHtml(item)}</li>`)
        .join("");

    const modelo = produto.modelo || "Maquina usada";
    const url = produto.url || `maquina-usada.html?id=${encodeURIComponent(produto.id)}`;

    return `
        <a href="${escaparHtml(url)}" class="usadas-product-card" itemscope itemtype="https://schema.org/Product" aria-label="Ver detalhes do ${escaparHtml(modelo)}">
            <span class="usadas-status ${escaparHtml(produto.statusClasse || "status-disponivel")}">${escaparHtml(produto.status || "Disponivel")}</span>
            <div class="usadas-product-image">
                <img src="${escaparHtml(produto.imagem || "assets/main/tr-700.png")}" alt="${escaparHtml(produto.alt || modelo)}" itemprop="image">
            </div>
            <h3 itemprop="name">${escaparHtml(modelo)}</h3>
            <span class="usadas-product-category" itemprop="category">${escaparHtml(produto.categoria || "Equipamento usado")}</span>
            <meta itemprop="brand" content="Brutusmaq">
            <p class="sr-only" itemprop="description">${escaparHtml(produto.descricao || "")}</p>
            <ul aria-label="Especificacoes principais do ${escaparHtml(modelo)} usado">
                ${especificacoes}
            </ul>
            <span class="usadas-card-btn" itemprop="url">${escaparHtml(produto.cta || "Ver detalhes")} <span aria-hidden="true">→</span></span>
        </a>
    `;
}

function configurarCatalogoUsadas() {
    const grid = document.getElementById("usadas-products-grid");
    const form = document.querySelector(".usadas-filter-bar");
    const contadorResultados = document.getElementById("usadas-results-count");

    if (!grid || !form) {
        return;
    }

    const busca = document.getElementById("busca-usadas");
    const categoria = document.getElementById("categoria-usadas");
    const modelo = document.getElementById("modelo-usadas");
    const ano = document.getElementById("ano-usadas");
    const status = document.getElementById("status-usadas");

    if (ano) {
        const anoAtual = new Date().getFullYear();
        const anosRecentes = Array.from(
            { length: Math.max(anoAtual - 2020, 1) },
            (_, indice) => anoAtual - indice
        );

        ano.innerHTML = [
            `<option value="">Ano: todos</option>`,
            ...anosRecentes.map((valor) => `<option value="${valor}">${valor}</option>`),
            `<option value="2020-ou-anterior">2020 ou anterior</option>`
        ].join("");
    }

    if (modelo) {
        const modelosUnicos = Array.from(
            new Map(
                maquinasUsadasCatalogo
                    .filter((produto) => produto.id && produto.modelo)
                    .map((produto) => [produto.id, produto])
            ).values()
        ).sort((produtoA, produtoB) => produtoA.modelo.localeCompare(produtoB.modelo, "pt-BR", { numeric: true }));

        modelo.innerHTML = [
            `<option value="">Todos os modelos</option>`,
            ...modelosUnicos.map((produto) => (
                `<option value="${escaparHtml(produto.id)}">${escaparHtml(produto.modelo)}</option>`
            ))
        ].join("");
    }

    const renderizar = () => {
        const termo = normalizarBusca(busca?.value || "");
        const categoriaValor = categoria?.value || "";
        const modeloValor = modelo?.value || "";
        const anoValor = ano?.value || "";
        const statusValor = status?.value || "";

        const filtrados = maquinasUsadasCatalogo.filter((produto) => {
            const textoBusca = normalizarBusca(`${produto.modelo || ""} ${(produto.modelo || "").replace("-", "")} ${produto.categoria || ""} ${produto.status || ""} ${produto.descricao || ""}`);

            return (!termo || textoBusca.includes(termo))
                && (!categoriaValor || produto.categoriaSlug === categoriaValor)
                && (!modeloValor || produto.id === modeloValor)
                && anoCorresponde(produto.ano, anoValor)
                && (!statusValor || produto.statusSlug === statusValor);
        });

        if (contadorResultados) {
            contadorResultados.textContent = filtrados.length === 1
                ? "1 máquina encontrada"
                : `${filtrados.length} máquinas encontradas`;
        }

        const possuiFiltros = Boolean(termo || categoriaValor || modeloValor || anoValor || statusValor);
        const tituloVazio = possuiFiltros
            ? "Nenhuma máquina corresponde aos filtros"
            : "Novas oportunidades chegam a todo momento";
        const mensagemVazia = possuiFiltros
            ? "Ajuste ou limpe os filtros para consultar todo o estoque disponível."
            : "No momento não há máquinas usadas cadastradas. Fale com nossa equipe e avise qual equipamento você procura.";

        grid.innerHTML = filtrados.length
            ? filtrados.map(criarCardMaquinaUsada).join("")
            : `
                <div class="usadas-empty-state">
                    <span class="usadas-empty-icon" aria-hidden="true">
                        <img src="assets/icones-laranjas/icone-avaliacao-laranja.svg" alt="">
                    </span>
                    <div>
                        <h3>${tituloVazio}</h3>
                        <p>${mensagemVazia}</p>
                    </div>
                    ${possuiFiltros
                        ? `<button type="button" class="usadas-btn-primary" data-limpar-filtros>Limpar filtros</button>`
                        : `<a href="contato.html#canais-atendimento" class="usadas-btn-primary">Falar com especialista <span aria-hidden="true">→</span></a>`}
                </div>`;

        grid.querySelector("[data-limpar-filtros]")?.addEventListener("click", () => form.reset());
    };

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        renderizar();
    });

    form.addEventListener("input", renderizar);
    form.addEventListener("change", renderizar);
    form.addEventListener("reset", () => {
        window.setTimeout(renderizar, 0);
    });

    renderizar();
}

document.addEventListener("DOMContentLoaded", configurarCatalogoUsadas);
