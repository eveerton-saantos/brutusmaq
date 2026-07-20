"use strict";

const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ quiet: true });

const projectRoot = path.resolve(__dirname, "..");

function booleanValue(value, fallback) {
    if (value == null || value === "") return fallback;
    return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function integerValue(value, fallback, minimum, maximum) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(minimum, Math.min(maximum, parsed));
}

function normalizeOrigin(value) {
    try {
        return new URL(value).origin;
    } catch (error) {
        return "";
    }
}

function requireProductionSecret(name, value, production) {
    const normalized = String(value || "");
    if (production && (normalized.length < 32 || /troque|change|development-only|exemplo|example/i.test(normalized))) {
        throw new Error(`${name} precisa ser um segredo aleatório com pelo menos 32 caracteres em produção.`);
    }
    return normalized || `development-only-${name.toLowerCase()}-change-before-deploy`;
}

function loadConfig(overrides) {
    const env = { ...process.env, ...(overrides || {}) };
    const production = env.NODE_ENV === "production";
    const baseUrl = String(env.BASE_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/+$/, "");
    if (production && !/^https:\/\//i.test(baseUrl)) {
        throw new Error("BASE_URL precisa usar HTTPS em produção.");
    }
    if (production && env.DATABASE_URL) {
        let databaseUrl;
        try {
            databaseUrl = new URL(env.DATABASE_URL);
        } catch (error) {
            throw new Error("DATABASE_URL possui formato inválido.");
        }
        if (databaseUrl.protocol !== "mysql:" || !databaseUrl.username || !databaseUrl.password || databaseUrl.pathname === "/") {
            throw new Error("DATABASE_URL precisa conter protocolo MySQL, usuário, senha e banco.");
        }
    }
    if (production && !env.DATABASE_URL) {
        const databaseValues = [env.DB_NAME, env.DB_USER, env.DB_PASSWORD].map((value) => String(value || ""));
        if (databaseValues.some((value) => !value || /troque|exemplo|example/i.test(value))) {
            throw new Error("Defina DB_NAME, DB_USER e DB_PASSWORD reais em produção.");
        }
    }
    const sessionSecret = requireProductionSecret("SESSION_SECRET", env.SESSION_SECRET, production);
    const analyticsSecret = requireProductionSecret("ANALYTICS_SECRET", env.ANALYTICS_SECRET, production);
    const mfaEncryptionKey = requireProductionSecret("MFA_ENCRYPTION_KEY", env.MFA_ENCRYPTION_KEY, production);
    const backupEncryptionKey = requireProductionSecret("BACKUP_ENCRYPTION_KEY", env.BACKUP_ENCRYPTION_KEY, production);
    const secrets = new Set([sessionSecret, analyticsSecret, mfaEncryptionKey, backupEncryptionKey]);
    if (production && secrets.size !== 4) {
        throw new Error("SESSION_SECRET, ANALYTICS_SECRET, MFA_ENCRYPTION_KEY e BACKUP_ENCRYPTION_KEY precisam ser diferentes.");
    }
    const allowedOrigins = new Set([
        normalizeOrigin(baseUrl),
        ...String(env.ALLOWED_ORIGINS || "")
            .split(",")
            .map((item) => normalizeOrigin(item.trim()))
            .filter(Boolean)
    ].filter(Boolean));
    if (!production) {
        const developmentUrl = new URL(baseUrl);
        const developmentPort = developmentUrl.port ? `:${developmentUrl.port}` : "";
        allowedOrigins.add(`${developmentUrl.protocol}//localhost${developmentPort}`);
        allowedOrigins.add(`${developmentUrl.protocol}//127.0.0.1${developmentPort}`);
    }

    return Object.freeze({
        env: String(env.NODE_ENV || "development"),
        production,
        port: integerValue(env.PORT, 3000, 1, 65535),
        baseUrl,
        allowedOrigins,
        trustProxy: integerValue(env.TRUST_PROXY, production ? 1 : 0, 0, 10),
        publicDir: path.join(projectRoot, "public"),
        uploadDir: path.resolve(projectRoot, env.UPLOAD_DIR || "storage/uploads"),
        maxUploadBytes: integerValue(env.MAX_UPLOAD_MB, 8, 1, 20) * 1024 * 1024,
        cookieName: "brutusmaq_session",
        sessionHours: integerValue(env.SESSION_HOURS, 8, 1, 168),
        sessionSecret,
        analyticsSecret,
        mfaEncryptionKey,
        backupEncryptionKey,
        requireAdminMfa: booleanValue(env.REQUIRE_ADMIN_MFA, production),
        backupDir: path.resolve(projectRoot, env.BACKUP_DIR || "storage/backups"),
        database: {
            url: String(env.DATABASE_URL || ""),
            host: String(env.DB_HOST || "localhost"),
            port: integerValue(env.DB_PORT, 3306, 1, 65535),
            name: String(env.DB_NAME || "brutusmaq"),
            user: String(env.DB_USER || ""),
            password: String(env.DB_PASSWORD || ""),
            connectionLimit: integerValue(env.DB_CONNECTION_LIMIT, 10, 1, 30),
            ssl: booleanValue(env.DB_SSL, false)
        },
        smtp: {
            enabled: Boolean(env.SMTP_HOST),
            host: String(env.SMTP_HOST || ""),
            port: integerValue(env.SMTP_PORT, 465, 1, 65535),
            secure: booleanValue(env.SMTP_SECURE, true),
            user: String(env.SMTP_USER || ""),
            password: String(env.SMTP_PASSWORD || ""),
            from: String(env.SMTP_FROM || "Site Brutusmaq <contato@brutusmaq.com.br>"),
            contactTo: String(env.CONTACT_TO || "contato@brutusmaq.com.br")
        }
    });
}

module.exports = { loadConfig, projectRoot };
