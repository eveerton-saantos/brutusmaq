"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { createConnection, runMigrations } = require("./database-tools");
const { decryptBackup } = require("./backup-crypto");

const tableOrder = [
    "admins",
    "admin_access_requests",
    "editorial_submissions",
    "products",
    "articles",
    "leads",
    "analytics_events",
    "media_assets",
    "audit_logs",
    "security_events"
];

function requireConfirmation() {
    if (process.env.RESTORE_CONFIRM !== "RESTAURAR-BRUTUSMAQ") {
        throw new Error("Para restaurar, defina RESTORE_CONFIRM=RESTAURAR-BRUTUSMAQ.");
    }
    const filePath = process.argv[2];
    if (!filePath || path.extname(filePath).toLowerCase() !== ".bmaq") {
        throw new Error("Informe o caminho de um arquivo .bmaq: npm run db:restore -- caminho-do-backup.bmaq");
    }
    const secret = String(process.env.BACKUP_ENCRYPTION_KEY || "");
    if (secret.length < 32) throw new Error("Defina BACKUP_ENCRYPTION_KEY para descriptografar o backup.");
    return { filePath: path.resolve(filePath), secret };
}

async function insertRows(connection, table, rows) {
    if (!rows.length) return;
    const columns = Object.keys(rows[0]);
    const escapedColumns = columns.map((column) => `\`${column.replace(/`/g, "")}\``).join(", ");
    for (let index = 0; index < rows.length; index += 100) {
        const chunk = rows.slice(index, index + 100);
        const values = chunk.map((row) => columns.map((column) => row[column]));
        await connection.query(`INSERT INTO \`${table}\` (${escapedColumns}) VALUES ?`, [values]);
    }
}

async function main() {
    const input = requireConfirmation();
    const payload = decryptBackup(await fs.readFile(input.filePath), input.secret);
    if (payload?.format !== "brutusmaq-database-backup" || payload.version !== 1 || !payload.tables) {
        throw new Error("Formato de backup incompatível.");
    }

    await runMigrations();
    const { connection } = await createConnection();
    try {
        await connection.beginTransaction();
        await connection.query("SET FOREIGN_KEY_CHECKS = 0");
        for (const table of [...tableOrder].reverse()) await connection.query(`DELETE FROM \`${table}\``);
        await connection.query("DELETE FROM admin_sessions");
        await connection.query("DELETE FROM admin_mfa_challenges");
        await connection.query("DELETE FROM password_reset_tokens");
        await connection.query("DELETE FROM admin_invitations");
        for (const table of tableOrder) {
            const rows = Array.isArray(payload.tables[table]) ? payload.tables[table] : [];
            await insertRows(connection, table, rows);
        }
        await connection.query("SET FOREIGN_KEY_CHECKS = 1");
        await connection.commit();
        console.log(`Backup restaurado: ${input.filePath}`);
        console.log("Todas as sessões administrativas anteriores foram invalidadas.");
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        await connection.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => {});
        await connection.end();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
