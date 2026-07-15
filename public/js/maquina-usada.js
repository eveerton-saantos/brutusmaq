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

function normalizarRotulo(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function atualizarLista(id, itens, mensagemPadrao) {
    const lista = document.getElementById(id);

    if (!lista) {
        return;
    }

    const valores = Array.isArray(itens) && itens.length ? itens : [mensagemPadrao];
    lista.innerHTML = valores.map((item) => `<li>${escaparHtml(item)}</li>`).join("");
}

function atualizarInformacoesComerciais(produto) {
    const lista = document.getElementById("produtoInfoComercial");

    if (!lista) {
        return;
    }

    const informacoes = produto.informacoesComerciais?.length
        ? produto.informacoesComerciais
        : [
            ["Preço", "Consultar valor"],
            ["Disponibilidade", produto.status || "A consultar"],
            ["Prazo de entrega", "A combinar"],
            ["Condições de pagamento", "Conforme proposta"],
            ["Transporte", "A combinar"]
        ];

    lista.innerHTML = informacoes
        .map(([rotulo, valor]) => `<div><strong>${escaparHtml(rotulo)}</strong><span>${escaparHtml(valor)}</span></div>`)
        .join("");
}

function atualizarSeoProduto(produto, breadcrumb) {
    const descricao = `${breadcrumb} - ${produto.descricao || "Consulte condição e informações técnicas."}`;
    const url = `https://www.brutusmaq.com.br/maquina-usada.html?id=${encodeURIComponent(produto.id)}`;
    const imagem = new URL(produto.imagemPrincipal || produto.imagem || "assets/main/tr-700.png", "https://www.brutusmaq.com.br/").href;
    const disponibilidade = {
        vendido: "https://schema.org/SoldOut",
        vendida: "https://schema.org/SoldOut",
        revisao: "https://schema.org/PreOrder",
        "nao-revisado": "https://schema.org/PreOrder"
    };

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
            description: produto.descricao || "Equipamento industrial usado Brutusmaq",
            category: produto.categoria || "Equipamento usado",
            image: imagem,
            brand: { "@type": "Brand", name: "Brutusmaq" },
            url,
            itemCondition: "https://schema.org/UsedCondition",
            offers: {
                "@type": "Offer",
                priceCurrency: "BRL",
                availability: disponibilidade[produto.statusSlug] || "https://schema.org/InStock",
                url
            }
        });
    }
}

function atualizarLinksWhatsAppProdutoUsado(produto, breadcrumb) {
    const categoria = produto.categoria || "equipamento industrial usado";
    const condicao = produto.condicao || produto.status || "sob consulta";
    const pagina = `https://www.brutusmaq.com.br/maquina-usada.html?id=${encodeURIComponent(produto.id)}`;
    const mensagem = `Ola, visitei a pagina do equipamento ${breadcrumb} (${categoria}). Condicao informada: ${condicao}. Gostaria de receber mais informacoes sobre disponibilidade e negociacao. Link do equipamento: ${pagina}`;
    const href = `https://wa.me/5541988754003?text=${encodeURIComponent(mensagem)}`;

    document.querySelectorAll("[data-whatsapp-produto-usado]").forEach((link) => {
        link.href = href;
        link.setAttribute("aria-label", `Falar no WhatsApp sobre ${breadcrumb}`);
    });
}

function carregarProdutoUsado() {
    const idProduto = pegarParametroUrl("id");
    const produto = maquinasUsadas.find((item) => item.id === idProduto) || (!idProduto ? maquinasUsadas[0] : null);

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

        const imagemVazia = document.getElementById("produtoImagemPrincipal");
        if (imagemVazia) {
            imagemVazia.src = imagemVazia.dataset.fallbackSrc || "assets/main/tr-700.png";
            imagemVazia.alt = "Equipamento usado Brutusmaq";
        }

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
    atualizarSeoProduto(produto, breadcrumb);

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
    atualizarTexto("produtoBadgeCondicao", produto.condicao || produto.status || "A consultar");
    atualizarTexto("produtoGuaranteeNote", `Garantia: ${produto.garantia || "condições sob consulta"}.`);

    if (imagemPrincipal) {
        const fallback = imagemPrincipal.dataset.fallbackSrc || "assets/main/tr-700.png";
        imagemPrincipal.addEventListener("error", () => {
            if (!imagemPrincipal.src.endsWith(fallback)) {
                imagemPrincipal.src = fallback;
            }
        });
        imagemPrincipal.src = produto.imagemPrincipal || produto.imagem || fallback;
        imagemPrincipal.alt = `${breadcrumb} Brutusmaq`;
    }

    if (modalProduto) {
        modalProduto.value = breadcrumb;
    }

    document.querySelectorAll("[data-produto-proposta]").forEach((link) => {
        const parametros = new URLSearchParams({
            tipo: "equipamento-usado",
            produto: produto.id,
            modelo: breadcrumb,
            categoria: produto.categoria || "Equipamento usado",
            pagina: `maquina-usada.html?id=${produto.id}`,
            origem: "maquina-usada"
        });
        link.href = `contato.html?${parametros.toString()}`;
    });

    atualizarLinksWhatsAppProdutoUsado(produto, breadcrumb);

    atualizarGaleria(produto);
    atualizarEspecificacoes(produto);
    atualizarYoutube(produto);
    atualizarLista("produtoItensInclusos", produto.oQueAcompanha || produto.itensInclusos, "Itens confirmados na proposta comercial");
    atualizarLista("produtoRevisoes", produto.avaliacaoTecnica || produto.revisoes, "Condição detalhada sob consulta");
    atualizarInformacoesComerciais(produto);
}

function atualizarGaleria(produto) {
    const imagemPadrao = produto.imagemPrincipal || produto.imagem || "assets/main/tr-700.png";
    const imagens = (produto.galeria?.length ? produto.galeria : [{ src: imagemPadrao, alt: produto.alt }])
        .map((item, indice) => ({
            src: typeof item === "string" ? item : item.src,
            alt: typeof item === "string"
                ? `${produto.modelo || "Equipamento"} usado - imagem ${indice + 1}`
                : item.alt || produto.alt || produto.modelo || "Maquina usada Brutusmaq"
        }))
        .filter((item) => item.src);
    const principal = document.querySelector(".produto-main-photo img");
    const botoes = [...document.querySelectorAll(".produto-galeria-thumbs button")];

    if (principal && imagens[0]) {
        principal.src = imagens[0].src;
        principal.alt = imagens[0].alt;
    }

    botoes.forEach((botao, indice) => {
        const imagem = imagens[indice];
        const miniatura = botao.querySelector("img");

        botao.hidden = !imagem;
        botao.classList.toggle("active", indice === 0 && Boolean(imagem));

        if (imagem && miniatura) {
            miniatura.src = imagem.src;
            miniatura.alt = imagem.alt;
        }
    });

    atualizarTexto("produtoMediaNote", produto.observacaoImagens || "Solicite fotos reais e atualizadas do equipamento.");
}

function atualizarEspecificacoes(produto) {
    const tabela = document.getElementById("produtoSpecTable");
    if (!tabela) {
        return;
    }

    const specsOriginais = produto.specs?.length ? produto.specs : [["Modelo", produto.modelo || "A consultar"]];
    const specsSemAno = specsOriginais.filter(([label]) => {
        const rotulo = normalizarRotulo(label);
        return rotulo !== "ano" && !rotulo.startsWith("ano de ");
    });
    const specs = specsSemAno.length ? specsSemAno : [["Modelo", produto.modelo || "A consultar"]];
    tabela.innerHTML = specs
        .map(([label, value]) => `<div><strong>${escaparHtml(label)}</strong><span>${escaparHtml(value)}</span></div>`)
        .join("");
}

function atualizarYoutube(produto) {
    const iframe = document.getElementById("produtoYoutubeFrame");
    if (!iframe) {
        return;
    }

    if (produto.youtubeId) {
        iframe.removeAttribute("srcdoc");
        iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(produto.youtubeId)}`;
        iframe.title = `Video do ${produto.modelo || "equipamento"} em funcionamento`;
        return;
    }

    iframe.removeAttribute("src");
    iframe.title = `Vídeo do ${produto.modelo || "equipamento"} disponível sob solicitação`;
    iframe.srcdoc = `
        <style>
            body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box; color: #f4f4f1; background: #111212; font-family: Arial, sans-serif; text-align: center; }
            strong { display: block; margin-bottom: 8px; color: #ff6200; font-size: 20px; text-transform: uppercase; }
            span { max-width: 420px; color: #c7c9c6; font-size: 14px; line-height: 1.5; }
        </style>
        <div><strong>Vídeo sob solicitação</strong><span>Peça um vídeo atualizado ou um teste com o material da sua operação.</span></div>`;
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
    const botoesAbrir = document.querySelectorAll("[data-open-video-modal]");
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

    botoesAbrir.forEach((botao) => botao.addEventListener("click", abrirModal));
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
        const idProduto = pegarParametroUrl("id");
        const pagina = idProduto
            ? `https://www.brutusmaq.com.br/maquina-usada.html?id=${encodeURIComponent(idProduto)}`
            : window.location.href;
        const mensagem = `Ola, tenho interesse no ${produto}. Gostaria de solicitar um video/teste com o material: ${material}. Detalhes: ${detalhes}. Pagina consultada: ${pagina}`;
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
