(function () {
    "use strict";

    const STORAGE_KEY = "brutusmaq.blog.v1";
    const SCHEMA_VERSION = 1;
    const MAX_ARTICLES = 300;
    const MAX_DATA_IMAGE_LENGTH = 1400000;
    const STATUS_VALUES = new Set(["draft", "review", "published"]);
    const MONTHS = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

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

    function safeString(value, maxLength) {
        return String(value == null ? "" : value)
            .replace(/[\u0000-\u001f\u007f]/g, " ")
            .replace(/[<>]/g, "")
            .replace(/\s{2,}/g, " ")
            .trim()
            .slice(0, maxLength || 500);
    }

    function safeParagraph(value, maxLength) {
        return String(value == null ? "" : value)
            .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
            .replace(/[<>]/g, "")
            .replace(/[ \t]{2,}/g, " ")
            .trim()
            .slice(0, maxLength || 3000);
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
            return prefix + (normalized === "assets/main/tr-700.png" ? "assets/main/tr-700.webp" : normalized);
        }
        if (isDataImage || isHttpsImage) return image;
        return fallback === undefined ? "assets/main/tr-700.webp" : fallback;
    }

    function safeDate(value) {
        const candidate = String(value || "").slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return "";
        const date = new Date(`${candidate}T12:00:00`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== candidate) return "";
        return candidate;
    }

    function formatDisplayDate(value) {
        const datetime = safeDate(value);
        if (!datetime) return "";
        const [year, month, day] = datetime.split("-").map(Number);
        return `${day} de ${MONTHS[month - 1]} de ${year}`;
    }

    function safeStringList(value, maxItems, maxLength) {
        if (!Array.isArray(value)) return [];
        return value
            .slice(0, maxItems || 30)
            .map((item) => safeParagraph(item, maxLength || 3000))
            .filter(Boolean);
    }

    function safeSections(value) {
        if (!Array.isArray(value)) return [];
        return value.slice(0, 30).map((item, index) => {
            const source = item && typeof item === "object" ? item : {};
            return {
                title: safeString(source.title, 180) || `${index + 1}. Seção`,
                paragraphs: safeStringList(source.paragraphs, 20, 3000)
            };
        }).filter((section) => section.paragraphs.length);
    }

    function safeCards(value) {
        if (!Array.isArray(value)) return [];
        return value.slice(0, 12).map((item, index) => {
            const values = Array.isArray(item) ? item : [];
            const title = safeString(values[1], 120);
            const description = safeParagraph(values[2], 600);
            return [safeString(values[0], 12) || String(index + 1).padStart(2, "0"), title, description];
        }).filter((item) => item[1] && item[2]);
    }

    function countWords(article) {
        const text = [
            ...(article.intro || []),
            ...(article.sections || []).flatMap((section) => section.paragraphs || []),
            article.highlight || ""
        ].join(" ").trim();
        return text ? text.split(/\s+/).length : 0;
    }

    function estimateReading(article) {
        return `${Math.max(1, Math.ceil(countWords(article) / 210))} min de leitura`;
    }

    function createUid(slug, index) {
        const randomPart = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        return `article:${slug || "artigo"}:${index == null ? randomPart : index}`;
    }

    function safeAdmin(value, slug, index) {
        const admin = value && typeof value === "object" ? value : {};
        const uidCandidate = safeString(admin.uid, 150);
        const status = STATUS_VALUES.has(admin.status) ? admin.status : "published";
        const updatedAt = /^\d{4}-\d{2}-\d{2}T/.test(String(admin.updatedAt || ""))
            ? String(admin.updatedAt).slice(0, 30)
            : "";
        const normalized = {
            uid: /^[a-z0-9:_-]+$/i.test(uidCandidate) ? uidCandidate : createUid(slug, index),
            status,
            visible: admin.visible !== false,
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

    function cardClassFor(category) {
        const normalized = normalizeText(category);
        if (normalized.includes("manutenc")) return "blog-media-maintenance";
        if (normalized.includes("sustent") || normalized.includes("circular")) return "blog-media-plastic";
        if (normalized.includes("performance") || normalized.includes("tecnolog")) return "blog-media-conveyor";
        return "blog-media-machine";
    }

    function sanitizeArticle(input, index) {
        const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
        const title = safeString(source.title, 180) || `Artigo ${index + 1}`;
        const slug = createSlug(source.slug || title, `artigo-${index + 1}`);
        const datetime = safeDate(source.datetime) || new Date().toISOString().slice(0, 10);
        const article = {
            slug,
            category: safeString(source.category, 100) || "Conteúdo técnico",
            title,
            accentFrom: safeString(source.accentFrom, 100),
            excerpt: safeParagraph(source.excerpt, 360),
            date: formatDisplayDate(datetime),
            datetime,
            reading: safeString(source.reading, 40),
            author: safeString(source.author, 100) || "Equipe Brutusmaq",
            image: safeImage(source.image, "assets/main/tr-700.webp"),
            imageAlt: safeString(source.imageAlt, 180) || `${title} | Brutusmaq`,
            cardClass: /^blog-media-[a-z-]+$/.test(String(source.cardClass || ""))
                ? source.cardClass
                : cardClassFor(source.category),
            popular: source.popular === true,
            intro: safeStringList(source.intro, 10, 3000),
            sections: safeSections(source.sections),
            benefits: safeCards(source.benefits),
            applications: safeCards(source.applications),
            checks: safeStringList(source.checks, 20, 600),
            highlight: safeParagraph(source.highlight, 1000),
            _admin: safeAdmin(source._admin, slug, index)
        };

        article.reading = article.reading || estimateReading(article);
        return article;
    }

    function normalizeArticles(input) {
        const source = input && input.articles ? input.articles : input;
        return (Array.isArray(source) ? source : [])
            .slice(0, MAX_ARTICLES)
            .map((article, index) => sanitizeArticle(article, index));
    }

    function assertArticles(articles) {
        const slugs = new Set();
        const uids = new Set();
        articles.forEach((article) => {
            if (slugs.has(article.slug)) throw new Error(`O slug \"${article.slug}\" está duplicado.`);
            if (uids.has(article._admin.uid)) throw new Error("Há artigos com identificadores internos duplicados.");
            slugs.add(article.slug);
            uids.add(article._admin.uid);
        });
    }

    function isPublic(article) {
        return article._admin.status === "published" && article._admin.visible !== false;
    }

    function sortByPublication(articles) {
        return articles.slice().sort((first, second) => {
            const dateDifference = String(second.datetime).localeCompare(String(first.datetime));
            if (dateDifference) return dateDifference;
            return Number(second.popular) - Number(first.popular);
        });
    }

    const baseArticles = normalizeArticles(
        Array.isArray(window.BRUTUS_BLOG_ARTICLES) ? window.BRUTUS_BLOG_ARTICLES : []
    );
    let state = clone(baseArticles);
    let lastError = "";
    let mode = "local";

    function readStoredArticles() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            const articles = normalizeArticles(parsed);
            assertArticles(articles);
            return articles;
        } catch (error) {
            lastError = error instanceof Error ? error.message : "Não foi possível ler os artigos salvos.";
            return null;
        }
    }

    function applyPublicArticles() {
        window.BRUTUS_BLOG_ARTICLES = clone(sortByPublication(state.filter(isPublic)));
    }

    function notify() {
        if (typeof window.CustomEvent === "function") {
            window.dispatchEvent(new CustomEvent("brutusmaq:blog-changed", {
                detail: { articles: clone(state) }
            }));
        }
    }

    function persist(nextState) {
        const articles = normalizeArticles(nextState);
        assertArticles(articles);

        if (mode === "local") {
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    version: SCHEMA_VERSION,
                    updatedAt: new Date().toISOString(),
                    articles
                }));
            } catch (error) {
                throw new Error("O navegador não conseguiu salvar os artigos. Reduza o tamanho da imagem ou exporte um backup.");
            }
        }

        state = articles;
        lastError = "";
        applyPublicArticles();
        notify();
        return clone(state);
    }

    function findByUid(articles, uid) {
        const index = articles.findIndex((article) => article._admin.uid === uid);
        return index >= 0 ? { index, article: articles[index] } : null;
    }

    function upsert(input, originalUid) {
        const articles = clone(state);
        const existing = originalUid ? findByUid(articles, originalUid) : null;
        if (existing) articles.splice(existing.index, 1);

        const article = sanitizeArticle(input, articles.length);
        if (originalUid) article._admin.uid = originalUid;
        article._admin.updatedAt = new Date().toISOString();

        if (articles.some((item) => item.slug === article.slug)) {
            throw new Error(`Já existe um artigo com o slug \"${article.slug}\".`);
        }

        if (existing) articles.splice(existing.index, 0, article);
        else articles.unshift(article);

        persist(articles);
        return clone(article);
    }

    function remove(uid) {
        const articles = clone(state);
        const found = findByUid(articles, uid);
        if (!found) throw new Error("Artigo não encontrado.");
        const article = articles.splice(found.index, 1)[0];
        persist(articles);
        return { index: found.index, article: clone(article) };
    }

    function restore(removed) {
        if (!removed || !removed.article) throw new Error("Não foi possível restaurar o artigo.");
        const articles = clone(state);
        const index = Math.max(0, Math.min(Number(removed.index) || 0, articles.length));
        articles.splice(index, 0, removed.article);
        return persist(articles);
    }

    function replaceArticles(input) {
        return persist(normalizeArticles(input));
    }

    function reset() {
        if (mode === "local") window.localStorage.removeItem(STORAGE_KEY);
        state = clone(baseArticles);
        lastError = "";
        applyPublicArticles();
        notify();
        return clone(state);
    }

    const storedArticles = readStoredArticles();
    if (storedArticles) state = storedArticles;
    applyPublicArticles();

    function setRemoteArticles(input) {
        const articles = normalizeArticles(input);
        assertArticles(articles);
        state = articles;
        mode = "database";
        lastError = "";
        applyPublicArticles();
        notify();
        return clone(state);
    }

    async function hydrateFromApi() {
        if (!/^https?:$/.test(window.location.protocol) || typeof window.fetch !== "function") return false;
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        const timeout = controller ? window.setTimeout(() => controller.abort(), 3000) : 0;
        try {
            const response = await window.fetch("/api/articles", {
                headers: { Accept: "application/json" },
                credentials: "same-origin",
                signal: controller?.signal
            });
            if (!response.ok) return false;
            const payload = await response.json();
            setRemoteArticles(payload.articles);
            return true;
        } catch (error) {
            return false;
        } finally {
            if (timeout) window.clearTimeout(timeout);
        }
    }

    window.addEventListener("storage", (event) => {
        if (event.key !== STORAGE_KEY || mode === "database") return;
        const stored = readStoredArticles();
        state = stored || clone(baseArticles);
        applyPublicArticles();
        notify();
    });

    window.BrutusmaqBlogStore = Object.freeze({
        version: SCHEMA_VERSION,
        storageKey: STORAGE_KEY,
        getMode: () => mode,
        getArticles: () => clone(state),
        getBaseArticles: () => clone(baseArticles),
        getLocalArticles: () => clone(readStoredArticles()),
        getPublicArticles: () => clone(sortByPublication(state.filter(isPublic))),
        getLastError: () => lastError,
        hasCustomArticles: () => window.localStorage.getItem(STORAGE_KEY) !== null,
        upsert,
        remove,
        restore,
        replaceArticles,
        setRemoteArticles,
        reset,
        exportArticles: () => ({
            version: SCHEMA_VERSION,
            exportedAt: new Date().toISOString(),
            articles: clone(state)
        })
    });
    window.BrutusmaqBlogReady = hydrateFromApi();
}());
