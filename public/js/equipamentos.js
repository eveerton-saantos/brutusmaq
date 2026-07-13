(function () {
    const categorias = {
        trituradores: {
            titulo: "Trituradores",
            rowSelector: "#trituradores .equipamentos-products-row",
            emptyText: "Nenhum triturador cadastrado no momento."
        },
        moinhos: {
            titulo: "Moinhos",
            rowSelector: "#moinhos .equipamentos-products-row",
            emptyText: "Nenhum moinho cadastrado no momento."
        },
        picadores: {
            titulo: "Picadores",
            rowSelector: "#picadores .equipamentos-products-row",
            emptyText: "Nenhum picador cadastrado no momento."
        },
        esteiras: {
            titulo: "Esteiras",
            rowSelector: "#esteiras .equipamentos-products-row",
            emptyText: "Nenhuma esteira cadastrada no momento."
        }
    };

    function escaparHtml(valor) {
        return String(valor).replace(/[&<>"']/g, (caractere) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[caractere]));
    }

    function criarCardProduto(produto) {
        const id = produto.id || produto.modelo.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const modelo = produto.modelo || "Produto";
        const resumo = produto.resumo || produto.descricao || "Consulte as especificacoes deste equipamento.";
        const imagem = produto.imagem || "assets/main/tr-700.png";
        const alt = produto.alt || `${modelo} Brutusmaq`;

        return `
            <a class="equipamentos-product" id="${escaparHtml(id)}" href="produto.html?produto=${encodeURIComponent(id)}" aria-label="Ver produto ${escaparHtml(modelo)}">
                <img src="${escaparHtml(imagem)}" alt="${escaparHtml(alt)}">
                <h3>${escaparHtml(modelo)}</h3>
                <p>${escaparHtml(resumo)}</p>
            </a>
        `;
    }

    function renderizarCategoria(slug, config, produtos) {
        const row = document.querySelector(config.rowSelector);
        if (!row) {
            return;
        }

        const produtosDaCategoria = produtos.filter((produto) => produto.categoriaSlug === slug);

        row.innerHTML = produtosDaCategoria.length
            ? produtosDaCategoria.map(criarCardProduto).join("")
            : `<div class="equipamentos-empty-state">${escaparHtml(config.emptyText)}</div>`;
    }

    function renderizarEquipamentos() {
        const produtos = window.brutusmaqProdutosNovos || [];

        Object.entries(categorias).forEach(([slug, config]) => {
            renderizarCategoria(slug, config, produtos);
        });
    }

    function ativarTabCategoria(tabAtiva) {
        const tabs = document.querySelectorAll(".equipamentos-tabs a");

        tabs.forEach((tab) => {
            const ativa = tab === tabAtiva;

            tab.classList.toggle("active", ativa);
            tab.setAttribute("aria-current", ativa ? "true" : "false");
        });
    }

    function encontrarTabPorHash(hash) {
        if (!hash) {
            return null;
        }

        return document.querySelector(`.equipamentos-tabs a[href="${hash}"]`);
    }

    function configurarTabsCategorias() {
        const tabs = document.querySelectorAll(".equipamentos-tabs a");

        tabs.forEach((tab) => {
            tab.addEventListener("click", () => {
                ativarTabCategoria(tab);
            });
        });

        const tabInicial = encontrarTabPorHash(window.location.hash) || document.querySelector(".equipamentos-tabs a.active") || tabs[0];

        if (tabInicial) {
            ativarTabCategoria(tabInicial);
        }

        window.addEventListener("hashchange", () => {
            const tabPorHash = encontrarTabPorHash(window.location.hash);

            if (tabPorHash) {
                ativarTabCategoria(tabPorHash);
            }
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        renderizarEquipamentos();
        configurarTabsCategorias();
    });
}());
