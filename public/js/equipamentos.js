(function () {
    const HERO_STORAGE_KEY = "brutusmaq-equipamentos-hero-anterior";
    const HERO_FALLBACK_IMAGE = "assets/main/tr-700.webp";

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
        esteiras: {
            titulo: "Esteiras",
            rowSelector: "#esteiras .equipamentos-products-row",
            emptyText: "Nenhuma esteira cadastrada no momento.",
            maisTexto: "Ver mais esteiras",
            aliases: ["esteiras-transportadoras"]
        },
        "outros-equipamentos": {
            titulo: "Outros equipamentos",
            rowSelector: "#outros-equipamentos .equipamentos-products-row",
            emptyText: "Nenhum equipamento complementar cadastrado no momento.",
            maisTexto: "Ver mais equipamentos",
            aliases: ["outros"]
        }
    };
    const LIMITE_PRODUTOS_DESKTOP = 4;
    const LIMITE_PRODUTOS_MOBILE = 3;
    const mediaProdutosMobile = window.matchMedia("(max-width: 680px)");

    function obterImagemPrincipal(produto) {
        const imagemPrincipal = typeof produto?.imagemPrincipal === "string"
            ? produto.imagemPrincipal.trim()
            : "";

        return imagemPrincipal || produto?.imagem || "";
    }

    function obterUltimoDestaque() {
        try {
            return window.localStorage.getItem(HERO_STORAGE_KEY) || "";
        } catch (erro) {
            return "";
        }
    }

    function guardarUltimoDestaque(id) {
        try {
            window.localStorage.setItem(HERO_STORAGE_KEY, id);
        } catch (erro) {
            // A rotacao continua funcionando mesmo com armazenamento bloqueado.
        }
    }

    function escolherProdutoDoHero(produtos) {
        const imagensUnicas = new Set();
        const candidatos = produtos.filter((produto) => {
            const imagem = obterImagemPrincipal(produto);

            if (!imagem || imagensUnicas.has(imagem)) {
                return false;
            }

            imagensUnicas.add(imagem);
            return true;
        });

        if (!candidatos.length) {
            return null;
        }

        const ultimoDestaque = obterUltimoDestaque();
        const alternativas = candidatos.filter((produto) => String(produto.id || produto.modelo) !== ultimoDestaque);
        const disponiveis = alternativas.length ? alternativas : candidatos;
        return disponiveis[Math.floor(Math.random() * disponiveis.length)];
    }

    function renderizarHero(produtos) {
        const imagemHero = document.getElementById("equipamentosHeroImage");

        if (!imagemHero) {
            return;
        }

        const produto = escolherProdutoDoHero(produtos);
        const fallback = imagemHero.dataset.fallbackSrc || HERO_FALLBACK_IMAGE;
        const origem = produto ? obterImagemPrincipal(produto) : fallback;

        imagemHero.addEventListener("load", () => imagemHero.classList.add("is-loaded"));
        imagemHero.addEventListener("error", () => {
            if (imagemHero.src.endsWith(fallback)) {
                imagemHero.classList.add("is-loaded");
                return;
            }

            imagemHero.src = fallback;
        });

        imagemHero.src = origem;

        if (produto) {
            guardarUltimoDestaque(String(produto.id || produto.modelo));
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

    function criarCardProduto(produto) {
        const id = produto.id || produto.modelo.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const modelo = produto.modelo || "Produto";
        const resumo = produto.resumo || produto.descricao || "Consulte as especificacoes deste equipamento.";
        const imagem = obterImagemPrincipal(produto) || HERO_FALLBACK_IMAGE;
        const alt = produto.alt || `${modelo} Brutusmaq`;
        const aplicacao = produto.aplicacao || produto.categoria || "Aplicacao industrial";
        const fabricacao = produto.fabricacao || "Projeto Brutusmaq";

        return `
            <a class="equipamentos-product" id="${escaparHtml(id)}" href="produto.html?produto=${encodeURIComponent(id)}" aria-label="Ver produto ${escaparHtml(modelo)}">
                <span class="equipamentos-product-media">
                    <img src="${escaparHtml(imagem)}" alt="${escaparHtml(alt)}" loading="lazy" decoding="async">
                </span>
                <span class="equipamentos-product-meta">${escaparHtml(aplicacao)} · ${escaparHtml(fabricacao)}</span>
                <h3>${escaparHtml(modelo)}</h3>
                <p>${escaparHtml(resumo)}</p>
                <span class="equipamentos-product-action">Ver detalhes <span aria-hidden="true">↗</span></span>
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

        const categorySlugs = new Set([slug, ...(config.aliases || [])]);
        const produtosDaCategoria = ordenarProdutos(produtos.filter((produto) => categorySlugs.has(produto.categoriaSlug)));
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

        const canonicalHash = {
            "#esteiras-transportadoras": "#esteiras",
            "#outros": "#outros-equipamentos"
        }[hash] || hash;

        return document.querySelector(`.equipamentos-tabs a[href="${canonicalHash}"]`);
    }

    function configurarTabsCategorias() {
        const tabs = document.querySelectorAll(".equipamentos-tabs a");
        const secoes = Array.from(tabs)
            .map((tab) => document.querySelector(tab.getAttribute("href")))
            .filter(Boolean);

        tabs.forEach((tab) => {
            tab.addEventListener("click", () => {
                ativarTabCategoria(tab);
                tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            });
        });

        const tabInicial = encontrarTabPorHash(window.location.hash) || document.querySelector(".equipamentos-tabs a.active") || tabs[0];

        if (tabInicial) {
            ativarTabCategoria(tabInicial);
            if (window.location.hash) {
                const secaoInicial = document.querySelector(tabInicial.getAttribute("href"));
                window.requestAnimationFrame(() => {
                    secaoInicial?.scrollIntoView({ block: "start" });
                    tabInicial.scrollIntoView({ block: "nearest", inline: "center" });
                });
            }
        }

        window.addEventListener("hashchange", () => {
            const tabPorHash = encontrarTabPorHash(window.location.hash);

            if (tabPorHash) {
                ativarTabCategoria(tabPorHash);
                tabPorHash.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            }
        });

        if (!("IntersectionObserver" in window)) {
            return;
        }

        const observador = new IntersectionObserver((entradas) => {
            const visiveis = entradas
                .filter((entrada) => entrada.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

            if (!visiveis.length) {
                return;
            }

            const tab = encontrarTabPorHash(`#${visiveis[0].target.id}`);

            if (tab) {
                ativarTabCategoria(tab);
                tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
            }
        }, {
            rootMargin: "-30% 0px -55% 0px",
            threshold: [0, 0.1, 0.25]
        });

        secoes.forEach((secao) => observador.observe(secao));
    }

    document.addEventListener("DOMContentLoaded", async () => {
        await Promise.resolve(window.BrutusmaqCatalogReady);
        const produtos = window.brutusmaqProdutosNovos || [];

        renderizarHero(produtos);
        renderizarEquipamentos();
        configurarTabsCategorias();

        mediaProdutosMobile.addEventListener("change", renderizarEquipamentos);
    });
}());
