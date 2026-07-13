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

    if (!grid || !form) {
        return;
    }

    const busca = document.getElementById("busca-usadas");
    const categoria = document.getElementById("categoria-usadas");
    const modelo = document.getElementById("modelo-usadas");
    const ano = document.getElementById("ano-usadas");
    const status = document.getElementById("status-usadas");

    if (modelo) {
        modelo.innerHTML = [
            `<option value="">Todos os modelos</option>`,
            ...maquinasUsadasCatalogo.map((produto) => (
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

        grid.innerHTML = filtrados.length
            ? filtrados.map(criarCardMaquinaUsada).join("")
            : `<div class="usadas-empty-state">Nenhuma maquina usada real cadastrada no momento.</div>`;
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
