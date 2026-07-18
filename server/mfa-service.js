"use strict";

const crypto = require("node:crypto");
const QRCode = require("qrcode");
const { generateSecret, generateURI, verify } = require("otplib");
const { AppError } = require("./errors");

function encryptionKey(secret) {
    return crypto.createHash("sha256").update(String(secret)).digest();
}

function encryptSecret(value, secret) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
    const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

function decryptSecret(value, secret) {
    try {
        const [version, ivValue, tagValue, encryptedValue] = String(value || "").split(":");
        if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) throw new Error("invalid payload");
        const decipher = crypto.createDecipheriv(
            "aes-256-gcm",
            encryptionKey(secret),
            Buffer.from(ivValue, "base64url")
        );
        decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
        return Buffer.concat([
            decipher.update(Buffer.from(encryptedValue, "base64url")),
            decipher.final()
        ]).toString("utf8");
    } catch (error) {
        throw new AppError(500, "mfa_secret_unavailable", "Não foi possível acessar a configuração de autenticação em dois fatores.");
    }
}

function normalizeCode(value) {
    return String(value || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function recoveryHash(value, secret) {
    return crypto.createHmac("sha256", String(secret)).update(normalizeCode(value)).digest("hex");
}

function recoveryCodes(secret) {
    const codes = Array.from({ length: 10 }, () => {
        const value = crypto.randomBytes(6).toString("hex").toUpperCase();
        return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}`;
    });
    return {
        codes,
        hashes: codes.map((code) => recoveryHash(code, secret))
    };
}

function createMfaService(config) {
    return Object.freeze({
        async createSetup(email) {
            const secret = generateSecret();
            const uri = generateURI({ issuer: "Brutusmaq", label: email, secret });
            const qrCode = await QRCode.toDataURL(uri, {
                errorCorrectionLevel: "M",
                margin: 1,
                width: 260,
                color: { dark: "#0d100f", light: "#ffffff" }
            });
            return {
                encryptedSecret: encryptSecret(secret, config.mfaEncryptionKey),
                secret,
                uri,
                qrCode
            };
        },
        async verifyCode(encryptedSecret, token) {
            if (!/^\d{6}$/.test(String(token || "").trim())) return false;
            const secret = decryptSecret(encryptedSecret, config.mfaEncryptionKey);
            const result = await verify({ secret, token: String(token).trim(), epochTolerance: 30 });
            return Boolean(result.valid);
        },
        createRecoveryCodes() {
            return recoveryCodes(config.mfaEncryptionKey);
        },
        hashRecoveryCode(code) {
            return recoveryHash(code, config.mfaEncryptionKey);
        },
        isRecoveryCode(code) {
            return normalizeCode(code).length === 12 && !/^\d{6}$/.test(String(code || "").trim());
        }
    });
}

module.exports = { createMfaService, encryptSecret, decryptSecret, recoveryHash };
