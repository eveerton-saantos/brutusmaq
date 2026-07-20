(function () {
    "use strict";

    const STORAGE_KEY = "brutusmaq.catalogo.v1";
    const SCHEMA_VERSION = 1;
    const MAX_PRODUCTS_PER_TYPE = 250;
    const MAX_DATA_IMAGE_LENGTH = 1400000;
    const STATUS_VALUES = new Set(["draft", "review", "published"]);
    const USED_INFO_CARD_IDS = new Set([
        "ano", "condicao", "garantia", "localizacao", "disponibilidade", "preco",
        "entrega", "pagamento", "transporte", "horas-uso", "potencia", "boca-alimentacao"
    ]);
    const TYPE_KEYS = {
        novo: "novos",
        usado: "usados"
    };
    const optimizedLegacyImages = new Map([
        ["assets/main/tr-700.png", "assets/main/tr-700.webp"],
        ["assets/main/tr-800-disp-mobile.png", "assets/main/tr-800-disp-mobile.webp"],
        ["assets/main/main-brutusmaq.svg", "assets/main/main-brutusmaq.webp"]
    ]);

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeText(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    function createSlug(value, fallback) {
        return normalizeText(value)
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || fallback;
    }

    function canonicalNewProductLine(line, categorySlug, category) {
        const identify = (source) => {
            if (source.includes("outro")) return "Outros equipamentos";
            if (source.includes("tritur")) return "Trituradores";
            if (source.includes("moinho")) return "Moinhos";
            if (source.includes("esteira")) return "Esteiras transportadoras";
            return "";
        };
        const explicitLine = normalizeText(line);
        const explicitMatch = identify(explicitLine);
        if (explicitMatch) return explicitMatch;
        const storedSlug = normalizeText(categorySlug);
        const storedMatch = identify(storedSlug);
        if (storedMatch) return storedMatch;
        if (explicitLine || storedSlug) return "Outros equipamentos";
        const specificCategory = normalizeText(category);
        if (specificCategory) return identify(specificCategory) || "Outros equipamentos";
        return "Outros equipamentos";
    }

    function canonicalNewProductSlug(line) {
        if (line === "Trituradores") return "trituradores";
        if (line === "Moinhos") return "moinhos";
        if (line === "Esteiras transportadoras") return "esteiras";
        return "outros-equipamentos";
    }

    function usedStatusSlug(value) {
        const normalized = normalizeText(value);
        if (normalized.includes("vendid") || normalized.includes("indisponivel")) return "vendido";
        if (normalized.includes("revisao")) return "revisao";
        if (normalized.includes("reservad")) return "reservado";
        if (normalized.includes("disponivel")) return "disponivel";
        return createSlug(value, "a-consultar");
    }

    function safeString(value, maxLength) {
        return String(value == null ? "" : value)
            .replace(/[\u0000-\u001f\u007f]/g, " ")
            .replace(/[<>]/g, "")
            .replace(/\s{2,}/g, " ")
            .trim()
            .slice(0, maxLength || 500);
    }

    function safeMultiline(value, maxLength) {
        return String(value == null ? "" : value)
            .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
            .replace(/[<>]/g, "")
            .trim()
            .slice(0, maxLength || 5000);
    }

    function safeImage(value, fallback) {
        const image = String(value || "").trim();
        const isDataImage = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(image)
            && image.length <= MAX_DATA_IMAGE_LENGTH;
        const isHttpsImage = /^https:\/\/[a-z0-9.-]+(?:\/[a-z0-9_~:/?#[\]@!$&'()*+,;=%.-]*)?$/i.test(image);
        const isLocalImage = /^(?:\.\/|\/)?(?:assets|uploads)\/[a-z0-9_()\-./% ]+$/i.test(image);

        if (isLocalImage) {
            const prefix = image.startsWith("/") ? "/" : (image.startsWith("./") ? "./" : "");
            const normalized = image.replace(/^(?:\.\/|\/)/, "");
            return prefix + (optimizedLegacyImages.get(normalized) || normalized);
        }
        if (isDataImage || isHttpsImage) return image;
        return fallback === undefined ? "assets/main/tr-700.webp" : fallback;
    }

    function safePageUrl(value, fallback) {
        const url = String(value || "").trim();
        if (/^(?:produto|maquina-usada)\.html\?id=[a-z0-9_-]+$/i.test(url)) return url;
        return fallback;
    }

    function safeStringList(value, maxItems, maxLength) {
        if (!Array.isArray(value)) return [];
        return value
            .slice(0, maxItems || 30)
            .map((item) => safeString(item, maxLength || 240))
            .filter(Boolean);
    }

    function safeUsedInfoCards(value) {
        if (!Array.isArray(value)) return [];
        const cards = [];
        value.forEach((item) => {
            const id = String(item || "").trim();
            if (USED_INFO_CARD_IDS.has(id) && !cards.includes(id) && cards.length < 4) cards.push(id);
        });
        return cards;
    }

    function safeBenefits(value, maxItems) {
        if (!Array.isArray(value)) return [];
        return value.slice(0, maxItems || 20).map((item) => {
            if (typeof item === "string") return safeString(item, 600);
            if (!item || typeof item !== "object") return "";
            const title = safeString(item.titulo || item.nome, 180);
            const description = safeString(item.texto || item.descricao, 500);
            if (!title && !description) return "";
            return { titulo: title || "Diferencial", texto: description };
        }).filter(Boolean);
    }

    function safeSpecs(value, maxItems) {
        if (!Array.isArray(value)) return [];
        return value
            .slice(0, maxItems || 40)
            .map((item) => Array.isArray(item)
                ? [safeString(item[0], 100), safeString(item[1], 240)]
                : ["", ""])
            .filter((item) => item[0] && item[1]);
    }

    function safeGallery(value, fallbackAlt) {
        if (!Array.isArray(value)) return [];
        return value.slice(0, 8).map((item) => {
            const source = typeof item === "string" ? item : item && item.src;
            const alt = typeof item === "object" && item ? item.alt : fallbackAlt;
            return {
                src: safeImage(source, ""),
                alt: safeString(alt || fallbackAlt, 180)
            };
        }).filter((item) => item.src);
    }

    function safeDownloadEntry(value) {
        const source = value && typeof value === "object" ? value : {};
        const url = String(typeof value === "string" ? value : source.url || "").trim();
        if (!/^(?:https:\/\/|assets\/)[^<>\s]+$/i.test(url) || url.includes("..")) return undefined;
        if (typeof value === "string") return url.slice(0, 600);
        const entry = { url: url.slice(0, 600) };
        assignOptional(entry, "titulo", safeString(source.titulo || source.label, 180));
        assignOptional(entry, "tipo", safeString(source.tipo || source.formato, 40));
        assignOptional(entry, "icone", safeString(source.icone, 20));
        return entry;
    }

    function safeDownloads(value) {
        if (Array.isArray(value)) {
            const entries = value.slice(0, 8).map(safeDownloadEntry).filter(Boolean);
            return entries.length ? entries : undefined;
        }
        if (!value || typeof value !== "object") return undefined;
        const downloads = {};
        ["catalogoTecnico", "manualOperacao", "desenhoTecnico", "certificadoNr12"].forEach((key) => {
            const entry = safeDownloadEntry(value[key]);
            if (entry) downloads[key] = entry;
        });
        return Object.keys(downloads).length ? downloads : undefined;
    }

    function safeYoutubeId(value) {
        const id = String(value || "").trim();
        return /^[a-z0-9_-]{6,20}$/i.test(id) ? id : "";
    }

    function safeYoutubeEmbed(value) {
        const url = String(value || "").trim();
        return /^https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/[a-z0-9_-]{6,20}(?:\?[^<>"\s]*)?$/i.test(url)
            ? url.slice(0, 600)
            : "";
    }

    function createUid(type, id, index) {
        const randomPart = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        return `${type}:${id || "produto"}:${index == null ? randomPart : index}`;
    }

    function safeAdmin(value, type, id, index) {
        const admin = value && typeof value === "object" ? value : {};
        const uidCandidate = safeString(admin.uid, 120);
        const status = STATUS_VALUES.has(admin.status) ? admin.status : "published";
        const updatedAt = /^\d{4}-\d{2}-\d{2}T/.test(String(admin.updatedAt || ""))
            ? String(admin.updatedAt).slice(0, 30)
            : "";
        const normalized = {
            uid: /^[a-z0-9:_-]+$/i.test(uidCandidate) ? uidCandidate : createUid(type, id, index),
            status,
            visible: admin.visible !== false,
            featured: admin.featured === true,
            priority: admin.priority === true,
            sku: safeString(admin.sku, 80),
            updatedAt
        };
        const submissionId = safeString(admin.submissionId, 180);
        const submissionStatus = safeString(admin.submissionStatus, 20);
        if (/^[a-z0-9:_-]+$/i.test(submissionId)) normalized.submissionId = submissionId;
        if (["draft", "pending", "rejected"].includes(submissionStatus)) normalized.submissionStatus = submissionStatus;
        if (Number.isInteger(admin.version) && admin.version >= 0) normalized.version = admin.version;
        const reviewNote = safeString(admin.reviewNote, 1000);
        if (reviewNote) normalized.reviewNote = reviewNote;
        return normalized;
    }

    function assignOptional(target, key, value) {
        if (value !== "" && value !== undefined && (!Array.isArray(value) || value.length)) {
            target[key] = value;
        }
    }

    function sanitizeProduct(input, type, index) {
        const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
        const model = safeString(source.modelo || source.model, 120) || `Produto ${index + 1}`;
        const id = createSlug(source.id || source.slug || model, `${type}-${index + 1}`);
        const fallbackImage = "assets/main/tr-700.webp";
        const image = safeImage(source.imagemPrincipal || source.imagem, fallbackImage);
        const category = safeString(source.categoria, 120);
        const line = safeString(source.linha, 120);
        const canonicalLine = type === "novo"
            ? canonicalNewProductLine(line, source.categoriaSlug, category)
            : "";
        const product = {
            id,
            modelo: model,
            categoriaSlug: type === "novo"
                ? canonicalNewProductSlug(canonicalLine)
                : createSlug(source.categoriaSlug || category, "outros"),
            categoria: category || line || (type === "usado" ? "Máquina usada" : "Equipamento industrial"),
            descricao: safeMultiline(source.descricao, 5000),
            imagemPrincipal: image,
            imagem: image,
            alt: safeString(source.alt || `${model} Brutusmaq`, 180),
            specs: safeSpecs(source.specs, 40)
        };
        assignOptional(product, "resumo", safeString(source.resumo, 180));

        if (type === "novo") {
            product.linha = canonicalLine;
            assignOptional(product, "status", safeString(source.status, 100));
            assignOptional(product, "aplicacao", safeString(source.aplicacao, 300));
            assignOptional(product, "aplicacoesTexto", safeString(source.aplicacoesTexto, 300));
            assignOptional(product, "garantia", safeString(source.garantia, 160));
            assignOptional(product, "fabricacao", safeString(source.fabricacao, 160));
            assignOptional(product, "recursos", safeStringList(source.recursos, 30, 240));
            assignOptional(product, "beneficios", safeBenefits(source.beneficios, 20));
            assignOptional(product, "aplicacoes", safeStringList(source.aplicacoes, 30, 240));
            assignOptional(product, "materiais", safeStringList(source.materiais, 30, 240));
            assignOptional(product, "destaques", safeStringList(source.destaques, 20, 240));
            assignOptional(product, "sobre", safeStringList(source.sobre, 10, 1200));
            assignOptional(product, "sobreTitulo", safeString(source.sobreTitulo, 180));
            assignOptional(product, "notaTecnica", safeMultiline(source.notaTecnica, 1500));
            assignOptional(product, "tipoImagem", safeString(source.tipoImagem, 30));
            assignOptional(product, "disponibilidade", safeString(source.disponibilidade, 100));
            assignOptional(product, "precoVisibilidade", safeString(source.precoVisibilidade, 100));
        } else {
            const publicStatus = safeString(source.status, 100) || "A consultar";
            const publicStatusSlug = usedStatusSlug(source.statusSlug || publicStatus);
            assignOptional(product, "ano", safeString(source.ano, 20));
            assignOptional(product, "condicao", safeString(source.condicao, 240));
            assignOptional(product, "garantia", safeString(source.garantia, 240));
            assignOptional(product, "localizacao", safeString(source.localizacao, 240));
            product.statusSlug = publicStatusSlug;
            product.status = publicStatus;
            product.statusClasse = `status-${publicStatusSlug}`;
            assignOptional(product, "aplicacoes", safeStringList(source.aplicacoes, 30, 240));
            assignOptional(product, "materiais", safeStringList(source.materiais, 30, 240));
            assignOptional(product, "notaTecnica", safeMultiline(source.notaTecnica, 1500));
            assignOptional(product, "especificacoes", safeStringList(source.especificacoes, 20, 300));
            assignOptional(product, "oQueAcompanha", safeStringList(source.oQueAcompanha, 30, 300));
            assignOptional(product, "avaliacaoTecnica", safeStringList(source.avaliacaoTecnica, 30, 300));
            assignOptional(product, "informacoesComerciais", safeSpecs(source.informacoesComerciais, 30));
            assignOptional(product, "cardsInformativos", safeUsedInfoCards(source.cardsInformativos));
            assignOptional(product, "cta", safeString(source.cta, 80));
            product.url = safePageUrl(source.url, `maquina-usada.html?id=${id}`);
        }

        assignOptional(product, "observacaoImagens", safeMultiline(source.observacaoImagens, 800));
        assignOptional(product, "galeria", safeGallery(source.galeria, product.alt));
        assignOptional(product, "youtubeBusca", safeString(source.youtubeBusca, 240));
        assignOptional(product, "youtubeId", safeYoutubeId(source.youtubeId));
        assignOptional(product, "youtubeEmbed", safeYoutubeEmbed(source.youtubeEmbed));
        assignOptional(product, "downloads", safeDownloads(source.downloads));
        product._admin = safeAdmin(source._admin, type, id, index);

        return product;
    }

    function normalizeCatalog(input) {
        const source = input && input.catalog ? input.catalog : input || {};
        const newProducts = source.novos || source.produtosNovos || [];
        const usedProducts = source.usados || source.maquinasUsadas || [];

        return {
            novos: (Array.isArray(newProducts) ? newProducts : [])
                .slice(0, MAX_PRODUCTS_PER_TYPE)
                .map((product, index) => sanitizeProduct(product, "novo", index)),
            usados: (Array.isArray(usedProducts) ? usedProducts : [])
                .slice(0, MAX_PRODUCTS_PER_TYPE)
                .map((product, index) => sanitizeProduct(product, "usado", index))
        };
    }

    function assertCatalog(catalog) {
        if (!catalog.novos.length && !catalog.usados.length) {
            throw new Error("O catálogo não pode ficar totalmente vazio.");
        }

        ["novos", "usados"].forEach((key) => {
            const ids = new Set();
            catalog[key].forEach((product) => {
                if (ids.has(product.id)) {
                    throw new Error(`O identificador \"${product.id}\" está duplicado em ${key}.`);
                }
                ids.add(product.id);
            });
        });
    }

    const baseCatalog = normalizeCatalog({
        novos: Array.isArray(window.brutusmaqProdutosNovos) ? window.brutusmaqProdutosNovos : [],
        usados: Array.isArray(window.brutusmaqMaquinasUsadas) ? window.brutusmaqMaquinasUsadas : []
    });
    let state = clone(baseCatalog);
    let lastError = "";
    let mode = "local";

    function readStoredCatalog() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            const catalog = normalizeCatalog(parsed);
            assertCatalog(catalog);
            return catalog;
        } catch (error) {
            lastError = error instanceof Error ? error.message : "Não foi possível ler o catálogo salvo.";
            return null;
        }
    }

    function isPublic(product) {
        return product._admin.status === "published" && product._admin.visible !== false;
    }

    function applyPublicCatalog() {
        window.brutusmaqProdutosNovos = clone(state.novos.filter(isPublic));
        window.brutusmaqMaquinasUsadas = clone(state.usados.filter(isPublic));
    }

    function notify() {
        if (typeof window.CustomEvent === "function") {
            window.dispatchEvent(new CustomEvent("brutusmaq:catalog-changed", {
                detail: { catalog: clone(state) }
            }));
        }
    }

    function persist(nextState) {
        const catalog = normalizeCatalog(nextState);
        assertCatalog(catalog);

        if (mode === "local") {
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    version: SCHEMA_VERSION,
                    updatedAt: new Date().toISOString(),
                    catalog
                }));
            } catch (error) {
                throw new Error("O navegador não conseguiu salvar o catálogo. Reduza o tamanho das imagens ou exporte uma cópia de segurança.");
            }
        }

        state = catalog;
        lastError = "";
        applyPublicCatalog();
        notify();
        return clone(state);
    }

    function findByUid(catalog, uid) {
        for (const key of ["novos", "usados"]) {
            const index = catalog[key].findIndex((product) => product._admin.uid === uid);
            if (index >= 0) return { key, index, product: catalog[key][index] };
        }
        return null;
    }

    function upsert(type, input, originalUid) {
        const destinationKey = TYPE_KEYS[type];
        if (!destinationKey) throw new Error("Tipo de produto inválido.");

        const catalog = clone(state);
        const existing = originalUid ? findByUid(catalog, originalUid) : null;
        if (existing) catalog[existing.key].splice(existing.index, 1);

        const product = sanitizeProduct(input, type, catalog[destinationKey].length);
        if (originalUid) product._admin.uid = originalUid;
        product._admin.updatedAt = new Date().toISOString();

        const duplicate = catalog[destinationKey].some((item) => item.id === product.id);
        if (duplicate) throw new Error(`Já existe um produto com o identificador \"${product.id}\".`);

        if (existing && existing.key === destinationKey) {
            catalog[destinationKey].splice(existing.index, 0, product);
        } else {
            catalog[destinationKey].unshift(product);
        }

        persist(catalog);
        return clone(product);
    }

    function remove(uid) {
        const catalog = clone(state);
        const found = findByUid(catalog, uid);
        if (!found) throw new Error("Produto não encontrado.");
        const removed = catalog[found.key].splice(found.index, 1)[0];
        persist(catalog);
        return {
            key: found.key,
            index: found.index,
            product: clone(removed)
        };
    }

    function restore(removed) {
        if (!removed || !removed.product || !["novos", "usados"].includes(removed.key)) {
            throw new Error("Não foi possível restaurar o produto.");
        }
        const catalog = clone(state);
        const index = Math.max(0, Math.min(Number(removed.index) || 0, catalog[removed.key].length));
        catalog[removed.key].splice(index, 0, removed.product);
        return persist(catalog);
    }

    function replaceCatalog(input) {
        return persist(normalizeCatalog(input));
    }

    function reset() {
        if (mode === "local") window.localStorage.removeItem(STORAGE_KEY);
        state = clone(baseCatalog);
        lastError = "";
        applyPublicCatalog();
        notify();
        return clone(state);
    }

    const storedCatalog = readStoredCatalog();
    if (storedCatalog) state = storedCatalog;
    applyPublicCatalog();

    function setRemoteCatalog(input) {
        const catalog = normalizeCatalog(input);
        assertCatalog(catalog);
        state = catalog;
        mode = "database";
        lastError = "";
        applyPublicCatalog();
        notify();
        return clone(state);
    }

    async function hydrateFromApi() {
        if (!/^https?:$/.test(window.location.protocol) || typeof window.fetch !== "function") return false;
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        const timeout = controller ? window.setTimeout(() => controller.abort(), 3000) : 0;
        try {
            const response = await window.fetch("/api/products", {
                headers: { Accept: "application/json" },
                credentials: "same-origin",
                signal: controller?.signal
            });
            if (!response.ok) return false;
            const payload = await response.json();
            setRemoteCatalog(payload.catalog);
            return true;
        } catch (error) {
            return false;
        } finally {
            if (timeout) window.clearTimeout(timeout);
        }
    }

    window.addEventListener("storage", (event) => {
        if (event.key !== STORAGE_KEY || mode === "database") return;
        const stored = readStoredCatalog();
        state = stored || clone(baseCatalog);
        applyPublicCatalog();
        notify();
    });

    window.BrutusmaqCatalogStore = Object.freeze({
        version: SCHEMA_VERSION,
        storageKey: STORAGE_KEY,
        getMode: () => mode,
        getCatalog: () => clone(state),
        getBaseCatalog: () => clone(baseCatalog),
        getLocalCatalog: () => clone(readStoredCatalog()),
        getPublicCatalog: () => ({
            novos: clone(state.novos.filter(isPublic)),
            usados: clone(state.usados.filter(isPublic))
        }),
        getLastError: () => lastError,
        hasCustomCatalog: () => window.localStorage.getItem(STORAGE_KEY) !== null,
        upsert,
        remove,
        restore,
        replaceCatalog,
        setRemoteCatalog,
        reset,
        exportCatalog: () => ({
            version: SCHEMA_VERSION,
            exportedAt: new Date().toISOString(),
            catalog: clone(state)
        })
    });
    window.BrutusmaqCatalogReady = hydrateFromApi();
}());
