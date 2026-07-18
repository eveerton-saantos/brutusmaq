const maquinasUsadasCatalogo = (window.brutusmaqMaquinasUsadas || []).filter(Boolean);

function escaparHtml(valor) {
    return String(valor).replace(/[&<>"']/g, (caractere) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[caractere]));
}

function normalizarBusca(valor) {
    return String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[-_]/g, " ")
        .toLowerCase()
        .trim();
}

function criarSlug(valor, fallback = "outros") {
    return normalizarBusca(valor)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || fallback;
}

function chaveCategoria(produto) {
    return criarSlug(produto.categoriaSlug || produto.categoria, "outros-equipamentos");
}

function rotuloCategoria(produto) {
    return produto.categoria || produto.categoriaSlug || "Outros equipamentos";
}

function chaveStatus(produto) {
    return criarSlug(produto.statusSlug || produto.status, "a-consultar");
}

function rotuloStatus(produto) {
    return produto.status || produto.statusSlug || "A consultar";
}

function agruparOpcoes(produtos, obterChave, obterRotulo) {
    const opcoes = new Map();

    produtos.forEach((produto) => {
        const chave = obterChave(produto);
        const rotulo = obterRotulo(produto);
        const atual = opcoes.get(chave);

        opcoes.set(chave, {
            chave,
            rotulo: atual?.rotulo || rotulo,
            quantidade: (atual?.quantidade || 0) + 1
        });
    });

    return [...opcoes.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR", { numeric: true }));
}

function preencherSelect(select, placeholder, opcoes, valorAnterior = "") {
    if (!select) {
        return;
    }

    select.innerHTML = [
        `<option value="">${escaparHtml(placeholder)}</option>`,
        ...opcoes.map((opcao) => (
            `<option value="${escaparHtml(opcao.chave)}">${escaparHtml(opcao.rotulo)}${opcao.quantidade > 1 ? ` (${opcao.quantidade})` : ""}</option>`
        ))
    ].join("");

    select.disabled = opcoes.length === 0;

    if (opcoes.some((opcao) => opcao.chave === valorAnterior)) {
        select.value = valorAnterior;
    }
}

function criarCardMaquinaUsada(produto) {
    const informacoes = [...(produto.especificacoes || [])];

    if (produto.ano && !informacoes.some((item) => normalizarBusca(item).startsWith("ano"))) {
        informacoes.push(`Ano: ${produto.ano}`);
    }

    if (produto.condicao && !informacoes.some((item) => normalizarBusca(item).includes("condicao"))) {
        informacoes.push(produto.condicao);
    }

    const especificacoes = (informacoes.length ? informacoes : ["Informações técnicas sob consulta"])
        .slice(0, 3)
        .map((item) => `<li>${escaparHtml(item)}</li>`)
        .join("");

    const modelo = produto.modelo || "Equipamento usado";
    const id = produto.id || criarSlug(modelo, "equipamento-usado");
    const url = produto.url || `maquina-usada.html?id=${encodeURIComponent(id)}`;
    const statusClasse = produto.statusClasse || `status-${chaveStatus(produto)}`;
    const imagem = produto.imagemPrincipal || produto.imagem || "assets/main/tr-700.webp";

    return `
        <a href="${escaparHtml(url)}" class="usadas-product-card" itemscope itemtype="https://schema.org/Product" aria-label="Ver detalhes de ${escaparHtml(modelo)}">
            <span class="usadas-status ${escaparHtml(statusClasse)}">${escaparHtml(rotuloStatus(produto))}</span>
            <div class="usadas-product-image">
                <img src="${escaparHtml(imagem)}" alt="${escaparHtml(produto.alt || modelo)}" itemprop="image" loading="lazy" decoding="async">
            </div>
            <span class="usadas-product-category" itemprop="category">${escaparHtml(rotuloCategoria(produto))}</span>
            <h3 itemprop="name">${escaparHtml(modelo)}</h3>
            <meta itemprop="brand" content="Brutusmaq">
            <p class="sr-only" itemprop="description">${escaparHtml(produto.descricao || "")}</p>
            <ul aria-label="Informações principais de ${escaparHtml(modelo)}">
                ${especificacoes}
            </ul>
            <span class="usadas-card-btn">${escaparHtml(produto.cta || "Ver detalhes")} <span aria-hidden="true">→</span></span>
        </a>
    `;
}

function atualizarDadosEstruturados() {
    const script = document.getElementById("usadasCollectionJsonLd");

    if (!script) {
        return;
    }

    try {
        const dados = JSON.parse(script.textContent);
        const baseUrl = "https://www.brutusmaq.com.br/";
        const disponibilidade = {
            vendido: "https://schema.org/SoldOut",
            vendida: "https://schema.org/SoldOut",
            revisao: "https://schema.org/PreOrder",
            "nao-revisado": "https://schema.org/PreOrder"
        };

        dados.mainEntity = {
            "@type": "ItemList",
            itemListOrder: "https://schema.org/ItemListOrderAscending",
            numberOfItems: maquinasUsadasCatalogo.length,
            itemListElement: maquinasUsadasCatalogo.map((produto, indice) => {
                const id = produto.id || criarSlug(produto.modelo, "equipamento-usado");
                const url = new URL(produto.url || `maquina-usada.html?id=${encodeURIComponent(id)}`, baseUrl).href;
                const imagem = new URL(produto.imagemPrincipal || produto.imagem || "assets/main/tr-700.webp", baseUrl).href;

                return {
                    "@type": "ListItem",
                    position: indice + 1,
                    url,
                    item: {
                        "@type": "Product",
                        name: `${produto.modelo || "Equipamento"} usado`,
                        category: rotuloCategoria(produto),
                        brand: { "@type": "Brand", name: "Brutusmaq" },
                        image: imagem,
                        description: produto.descricao || `Equipamento usado ${produto.modelo || ""}`.trim(),
                        offers: {
                            "@type": "Offer",
                            availability: disponibilidade[chaveStatus(produto)] || "https://schema.org/InStock",
                            priceCurrency: "BRL",
                            url
                        }
                    }
                };
            })
        };

        script.textContent = JSON.stringify(dados);
    } catch (erro) {
        // Mantem os dados estaticos caso o JSON-LD da pagina seja alterado incorretamente.
    }
}

function configurarRolagemParaEstoque() {
    const botao = document.querySelector('.usadas-hero-actions a[href="#maquinas-disponiveis"]');
    const destino = document.getElementById("maquinas-disponiveis");

    if (!botao || !destino) {
        return;
    }

    botao.addEventListener("click", (event) => {
        event.preventDefault();

        const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        destino.scrollIntoView({
            behavior: reduzirMovimento ? "auto" : "smooth",
            block: "start"
        });

        if (window.history?.replaceState) {
            try {
                window.history.replaceState(null, "", "#maquinas-disponiveis");
            } catch (erro) {
                // A rolagem nao depende da atualizacao do endereco.
            }
        }
    });
}

function configurarCatalogoUsadas() {
    const grid = document.getElementById("usadas-products-grid");
    const form = document.querySelector(".usadas-filter-bar");
    const contadorResultados = document.getElementById("usadas-results-count");
    const busca = document.getElementById("busca-usadas");
    const categoria = document.getElementById("categoria-usadas");
    const modelo = document.getElementById("modelo-usadas");
    const status = document.getElementById("status-usadas");

    if (!grid || !form) {
        return;
    }

    atualizarDadosEstruturados();

    preencherSelect(
        categoria,
        "Todas as categorias",
        agruparOpcoes(maquinasUsadasCatalogo, chaveCategoria, rotuloCategoria)
    );

    preencherSelect(
        status,
        "Todas as condições",
        agruparOpcoes(maquinasUsadasCatalogo, chaveStatus, rotuloStatus)
    );

    const atualizarModelos = () => {
        const categoriaValor = categoria?.value || "";
        const valorAnterior = modelo?.value || "";
        const produtosDaCategoria = maquinasUsadasCatalogo.filter((produto) => (
            !categoriaValor || chaveCategoria(produto) === categoriaValor
        ));
        const modelos = agruparOpcoes(
            produtosDaCategoria.filter((produto) => produto.modelo),
            (produto) => String(produto.id || criarSlug(produto.modelo)),
            (produto) => produto.modelo
        );

        preencherSelect(modelo, "Todos os modelos", modelos, valorAnterior);
    };

    const renderizar = () => {
        const termo = normalizarBusca(busca?.value || "");
        const categoriaValor = categoria?.value || "";
        const modeloValor = modelo?.value || "";
        const statusValor = status?.value || "";

        const filtrados = maquinasUsadasCatalogo
            .filter((produto) => {
                const textoBusca = normalizarBusca([
                    produto.modelo,
                    String(produto.modelo || "").replace("-", ""),
                    produto.categoria,
                    produto.status,
                    produto.descricao,
                    produto.aplicacao,
                    produto.ano,
                    produto.condicao,
                    produto.localizacao,
                    ...(produto.especificacoes || [])
                ].join(" "));

                return (!termo || textoBusca.includes(termo))
                    && (!categoriaValor || chaveCategoria(produto) === categoriaValor)
                    && (!modeloValor || String(produto.id || criarSlug(produto.modelo)) === modeloValor)
                    && (!statusValor || chaveStatus(produto) === statusValor);
            })
            .sort((produtoA, produtoB) => {
                const prioridade = { disponivel: 0, revisado: 1, revisao: 2, "nao-revisado": 3, vendido: 4, vendida: 4 };
                const statusA = prioridade[chaveStatus(produtoA)] ?? 2;
                const statusB = prioridade[chaveStatus(produtoB)] ?? 2;

                return statusA - statusB || String(produtoA.modelo).localeCompare(String(produtoB.modelo), "pt-BR", { numeric: true });
            });

        if (contadorResultados) {
            contadorResultados.textContent = filtrados.length === 1
                ? "1 equipamento encontrado"
                : `${filtrados.length} equipamentos encontrados`;
        }

        const possuiFiltros = Boolean(termo || categoriaValor || modeloValor || statusValor);
        form.classList.toggle("has-active-filters", possuiFiltros);

        const tituloVazio = possuiFiltros
            ? "Nenhum equipamento corresponde aos filtros"
            : "Novas oportunidades chegam a todo momento";
        const mensagemVazia = possuiFiltros
            ? "Ajuste ou limpe os filtros para consultar todo o estoque disponível."
            : "No momento não há equipamentos usados cadastrados. Avise nossa equipe sobre o que você procura.";

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
                        : `<a href="contato.html#canais-atendimento" class="usadas-btn-primary">Avisar o que procuro <span aria-hidden="true">→</span></a>`}
                </div>`;

        grid.querySelector("[data-limpar-filtros]")?.addEventListener("click", () => form.reset());
    };

    atualizarModelos();

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        renderizar();
    });

    busca?.addEventListener("input", renderizar);
    categoria?.addEventListener("change", () => {
        atualizarModelos();
        renderizar();
    });
    modelo?.addEventListener("change", renderizar);
    status?.addEventListener("change", renderizar);
    form.addEventListener("reset", () => {
        window.setTimeout(() => {
            atualizarModelos();
            renderizar();
        }, 0);
    });

    renderizar();
}

document.addEventListener("DOMContentLoaded", async () => {
    await Promise.resolve(window.BrutusmaqCatalogReady);
    configurarCatalogoUsadas();
});
document.addEventListener("DOMContentLoaded", configurarRolagemParaEstoque);
