"use strict";

const crypto = require("node:crypto");
const path = require("node:path");
const express = require("express");
const bcrypt = require("bcryptjs");
const compression = require("compression");
const helmet = require("helmet");
const multer = require("multer");
const { rateLimit } = require("express-rate-limit");
const logger = require("./logger");
const { AppError, asyncRoute, apiNotFound, errorHandler } = require("./errors");
const { createMfaService } = require("./mfa-service");
const { buildSitemap, buildRobots } = require("./sitemap");
const {
    randomToken,
    sha256,
    hmac,
    sessionCookie,
    clearSessionCookie,
    allowedOriginMiddleware,
    createAuthMiddleware
} = require("./security");
const { schemas, parse } = require("./validation");
const { allowedMimeTypes } = require("./media-service");

function noStore(req, res, next) {
    res.set("Cache-Control", "no-store");
    next();
}

function publicCache(res) {
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
}

function publicProductData(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return data;
    const { _admin, ...publicData } = data;
    return publicData;
}

function groupedCatalog(items, options = {}) {
    const mapData = options.publicOnly ? (item) => publicProductData(item.data) : (item) => item.data;
    return {
        novos: items.filter((item) => item.type === "new").map(mapData),
        usados: items.filter((item) => item.type === "used").map(mapData)
    };
}

function normalizedCatalogInput(body) {
    const source = body?.catalog || body;
    if (!source || !Array.isArray(source.novos) || !Array.isArray(source.usados)) {
        throw new AppError(422, "invalid_catalog", "O backup do catálogo possui formato inválido.");
    }
    if (!source.novos.length && !source.usados.length) {
        throw new AppError(422, "empty_catalog", "O catálogo não pode ficar vazio.");
    }
    if (source.novos.length + source.usados.length > 1000) {
        throw new AppError(422, "catalog_limit", "O catálogo ultrapassa o limite de 1.000 produtos.");
    }
    const ids = new Set();
    const parseProduct = (product, type) => {
        const parsed = parse(schemas.product, { type, product }).product;
        if (ids.has(parsed.id)) throw new AppError(409, "duplicate_slug", `O identificador ${parsed.id} está duplicado.`);
        ids.add(parsed.id);
        return parsed;
    };
    return {
        novos: source.novos.map((product) => parseProduct(product, "new")),
        usados: source.usados.map((product) => parseProduct(product, "used"))
    };
}

function normalizedArticlesInput(body) {
    const source = body?.articles || body;
    if (!Array.isArray(source)) throw new AppError(422, "invalid_articles", "O backup de artigos possui formato inválido.");
    if (source.length > 2000) throw new AppError(422, "articles_limit", "O backup ultrapassa o limite de 2.000 artigos.");
    const slugs = new Set();
    return source.map((article) => {
        const parsed = parse(schemas.article, article);
        if (slugs.has(parsed.slug)) throw new AppError(409, "duplicate_slug", `O slug ${parsed.slug} está duplicado.`);
        slugs.add(parsed.slug);
        return parsed;
    });
}

function safeQueryText(value, maximum) {
    return String(value || "").replace(/[%_<>]/g, "").trim().slice(0, maximum || 100);
}

function cleanLeadPayload(lead) {
    const payload = {};
    Object.entries(lead).forEach(([key, value]) => {
        if (key.startsWith("_") || typeof value !== "string") return;
        payload[key.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 80)] = value.replace(/[<>]/g, "").trim().slice(0, 1200);
    });
    return payload;
}

function publicAdmin(admin) {
    return {
        id: admin.publicId || admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        mfaEnabled: Boolean(admin.mfaEnabled)
    };
}

function proposedContent(review) {
    const payload = JSON.parse(JSON.stringify(review.payload || {}));
    const status = review.status === "pending" ? "review" : "draft";
    payload._admin = {
        ...(payload._admin || {}),
        uid: review.entityUid || `submission:${review.id}`,
        status,
        version: review.baseVersion == null ? 0 : review.baseVersion,
        submissionId: review.id,
        submissionStatus: review.status,
        reviewNote: review.note || "",
        updatedAt: review.updatedAt
    };
    return payload;
}

function overlayEditorialSubmissions(products, articles, reviews) {
    const productItems = products.map((item) => ({ ...item, data: { ...item.data } }));
    const articleItems = articles.map((article) => ({ ...article }));
    for (const review of [...reviews].reverse()) {
        const payload = proposedContent(review);
        if (review.entityType === "product") {
            const targetIndex = review.entityUid
                ? productItems.findIndex((item) => item.data?._admin?.uid === review.entityUid)
                : -1;
            const keyIndex = productItems.findIndex((item) => item.data?.id === payload.id);
            const index = targetIndex >= 0 ? targetIndex : keyIndex;
            const item = { type: review.productType || productItems[index]?.type || "new", data: payload };
            if (index >= 0) productItems[index] = item;
            else productItems.unshift(item);
            if (targetIndex >= 0 && keyIndex >= 0 && targetIndex !== keyIndex) productItems.splice(keyIndex, 1);
        } else {
            const targetIndex = review.entityUid
                ? articleItems.findIndex((article) => article._admin?.uid === review.entityUid)
                : -1;
            const keyIndex = articleItems.findIndex((article) => article.slug === payload.slug);
            const index = targetIndex >= 0 ? targetIndex : keyIndex;
            if (index >= 0) articleItems[index] = payload;
            else articleItems.unshift(payload);
            if (targetIndex >= 0 && keyIndex >= 0 && targetIndex !== keyIndex) articleItems.splice(keyIndex, 1);
        }
    }
    return { products: productItems, articles: articleItems };
}

function requestSecurityContext(req, config) {
    const ip = String(req.ip || req.socket?.remoteAddress || "unknown");
    const userAgent = String(req.get("user-agent") || "Dispositivo não identificado").replace(/[\r\n]/g, " ").slice(0, 240);
    return {
        ipHash: sha256(`${config.analyticsSecret}:${ip}`),
        userAgent,
        userAgentHash: sha256(`${config.analyticsSecret}:${userAgent}`)
    };
}

function createApp(options) {
    const { config, repository, mailer, mediaService } = options;
    const mfaService = options.mfaService || createMfaService(config);
    const app = express();
    app.set("env", config.env);
    app.set("trust proxy", config.trustProxy);
    app.disable("x-powered-by");

    const cspDirectives = {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'"],
        styleSrcAttr: ["'none'"],
        fontSrc: ["'self'", "data:"],
        imgSrc: ["'self'", "data:", "https:"],
        mediaSrc: ["'self'", "https:"],
        frameSrc: ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com", "https://www.google.com"],
        connectSrc: ["'self'"],
        formAction: ["'self'"]
    };
    if (config.production) cspDirectives.upgradeInsecureRequests = [];

    app.use(logger.requestIdMiddleware);
    app.use(logger.httpRequestMiddleware);
    app.use(helmet({
        crossOriginEmbedderPolicy: false,
        contentSecurityPolicy: {
            directives: cspDirectives
        },
        referrerPolicy: { policy: "strict-origin-when-cross-origin" },
        strictTransportSecurity: config.production ? { maxAge: 31536000, includeSubDomains: true } : false
    }));
    app.use(compression());
    app.use(express.json({ limit: "6mb", strict: true }));
    app.use(express.urlencoded({ extended: false, limit: "256kb" }));
    app.use(allowedOriginMiddleware(config));

    const auth = createAuthMiddleware(repository, config);
    app.use(auth.optionalAuth);

    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 8,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: { code: "login_rate_limit", message: "Muitas tentativas. Aguarde alguns minutos." } }
    });
    const mfaLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 12,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: { code: "mfa_rate_limit", message: "Muitas tentativas de verificação. Aguarde alguns minutos." } }
    });
    const passwordResetLimiter = rateLimit({
        windowMs: 60 * 60 * 1000,
        limit: 4,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: { code: "password_reset_rate_limit", message: "Aguarde antes de solicitar uma nova redefinição." } }
    });
    const invitationLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 8,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: { code: "invitation_rate_limit", message: "Muitas tentativas de ativação. Aguarde alguns minutos." } }
    });
    const accessRequestLimiter = rateLimit({
        windowMs: 60 * 60 * 1000,
        limit: 5,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: { code: "access_request_rate_limit", message: "Aguarde antes de enviar uma nova solicitação de acesso." } }
    });
    const leadLimiter = rateLimit({
        windowMs: 60 * 60 * 1000,
        limit: 12,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: { code: "lead_rate_limit", message: "Limite de solicitações atingido. Use o WhatsApp para atendimento imediato." } }
    });
    const analyticsLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: 300,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: { code: "analytics_rate_limit", message: "Limite temporário de eventos atingido." } }
    });
    const editorialMutationLimiter = rateLimit({
        windowMs: 10 * 60 * 1000,
        limit: 100,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: { code: "editorial_rate_limit", message: "Muitas alterações em pouco tempo. Aguarde alguns minutos." } }
    });
    const mediaUploadLimiter = rateLimit({
        windowMs: 60 * 60 * 1000,
        limit: 40,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: { code: "media_rate_limit", message: "Limite temporário de imagens atingido. Tente novamente mais tarde." } }
    });

    async function recordSecurity(req, event) {
        if (typeof repository.recordSecurityEvent !== "function") return;
        const context = requestSecurityContext(req, config);
        try {
            await repository.recordSecurityEvent({
                ...event,
                requestId: req.id,
                subjectHash: event.subject ? sha256(`${config.analyticsSecret}:${String(event.subject).toLowerCase()}`) : null,
                ipHash: context.ipHash,
                userAgentHash: context.userAgentHash
            });
        } catch (error) {
            logger.warn("security_event_write_failed", { requestId: req.id, type: event.type });
        }
    }

    async function issueSession(admin, remember, req, res) {
        const token = randomToken(32);
        const maxAgeSeconds = remember ? 7 * 86400 : config.sessionHours * 3600;
        const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);
        const context = requestSecurityContext(req, config);
        await repository.createSession(admin.id || admin.adminId, sha256(token), expiresAt, context);
        res.appendHeader("Set-Cookie", sessionCookie(config, token, maxAgeSeconds));
        return {
            authenticated: true,
            user: publicAdmin({
                publicId: admin.publicId,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                mfaEnabled: admin.mfaEnabled
            }),
            csrfToken: hmac(token, config.sessionSecret)
        };
    }

    async function verifySecondFactor(admin, code) {
        if (mfaService.isRecoveryCode(code)) {
            const codeHash = mfaService.hashRecoveryCode(code);
            if (!admin.recoveryCodeHashes?.includes(codeHash)) return { valid: false, recovery: false };
            return { valid: await repository.consumeRecoveryCode(admin.id || admin.adminId, codeHash), recovery: true };
        }
        return {
            valid: await mfaService.verifyCode(admin.mfaSecretEncrypted, code),
            recovery: false
        };
    }

    async function createStaffInvitation(input, ownerId, existingPublicId) {
        const token = randomToken(32);
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
        const invitationInput = {
            ...input,
            tokenHash: sha256(token),
            expiresAt,
            passwordHash: await bcrypt.hash(randomToken(32), 12)
        };
        const result = existingPublicId
            ? await repository.resendInvitation(existingPublicId, invitationInput, ownerId)
            : await repository.createInvitation(invitationInput, ownerId);
        const setupUrl = `${config.baseUrl}/painel-admin.html#invite=${encodeURIComponent(token)}`;
        let delivered = false;
        if (mailer.enabled && typeof mailer.sendInvitation === "function") {
            try {
                delivered = Boolean((await mailer.sendInvitation(result.member, setupUrl, expiresAt)).delivered);
            } catch (error) {
                logger.error("staff_invitation_email_failed", { adminId: ownerId, memberId: result.member.id });
            }
        }
        return {
            member: result.member,
            invitation: { ...result.invitation, delivered },
            ...(delivered ? {} : { setupUrl })
        };
    }

    app.get("/api/health", noStore, asyncRoute(async (req, res) => {
        let database = false;
        const databaseStartedAt = process.hrtime.bigint();
        try {
            database = Boolean(await repository.ping());
        } catch (error) {
            database = false;
        }
        const databaseLatencyMs = Number(process.hrtime.bigint() - databaseStartedAt) / 1e6;
        res.status(database ? 200 : 503).json({
            service: "brutusmaq",
            status: database ? "ok" : "degraded",
            database,
            checks: {
                database: {
                    ok: database,
                    latencyMs: Math.round(databaseLatencyMs * 10) / 10
                }
            },
            uptimeSeconds: Math.floor(process.uptime()),
            timestamp: new Date().toISOString()
        });
    }));

    app.get("/robots.txt", (req, res) => {
        res.type("text/plain").set("Cache-Control", "public, max-age=86400").send(buildRobots(config));
    });

    app.get("/sitemap.xml", asyncRoute(async (req, res) => {
        const sitemap = await buildSitemap(repository, config);
        res.type("application/xml").set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400").send(sitemap);
    }));

    app.post("/api/auth/login", noStore, loginLimiter, asyncRoute(async (req, res) => {
        const credentials = parse(schemas.login, req.body);
        const admin = await repository.findAdminByEmail(credentials.email);
        const fallbackHash = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.4NqEw3pYtOQY6G8V3i0RZPl8qgQYw4K";
        const valid = await bcrypt.compare(credentials.password, admin?.passwordHash || fallbackHash);
        if (!valid || !admin?.active) {
            await recordSecurity(req, {
                type: "admin_login",
                outcome: "failure",
                adminId: admin?.id,
                subject: credentials.email
            });
            throw new AppError(401, "invalid_credentials", "E-mail ou senha inválidos.");
        }
        if (admin.mfaEnabled) {
            const challengeToken = randomToken(32);
            await repository.createMfaChallenge(
                admin.id,
                sha256(challengeToken),
                credentials.remember,
                new Date(Date.now() + 5 * 60 * 1000)
            );
            await recordSecurity(req, {
                type: "admin_login_password",
                outcome: "success",
                adminId: admin.id,
                subject: credentials.email
            });
            res.status(202).json({ mfaRequired: true, challengeToken, expiresIn: 300 });
            return;
        }
        const payload = await issueSession(admin, credentials.remember, req, res);
        await recordSecurity(req, {
            type: "admin_login",
            outcome: "success",
            adminId: admin.id,
            subject: credentials.email,
            details: { mfa: false }
        });
        res.json(payload);
    }));

    app.post("/api/auth/mfa", noStore, mfaLimiter, asyncRoute(async (req, res) => {
        const input = parse(schemas.mfaChallenge, req.body);
        const tokenHash = sha256(input.challengeToken);
        const challenge = await repository.findMfaChallenge(tokenHash);
        if (!challenge || !challenge.active || !challenge.mfaEnabled || challenge.attempts >= 5) {
            await recordSecurity(req, { type: "admin_mfa_login", outcome: "blocked" });
            throw new AppError(401, "mfa_challenge_invalid", "A verificação expirou. Entre novamente.");
        }
        const verification = await verifySecondFactor(challenge, input.code);
        if (!verification.valid) {
            await repository.failMfaChallenge(tokenHash);
            await recordSecurity(req, {
                type: "admin_mfa_login",
                outcome: "failure",
                adminId: challenge.adminId,
                subject: challenge.email
            });
            throw new AppError(401, "mfa_code_invalid", "Código inválido ou expirado.");
        }
        await repository.consumeMfaChallenge(tokenHash);
        const payload = await issueSession(challenge, challenge.remember, req, res);
        await recordSecurity(req, {
            type: "admin_login",
            outcome: "success",
            adminId: challenge.adminId,
            subject: challenge.email,
            details: { mfa: true, recovery: verification.recovery }
        });
        res.json(payload);
    }));

    app.post("/api/auth/password/forgot", noStore, passwordResetLimiter, asyncRoute(async (req, res) => {
        const input = parse(schemas.forgotPassword, req.body);
        const admin = await repository.findAdminByEmail(input.email);
        if (admin?.active && mailer.enabled && typeof mailer.sendPasswordReset === "function") {
            const token = randomToken(32);
            await repository.createPasswordReset(admin.id, sha256(token), new Date(Date.now() + 30 * 60 * 1000));
            const resetUrl = `${config.baseUrl}/painel-admin.html#reset=${encodeURIComponent(token)}`;
            try {
                await mailer.sendPasswordReset(admin, resetUrl);
                await recordSecurity(req, {
                    type: "password_reset_request",
                    outcome: "success",
                    adminId: admin.id,
                    subject: input.email
                });
            } catch (error) {
                logger.error("password_reset_email_failed", { requestId: req.id, adminId: admin.id });
                await recordSecurity(req, {
                    type: "password_reset_request",
                    outcome: "failure",
                    adminId: admin.id,
                    subject: input.email
                });
            }
        } else {
            await recordSecurity(req, {
                type: "password_reset_request",
                outcome: "info",
                adminId: admin?.id,
                subject: input.email
            });
        }
        res.status(202).json({ accepted: true, message: "Se a conta existir, enviaremos as instruções de redefinição." });
    }));

    app.post("/api/auth/password/reset", noStore, passwordResetLimiter, asyncRoute(async (req, res) => {
        const input = parse(schemas.resetPassword, req.body);
        const reset = await repository.findPasswordReset(sha256(input.token));
        if (!reset?.active) {
            await recordSecurity(req, { type: "password_reset", outcome: "failure" });
            throw new AppError(400, "password_reset_invalid", "O link de redefinição é inválido ou expirou.");
        }
        await repository.updatePassword(reset.adminId, await bcrypt.hash(input.newPassword, 12));
        await recordSecurity(req, {
            type: "password_reset",
            outcome: "success",
            adminId: reset.adminId,
            subject: reset.email
        });
        res.json({ reset: true, message: "Senha alterada. Entre novamente com a nova senha." });
    }));

    app.post("/api/auth/access-requests", noStore, accessRequestLimiter, asyncRoute(async (req, res) => {
        const input = parse(schemas.accessRequest, req.body);
        const result = await repository.createAccessRequest(input);
        if (result.stored && mailer.enabled && typeof mailer.sendAccessRequest === "function") {
            try {
                await mailer.sendAccessRequest(result.request);
            } catch (error) {
                logger.error("access_request_email_failed", { requestId: req.id, accessRequestId: result.request?.id });
            }
        }
        await recordSecurity(req, {
            type: "admin_access_request",
            outcome: "success",
            subject: input.email,
            details: { requestedRole: input.requestedRole, stored: Boolean(result.stored) }
        });
        res.status(202).json({
            accepted: true,
            message: "Solicitação enviada. O administrador analisará o pedido antes de liberar o acesso."
        });
    }));

    app.post("/api/auth/invitations/accept", noStore, invitationLimiter, asyncRoute(async (req, res) => {
        const input = parse(schemas.invitationAccept, req.body);
        const invitation = await repository.findInvitation(sha256(input.token));
        if (!invitation?.valid) {
            await recordSecurity(req, { type: "staff_invitation_accept", outcome: "failure" });
            throw new AppError(400, "invitation_invalid", "O convite é inválido, expirou ou já foi utilizado.");
        }
        const member = await repository.acceptInvitation(
            sha256(input.token),
            await bcrypt.hash(input.password, 12)
        );
        await recordSecurity(req, {
            type: "staff_invitation_accept",
            outcome: "success",
            adminId: invitation.adminId,
            subject: invitation.email
        });
        res.json({ accepted: true, member: publicAdmin(member), message: "Conta ativada. Entre com seu e-mail e a senha criada." });
    }));

    app.get("/api/auth/session", noStore, (req, res) => {
        if (!req.auth) {
            res.status(401).json({ authenticated: false });
            return;
        }
        res.json({
            authenticated: true,
            user: publicAdmin(req.auth.admin),
            csrfToken: req.auth.csrfToken,
            mfaSetupRequired: config.requireAdminMfa && !req.auth.admin.mfaEnabled
        });
    });

    app.post("/api/auth/logout", noStore, auth.requireAuth, auth.requireCsrf, asyncRoute(async (req, res) => {
        await repository.deleteSession(req.auth.tokenHash);
        await recordSecurity(req, {
            type: "admin_logout",
            outcome: "success",
            adminId: req.auth.admin.id,
            subject: req.auth.admin.email
        });
        res.appendHeader("Set-Cookie", clearSessionCookie(config));
        res.status(204).end();
    }));

    app.get("/api/products", asyncRoute(async (req, res) => {
        publicCache(res);
        const items = await repository.listProducts({ publicOnly: true });
        res.json({ catalog: groupedCatalog(items, { publicOnly: true }), mode: "database", updatedAt: new Date().toISOString() });
    }));

    app.get("/api/products/:slug", asyncRoute(async (req, res) => {
        const slug = String(req.params.slug || "").slice(0, 180);
        const item = await repository.getPublicProduct(slug);
        if (!item) throw new AppError(404, "product_not_found", "Equipamento não encontrado.");
        publicCache(res);
        res.json({ type: item.type, product: publicProductData(item.data) });
    }));

    app.get("/api/articles", asyncRoute(async (req, res) => {
        publicCache(res);
        const articles = await repository.listArticles({ publicOnly: true });
        res.json({ articles, mode: "database", updatedAt: new Date().toISOString() });
    }));

    app.get("/api/articles/:slug", asyncRoute(async (req, res) => {
        const article = await repository.getPublicArticle(String(req.params.slug || "").slice(0, 180));
        if (!article) throw new AppError(404, "article_not_found", "Artigo não encontrado.");
        publicCache(res);
        res.json({ article });
    }));

    app.post("/api/leads", noStore, leadLimiter, asyncRoute(async (req, res) => {
        const input = parse(schemas.lead, req.body);
        if (input._honey) {
            res.status(202).json({ accepted: true });
            return;
        }
        const phone = input.telefone.replace(/\D/g, "");
        const lead = {
            reason: input.motivo,
            name: input.nome,
            phone,
            email: input.email,
            company: input.empresa,
            cityState: input.cidade_estado,
            interest: input.interesse,
            productSlug: input.produto_slug,
            productName: input.equipamento_solicitado,
            message: input.mensagem,
            source: input.origem_da_solicitacao || "contato.html",
            payload: cleanLeadPayload(input),
            privacyVersion: "2026-07-17"
        };
        const created = await repository.createLead(lead);
        let emailDelivered = false;
        try {
            emailDelivered = Boolean((await mailer.sendLead(lead, created.publicId)).delivered);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Não foi possível notificar uma nova solicitação ${created.publicId}.`);
        }
        res.status(201).json({ accepted: true, requestId: created.publicId, emailDelivered });
    }));

    app.post("/api/analytics/events", noStore, analyticsLimiter, asyncRoute(async (req, res) => {
        const batch = parse(schemas.analyticsBatch, req.body);
        const now = Date.now();
        const earliest = now - 7 * 86400000;
        const events = batch.events
            .filter((event) => {
                const time = new Date(event.timestamp).getTime();
                return Number.isFinite(time) && time >= earliest && time <= now + 5 * 60000;
            })
            .map((event) => ({
                ...event,
                occurredAt: new Date(event.timestamp),
                sessionHash: crypto.createHmac("sha256", config.analyticsSecret).update(event.sessionId).digest("hex")
            }));
        await repository.insertAnalytics(events);
        res.status(202).json({ accepted: events.map((event) => event.id) });
    }));

    const adminRouter = express.Router();
    adminRouter.use(noStore, auth.requireAuth);

    adminRouter.get("/bootstrap", asyncRoute(async (req, res) => {
        const mfaSetupRequired = config.requireAdminMfa && !req.auth.admin.mfaEnabled;
        if (mfaSetupRequired) {
            res.json({
                user: publicAdmin(req.auth.admin),
                mode: "database",
                mfaSetupRequired: true
            });
            return;
        }
        const isEditor = req.auth.admin.role === "editor";
        const isOwner = req.auth.admin.role === "owner";
        const [products, articles, submissions] = await Promise.all([
            repository.listProducts({ publicOnly: false }),
            repository.listArticles({ publicOnly: false }),
            typeof repository.listContentSubmissions === "function" && (isEditor || isOwner)
                ? repository.listContentSubmissions({
                    status: isEditor ? ["draft", "pending", "rejected"] : "pending",
                    ...(isEditor ? { submittedBy: req.auth.admin.id } : {}),
                    limit: 500
                })
                : []
        ]);
        const content = isEditor
            ? overlayEditorialSubmissions(products, articles, submissions)
            : { products, articles };
        res.json({
            catalog: groupedCatalog(content.products),
            articles: content.articles,
            user: publicAdmin(req.auth.admin),
            mode: "database",
            mfaSetupRequired: false,
            pendingReviewCount: isOwner ? submissions.length : undefined
        });
    }));

    adminRouter.get("/security", asyncRoute(async (req, res) => {
        const [admin, sessions, events] = await Promise.all([
            repository.getAdminSecurity(req.auth.admin.id),
            repository.listSessions(req.auth.admin.id, req.auth.tokenHash),
            repository.listSecurityEvents(req.auth.admin.id, 30)
        ]);
        if (!admin) throw new AppError(404, "admin_not_found", "Conta administrativa não encontrada.");
        res.json({
            security: {
                mfaEnabled: admin.mfaEnabled,
                mfaRequired: config.requireAdminMfa,
                recoveryCodesRemaining: admin.recoveryCodeHashes.length,
                passwordChangedAt: admin.passwordChangedAt,
                lastLoginAt: admin.lastLoginAt
            },
            sessions,
            events
        });
    }));

    adminRouter.post("/security/password", auth.requireCsrf, asyncRoute(async (req, res) => {
        const input = parse(schemas.passwordChange, req.body);
        const admin = await repository.getAdminSecurity(req.auth.admin.id);
        const currentPasswordValid = await bcrypt.compare(input.currentPassword, admin?.passwordHash || "");
        if (!admin || !currentPasswordValid) {
            await recordSecurity(req, {
                type: "password_change",
                outcome: "failure",
                adminId: req.auth.admin.id,
                subject: req.auth.admin.email
            });
            throw new AppError(401, "current_password_invalid", "A senha atual não confere.");
        }
        if (input.currentPassword === input.newPassword) {
            throw new AppError(422, "password_unchanged", "A nova senha precisa ser diferente da senha atual.");
        }
        if (admin.mfaEnabled) {
            const verification = await verifySecondFactor(admin, input.code);
            if (!verification.valid) throw new AppError(401, "mfa_code_invalid", "Confirme a alteração com um código válido.");
        }
        await repository.updatePassword(admin.id, await bcrypt.hash(input.newPassword, 12));
        await recordSecurity(req, {
            type: "password_change",
            outcome: "success",
            adminId: admin.id,
            subject: admin.email
        });
        res.appendHeader("Set-Cookie", clearSessionCookie(config));
        res.json({ changed: true, reauthenticate: true });
    }));

    adminRouter.post("/security/mfa/setup", auth.requireCsrf, asyncRoute(async (req, res) => {
        const input = parse(schemas.mfaSetup, req.body);
        const admin = await repository.getAdminSecurity(req.auth.admin.id);
        if (!admin || !await bcrypt.compare(input.password, admin.passwordHash)) {
            throw new AppError(401, "current_password_invalid", "A senha atual não confere.");
        }
        if (admin.mfaEnabled) throw new AppError(409, "mfa_already_enabled", "A autenticação em dois fatores já está ativa.");
        const setup = await mfaService.createSetup(admin.email);
        await repository.storePendingMfaSecret(admin.id, setup.encryptedSecret);
        await recordSecurity(req, {
            type: "mfa_setup",
            outcome: "info",
            adminId: admin.id,
            subject: admin.email
        });
        res.json({ qrCode: setup.qrCode, secret: setup.secret, uri: setup.uri });
    }));

    adminRouter.post("/security/mfa/enable", auth.requireCsrf, asyncRoute(async (req, res) => {
        const input = parse(schemas.mfaCode, req.body);
        const admin = await repository.getAdminSecurity(req.auth.admin.id);
        if (!admin?.mfaSecretEncrypted) throw new AppError(409, "mfa_setup_required", "Inicie a configuração do autenticador primeiro.");
        if (admin.mfaEnabled) throw new AppError(409, "mfa_already_enabled", "A autenticação em dois fatores já está ativa.");
        if (!await mfaService.verifyCode(admin.mfaSecretEncrypted, input.code)) {
            await recordSecurity(req, { type: "mfa_enable", outcome: "failure", adminId: admin.id, subject: admin.email });
            throw new AppError(401, "mfa_code_invalid", "O código não confere. Verifique o horário do dispositivo.");
        }
        const recovery = mfaService.createRecoveryCodes();
        await repository.enableMfa(admin.id, recovery.hashes);
        await repository.deleteOtherSessions(admin.id, req.auth.tokenHash);
        await recordSecurity(req, { type: "mfa_enable", outcome: "success", adminId: admin.id, subject: admin.email });
        res.json({ enabled: true, recoveryCodes: recovery.codes });
    }));

    adminRouter.post("/security/mfa/disable", auth.requireCsrf, asyncRoute(async (req, res) => {
        const input = parse(schemas.mfaDisable, req.body);
        const admin = await repository.getAdminSecurity(req.auth.admin.id);
        if (!admin?.mfaEnabled) throw new AppError(409, "mfa_not_enabled", "A autenticação em dois fatores não está ativa.");
        const passwordValid = await bcrypt.compare(input.password, admin.passwordHash);
        const verification = passwordValid ? await verifySecondFactor(admin, input.code) : { valid: false };
        if (!passwordValid || !verification.valid) {
            await recordSecurity(req, { type: "mfa_disable", outcome: "failure", adminId: admin.id, subject: admin.email });
            throw new AppError(401, "mfa_disable_invalid", "Senha ou código de verificação inválido.");
        }
        await repository.disableMfa(admin.id);
        await repository.deleteOtherSessions(admin.id, req.auth.tokenHash);
        await recordSecurity(req, { type: "mfa_disable", outcome: "success", adminId: admin.id, subject: admin.email });
        res.json({ disabled: true });
    }));

    adminRouter.post("/security/sessions/revoke-others", auth.requireCsrf, asyncRoute(async (req, res) => {
        const revoked = await repository.deleteOtherSessions(req.auth.admin.id, req.auth.tokenHash);
        await recordSecurity(req, {
            type: "sessions_revoke_others",
            outcome: "success",
            adminId: req.auth.admin.id,
            subject: req.auth.admin.email,
            details: { revoked }
        });
        res.json({ revoked });
    }));

    adminRouter.use((req, res, next) => {
        if (config.requireAdminMfa && !req.auth.admin.mfaEnabled) {
            next(new AppError(403, "mfa_setup_required", "Ative a autenticação em dois fatores para acessar os dados administrativos."));
            return;
        }
        next();
    });

    adminRouter.get("/team", auth.requireRole("owner"), asyncRoute(async (req, res) => {
        res.json({ members: await repository.listAdmins() });
    }));

    adminRouter.post("/team/invitations", auth.requireRole("owner"), auth.requireCsrf, asyncRoute(async (req, res) => {
        const input = parse(schemas.staffInvitation, req.body);
        const result = await createStaffInvitation(input, req.auth.admin.id);
        res.status(201).json(result);
    }));

    adminRouter.get("/access-requests", auth.requireRole("owner"), asyncRoute(async (req, res) => {
        const status = ["pending", "approved", "rejected"].includes(String(req.query.status || "pending"))
            ? String(req.query.status || "pending")
            : "pending";
        const requests = await repository.listAccessRequests(status);
        res.json({ requests, total: requests.length });
    }));

    adminRouter.post("/access-requests/:id/approve", auth.requireRole("owner"), auth.requireCsrf, asyncRoute(async (req, res) => {
        const id = parse(schemas.uid, req.params.id);
        const input = parse(schemas.accessRequestApproval, req.body);
        const accessRequest = await repository.getAccessRequestByPublicId(id);
        if (!accessRequest) throw new AppError(404, "access_request_not_found", "Solicitação de acesso não encontrada.");
        if (accessRequest.status !== "pending") {
            throw new AppError(409, "access_request_already_reviewed", "Esta solicitação de acesso já foi analisada.");
        }
        const result = await createStaffInvitation({
            name: accessRequest.name,
            email: accessRequest.email,
            role: input.role,
            accessRequestId: id
        }, req.auth.admin.id);
        res.status(201).json({ ...result, message: "Solicitação aprovada e convite criado." });
    }));

    adminRouter.post("/access-requests/:id/reject", auth.requireRole("owner"), auth.requireCsrf, asyncRoute(async (req, res) => {
        const id = parse(schemas.uid, req.params.id);
        const input = parse(schemas.accessRequestRejection, req.body);
        const reviewed = await repository.reviewAccessRequest(id, "rejected", input.note, req.auth.admin.id);
        res.json({ request: reviewed, message: "Solicitação de acesso recusada." });
    }));

    adminRouter.post("/team/:id/resend-invitation", auth.requireRole("owner"), auth.requireCsrf, asyncRoute(async (req, res) => {
        const id = parse(schemas.uid, req.params.id);
        res.json(await createStaffInvitation({}, req.auth.admin.id, id));
    }));

    adminRouter.patch("/team/:id", auth.requireRole("owner"), auth.requireCsrf, asyncRoute(async (req, res) => {
        const id = parse(schemas.uid, req.params.id);
        const input = parse(schemas.staffUpdate, req.body);
        res.json({ member: await repository.updateAdmin(id, input, req.auth.admin.id) });
    }));

    adminRouter.get("/reviews", auth.requireRole("owner"), asyncRoute(async (req, res) => {
        const allowedStatuses = new Set(["all", "draft", "pending", "approved", "rejected", "cancelled"]);
        const status = allowedStatuses.has(String(req.query.status || "pending"))
            ? String(req.query.status || "pending")
            : "pending";
        const entityType = ["product", "article"].includes(String(req.query.entityType || ""))
            ? String(req.query.entityType)
            : undefined;
        const reviews = await repository.listContentSubmissions({ status, entityType, limit: 500 });
        res.json({ reviews, total: reviews.length });
    }));

    adminRouter.post("/reviews/:id/approve", auth.requireRole("owner"), auth.requireCsrf, asyncRoute(async (req, res) => {
        const id = parse(schemas.uid, req.params.id);
        const input = parse(schemas.reviewApproval, req.body || {});
        const review = await repository.getContentSubmission(id);
        if (!review) throw new AppError(404, "review_not_found", "Publicação para análise não encontrada.");
        const payload = review.entityType === "product"
            ? parse(
                schemas.publishableProduct,
                parse(schemas.product, { type: review.productType, product: review.payload }).product
            )
            : parse(schemas.publishableArticle, review.payload);
        res.json(await repository.approveContentSubmission(id, req.auth.admin.id, payload, input.note));
    }));

    adminRouter.post("/reviews/:id/reject", auth.requireRole("owner"), auth.requireCsrf, asyncRoute(async (req, res) => {
        const id = parse(schemas.uid, req.params.id);
        const input = parse(schemas.reviewRejection, req.body);
        res.json({ review: await repository.rejectContentSubmission(id, req.auth.admin.id, input.note) });
    }));

    adminRouter.delete("/submissions/:id", auth.requireRole("editor"), auth.requireCsrf, asyncRoute(async (req, res) => {
        const id = parse(schemas.uid, req.params.id);
        res.json({ submission: await repository.cancelContentSubmission(id, req.auth.admin.id) });
    }));

    adminRouter.post("/products", auth.requireRole("owner", "editor"), editorialMutationLimiter, auth.requireCsrf, asyncRoute(async (req, res) => {
        const input = parse(schemas.product, req.body);
        if (req.auth.admin.role === "editor") {
            const desiredStatus = input.product._admin?.status || "draft";
            const review = await repository.createContentSubmission({
                intent: "create",
                entityType: "product",
                entityUid: input.product._admin?.uid,
                submissionId: input.product._admin?.submissionId,
                productType: input.type,
                payload: input.product,
                baseVersion: Number.isInteger(input.product._admin?.version) ? input.product._admin.version : undefined,
                status: desiredStatus === "draft" ? "draft" : "pending"
            }, req.auth.admin.id);
            res.status(201).json({ product: proposedContent(review), submission: review, requiresApproval: true });
            return;
        }
        if (input.product._admin?.status === "published") {
            input.product = parse(schemas.publishableProduct, input.product);
        }
        const product = await repository.saveProduct(input.type, input.product, req.auth.admin.id);
        res.status(201).json({ product });
    }));

    adminRouter.put("/products/:uid", auth.requireRole("owner", "editor"), editorialMutationLimiter, auth.requireCsrf, asyncRoute(async (req, res) => {
        const uid = parse(schemas.uid, req.params.uid);
        const input = parse(schemas.product, req.body);
        if (req.auth.admin.role === "editor") {
            const desiredStatus = input.product._admin?.status || "draft";
            const review = await repository.createContentSubmission({
                intent: "update",
                entityType: "product",
                entityUid: uid,
                submissionId: input.product._admin?.submissionId || (uid.startsWith("submission:") ? uid.slice(11) : undefined),
                productType: input.type,
                payload: input.product,
                baseVersion: Number.isInteger(input.product._admin?.version) ? input.product._admin.version : undefined,
                status: desiredStatus === "draft" ? "draft" : "pending"
            }, req.auth.admin.id);
            res.json({ product: proposedContent(review), submission: review, requiresApproval: true });
            return;
        }
        if (input.product._admin?.status === "published") {
            input.product = parse(schemas.publishableProduct, input.product);
        }
        const product = await repository.saveProduct(input.type, input.product, req.auth.admin.id, uid);
        res.json({ product });
    }));

    adminRouter.delete("/products/:uid", auth.requireRole("owner"), auth.requireCsrf, asyncRoute(async (req, res) => {
        const uid = parse(schemas.uid, req.params.uid);
        const product = await repository.deleteProduct(uid, req.auth.admin.id);
        res.json({ product });
    }));

    adminRouter.post("/products/:uid/restore", auth.requireRole("owner"), auth.requireCsrf, asyncRoute(async (req, res) => {
        const uid = parse(schemas.uid, req.params.uid);
        const product = await repository.restoreProduct(uid, req.auth.admin.id);
        res.json({ product });
    }));

    adminRouter.put("/catalog", auth.requireRole("owner"), auth.requireCsrf, asyncRoute(async (req, res) => {
        const catalog = normalizedCatalogInput(req.body);
        const items = await repository.replaceProducts(catalog, req.auth.admin.id);
        res.json({ catalog: groupedCatalog(items) });
    }));

    adminRouter.post("/articles", auth.requireRole("owner", "editor"), editorialMutationLimiter, auth.requireCsrf, asyncRoute(async (req, res) => {
        const article = parse(schemas.article, req.body.article || req.body);
        if (req.auth.admin.role === "editor") {
            const desiredStatus = article._admin?.status || "draft";
            const review = await repository.createContentSubmission({
                intent: "create",
                entityType: "article",
                entityUid: article._admin?.uid,
                submissionId: article._admin?.submissionId,
                payload: article,
                baseVersion: Number.isInteger(article._admin?.version) ? article._admin.version : undefined,
                status: desiredStatus === "draft" ? "draft" : "pending"
            }, req.auth.admin.id);
            res.status(201).json({ article: proposedContent(review), submission: review, requiresApproval: true });
            return;
        }
        const saved = await repository.saveArticle(article, req.auth.admin.id);
        res.status(201).json({ article: saved });
    }));

    adminRouter.put("/articles/:uid", auth.requireRole("owner", "editor"), editorialMutationLimiter, auth.requireCsrf, asyncRoute(async (req, res) => {
        const uid = parse(schemas.uid, req.params.uid);
        const article = parse(schemas.article, req.body.article || req.body);
        if (req.auth.admin.role === "editor") {
            const desiredStatus = article._admin?.status || "draft";
            const review = await repository.createContentSubmission({
                intent: "update",
                entityType: "article",
                entityUid: uid,
                submissionId: article._admin?.submissionId || (uid.startsWith("submission:") ? uid.slice(11) : undefined),
                payload: article,
                baseVersion: Number.isInteger(article._admin?.version) ? article._admin.version : undefined,
                status: desiredStatus === "draft" ? "draft" : "pending"
            }, req.auth.admin.id);
            res.json({ article: proposedContent(review), submission: review, requiresApproval: true });
            return;
        }
        const saved = await repository.saveArticle(article, req.auth.admin.id, uid);
        res.json({ article: saved });
    }));

    adminRouter.delete("/articles/:uid", auth.requireRole("owner"), auth.requireCsrf, asyncRoute(async (req, res) => {
        const uid = parse(schemas.uid, req.params.uid);
        res.json({ article: await repository.deleteArticle(uid, req.auth.admin.id) });
    }));

    adminRouter.post("/articles/:uid/restore", auth.requireRole("owner"), auth.requireCsrf, asyncRoute(async (req, res) => {
        const uid = parse(schemas.uid, req.params.uid);
        res.json({ article: await repository.restoreArticle(uid, req.auth.admin.id) });
    }));

    adminRouter.put("/articles", auth.requireRole("owner"), auth.requireCsrf, asyncRoute(async (req, res) => {
        const articles = normalizedArticlesInput(req.body);
        res.json({ articles: await repository.replaceArticles(articles, req.auth.admin.id) });
    }));

    adminRouter.get("/leads", auth.requireRole("owner"), asyncRoute(async (req, res) => {
        const data = await repository.listLeads({
            status: ["new", "in_progress", "closed", "spam"].includes(req.query.status) ? req.query.status : "all",
            search: safeQueryText(req.query.search, 100),
            page: Number(req.query.page) || 1,
            pageSize: Number(req.query.pageSize) || 30
        });
        res.json(data);
    }));

    adminRouter.patch("/leads/:id", auth.requireRole("owner"), auth.requireCsrf, asyncRoute(async (req, res) => {
        const input = parse(schemas.leadStatus, req.body);
        const id = String(req.params.id || "").slice(0, 36);
        res.json({ lead: await repository.updateLeadStatus(id, input.status, req.auth.admin.id) });
    }));

    adminRouter.get("/analytics/events", auth.requireRole("owner"), asyncRoute(async (req, res) => {
        const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 400 * 86400000);
        const to = req.query.to ? new Date(String(req.query.to)) : new Date(Date.now() + 86400000);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            throw new AppError(422, "invalid_period", "O período das métricas é inválido.");
        }
        const events = await repository.listAnalytics({ from, to, limit: Number(req.query.limit) || 15000 });
        res.json({
            version: 1,
            mode: "database",
            startedAt: events[0]?.timestamp || new Date().toISOString(),
            updatedAt: events[events.length - 1]?.timestamp || new Date().toISOString(),
            retentionDays: 400,
            events
        });
    }));

    adminRouter.delete("/analytics/events", auth.requireRole("owner"), auth.requireCsrf, asyncRoute(async (req, res) => {
        const count = await repository.clearAnalytics(req.auth.admin.id);
        res.json({ cleared: count });
    }));

    const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: config.maxUploadBytes, files: 1, fields: 5 },
        fileFilter: (req, file, callback) => {
            if (!allowedMimeTypes.has(file.mimetype)) {
                callback(new AppError(415, "unsupported_image", "Use uma imagem JPEG, PNG, WebP ou AVIF."));
                return;
            }
            callback(null, true);
        }
    });
    adminRouter.post(
        "/media",
        auth.requireRole("owner", "editor"),
        mediaUploadLimiter,
        auth.requireCsrf,
        upload.single("file"),
        asyncRoute(async (req, res) => {
            const asset = await mediaService.saveImage(req.file, req.body.alt);
            try {
                res.status(201).json({ asset: await repository.createMediaAsset(asset, req.auth.admin.id) });
            } catch (error) {
                await mediaService.removeImage?.(asset.storagePath).catch(() => {});
                throw error;
            }
        })
    );

    app.use("/api/admin", adminRouter);
    app.use("/api", apiNotFound);

    app.use("/uploads", express.static(config.uploadDir, {
        fallthrough: false,
        immutable: true,
        maxAge: "30d",
        index: false
    }));
    app.use(express.static(config.publicDir, {
        extensions: ["html"],
        maxAge: 0,
        setHeaders(res, filePath) {
            if (/\.(?:svg|png|jpe?g|webp|avif|woff2?)$/i.test(filePath)) {
                res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
            } else if (/\.(?:css|js)$/i.test(filePath)) {
                res.setHeader("Cache-Control", "no-cache");
            } else {
                res.setHeader("Cache-Control", "no-cache");
            }
        }
    }));
    app.use((req, res) => {
        res.status(404).sendFile(path.join(config.publicDir, "404.html"));
    });
    app.use(errorHandler);
    return app;
}

module.exports = { createApp, groupedCatalog, normalizedCatalogInput, normalizedArticlesInput };
