"use strict";

const { createConnection } = require("./database-tools");

const requiredTables = [
    "admins",
    "admin_sessions",
    "products",
    "articles",
    "leads",
    "analytics_events",
    "media_assets",
    "audit_logs",
    "admin_mfa_challenges",
    "password_reset_tokens",
    "security_events",
    "admin_invitations",
    "editorial_submissions",
    "schema_migrations"
];

async function main() {
    const { config, connection } = await createConnection();
    try {
        const [rows] = await connection.query(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = ?`,
            [config.database.name]
        );
        const available = new Set(rows.map((row) => row.TABLE_NAME || row.table_name));
        const missing = requiredTables.filter((table) => !available.has(table));
        if (missing.length) throw new Error(`Tabelas ausentes: ${missing.join(", ")}`);
        const [adminRows] = await connection.query("SELECT COUNT(*) AS total FROM admins WHERE active = 1");
        const [migrationRows] = await connection.query("SELECT filename, applied_at FROM schema_migrations ORDER BY filename");
        const migrations = new Set(migrationRows.map((row) => row.filename));
        if (!migrations.has("004_staff_approval_workflow.sql") || !migrations.has("005_editorial_restore_operation.sql")) {
            throw new Error("Migrações editoriais 004/005 ainda não foram aplicadas.");
        }
        const [operationColumns] = await connection.query("SHOW COLUMNS FROM editorial_submissions LIKE 'operation'");
        if (!String(operationColumns[0]?.Type || "").includes("'restore'")) {
            throw new Error("Schema editorial desatualizado: a operação restore não está disponível.");
        }
        console.log(JSON.stringify({
            database: config.database.name,
            status: "ok",
            activeAdmins: Number(adminRows[0]?.total || 0),
            migrations: migrationRows
        }, null, 2));
    } finally {
        await connection.end();
    }
}

main().catch((error) => {
    const nested = Array.isArray(error?.errors) ? error.errors.map((item) => item?.code || item?.message).filter(Boolean) : [];
    console.error(error?.message || error?.code || nested.join(", ") || "Não foi possível conectar e validar o banco de dados.");
    process.exitCode = 1;
});
