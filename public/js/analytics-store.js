(function () {
    "use strict";

    const storageKey = "brutusmaq:analytics:v1";
    const outboxKey = "brutusmaq:analytics:outbox:v1";
    const sessionKey = "brutusmaq:analytics:session:v1";
    const acquisitionKey = "brutusmaq:analytics:acquisition:v1";
    const adminPage = /(?:^|\/)painel-admin\.html$/i.test(window.location.pathname);
    const retentionDays = 400;
    const maxEvents = 15000;
    const eventTypes = new Set([
        "page_view",
        "proposal_intent",
        "whatsapp_click",
        "form_submit_attempt",
        "form_submit_success",
        "form_submit_failure",
        "article_share"
    ]);
    const entityTypes = new Set(["page", "product", "used_product", "article"]);
    const deviceTypes = new Set(["desktop", "mobile", "tablet", "unknown"]);
    const trafficSources = new Set([
        "direct", "google", "bing", "facebook", "instagram", "tiktok", "youtube",
        "linkedin", "whatsapp", "email", "other", "unknown"
    ]);
    const trafficMediums = new Set(["direct", "organic", "social", "paid", "referral", "email", "unknown"]);
    let lastError = "";
    let pageViewTracked = false;
    let flushTimer = 0;
    let flushing = false;
    let remoteUnavailableUntil = 0;

    function trackingAllowed() {
        return !adminPage && Boolean(window.BrutusmaqPrivacy?.allows?.("analytics"));
    }

    function cleanText(value, maxLength) {
        return String(value == null ? "" : value)
            .replace(/[<>]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, maxLength || 120);
    }

    function normalizeSlug(value) {
        return cleanText(value, 100)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function normalizePage(pathname) {
        let path = cleanText(pathname || window.location.pathname, 160)
            .replace(/^\/public(?=\/)/, "")
            .replace(/^\/+/, "");
        if (!path) path = "index.html";
        return path;
    }

    function createId(prefix) {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            return `${prefix}-${window.crypto.randomUUID()}`;
        }
        return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function getSessionId() {
        try {
            const saved = window.sessionStorage.getItem(sessionKey);
            if (saved) return saved;
            const created = createId("session");
            window.sessionStorage.setItem(sessionKey, created);
            return created;
        } catch (error) {
            return createId("session");
        }
    }

    function detectDeviceType() {
        const userAgent = String(window.navigator?.userAgent || "").toLowerCase();
        const touchPoints = Number(window.navigator?.maxTouchPoints || 0);
        if (/ipad|tablet|playbook|silk/.test(userAgent)
            || (/android/.test(userAgent) && !/mobile/.test(userAgent))
            || (/macintosh/.test(userAgent) && touchPoints > 1)) return "tablet";
        if (window.navigator?.userAgentData?.mobile
            || /mobi|iphone|ipod|android|blackberry|iemobile|opera mini/.test(userAgent)) return "mobile";
        return userAgent ? "desktop" : "unknown";
    }

    function sourceFromToken(value) {
        const token = cleanText(value, 100).toLowerCase();
        if (!token) return "";
        if (/(?:^|\.)google\.|google|adwords|doubleclick/.test(token)) return "google";
        if (/(?:^|\.)bing\.|bing/.test(token)) return "bing";
        if (/(?:^|\.)facebook\.|facebook|^fb$/.test(token)) return "facebook";
        if (/(?:^|\.)instagram\.|instagram/.test(token)) return "instagram";
        if (/(?:^|\.)tiktok\.|tiktok/.test(token)) return "tiktok";
        if (/(?:^|\.)youtube\.|youtu\.be|youtube/.test(token)) return "youtube";
        if (/(?:^|\.)linkedin\.|linkedin/.test(token)) return "linkedin";
        if (/(?:^|\.)whatsapp\.|wa\.me|whatsapp/.test(token)) return "whatsapp";
        if (/newsletter|e-?mail/.test(token)) return "email";
        return "other";
    }

    function mediumFromToken(value, source) {
        const token = cleanText(value, 80).toLowerCase().replace(/[\s_]+/g, "-");
        if (/cpc|ppc|paid|ads?|display|remarketing|retargeting/.test(token)) return "paid";
        if (/social/.test(token)) return "social";
        if (/organic|search|seo/.test(token)) return "organic";
        if (/e-?mail|newsletter/.test(token)) return "email";
        if (/referral|affiliate|partner/.test(token)) return "referral";
        if (["google", "bing"].includes(source)) return "organic";
        if (["facebook", "instagram", "tiktok", "youtube", "linkedin", "whatsapp"].includes(source)) return "social";
        if (source === "email") return "email";
        if (source === "direct") return "direct";
        if (source === "other") return "referral";
        return "unknown";
    }

    function detectTrafficAttribution() {
        const params = new URLSearchParams(window.location.search);
        let source = "";
        let medium = "";
        if (params.has("gclid")) {
            source = "google";
            medium = "paid";
        } else if (params.has("fbclid")) {
            source = "facebook";
            medium = "paid";
        } else if (params.has("ttclid")) {
            source = "tiktok";
            medium = "paid";
        } else if (params.get("utm_source")) {
            source = sourceFromToken(params.get("utm_source"));
            medium = mediumFromToken(params.get("utm_medium"), source);
        }

        if (!source && document.referrer) {
            try {
                const referrer = new URL(document.referrer);
                if (referrer.origin !== window.location.origin) source = sourceFromToken(referrer.hostname);
            } catch (error) {
                source = "unknown";
            }
        }

        if (!source) source = "direct";
        if (!medium) medium = mediumFromToken("", source);
        return {
            trafficSource: trafficSources.has(source) ? source : "unknown",
            trafficMedium: trafficMediums.has(medium) ? medium : "unknown"
        };
    }

    function getAcquisitionContext() {
        try {
            const saved = JSON.parse(window.sessionStorage.getItem(acquisitionKey) || "null");
            if (saved && trafficSources.has(saved.trafficSource) && trafficMediums.has(saved.trafficMedium)) {
                return { trafficSource: saved.trafficSource, trafficMedium: saved.trafficMedium };
            }
        } catch (error) {
            // A atribuição da página atual ainda pode ser usada quando o armazenamento está bloqueado.
        }
        const detected = detectTrafficAttribution();
        try {
            window.sessionStorage.setItem(acquisitionKey, JSON.stringify(detected));
        } catch (error) {
            // A atribuição permanece válida durante esta página quando o armazenamento está bloqueado.
        }
        return detected;
    }

    function emptyState() {
        const now = new Date().toISOString();
        return {
            version: 1,
            startedAt: now,
            updatedAt: now,
            retentionDays,
            events: []
        };
    }

    function sanitizeEvent(source) {
        if (!source || !eventTypes.has(source.type)) return null;
        const timestamp = new Date(source.timestamp || "");
        if (Number.isNaN(timestamp.getTime())) return null;
        const entityType = entityTypes.has(source.entityType) ? source.entityType : "page";
        return {
            id: cleanText(source.id, 100) || createId("event"),
            type: source.type,
            timestamp: timestamp.toISOString(),
            sessionId: cleanText(source.sessionId, 100),
            page: normalizePage(source.page),
            entityType,
            entityId: cleanText(source.entityId, 100),
            entityName: cleanText(source.entityName, 140),
            channel: cleanText(source.channel, 40),
            formType: cleanText(source.formType, 100),
            source: cleanText(source.source, 120),
            deviceType: deviceTypes.has(source.deviceType) ? source.deviceType : "unknown",
            trafficSource: trafficSources.has(source.trafficSource) ? source.trafficSource : "unknown",
            trafficMedium: trafficMediums.has(source.trafficMedium) ? source.trafficMedium : "unknown"
        };
    }

    function pruneEvents(events) {
        const oldestAllowed = Date.now() - retentionDays * 86400000;
        return events
            .filter((event) => new Date(event.timestamp).getTime() >= oldestAllowed)
            .sort((first, second) => new Date(first.timestamp) - new Date(second.timestamp))
            .slice(-maxEvents);
    }

    function readState() {
        try {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) return emptyState();
            const parsed = JSON.parse(raw);
            const events = pruneEvents((Array.isArray(parsed.events) ? parsed.events : [])
                .map(sanitizeEvent)
                .filter(Boolean));
            const startedAt = events[0] ? events[0].timestamp : parsed.startedAt;
            return {
                version: 1,
                startedAt: new Date(startedAt || Date.now()).toISOString(),
                updatedAt: new Date(parsed.updatedAt || Date.now()).toISOString(),
                retentionDays,
                events
            };
        } catch (error) {
            lastError = error instanceof Error ? error.message : "Não foi possível ler as métricas locais.";
            return emptyState();
        }
    }

    let state = (adminPage || trackingAllowed()) ? readState() : emptyState();
    let mode = "hybrid";

    function writeState() {
        try {
            state.events = pruneEvents(state.events);
            state.updatedAt = new Date().toISOString();
            if (state.events.length) state.startedAt = state.events[0].timestamp;
            window.localStorage.setItem(storageKey, JSON.stringify(state));
            lastError = "";
            window.dispatchEvent(new CustomEvent("brutusmaq:analytics-updated", {
                detail: { eventCount: state.events.length, updatedAt: state.updatedAt }
            }));
            return true;
        } catch (error) {
            lastError = error instanceof Error ? error.message : "Não foi possível salvar as métricas locais.";
            return false;
        }
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function readOutbox() {
        try {
            const parsed = JSON.parse(window.localStorage.getItem(outboxKey) || "[]");
            return (Array.isArray(parsed) ? parsed : []).map(sanitizeEvent).filter(Boolean).slice(-500);
        } catch (error) {
            return [];
        }
    }

    function writeOutbox(events) {
        try {
            window.localStorage.setItem(outboxKey, JSON.stringify(events.slice(-500)));
        } catch (error) {
            // A cópia principal permanece no histórico local quando a fila estiver indisponível.
        }
    }

    async function flushRemote() {
        if (!trackingAllowed() || flushing || Date.now() < remoteUnavailableUntil || !/^https?:$/.test(window.location.protocol)) return false;
        const batch = readOutbox().slice(0, 50);
        if (!batch.length || typeof window.fetch !== "function") return false;
        flushing = true;
        try {
            const response = await window.fetch("/api/analytics/events", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                    consent: { version: window.BrutusmaqPrivacy.version, analytics: true },
                    events: batch
                })
            });
            if (!response.ok) {
                remoteUnavailableUntil = Date.now() + 60000;
                return false;
            }
            const sentIds = new Set(batch.map((event) => event.id));
            writeOutbox(readOutbox().filter((event) => !sentIds.has(event.id)));
            if (readOutbox().length) window.setTimeout(flushRemote, 100);
            return true;
        } catch (error) {
            remoteUnavailableUntil = Date.now() + 60000;
            return false;
        } finally {
            flushing = false;
        }
    }

    function queueRemote(event) {
        if (!trackingAllowed()) return;
        const outbox = readOutbox();
        if (!outbox.some((item) => item.id === event.id)) outbox.push(event);
        writeOutbox(outbox);
        window.clearTimeout(flushTimer);
        flushTimer = window.setTimeout(flushRemote, 500);
    }

    function getPageContext() {
        const page = normalizePage(window.location.pathname);
        const fileName = page.split("/").pop() || "index.html";
        const params = new URLSearchParams(window.location.search);
        const titleFromDocument = cleanText(document.title.split("|")[0], 140);
        let entityType = "page";
        let entityId = normalizeSlug(fileName.replace(/\.html$/i, "")) || "inicio";
        let entityName = titleFromDocument || "Página do site";

        if (fileName === "produto.html") {
            entityType = "product";
            entityId = normalizeSlug(params.get("produto"));
            entityName = cleanText(document.getElementById("produtoTitulo")?.textContent, 140) || entityId;
        } else if (fileName === "maquina-usada.html") {
            entityType = "used_product";
            entityId = normalizeSlug(params.get("id"));
            entityName = cleanText(document.getElementById("produtoTitulo")?.textContent, 140) || entityId;
        } else if (fileName === "artigo-blog.html") {
            entityType = "article";
            entityId = normalizeSlug(params.get("artigo"));
            entityName = cleanText(document.getElementById("article-title")?.textContent, 140) || entityId;
        } else if (fileName === "contato.html") {
            const productName = cleanText(document.getElementById("contactProductInput")?.value, 140);
            const productParam = params.get("produto") || params.get("modelo") || productName;
            if (productParam) {
                entityType = params.get("tipo") === "equipamento-usado" ? "used_product" : "product";
                entityId = normalizeSlug(params.get("produto") || productName || params.get("modelo"));
                entityName = productName || cleanText(params.get("modelo") || params.get("produto"), 140);
            }
        }

        return { page, entityType, entityId, entityName };
    }

    function mergeContext(details) {
        const pageContext = getPageContext();
        const acquisition = getAcquisitionContext();
        const supplied = details || {};
        const entityType = entityTypes.has(supplied.entityType) ? supplied.entityType : pageContext.entityType;
        return {
            page: normalizePage(supplied.page || pageContext.page),
            entityType,
            entityId: cleanText(supplied.entityId || pageContext.entityId, 100),
            entityName: cleanText(supplied.entityName || pageContext.entityName, 140),
            channel: cleanText(supplied.channel, 40),
            formType: cleanText(supplied.formType, 100),
            source: cleanText(supplied.source || pageContext.page, 120),
            deviceType: deviceTypes.has(supplied.deviceType) ? supplied.deviceType : detectDeviceType(),
            trafficSource: trafficSources.has(supplied.trafficSource) ? supplied.trafficSource : acquisition.trafficSource,
            trafficMedium: trafficMediums.has(supplied.trafficMedium) ? supplied.trafficMedium : acquisition.trafficMedium
        };
    }

    function track(type, details) {
        if (!trackingAllowed() || !eventTypes.has(type)) return null;
        const context = mergeContext(details);
        const event = sanitizeEvent({
            id: createId("event"),
            type,
            timestamp: new Date().toISOString(),
            sessionId: getSessionId(),
            ...context
        });
        if (!event) return null;
        state = readState();
        state.events.push(event);
        writeState();
        queueRemote(event);
        return clone(event);
    }

    function isWhatsappLink(link) {
        if (!link) return false;
        const href = link.getAttribute("href") || "";
        return /(?:wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)/i.test(href)
            || link.hasAttribute("data-whatsapp-produto-usado")
            || link.hasAttribute("data-whatsapp-produto");
    }

    function isProposalLink(link) {
        if (!link) return false;
        if (link.hasAttribute("data-produto-proposta") || link.hasAttribute("data-open-proposal-modal")) return true;
        const href = link.getAttribute("href") || "";
        if (!/contato\.html/i.test(href)) return false;
        const normalized = cleanText(link.textContent, 100).toLowerCase();
        return /(?:tipo=(?:proposta-tecnica|equipamento-usado)|#proposta-tecnica)/i.test(href)
            || normalized.includes("proposta")
            || normalized.includes("cotação");
    }

    function setupClickTracking() {
        document.addEventListener("click", (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) return;
            const control = target.closest("a, button");
            if (!control) return;

            const shareChannels = {
                "share-whatsapp": "whatsapp",
                "share-linkedin": "linkedin",
                "share-email": "email",
                "copy-link": "copy"
            };
            const shareChannel = shareChannels[control.id];
            if (shareChannel) {
                track("article_share", { channel: shareChannel });
                return;
            }

            if (control instanceof HTMLAnchorElement && isWhatsappLink(control)) {
                track("whatsapp_click", { channel: "whatsapp" });
            }

            if (isProposalLink(control)) {
                track("proposal_intent", { channel: "form" });
            }
        }, true);

        document.addEventListener("submit", (event) => {
            const form = event.target instanceof HTMLFormElement ? event.target : null;
            if (!form || form.id !== "formSolicitacaoVideo") return;
            track("whatsapp_click", { channel: "whatsapp" });
        }, true);
    }

    function trackPageView() {
        if (!trackingAllowed() || pageViewTracked) return;
        const fileName = normalizePage(window.location.pathname).split("/").pop();
        if (fileName === "painel-admin.html") return;
        pageViewTracked = true;
        window.requestAnimationFrame(() => track("page_view", { channel: "site" }));
    }

    function clear() {
        state = emptyState();
        if (mode !== "database") {
            try {
                window.localStorage.removeItem(storageKey);
            } catch (error) {
                lastError = error instanceof Error ? error.message : "Não foi possível limpar as métricas locais.";
            }
        }
        window.dispatchEvent(new CustomEvent("brutusmaq:analytics-updated", {
            detail: { eventCount: 0, updatedAt: state.updatedAt }
        }));
    }

    function clearPrivateTrackingData() {
        state = emptyState();
        pageViewTracked = false;
        try {
            window.localStorage.removeItem(storageKey);
            window.localStorage.removeItem(outboxKey);
            window.sessionStorage.removeItem(sessionKey);
            window.sessionStorage.removeItem(acquisitionKey);
        } catch (error) {
            lastError = error instanceof Error ? error.message : "Não foi possível limpar as métricas locais.";
        }
        window.dispatchEvent(new CustomEvent("brutusmaq:analytics-updated", {
            detail: { eventCount: 0, updatedAt: state.updatedAt, consent: false }
        }));
    }

    function getEvents(options) {
        const settings = options || {};
        const from = settings.from ? new Date(settings.from).getTime() : -Infinity;
        const to = settings.to ? new Date(settings.to).getTime() : Infinity;
        return clone(state.events.filter((event) => {
            const time = new Date(event.timestamp).getTime();
            return time >= from && time < to;
        }));
    }

    function setRemoteState(input) {
        const source = input && typeof input === "object" ? input : {};
        const events = pruneEvents((Array.isArray(source.events) ? source.events : [])
            .map(sanitizeEvent)
            .filter(Boolean));
        state = {
            version: 1,
            startedAt: events[0]?.timestamp || new Date().toISOString(),
            updatedAt: events[events.length - 1]?.timestamp || new Date().toISOString(),
            retentionDays,
            events
        };
        mode = "database";
        window.dispatchEvent(new CustomEvent("brutusmaq:analytics-updated", {
            detail: { eventCount: events.length, updatedAt: state.updatedAt, mode }
        }));
        return clone(state);
    }

    window.BrutusmaqAnalytics = Object.freeze({
        track,
        getEvents,
        getState: () => clone(state),
        getPageContext,
        setRemoteState,
        clear,
        exportData: () => clone(state),
        getLastError: () => lastError,
        isTrackingAllowed: trackingAllowed,
        flush: flushRemote,
        storageKey,
        outboxKey,
        acquisitionKey,
        retentionDays,
        maxEvents,
        get mode() { return mode; }
    });

    window.addEventListener("storage", (event) => {
        if (event.key !== storageKey || !trackingAllowed()) return;
        state = readState();
        window.dispatchEvent(new CustomEvent("brutusmaq:analytics-updated", {
            detail: { eventCount: state.events.length, updatedAt: state.updatedAt }
        }));
    });

    setupClickTracking();
    window.addEventListener("online", flushRemote);
    window.addEventListener("brutusmaq:privacy-change", (event) => {
        if (event.detail?.analytics) {
            state = readState();
            trackPageView();
            window.setTimeout(flushRemote, 100);
        } else {
            clearPrivateTrackingData();
        }
    });
    window.addEventListener("pagehide", () => {
        if (!trackingAllowed()) return;
        const batch = readOutbox().slice(0, 50);
        if (!batch.length || typeof navigator.sendBeacon !== "function") return;
        navigator.sendBeacon(
            "/api/analytics/events",
            new Blob([JSON.stringify({
                consent: { version: window.BrutusmaqPrivacy.version, analytics: true },
                events: batch
            })], { type: "application/json" })
        );
    });
    if (trackingAllowed()) window.setTimeout(flushRemote, 800);
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", trackPageView, { once: true });
    } else {
        trackPageView();
    }
}());
