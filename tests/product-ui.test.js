"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const projectRoot = path.join(__dirname, "..");
const productSource = fs.readFileSync(path.join(projectRoot, "public", "js", "produto.js"), "utf8");
const usedProductSource = fs.readFileSync(path.join(projectRoot, "public", "js", "maquina-usada.js"), "utf8");
const adminHtml = fs.readFileSync(path.join(projectRoot, "public", "painel-admin.html"), "utf8");
const equipmentHtml = fs.readFileSync(path.join(projectRoot, "public", "equipamentos.html"), "utf8");
const productHtml = fs.readFileSync(path.join(projectRoot, "public", "produto.html"), "utf8");
const usedProductHtml = fs.readFileSync(path.join(projectRoot, "public", "maquina-usada.html"), "utf8");

function createIframeMock() {
    return {
        dataset: {},
        hidden: true,
        src: "",
        srcdoc: "",
        title: "",
        attributes: { tabindex: "-1" },
        removeAttribute(name) {
            if (name === "src") this.src = "";
            if (name === "srcdoc") this.srcdoc = "";
            delete this.attributes[name];
        },
        setAttribute(name, value) {
            this.attributes[name] = String(value);
        },
        getAttribute(name) {
            return this.attributes[name] ?? null;
        }
    };
}

function createProductContext() {
    const elements = {
        produtoSobreTitulo: { textContent: "" },
        produtoSobreTexto: { innerHTML: "" },
        produtoBeneficios: { innerHTML: "conteúdo estático antigo", hidden: false },
        produtoYoutubeFrame: createIframeMock()
    };
    const document = {
        addEventListener: () => {},
        getElementById: (id) => elements[id] || null,
        querySelectorAll: () => []
    };
    const window = {
        BrutusmaqCatalogReady: Promise.resolve(),
        location: {
            search: "",
            href: "https://www.brutusmaq.com.br/produto.html",
            origin: "https://www.brutusmaq.com.br"
        }
    };
    const context = vm.createContext({
        URL,
        URLSearchParams,
        document,
        Promise,
        window
    });

    vm.runInContext(productSource, context, { filename: "produto.js" });
    return { context, elements };
}

function createUsedProductContext() {
    const elements = { produtoYoutubeFrame: createIframeMock() };
    const document = {
        addEventListener: () => {},
        getElementById: (id) => elements[id] || null,
        querySelector: () => null,
        querySelectorAll: () => []
    };
    const window = {
        brutusmaqMaquinasUsadas: [],
        BrutusmaqCatalogReady: Promise.resolve(),
        location: {
            search: "",
            href: "https://www.brutusmaq.com.br/maquina-usada.html",
            origin: "https://www.brutusmaq.com.br"
        },
        open: () => {}
    };
    const context = vm.createContext({
        URL,
        URLSearchParams,
        document,
        Promise,
        window
    });

    vm.runInContext(usedProductSource, context, { filename: "maquina-usada.js" });
    return { context, elements };
}

test("página do produto oculta benefícios quando o cadastro não possui opções", () => {
    const { context, elements } = createProductContext();

    context.atualizarConteudoTecnico({
        modelo: "EX-450",
        descricao: "Descrição técnica."
    });

    assert.equal(elements.produtoBeneficios.innerHTML, "");
    assert.equal(elements.produtoBeneficios.hidden, true);
});

test("página do produto renderiza no máximo quatro benefícios e escapa o conteúdo", () => {
    const { context, elements } = createProductContext();

    context.atualizarConteudoTecnico({
        modelo: "EX-450",
        descricao: "Descrição técnica.",
        beneficios: [
            "<script>Projeto</script> | Dimensionamento seguro.",
            { titulo: "Construção industrial", texto: "Estrutura robusta." },
            { nome: "Baixa manutenção", descricao: "Acesso facilitado." },
            "Suporte técnico | Acompanhamento especializado.",
            "Quinto benefício | Não deve aparecer."
        ]
    });

    const html = elements.produtoBeneficios.innerHTML;
    assert.equal(elements.produtoBeneficios.hidden, false);
    assert.equal((html.match(/product-benefit-icon/g) || []).length, 4);
    assert.match(html, /&lt;script&gt;Projeto&lt;\/script&gt;/);
    assert.doesNotMatch(html, /Quinto benefício/);
});

test("formulário administrativo oferece quatro linhas fixas e oito benefícios opcionais", () => {
    const lineSelect = adminHtml.match(/<select name="line"[^>]*>([\s\S]*?)<\/select>/);
    assert.ok(lineSelect, "select de linha não encontrado");
    const lineValues = [...lineSelect[1].matchAll(/<option value="([^"]*)"/g)].map((match) => match[1]);

    assert.deepEqual(lineValues, [
        "",
        "Trituradores",
        "Moinhos",
        "Esteiras transportadoras",
        "Outros equipamentos"
    ]);

    const benefits = [...adminHtml.matchAll(/<input type="checkbox" name="benefitOptions" value="([^"]+)"/g)]
        .map((match) => match[1]);
    assert.equal(benefits.length, 8);
    assert.equal(new Set(benefits).size, 8);
    assert.match(adminHtml, /name="benefitsCustom"/);
    assert.match(adminHtml, /id="adminBenefitCounter"/);
});

test("formulário administrativo permite editar todos os blocos públicos da máquina usada", () => {
    [
        "usedYear",
        "condition",
        "usedAvailability",
        "location",
        "usedWarranty",
        "summary",
        "description",
        "applications",
        "materials",
        "imageAlt",
        "imageNote",
        "includedItems",
        "technicalAssessment",
        "usedTechnicalNote",
        "youtubeVideo"
    ].forEach((name) => assert.match(adminHtml, new RegExp(`name="${name}"`)));
    assert.match(adminHtml, /id="adminCommercialList"/);
    assert.match(adminHtml, /id="adminAddCommercial"/);
    assert.equal((adminHtml.match(/data-used-info-card/g) || []).length, 4);
    assert.match(adminHtml, /id="adminUsedCardCounter"/);
    assert.match(adminHtml, /id="adminSummaryCounter"/);
    assert.match(adminHtml, /data-used-product-only/);
});

test("cards da máquina usada respeitam seleção, ordem e valores já cadastrados", () => {
    const { context } = createUsedProductContext();
    const cards = { innerHTML: "", hidden: false };
    context.document.getElementById = (id) => id === "produtoCardsResumo" ? cards : null;

    const rendered = context.atualizarCardsResumo({
        ano: "2022",
        localizacao: "Contenda - PR",
        cardsInformativos: ["pagamento", "potencia", "ano", "localizacao", "garantia"],
        informacoesComerciais: [["Condições de pagamento", "Entrada + saldo <script>"]],
        specs: [["Potência instalada", "2 x 30 cv"]]
    });

    assert.equal(rendered.length, 4);
    assert.equal((cards.innerHTML.match(/<div>/g) || []).length, 4);
    assert.ok(cards.innerHTML.indexOf("Pagamento") < cards.innerHTML.indexOf("Potência"));
    assert.ok(cards.innerHTML.indexOf("Potência") < cards.innerHTML.indexOf("Ano"));
    assert.match(cards.innerHTML, /Entrada \+ saldo &lt;script&gt;/);
    assert.doesNotMatch(cards.innerHTML, /<strong>Garantia<\/strong>/);
});

test("máquina usada mantém os quatro cards legados e encurta apenas o texto do topo", () => {
    const { context } = createUsedProductContext();
    const cards = { innerHTML: "", hidden: false };
    const elements = {
        produtoCardsResumo: cards,
        produtoResumo: { textContent: "" },
        produtoSobreTitulo: { textContent: "" },
        produtoDescricao: { textContent: "" },
        produtoAplicacoesTexto: { textContent: "" },
        produtoAplicacoes: { innerHTML: "" },
        produtoMateriais: { innerHTML: "" },
        produtoApplicationsCard: { hidden: true },
        produtoMaterialsCard: { hidden: true }
    };
    context.document.getElementById = (id) => elements[id] || null;
    const description = "Descrição completa muito detalhada da unidade, com histórico, estado de conservação, componentes e recomendações para a operação industrial. Este trecho deve permanecer na seção técnica.";
    const product = {
        modelo: "TR-900",
        descricao: description,
        ano: "2021",
        condicao: "Revisada",
        garantia: "90 dias",
        localizacao: "Contenda - PR",
        aplicacoes: ["Reciclagem"],
        materiais: ["PEAD"]
    };

    context.atualizarCardsResumo(product);
    context.atualizarConteudoProdutoUsado(product);

    assert.equal((cards.innerHTML.match(/<div>/g) || []).length, 4);
    assert.ok(elements.produtoResumo.textContent.length <= 120);
    assert.equal(elements.produtoDescricao.textContent, description);
    assert.equal(elements.produtoApplicationsCard.hidden, false);
    assert.equal(elements.produtoMaterialsCard.hidden, false);
});

test("catálogo público posiciona Outros equipamentos antes dos usados", () => {
    const otherTab = equipmentHtml.indexOf('href="#outros-equipamentos"');
    const usedTab = equipmentHtml.indexOf('href="#usados"');
    const otherSection = equipmentHtml.indexOf('id="outros-equipamentos"');
    const usedSection = equipmentHtml.indexOf('id="usados"');

    assert.ok(otherTab >= 0 && usedTab > otherTab);
    assert.ok(otherSection >= 0 && usedSection > otherSection);
    assert.match(equipmentHtml, /data-category-toggle="outros-equipamentos"/);

    const structuredData = [...equipmentHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.ok(structuredData.length > 0);
    structuredData.forEach((match) => assert.doesNotThrow(() => JSON.parse(match[1])));
});

test("player do YouTube é carregado diretamente em modo de privacidade aprimorada", () => {
    const { context, elements } = createProductContext();
    const iframe = elements.produtoYoutubeFrame;
    iframe.dataset.externalSrc = "https://youtube.example/valor-antigo";
    iframe.srcdoc = "placeholder antigo";

    context.atualizarYoutube({
        modelo: "EX-450",
        youtubeEmbed: "https://example.com/embed/url-invalida",
        youtubeId: "abcdefghijk"
    });

    assert.equal(iframe.src, "https://www.youtube-nocookie.com/embed/abcdefghijk");
    assert.equal(iframe.hidden, false);
    assert.equal(iframe.srcdoc, "");
    assert.equal("externalSrc" in iframe.dataset, false);
    assert.equal(iframe.getAttribute("tabindex"), null);
    assert.match(iframe.title, /EX-450/);

    context.atualizarYoutube({ modelo: "EX-450" });
    assert.equal(iframe.src, "");
    assert.match(iframe.srcdoc, /Video sob solicitacao/);
    assert.equal(iframe.getAttribute("tabindex"), "-1");
});

test("embed legado do YouTube é normalizado e endereços externos são rejeitados", () => {
    const { context } = createProductContext();

    assert.equal(
        context.normalizarYoutubePrivado("https://youtube-nocookie.com/embed/abcdefghijk?start=30&autoplay=1&mute=1&controls=0&disablekb=1#trecho"),
        "https://www.youtube-nocookie.com/embed/abcdefghijk?start=30"
    );
    assert.equal(context.normalizarYoutubePrivado("https://example.com/embed/abcdefghijk"), "");
    assert.equal(context.normalizarYoutubePrivado("https://www.youtube.com/watch?v=abcdefghijk"), "");
});

test("máquina usada carrega ID ou embed legado e volta ao placeholder com segurança", () => {
    const { context, elements } = createUsedProductContext();
    const iframe = elements.produtoYoutubeFrame;

    context.atualizarYoutube({ modelo: "TR-700 usada", youtubeId: "mnopqrstuvw" });
    assert.equal(iframe.src, "https://www.youtube-nocookie.com/embed/mnopqrstuvw");

    context.atualizarYoutube({
        modelo: "TR-700 usada",
        youtubeId: "id-invalido-com-mais-de-vinte-caracteres",
        youtubeEmbed: "https://youtube-nocookie.com/embed/abcdefghijk?start=30"
    });

    assert.equal(iframe.src, "https://www.youtube-nocookie.com/embed/abcdefghijk");
    assert.equal(iframe.hidden, false);
    assert.equal(iframe.srcdoc, "");
    assert.equal(iframe.getAttribute("tabindex"), null);

    context.atualizarYoutube({ modelo: "TR-700 usada", youtubeEmbed: "https://example.com/embed/abcdefghijk" });
    assert.equal(iframe.src, "");
    assert.match(iframe.srcdoc, /Vídeo sob solicitação/);
    assert.equal(iframe.getAttribute("tabindex"), "-1");
});

test("máquina usada usa o catálogo carregado depois da resposta da API", async () => {
    let onDomReady;
    let resolveCatalog;
    const elements = { produtoTitulo: { innerHTML: "" } };
    const ready = new Promise((resolve) => { resolveCatalog = resolve; });
    const document = {
        addEventListener(event, callback) {
            if (event === "DOMContentLoaded") onDomReady = callback;
        },
        getElementById: (id) => elements[id] || null,
        querySelector: () => null,
        querySelectorAll: () => []
    };
    const window = {
        brutusmaqMaquinasUsadas: [],
        BrutusmaqCatalogReady: ready,
        location: {
            search: "?id=usado-hidratado",
            href: "https://www.brutusmaq.com.br/maquina-usada.html?id=usado-hidratado",
            origin: "https://www.brutusmaq.com.br"
        },
        open: () => {}
    };
    const context = vm.createContext({ URL, URLSearchParams, document, Promise, window });
    vm.runInContext(usedProductSource, context, { filename: "maquina-usada.js" });

    const loading = onDomReady();
    window.brutusmaqMaquinasUsadas = [{
        id: "usado-hidratado",
        modelo: "TR Hidratada",
        categoria: "Triturador industrial",
        resumo: "Produto carregado do banco.",
        descricao: "Descrição carregada do banco.",
        imagem: "assets/main/tr-700.webp",
        specs: [["Potência", "50 cv"]]
    }];
    resolveCatalog();
    await loading;

    assert.match(elements.produtoTitulo.innerHTML, /TR Hidratada/);
});

test("páginas de produto não exibem mais o botão intermediário de reprodução", () => {
    [productHtml, usedProductHtml].forEach((html) => {
        assert.doesNotMatch(html, /produtoYoutubeGate/);
        assert.doesNotMatch(html, /data-load-external-media/);
        assert.doesNotMatch(html, /js\/external-media\.js/);
        assert.match(html, /referrerpolicy="strict-origin-when-cross-origin"/);
        assert.match(html, /loading="lazy"/);
        assert.match(html, /allowfullscreen/);
        assert.match(html, /tabindex="-1"/);
        assert.doesNotMatch(html, /allow="[^"]*autoplay/);
    });
});

test("galeria da máquina usada renderiza todas as imagens cadastradas", () => {
    const { context } = createUsedProductContext();
    const principal = { src: "", alt: "" };
    const thumbs = {
        children: [],
        hidden: true,
        innerHTML: "",
        appendChild(child) {
            this.children.push(child);
        }
    };

    context.document.querySelector = (selector) => selector === ".produto-main-photo img" ? principal : null;
    context.document.getElementById = (id) => id === "produtoGaleriaThumbs" ? thumbs : null;
    context.document.createElement = (tagName) => ({
        tagName,
        children: [],
        attributes: {},
        appendChild(child) {
            this.children.push(child);
        },
        setAttribute(name, value) {
            this.attributes[name] = String(value);
        }
    });

    context.atualizarGaleria({
        modelo: "TR-900",
        imagem: "assets/main/principal.webp",
        alt: "TR-900 usada",
        galeria: Array.from({ length: 8 }, (_, indice) => ({
            src: `assets/gallery/tr-900-${indice + 1}.webp`,
            alt: `TR-900 - detalhe ${indice + 1}`
        }))
    });

    assert.equal(thumbs.hidden, false);
    assert.equal(thumbs.children.length, 9);
    assert.equal(principal.src, "assets/main/principal.webp");
    assert.equal(thumbs.children[8].children[0].src, "assets/gallery/tr-900-8.webp");
    assert.equal(thumbs.children[0].attributes["aria-current"], "true");
    assert.equal(thumbs.children[8].attributes["aria-current"], "false");
});

test("página usada compartilha a estrutura principal da página de produtos novos", () => {
    const structuralSections = [
        "product-hero",
        "product-technical",
        "product-operation",
        "product-catalog-support",
        "product-cta-band"
    ];

    let newPageCursor = -1;
    let usedPageCursor = -1;
    structuralSections.forEach((className) => {
        const newPageIndex = productHtml.indexOf(`<section class="${className}`);
        const usedPageIndex = usedProductHtml.indexOf(`<section class="${className}`);
        assert.ok(newPageIndex > newPageCursor, `${className} fora de ordem na página nova`);
        assert.ok(usedPageIndex > usedPageCursor, `${className} fora de ordem na página usada`);
        newPageCursor = newPageIndex;
        usedPageCursor = usedPageIndex;
    });

    assert.match(usedProductHtml, /<main class="product-page product-page--used"/);
    assert.ok(usedProductHtml.indexOf("css/product-page.css") < usedProductHtml.indexOf("css/maquina-usada.css"));
    assert.doesNotMatch(usedProductHtml, /js\/produto\.js/);
    assert.doesNotMatch(usedProductHtml, /class="maquina-usada-page"/);

    [
        "produtoStatus",
        "produtoResumo",
        "produtoCardsResumo",
        "produtoImagemPrincipal",
        "produtoGaleriaThumbs",
        "produtoDescricao",
        "produtoSpecTable",
        "produtoSpecNote",
        "produtoAplicacoes",
        "produtoMateriais",
        "produtoItensInclusos",
        "produtoRevisoes",
        "produtoInfoComercial",
        "produtoYoutubeFrame",
        "productRelatedRow"
    ].forEach((id) => assert.match(usedProductHtml, new RegExp(`id="${id}"`)));
    assert.equal((usedProductHtml.match(/id="produtoInfoComercial"/g) || []).length, 1);
    assert.match(usedProductHtml, /Condições e funcionamento/);
    assert.ok(usedProductHtml.indexOf("produtoInfoComercial") < usedProductHtml.indexOf("produtoYoutubeFrame"));
});

test("relacionados da página usada nunca repetem o próprio equipamento", () => {
    const { context } = createUsedProductContext();
    const related = { innerHTML: "" };
    context.document.getElementById = (id) => id === "productRelatedRow" ? related : null;
    context.window.brutusmaqMaquinasUsadas = [
        { id: "unidade-atual", modelo: "Unidade atual", imagem: "assets/main/atual.webp" },
        { id: "outra-unidade", modelo: "Outra unidade", imagemPrincipal: "assets/main/outra.webp" }
    ];

    context.atualizarRelacionadosUsados(context.window.brutusmaqMaquinasUsadas[0]);

    assert.doesNotMatch(related.innerHTML, /unidade-atual/);
    assert.match(related.innerHTML, /outra-unidade/);
    assert.match(related.innerHTML, /Outra unidade/);
});
