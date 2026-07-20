"use strict";

const crypto = require("node:crypto");
const zlib = require("node:zlib");

const magic = Buffer.from("BRUTUSMAQ-BACKUP-V1\n", "ascii");

function keyFromSecret(secret) {
    return crypto.createHash("sha256").update(String(secret)).digest();
}

function encryptBackup(payload, secret) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", keyFromSecret(secret), iv);
    const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(payload), "utf8"), { level: 9 });
    const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
    return Buffer.concat([magic, iv, cipher.getAuthTag(), encrypted]);
}

function decryptBackup(buffer, secret) {
    if (!Buffer.isBuffer(buffer) || !buffer.subarray(0, magic.length).equals(magic)) {
        throw new Error("O arquivo não é um backup Brutusmaq válido.");
    }
    const ivStart = magic.length;
    const tagStart = ivStart + 12;
    const dataStart = tagStart + 16;
    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        keyFromSecret(secret),
        buffer.subarray(ivStart, tagStart)
    );
    decipher.setAuthTag(buffer.subarray(tagStart, dataStart));
    const compressed = Buffer.concat([decipher.update(buffer.subarray(dataStart)), decipher.final()]);
    return JSON.parse(zlib.gunzipSync(compressed).toString("utf8"), (key, value) => {
        if (value && value.type === "Buffer" && Array.isArray(value.data)) return Buffer.from(value.data);
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
            return new Date(value);
        }
        return value;
    });
}

module.exports = { encryptBackup, decryptBackup, magic };

