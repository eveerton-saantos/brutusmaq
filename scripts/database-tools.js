"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const mysql = require("mysql2/promise");
const { loadConfig, projectRoot } = require("../server/config");
const { databaseConnectionOptions } = require("../server/database");

async function createConnection(options) {
    const config = loadConfig(options?.env);
    const connection = await mysql.createConnection({
        ...databaseConnectionOptions(config.database),
        multipleStatements: Boolean(options?.multipleStatements)
    });
    return { config, connection };
}

async function runMigrations() {
    const { connection } = await createConnection({ multipleStatements: true });
    const migrationsDir = path.join(projectRoot, "database", "migrations");
    try {
        await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            filename VARCHAR(255) NOT NULL,
            checksum CHAR(64) NOT NULL,
            applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (id),
            UNIQUE KEY uq_schema_migrations_filename (filename)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

        const filenames = (await fs.readdir(migrationsDir))
            .filter((filename) => /^\d+_.+\.sql$/i.test(filename))
            .sort((first, second) => first.localeCompare(second));

        for (const filename of filenames) {
            const sql = await fs.readFile(path.join(migrationsDir, filename), "utf8");
            const checksum = crypto.createHash("sha256").update(sql).digest("hex");
            const [rows] = await connection.execute(
                "SELECT checksum FROM schema_migrations WHERE filename = ? LIMIT 1",
                [filename]
            );
            if (rows[0]) {
                if (rows[0].checksum !== checksum) {
                    throw new Error(`A migração ${filename} foi alterada depois de aplicada.`);
                }
                continue;
            }
            await connection.query(sql);
            await connection.execute(
                "INSERT INTO schema_migrations (filename, checksum) VALUES (?, ?)",
                [filename, checksum]
            );
            console.log(`Migração aplicada: ${filename}`);
        }
        return filenames.length;
    } finally {
        await connection.end();
    }
}

function validateAdminEnvironment() {
    const name = String(process.env.ADMIN_NAME || "Administrador Brutusmaq").trim().slice(0, 120);
    const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const password = String(process.env.ADMIN_PASSWORD || "");
    const role = ["owner", "editor", "viewer"].includes(process.env.ADMIN_ROLE)
        ? process.env.ADMIN_ROLE
        : "owner";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Defina ADMIN_EMAIL com um e-mail válido.");
    }
    if (password.trim().length < 12 || Buffer.byteLength(password, "utf8") > 72
        || new Set(password).size < 6 || /troque|senha-forte/i.test(password)) {
        throw new Error("Defina ADMIN_PASSWORD com 12 a 72 bytes, caracteres variados e sem usar o valor de exemplo.");
    }
    return { name, email, password, role };
}

module.exports = { createConnection, runMigrations, validateAdminEnvironment };
