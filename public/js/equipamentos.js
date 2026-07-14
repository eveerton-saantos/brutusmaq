(function () {
    const categorias = {
        trituradores: {
            titulo: "Trituradores",
            rowSelector: "#trituradores .equipamentos-products-row",
            emptyText: "Nenhum triturador cadastrado no momento.",
            maisTexto: "Ver mais trituradores"
        },
        moinhos: {
            titulo: "Moinhos",
            rowSelector: "#moinhos .equipamentos-products-row",
            emptyText: "Nenhum moinho cadastrado no momento.",
            maisTexto: "Ver mais moinhos"
        },
        picadores: {
            titulo: "Picadores",
            rowSelector: "#picadores .equipamentos-products-row",
            emptyText: "Nenhum picador cadastrado no momento.",
            maisTexto: "Ver mais picadores"
        },
        esteiras: {
            titulo: "Esteiras",
            rowSelector: "#esteiras .equipamentos-products-row",
            emptyText: "Nenhuma esteira cadastrada no momento.",
            maisTexto: "Ver mais esteiras"
        }
    };
    const LIMITE_PRODUTOS_DESKTOP = 4;
    const LIMITE_PRODUTOS_MOBILE = 3;
    const mediaProdutosMobile = window.matchMedia("(max-width: 680px)");

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

    function numeroDoModelo(produto) {
        const texto = produto.modelo || produto.id || "";
        const numero = String(texto).match(/\d+/);

        return numero ? Number(numero[0]) : Number.MAX_SAFE_INTEGER;
    }

    function ordenarProdutos(produtos) {
        return [...produtos].sort((a, b) => {
            const numeroA = numeroDoModelo(a);
            const numeroB = numeroDoModelo(b);

            if (numeroA !== numeroB) {
                return numeroA - numeroB;
            }

            return String(a.modelo || a.id || "").localeCompare(String(b.modelo || b.id || ""), "pt-BR", { numeric: true });
        });
    }

    function limiteProdutosVisiveis() {
        return mediaProdutosMobile.matches ? LIMITE_PRODUTOS_MOBILE : LIMITE_PRODUTOS_DESKTOP;
    }

    function atualizarBotaoCategoria(slug, config, totalProdutos) {
        const botao = document.querySelector(`[data-category-toggle="${slug}"]`);
        const row = document.querySelector(config.rowSelector);

        if (!botao || !row) {
            return;
        }

        const temProdutosExtras = totalProdutos > limiteProdutosVisiveis();

        botao.hidden = !temProdutosExtras;
        botao.setAttribute("aria-controls", `${slug}-produtos`);

        if (!temProdutosExtras) {
            return;
        }

        botao.innerHTML = `${escaparHtml(config.maisTexto)} <span aria-hidden="true">↓</span>`;
        botao.setAttribute("aria-expanded", "false");

        botao.onclick = () => {
            const expandido = row.classList.toggle("is-expanded");

            botao.setAttribute("aria-expanded", expandido ? "true" : "false");
            botao.innerHTML = expandido
                ? `Mostrar menos <span aria-hidden="true">↑</span>`
                : `${escaparHtml(config.maisTexto)} <span aria-hidden="true">↓</span>`;
        };
    }

    function renderizarCategoria(slug, config, produtos) {
        const row = document.querySelector(config.rowSelector);
        if (!row) {
            return;
        }

        const produtosDaCategoria = ordenarProdutos(produtos.filter((produto) => produto.categoriaSlug === slug));
        const limite = limiteProdutosVisiveis();

        row.id = `${slug}-produtos`;

        row.innerHTML = produtosDaCategoria.length
            ? produtosDaCategoria.map((produto, index) => {
                const card = criarCardProduto(produto);

                if (index < limite) {
                    return card;
                }

                return card.replace('class="equipamentos-product"', 'class="equipamentos-product equipamentos-product-extra"');
            }).join("")
            : `<div class="equipamentos-empty-state">${escaparHtml(config.emptyText)}</div>`;

        row.classList.remove("is-expanded");
        atualizarBotaoCategoria(slug, config, produtosDaCategoria.length);
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

        mediaProdutosMobile.addEventListener("change", renderizarEquipamentos);
    });
}());
