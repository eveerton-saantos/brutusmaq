"use strict";

const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { createConnection, validateAdminEnvironment } = require("./database-tools");

async function createAdmin() {
    const admin = validateAdminEnvironment();
    const passwordHash = await bcrypt.hash(admin.password, 12);
    const { connection } = await createConnection();
    try {
        await connection.beginTransaction();
        await connection.execute(
            `INSERT INTO admins (public_id, name, email, password_hash, role, active, password_changed_at)
             VALUES (?, ?, ?, ?, ?, 1, UTC_TIMESTAMP(3))
             ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash),
             role = VALUES(role), active = 1, password_changed_at = UTC_TIMESTAMP(3)`,
            [crypto.randomUUID(), admin.name, admin.email, passwordHash, admin.role]
        );
        const [rows] = await connection.execute(
            "SELECT id FROM admins WHERE email = ? LIMIT 1 FOR UPDATE",
            [admin.email]
        );
        const adminId = rows[0]?.id;
        if (!adminId) throw new Error("A conta criada não foi encontrada para finalizar a configuração.");

        await connection.execute("DELETE FROM admin_sessions WHERE admin_id = ?", [adminId]);
        await connection.execute("DELETE FROM admin_mfa_challenges WHERE admin_id = ?", [adminId]);
        await connection.execute("DELETE FROM password_reset_tokens WHERE admin_id = ?", [adminId]);
        await connection.execute(
            "UPDATE admin_invitations SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(3)) WHERE admin_id = ? AND accepted_at IS NULL",
            [adminId]
        );
        await connection.commit();
        console.log(`Administrador ${admin.email} criado ou atualizado; credenciais temporárias e sessões antigas foram invalidadas.`);
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        await connection.end();
    }
}

createAdmin().catch((error) => {
    console.error(`Falha ao criar administrador: ${error.message}`);
    process.exitCode = 1;
});
