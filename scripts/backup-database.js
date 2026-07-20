"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { createConnection } = require("./database-tools");
const { encryptBackup } = require("./backup-crypto");

const tables = [
    "admins",
    "admin_access_requests",
    "products",
    "articles",
    "leads",
    "analytics_events",
    "media_assets",
    "editorial_submissions",
    "audit_logs",
    "security_events"
];

function requireBackupSecret(config) {
    const value = String(process.env.BACKUP_ENCRYPTION_KEY || "");
    if (value.length < 32 || /troque|change|example|exemplo/i.test(value)) {
        throw new Error("Defina BACKUP_ENCRYPTION_KEY com um segredo aleatório de pelo menos 32 caracteres.");
    }
    return config.backupEncryptionKey;
}

function timestamp() {
    return new Date().toISOString().replace(/[:.]/g, "-");
}

async function main() {
    const { config, connection } = await createConnection();
    try {
        const payload = {
            format: "brutusmaq-database-backup",
            version: 1,
            createdAt: new Date().toISOString(),
            tables: {}
        };
        for (const table of tables) {
            const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
            payload.tables[table] = rows;
        }
        const output = encryptBackup(payload, requireBackupSecret(config));
        await fs.mkdir(config.backupDir, { recursive: true });
        const filePath = path.join(config.backupDir, `brutusmaq-${timestamp()}.bmaq`);
        await fs.writeFile(filePath, output, { flag: "wx" });
        const counts = Object.fromEntries(tables.map((table) => [table, payload.tables[table].length]));
        console.log(JSON.stringify({ backup: filePath, bytes: output.length, counts }, null, 2));
    } finally {
        await connection.end();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
