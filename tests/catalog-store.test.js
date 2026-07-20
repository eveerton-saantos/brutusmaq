"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { schemas } = require("../server/validation");

const storeSource = fs.readFileSync(path.join(__dirname, "..", "public", "js", "catalogo-store.js"), "utf8");

function createStore() {
    const values = new Map();
    const localStorage = {
        getItem: (key) => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: (key) => values.delete(key)
    };
    const window = {
        brutusmaqProdutosNovos: [{
            id: "produto-base",
            modelo: "Produto base",
            categoria: "Equipamento industrial",
            descricao: "Descrição do produto base.",
            imagem: "assets/main/tr-700.webp",
            specs: [["Modelo", "Base"]]
        }],
        brutusmaqMaquinasUsadas: [],
        location: { protocol: "file:" },
        localStorage,
        addEventListener: () => {},
        dispatchEvent: () => {}
    };

    vm.runInNewContext(storeSource, {
        AbortController,
        URL,
        clearTimeout,
        crypto: crypto.webcrypto,
        setTimeout,
        window
    }, { filename: "catalogo-store.js" });

    return window.BrutusmaqCatalogStore;
}

test("catálogo preserva todos os campos editoriais da página de produto", () => {
    const store = createStore();
    const saved = store.upsert("novo", {
        id: "ex-450",
        modelo: "EX-450",
        linha: "Outros equipamentos - triturador auxiliar",
        categoria: "Coletor de pó",
        descricao: "Descrição técnica completa do equipamento.",
        resumo: "Resumo curto para o topo.",
        status: "Lançamento",
        aplicacao: "Captação de partículas",
        aplicacoesTexto: "Aplicações avaliadas conforme o processo.",
        aplicacoes: ["Marcenarias", "Reciclagem"],
        materiais: ["Pó de madeira", "Partículas leves"],
        garantia: "12 meses",
        fabricacao: "100% nacional",
        recursos: ["Alto fluxo de ar", "Baixa vibração"],
        destaques: ["Rotor balanceado", "Manutenção simplificada"],
        sobreTitulo: "Engenharia para uma operação limpa",
        sobre: ["Parágrafo técnico adicional."],
        beneficios: [
            "Baixa manutenção | Acesso facilitado aos componentes.",
            { titulo: "Construção robusta", texto: "Componentes selecionados para uso industrial." }
        ],
        notaTecnica: "Capacidades variam conforme o material.",
        tipoImagem: "real",
        observacaoImagens: "Imagens reais do equipamento.",
        imagem: "assets/main/tr-700.webp",
        imagemPrincipal: "assets/main/tr-700.webp",
        alt: "Coletor de pó EX-450 Brutusmaq",
        specs: [["Rotor", "450 mm"]],
        youtubeId: "abcdefghijk",
        downloads: {
            catalogoTecnico: "assets/downloads/ex-450.pdf"
        },
        _admin: {
            status: "published",
            visible: true
        }
    });
    const product = JSON.parse(JSON.stringify(saved));

    assert.equal(product.resumo, "Resumo curto para o topo.");
    assert.equal(product.descricao, "Descrição técnica completa do equipamento.");
    assert.equal(product.linha, "Outros equipamentos");
    assert.equal(product.categoria, "Coletor de pó");
    assert.equal(product.categoriaSlug, "outros-equipamentos");
    assert.equal(product.status, "Lançamento");
    assert.equal(product.aplicacoesTexto, "Aplicações avaliadas conforme o processo.");
    assert.deepEqual(product.recursos, ["Alto fluxo de ar", "Baixa vibração"]);
    assert.deepEqual(product.destaques, ["Rotor balanceado", "Manutenção simplificada"]);
    assert.deepEqual(product.aplicacoes, ["Marcenarias", "Reciclagem"]);
    assert.deepEqual(product.materiais, ["Pó de madeira", "Partículas leves"]);
    assert.deepEqual(product.sobre, ["Parágrafo técnico adicional."]);
    assert.deepEqual(product.beneficios, [
        "Baixa manutenção | Acesso facilitado aos componentes.",
        { titulo: "Construção robusta", texto: "Componentes selecionados para uso industrial." }
    ]);
    assert.equal(product.youtubeId, "abcdefghijk");
    assert.deepEqual(product.downloads, { catalogoTecnico: "assets/downloads/ex-450.pdf" });
});

test("catálogo rejeita URLs inseguras de vídeo, imagem e download", () => {
    const store = createStore();
    const saved = store.upsert("novo", {
        id: "produto-seguro",
        modelo: "Produto seguro",
        categoria: "Equipamento industrial",
        descricao: "Descrição técnica.",
        resumo: "Resumo.",
        imagem: "javascript:alert(1)",
        youtubeId: "<script>",
        downloads: {
            catalogoTecnico: "javascript:alert(1)"
        },
        specs: [["Modelo", "Seguro"]],
        _admin: { status: "published" }
    });
    const product = JSON.parse(JSON.stringify(saved));

    assert.equal(product.imagem, "assets/main/tr-700.webp");
    assert.equal(product.youtubeId, undefined);
    assert.equal(product.downloads, undefined);
});

test("catálogo preserva downloads legados com metadados", () => {
    const store = createStore();
    const saved = store.upsert("novo", {
        id: "produto-download",
        modelo: "Produto download",
        categoria: "Equipamento industrial",
        descricao: "Descrição técnica.",
        resumo: "Resumo.",
        imagem: "assets/main/tr-700.webp",
        specs: [["Modelo", "Download"]],
        downloads: [{
            url: "assets/downloads/produto.pdf",
            titulo: "Documento personalizado",
            tipo: "PDF",
            icone: "▤"
        }],
        _admin: { status: "published" }
    });
    const product = JSON.parse(JSON.stringify(saved));

    assert.deepEqual(product.downloads, [{
        url: "assets/downloads/produto.pdf",
        titulo: "Documento personalizado",
        tipo: "PDF",
        icone: "▤"
    }]);
});

test("catálogo normaliza as quatro linhas de equipamentos novos", () => {
    const store = createStore();
    const cases = [
        ["Trituradores", "trituradores", "Triturador de duplo eixo"],
        ["Moinhos", "moinhos", "Moinho granulador"],
        ["Esteiras transportadoras", "esteiras", "Esteira industrial"],
        ["Outros equipamentos", "outros-equipamentos", "Triturador auxiliar"]
    ];

    cases.forEach(([line, expectedSlug, category], index) => {
        const saved = store.upsert("novo", {
            id: `linha-${index}`,
            modelo: `Linha ${index}`,
            linha: line,
            categoria: category,
            imagem: "assets/main/tr-700.webp",
            specs: [["Modelo", String(index)]],
            _admin: { status: "published" }
        });

        assert.equal(saved.linha, line);
        assert.equal(saved.categoriaSlug, expectedSlug);
    });

    const legacyConveyor = store.upsert("novo", {
        id: "esteira-legada",
        modelo: "Esteira legada",
        linha: "Esteiras transportadoras",
        categoriaSlug: "esteiras-transportadoras",
        categoria: "Esteira industrial",
        imagem: "assets/main/tr-700.webp",
        specs: [["Modelo", "Legado"]],
        _admin: { status: "published" }
    });
    const legacyOther = store.upsert("novo", {
        id: "outro-legado",
        modelo: "Outro legado",
        linha: "Outros equipamentos",
        categoriaSlug: "outros",
        categoria: "Silo",
        imagem: "assets/main/tr-700.webp",
        specs: [["Modelo", "Legado"]],
        _admin: { status: "published" }
    });
    const legacyGenericLine = store.upsert("novo", {
        id: "linha-generica-legada",
        modelo: "Linha genérica legada",
        linha: "Linha industrial",
        categoriaSlug: "moinhos",
        categoria: "Equipamento industrial",
        imagem: "assets/main/tr-700.webp",
        specs: [["Modelo", "Legado"]],
        _admin: { status: "published" }
    });
    const explicitOther = store.upsert("novo", {
        id: "outro-explicito",
        modelo: "Outro explícito",
        linha: "Outros equipamentos",
        categoriaSlug: "trituradores",
        categoria: "Triturador auxiliar",
        imagem: "assets/main/tr-700.webp",
        specs: [["Modelo", "Atual"]],
        _admin: { status: "published" }
    });

    assert.equal(legacyConveyor.categoriaSlug, "esteiras");
    assert.equal(legacyOther.categoriaSlug, "outros-equipamentos");
    assert.equal(legacyGenericLine.linha, "Moinhos");
    assert.equal(legacyGenericLine.categoriaSlug, "moinhos");
    assert.equal(explicitOther.linha, "Outros equipamentos");
    assert.equal(explicitOther.categoriaSlug, "outros-equipamentos");
});

test("normalização das linhas novas não altera a categoria livre dos usados", () => {
    const store = createStore();
    const saved = store.upsert("usado", {
        id: "esteira-usada",
        modelo: "Esteira usada",
        linha: "Esteiras transportadoras",
        categoria: "Esteiras transportadoras",
        categoriaSlug: "esteiras-transportadoras",
        imagem: "assets/main/tr-700.webp",
        specs: [["Modelo", "Usado"]],
        _admin: { status: "published" }
    });
    const product = JSON.parse(JSON.stringify(saved));

    assert.equal(product.categoria, "Esteiras transportadoras");
    assert.equal(product.categoriaSlug, "esteiras-transportadoras");
    assert.equal(Object.hasOwn(product, "linha"), false);

    const genericUsed = store.upsert("usado", {
        id: "usado-sem-categoria",
        modelo: "Usado sem categoria",
        imagem: "assets/main/tr-700.webp",
        specs: [["Modelo", "Usado"]],
        _admin: { status: "published" }
    });
    assert.equal(genericUsed.categoriaSlug, "outros");
});

test("catálogo preserva o conteúdo completo cadastrado para uma máquina usada", () => {
    const store = createStore();
    const saved = store.upsert("usado", {
        id: "tr-900-usada-qa",
        modelo: "TR-900 Usada QA",
        categoria: "Triturador industrial de duplo eixo",
        resumo: "Resumo sentinela da máquina usada.",
        descricao: "Descrição técnica completa e exclusiva da máquina usada.",
        aplicacoes: ["Reciclagem de plástico rígido", "Redução de volume industrial"],
        materiais: ["PEAD", "PP"],
        ano: "2022",
        condicao: "Revisada e testada",
        garantia: "90 dias",
        localizacao: "Contenda - PR, pátio QA",
        status: "Vendido / indisponível",
        statusSlug: "vendido-indisponivel",
        imagemPrincipal: "assets/main/tr-700.webp",
        alt: "TR-900 usada fotografada no pátio QA",
        observacaoImagens: "Fotos reais realizadas para a validação.",
        galeria: [{ src: "assets/main/tr-800-disp-mobile.webp", alt: "Vista lateral" }],
        specs: [["Potência instalada", "2 x 30 cv"]],
        notaTecnica: "A produção varia conforme o material.",
        oQueAcompanha: ["Painel elétrico", "Jogo de facas reserva"],
        avaliacaoTecnica: ["Rolamentos inspecionados", "Teste sem carga aprovado"],
        informacoesComerciais: [["Preço", "R$ 321.987,00"], ["Transporte", "FOB Contenda"]],
        cardsInformativos: ["pagamento", "potencia", "ano", "localizacao"],
        youtubeId: "abcdefghijk",
        _admin: { status: "published", visible: true }
    });
    const product = JSON.parse(JSON.stringify(saved));

    assert.equal(product.resumo, "Resumo sentinela da máquina usada.");
    assert.equal(product.descricao, "Descrição técnica completa e exclusiva da máquina usada.");
    assert.deepEqual(product.aplicacoes, ["Reciclagem de plástico rígido", "Redução de volume industrial"]);
    assert.deepEqual(product.materiais, ["PEAD", "PP"]);
    assert.equal(product.ano, "2022");
    assert.equal(product.condicao, "Revisada e testada");
    assert.equal(product.garantia, "90 dias");
    assert.equal(product.localizacao, "Contenda - PR, pátio QA");
    assert.equal(product.statusSlug, "vendido");
    assert.equal(product.statusClasse, "status-vendido");
    assert.equal(product.observacaoImagens, "Fotos reais realizadas para a validação.");
    assert.deepEqual(product.specs, [["Potência instalada", "2 x 30 cv"]]);
    assert.equal(product.notaTecnica, "A produção varia conforme o material.");
    assert.deepEqual(product.oQueAcompanha, ["Painel elétrico", "Jogo de facas reserva"]);
    assert.deepEqual(product.avaliacaoTecnica, ["Rolamentos inspecionados", "Teste sem carga aprovado"]);
    assert.deepEqual(product.informacoesComerciais, [["Preço", "R$ 321.987,00"], ["Transporte", "FOB Contenda"]]);
    assert.deepEqual(product.cardsInformativos, ["pagamento", "potencia", "ano", "localizacao"]);
    assert.equal(product.youtubeId, "abcdefghijk");
});

test("catálogo sanitiza os cards informativos sem perder a ordem escolhida", () => {
    const store = createStore();
    const product = store.upsert("usado", {
        id: "usado-cards-qa",
        modelo: "Usado Cards QA",
        imagem: "assets/main/tr-700.webp",
        cardsInformativos: ["pagamento", "pagamento", "invalido", "potencia", "ano", "localizacao", "condicao"],
        _admin: { status: "draft" }
    });

    assert.deepEqual(
        JSON.parse(JSON.stringify(product.cardsInformativos)),
        ["pagamento", "potencia", "ano", "localizacao"]
    );
});

test("validação limita, tipa e impede repetição nos cards informativos", () => {
    const base = {
        id: "usado-cards-api",
        modelo: "Usado Cards API",
        cardsInformativos: ["ano", "pagamento"],
        _admin: { status: "draft" }
    };

    assert.equal(schemas.product.safeParse({ type: "used", product: base }).success, true);
    assert.equal(schemas.product.safeParse({ type: "used", product: { ...base, cardsInformativos: ["ano", "ano"] } }).success, false);
    assert.equal(schemas.product.safeParse({ type: "used", product: { ...base, cardsInformativos: ["ano", "condicao", "garantia", "localizacao", "preco"] } }).success, false);
    assert.equal(schemas.product.safeParse({ type: "used", product: { ...base, cardsInformativos: ["card-invalido"] } }).success, false);
});

test("API rejeita mídia e marcação inseguras nos campos do produto", () => {
    const base = {
        type: "new",
        product: {
            id: "produto-api",
            modelo: "Produto API",
            categoria: "Equipamento industrial",
            resumo: "Resumo seguro.",
            descricao: "Descrição segura.",
            specs: [["Granulometria", "< 5 mm"]],
            _admin: { status: "draft" }
        }
    };

    assert.equal(schemas.product.safeParse(base).success, true);
    [
        { descricao: "<script>alert(1)</script>" },
        { youtubeId: "<script>" },
        { imagem: "data:image/svg+xml,<svg onload=alert(1)>" },
        { downloads: { catalogoTecnico: "javascript:alert(1)" } }
    ].forEach((unsafeFields) => {
        const payload = {
            ...base,
            product: { ...base.product, ...unsafeFields }
        };
        assert.equal(schemas.product.safeParse(payload).success, false);
    });
});
