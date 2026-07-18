"use strict";

const crypto = require("node:crypto");
const cookie = require("cookie");
const { AppError } = require("./errors");

function randomToken(bytes) {
    return crypto.randomBytes(bytes || 32).toString("base64url");
}

function sha256(value) {
    return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function hmac(value, secret) {
    return crypto.createHmac("sha256", secret).update(String(value)).digest("base64url");
}

function safeEqual(first, second) {
    const a = Buffer.from(String(first || ""));
    const b = Buffer.from(String(second || ""));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

function parseCookies(req) {
    try {
        return cookie.parse(req.headers.cookie || "");
    } catch (error) {
        return {};
    }
}

function sessionCookie(config, token, maxAgeSeconds) {
    return cookie.serialize(config.cookieName, token, {
        httpOnly: true,
        secure: config.production,
        sameSite: "lax",
        path: "/",
        maxAge: maxAgeSeconds
    });
}

function clearSessionCookie(config) {
    return cookie.serialize(config.cookieName, "", {
        httpOnly: true,
        secure: config.production,
        sameSite: "lax",
        path: "/",
        maxAge: 0
    });
}

function allowedOriginMiddleware(config) {
    return function enforceAllowedOrigin(req, res, next) {
        if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
            next();
            return;
        }
        const origin = req.headers.origin;
        if (!origin) {
            next();
            return;
        }
        let normalized = "";
        try {
            normalized = new URL(origin).origin;
        } catch (error) {
            throw new AppError(403, "origin_not_allowed", "Origem da solicitação inválida.");
        }
        if (!config.allowedOrigins.has(normalized)) {
            throw new AppError(403, "origin_not_allowed", "Esta origem não pode alterar dados do site.");
        }
        next();
    };
}

function createAuthMiddleware(repository, config) {
    async function optionalAuth(req, res, next) {
        try {
            const token = parseCookies(req)[config.cookieName];
            if (!token) {
                req.auth = null;
                next();
                return;
            }
            const session = await repository.findSession(sha256(token));
            if (!session || !session.active || new Date(session.expiresAt).getTime() <= Date.now()) {
                res.appendHeader("Set-Cookie", clearSessionCookie(config));
                req.auth = null;
                next();
                return;
            }
            req.auth = {
                admin: {
                    id: session.adminId,
                    publicId: session.publicId,
                    name: session.name,
                    email: session.email,
                    role: session.role,
                    mfaEnabled: Boolean(session.mfaEnabled)
                },
                token,
                tokenHash: sha256(token),
                csrfToken: hmac(token, config.sessionSecret)
            };
            repository.touchSession(req.auth.tokenHash).catch(() => {});
            next();
        } catch (error) {
            next(error);
        }
    }

    function requireAuth(req, res, next) {
        if (!req.auth) {
            next(new AppError(401, "authentication_required", "Entre no painel para continuar."));
            return;
        }
        next();
    }

    function requireRole(...roles) {
        return function roleMiddleware(req, res, next) {
            if (!req.auth) {
                next(new AppError(401, "authentication_required", "Entre no painel para continuar."));
                return;
            }
            if (!roles.includes(req.auth.admin.role)) {
                next(new AppError(403, "permission_denied", "Seu perfil não possui permissão para esta ação."));
                return;
            }
            next();
        };
    }

    function requireCsrf(req, res, next) {
        const supplied = req.get("x-csrf-token");
        if (!req.auth || !supplied || !safeEqual(supplied, req.auth.csrfToken)) {
            next(new AppError(403, "csrf_validation_failed", "A sessão de segurança expirou. Atualize o painel."));
            return;
        }
        next();
    }

    return { optionalAuth, requireAuth, requireRole, requireCsrf };
}

module.exports = {
    randomToken,
    sha256,
    hmac,
    safeEqual,
    sessionCookie,
    clearSessionCookie,
    allowedOriginMiddleware,
    createAuthMiddleware
};
