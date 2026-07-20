"use strict";

const crypto = require("node:crypto");
const mysql = require("mysql2/promise");
const { AppError } = require("./errors");

function parseJson(value, fallback) {
    if (value == null) return fallback;
    if (typeof value === "object") return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

function iso(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isProductFeatured(product) {
    if (typeof product?._admin?.featured === "boolean") return product._admin.featured;
    return product?.destaque === true || product?.featured === true;
}

function productFromRow(row) {
    const data = parseJson(row.data_json, {});
    data.id = row.slug;
    data.modelo = row.model;
    data.categoria = data.categoria || row.category || "";
    data._admin = {
        ...(data._admin || {}),
        uid: row.uid,
        status: row.publication_status,
        visible: Boolean(row.visible),
        featured: Boolean(row.featured) || data._admin?.featured === true,
        version: Number(row.version || 1),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at)
    };
    return data;
}

function articleFromRow(row) {
    const data = parseJson(row.data_json, {});
    data.slug = row.slug;
    data.title = row.title;
    data.category = data.category || row.category || "";
    data.author = data.author || row.author || "Equipe Brutusmaq";
    data.popular = Boolean(row.popular);
    data._admin = {
        ...(data._admin || {}),
        uid: row.uid,
        status: row.publication_status,
        visible: Boolean(row.visible),
        version: Number(row.version || 1),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at)
    };
    return data;
}

function invitationState(row) {
    if (!row.invitation_public_id) return null;
    let status = "pending";
    if (row.invitation_accepted_at) status = "accepted";
    else if (row.invitation_revoked_at) status = "revoked";
    else if (new Date(row.invitation_expires_at).getTime() <= Date.now()) status = "expired";
    return {
        id: row.invitation_public_id,
        status,
        expiresAt: iso(row.invitation_expires_at),
        acceptedAt: iso(row.invitation_accepted_at),
        createdAt: iso(row.invitation_created_at)
    };
}

function adminFromRow(row) {
    return {
        id: row.public_id,
        name: row.name,
        email: row.email,
        role: row.role,
        active: Boolean(row.active),
        mfaEnabled: Boolean(row.mfa_enabled),
        lastLoginAt: iso(row.last_login_at),
        createdAt: iso(row.created_at),
        needsInvitation: !Boolean(row.active) && !row.password_changed_at,
        invitation: invitationState(row)
    };
}

function accessRequestFromRow(row) {
    return {
        id: row.public_id,
        name: row.name,
        email: row.email,
        requestedRole: row.requested_role,
        reason: row.reason || "",
        status: row.status,
        reviewNote: row.review_note || "",
        reviewedAt: iso(row.reviewed_at),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at)
    };
}

function reviewFromRow(row) {
    const reviewedBy = row.reviewer_public_id ? {
        id: row.reviewer_public_id,
        name: row.reviewer_name,
        email: row.reviewer_email
    } : null;
    return {
        id: row.public_id,
        entityType: row.entity_type,
        operation: row.operation,
        entityUid: row.entity_uid || null,
        productType: row.product_type || null,
        payload: parseJson(row.payload_json, {}),
        status: row.status,
        baseVersion: row.base_version == null ? null : Number(row.base_version),
        submittedBy: {
            id: row.submitter_public_id,
            name: row.submitter_name,
            email: row.submitter_email
        },
        reviewedBy,
        note: row.review_note || "",
        submittedAt: iso(row.submitted_at),
        reviewedAt: iso(row.reviewed_at),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at)
    };
}

const submissionSelect = `SELECT s.*, submitter.public_id AS submitter_public_id,
    submitter.name AS submitter_name, submitter.email AS submitter_email,
    reviewer.public_id AS reviewer_public_id, reviewer.name AS reviewer_name,
    reviewer.email AS reviewer_email
    FROM editorial_submissions s
    INNER JOIN admins submitter ON submitter.id = s.submitted_by
    LEFT JOIN admins reviewer ON reviewer.id = s.reviewed_by`;

function duplicateError(error, entity) {
    if (error && error.code === "ER_DUP_ENTRY") {
        return new AppError(409, `${entity}_already_exists`, `Já existe ${entity === "product" ? "um produto" : "um artigo"} com este identificador.`);
    }
    return error;
}

function databaseConnectionOptions(databaseConfig) {
    let connectionOptions = {
        host: databaseConfig.host,
        port: databaseConfig.port,
        user: databaseConfig.user,
        password: databaseConfig.password,
        database: databaseConfig.name
    };
    if (databaseConfig.url) {
        const databaseUrl = new URL(databaseConfig.url);
        connectionOptions = {
            host: databaseUrl.hostname,
            port: Number(databaseUrl.port) || 3306,
            user: decodeURIComponent(databaseUrl.username),
            password: decodeURIComponent(databaseUrl.password),
            database: decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""))
        };
    }
    return {
        ...connectionOptions,
        charset: "utf8mb4",
        timezone: "Z",
        decimalNumbers: true,
        ssl: databaseConfig.ssl ? { rejectUnauthorized: true } : undefined
    };
}

class MySqlRepository {
    constructor(pool) {
        this.pool = pool;
    }

    static create(databaseConfig) {
        const sharedOptions = {
            waitForConnections: true,
            connectionLimit: databaseConfig.connectionLimit,
            queueLimit: 0,
            charset: "utf8mb4",
            timezone: "Z",
            decimalNumbers: true,
            enableKeepAlive: true,
            ssl: databaseConfig.ssl ? { rejectUnauthorized: true } : undefined
        };
        const pool = mysql.createPool({ ...databaseConnectionOptions(databaseConfig), ...sharedOptions });
        return new MySqlRepository(pool);
    }

    async close() {
        await this.pool.end();
    }

    async ping() {
        const [rows] = await this.pool.query("SELECT 1 AS ok");
        if (rows[0]?.ok !== 1) return false;
        await this.pool.query("SELECT token_hash FROM admin_invitations LIMIT 0");
        await this.pool.query("SELECT operation, status, base_version FROM editorial_submissions LIMIT 0");
        const [columns] = await this.pool.query("SHOW COLUMNS FROM editorial_submissions LIKE 'operation'");
        return String(columns[0]?.Type || "").includes("'restore'");
    }

    async transaction(callback) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            const result = await callback(connection);
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async findAdminByEmail(email) {
        const [rows] = await this.pool.execute(
            `SELECT id, public_id, name, email, password_hash, role, active, mfa_secret_encrypted,
                    mfa_enabled, mfa_recovery_codes_json
             FROM admins WHERE email = ? LIMIT 1`,
            [email]
        );
        if (!rows[0]) return null;
        return {
            id: rows[0].id,
            publicId: rows[0].public_id,
            name: rows[0].name,
            email: rows[0].email,
            passwordHash: rows[0].password_hash,
            role: rows[0].role,
            active: Boolean(rows[0].active),
            mfaSecretEncrypted: rows[0].mfa_secret_encrypted || "",
            mfaEnabled: Boolean(rows[0].mfa_enabled),
            recoveryCodeHashes: parseJson(rows[0].mfa_recovery_codes_json, [])
        };
    }

    async getAdminByPublicId(publicId, executor) {
        const connection = executor || this.pool;
        const [rows] = await connection.execute(
            `SELECT a.public_id, a.name, a.email, a.role, a.active, a.mfa_enabled,
                    a.last_login_at, a.created_at, a.password_changed_at,
                    i.public_id AS invitation_public_id, i.expires_at AS invitation_expires_at,
                    i.accepted_at AS invitation_accepted_at, i.revoked_at AS invitation_revoked_at,
                    i.created_at AS invitation_created_at
             FROM admins a
             LEFT JOIN admin_invitations i ON i.id = (
                 SELECT latest.id FROM admin_invitations latest
                 WHERE latest.admin_id = a.id ORDER BY latest.created_at DESC LIMIT 1
             )
             WHERE a.public_id = ? LIMIT 1`,
            [publicId]
        );
        return rows[0] ? adminFromRow(rows[0]) : null;
    }

    async listAdmins() {
        const [rows] = await this.pool.execute(
            `SELECT a.public_id, a.name, a.email, a.role, a.active, a.mfa_enabled,
                    a.last_login_at, a.created_at, a.password_changed_at,
                    i.public_id AS invitation_public_id, i.expires_at AS invitation_expires_at,
                    i.accepted_at AS invitation_accepted_at, i.revoked_at AS invitation_revoked_at,
                    i.created_at AS invitation_created_at
             FROM admins a
             LEFT JOIN admin_invitations i ON i.id = (
                 SELECT latest.id FROM admin_invitations latest
                 WHERE latest.admin_id = a.id ORDER BY latest.created_at DESC LIMIT 1
             )
             ORDER BY a.role = 'owner' DESC, a.active DESC, a.name ASC`
        );
        return rows.map(adminFromRow);
    }

    async createAccessRequest(input) {
        return this.transaction(async (connection) => {
            const [adminRows] = await connection.execute(
                "SELECT id, active FROM admins WHERE email = ? LIMIT 1 FOR UPDATE",
                [input.email]
            );
            if (adminRows[0]?.active) return { stored: false, activeAccount: true };

            const [pendingRows] = await connection.execute(
                `SELECT public_id FROM admin_access_requests
                 WHERE email = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
                [input.email]
            );
            let publicId = pendingRows[0]?.public_id;
            if (publicId) {
                await connection.execute(
                    `UPDATE admin_access_requests
                     SET name = ?, requested_role = ?, reason = ?, updated_at = UTC_TIMESTAMP(3)
                     WHERE public_id = ?`,
                    [input.name, input.requestedRole, input.reason || null, publicId]
                );
            } else {
                publicId = crypto.randomUUID();
                await connection.execute(
                    `INSERT INTO admin_access_requests (public_id, name, email, requested_role, reason)
                     VALUES (?, ?, ?, ?, ?)`,
                    [publicId, input.name, input.email, input.requestedRole, input.reason || null]
                );
            }
            return { stored: true, request: await this.getAccessRequestByPublicId(publicId, connection) };
        });
    }

    async getAccessRequestByPublicId(publicId, executor) {
        const connection = executor || this.pool;
        const [rows] = await connection.execute(
            `SELECT public_id, name, email, requested_role, reason, status, review_note,
                    reviewed_at, created_at, updated_at
             FROM admin_access_requests WHERE public_id = ? LIMIT 1`,
            [publicId]
        );
        return rows[0] ? accessRequestFromRow(rows[0]) : null;
    }

    async listAccessRequests(status) {
        const requestedStatus = ["pending", "approved", "rejected"].includes(status) ? status : "pending";
        const [rows] = await this.pool.execute(
            `SELECT public_id, name, email, requested_role, reason, status, review_note,
                    reviewed_at, created_at, updated_at
             FROM admin_access_requests WHERE status = ?
             ORDER BY created_at ASC LIMIT 500`,
            [requestedStatus]
        );
        return rows.map(accessRequestFromRow);
    }

    async reviewAccessRequest(publicId, status, note, reviewerId) {
        return this.transaction(async (connection) => {
            const [result] = await connection.execute(
                `UPDATE admin_access_requests
                 SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP(3)
                 WHERE public_id = ? AND status = 'pending'`,
                [status, note || null, reviewerId, publicId]
            );
            if (result.affectedRows !== 1) {
                const existing = await this.getAccessRequestByPublicId(publicId, connection);
                if (!existing) throw new AppError(404, "access_request_not_found", "Solicitação de acesso não encontrada.");
                throw new AppError(409, "access_request_already_reviewed", "Esta solicitação de acesso já foi analisada.");
            }
            await this.audit(reviewerId, `access_request_${status}`, "admin_access_request", publicId, { note: note || "" }, connection);
            return this.getAccessRequestByPublicId(publicId, connection);
        });
    }

    async createInvitation(input, invitedBy) {
        return this.transaction(async (connection) => {
            const [existingRows] = await connection.execute(
                "SELECT id, public_id, role, active FROM admins WHERE email = ? LIMIT 1 FOR UPDATE",
                [input.email]
            );
            const existing = existingRows[0];
            if (existing?.active) {
                throw new AppError(409, "staff_already_active", "Já existe uma conta ativa com este e-mail.");
            }
            if (existing?.role === "owner") {
                throw new AppError(409, "owner_invitation_forbidden", "A conta do proprietário não pode ser substituída por um convite.");
            }

            let adminId = existing?.id;
            let publicId = existing?.public_id;
            const role = input.role === "viewer" ? "viewer" : "editor";
            if (existing) {
                await connection.execute(
                    `UPDATE admins SET name = ?, role = ?, active = 0, password_hash = ?,
                     password_changed_at = NULL, mfa_secret_encrypted = NULL, mfa_enabled = 0,
                     mfa_recovery_codes_json = NULL WHERE id = ?`,
                    [input.name, role, input.passwordHash, adminId]
                );
            } else {
                publicId = crypto.randomUUID();
                const [result] = await connection.execute(
                    `INSERT INTO admins (public_id, name, email, password_hash, role, active)
                     VALUES (?, ?, ?, ?, ?, 0)`,
                    [publicId, input.name, input.email, input.passwordHash, role]
                );
                adminId = result.insertId;
            }

            await connection.execute(
                "UPDATE admin_invitations SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(3)) WHERE admin_id = ? AND accepted_at IS NULL",
                [adminId]
            );
            await connection.execute("DELETE FROM admin_sessions WHERE admin_id = ?", [adminId]);
            await connection.execute("DELETE FROM admin_mfa_challenges WHERE admin_id = ?", [adminId]);
            await connection.execute("DELETE FROM password_reset_tokens WHERE admin_id = ?", [adminId]);
            const invitationId = crypto.randomUUID();
            await connection.execute(
                `INSERT INTO admin_invitations (public_id, admin_id, token_hash, invited_by, expires_at)
                 VALUES (?, ?, ?, ?, ?)`,
                [invitationId, adminId, input.tokenHash, invitedBy, input.expiresAt]
            );
            if (input.accessRequestId) {
                const [reviewResult] = await connection.execute(
                    `UPDATE admin_access_requests
                     SET status = 'approved', reviewed_by = ?, reviewed_at = UTC_TIMESTAMP(3)
                     WHERE public_id = ? AND status = 'pending'`,
                    [invitedBy, input.accessRequestId]
                );
                if (reviewResult.affectedRows !== 1) {
                    throw new AppError(409, "access_request_already_reviewed", "Esta solicitação de acesso já foi analisada.");
                }
            }
            await this.audit(invitedBy, "invite", "admin", publicId, { email: input.email, role }, connection);
            return {
                member: await this.getAdminByPublicId(publicId, connection),
                invitation: { id: invitationId, expiresAt: new Date(input.expiresAt).toISOString() }
            };
        });
    }

    async resendInvitation(publicId, input, invitedBy) {
        return this.transaction(async (connection) => {
            const [rows] = await connection.execute(
                `SELECT id, public_id, name, email, role, active, password_changed_at
                 FROM admins WHERE public_id = ? LIMIT 1 FOR UPDATE`,
                [publicId]
            );
            const admin = rows[0];
            if (!admin || admin.role === "owner") {
                throw new AppError(404, "staff_not_found", "Funcionário não encontrado.");
            }
            if (admin.active) {
                throw new AppError(409, "staff_already_active", "Esta conta já está ativa e não precisa de um novo convite.");
            }
            if (admin.password_changed_at) {
                throw new AppError(409, "staff_already_activated", "Esta conta já criou uma senha. Reative o acesso em vez de reenviar o convite.");
            }
            await connection.execute(
                "UPDATE admin_invitations SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(3)) WHERE admin_id = ? AND accepted_at IS NULL",
                [admin.id]
            );
            await connection.execute("DELETE FROM admin_sessions WHERE admin_id = ?", [admin.id]);
            await connection.execute("DELETE FROM admin_mfa_challenges WHERE admin_id = ?", [admin.id]);
            await connection.execute("DELETE FROM password_reset_tokens WHERE admin_id = ?", [admin.id]);
            const invitationId = crypto.randomUUID();
            await connection.execute(
                `INSERT INTO admin_invitations (public_id, admin_id, token_hash, invited_by, expires_at)
                 VALUES (?, ?, ?, ?, ?)`,
                [invitationId, admin.id, input.tokenHash, invitedBy, input.expiresAt]
            );
            await this.audit(invitedBy, "invite_resend", "admin", publicId, { email: admin.email }, connection);
            return {
                member: await this.getAdminByPublicId(publicId, connection),
                invitation: { id: invitationId, expiresAt: new Date(input.expiresAt).toISOString() }
            };
        });
    }

    async findInvitation(tokenHash) {
        const [rows] = await this.pool.execute(
            `SELECT i.id, i.public_id, i.admin_id, i.expires_at, i.accepted_at, i.revoked_at,
                    a.public_id AS admin_public_id, a.name, a.email, a.role, a.active
             FROM admin_invitations i INNER JOIN admins a ON a.id = i.admin_id
             WHERE i.token_hash = ? LIMIT 1`,
            [tokenHash]
        );
        if (!rows[0]) return null;
        const row = rows[0];
        return {
            id: row.public_id,
            adminId: row.admin_id,
            adminPublicId: row.admin_public_id,
            name: row.name,
            email: row.email,
            role: row.role,
            active: Boolean(row.active),
            expiresAt: iso(row.expires_at),
            acceptedAt: iso(row.accepted_at),
            revokedAt: iso(row.revoked_at),
            valid: !row.active && !row.accepted_at && !row.revoked_at && new Date(row.expires_at).getTime() > Date.now()
        };
    }

    async acceptInvitation(tokenHash, passwordHash) {
        return this.transaction(async (connection) => {
            const [rows] = await connection.execute(
                `SELECT i.id, i.admin_id, i.expires_at, i.accepted_at, i.revoked_at,
                        a.public_id, a.name, a.email, a.role, a.active
                 FROM admin_invitations i INNER JOIN admins a ON a.id = i.admin_id
                 WHERE i.token_hash = ? LIMIT 1 FOR UPDATE`,
                [tokenHash]
            );
            const invitation = rows[0];
            if (!invitation || invitation.active || invitation.accepted_at || invitation.revoked_at
                || new Date(invitation.expires_at).getTime() <= Date.now()) {
                throw new AppError(400, "invitation_invalid", "O convite é inválido, expirou ou já foi utilizado.");
            }
            await connection.execute(
                `UPDATE admins SET password_hash = ?, active = 1, password_changed_at = UTC_TIMESTAMP(3),
                 mfa_secret_encrypted = NULL, mfa_enabled = 0, mfa_recovery_codes_json = NULL
                 WHERE id = ?`,
                [passwordHash, invitation.admin_id]
            );
            await connection.execute(
                "UPDATE admin_invitations SET accepted_at = UTC_TIMESTAMP(3) WHERE id = ?",
                [invitation.id]
            );
            await connection.execute("DELETE FROM admin_sessions WHERE admin_id = ?", [invitation.admin_id]);
            await connection.execute("DELETE FROM admin_mfa_challenges WHERE admin_id = ?", [invitation.admin_id]);
            await connection.execute("DELETE FROM password_reset_tokens WHERE admin_id = ?", [invitation.admin_id]);
            await connection.execute(
                `UPDATE admin_invitations SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(3))
                 WHERE admin_id = ? AND id <> ? AND accepted_at IS NULL`,
                [invitation.admin_id, invitation.id]
            );
            await this.audit(invitation.admin_id, "invitation_accept", "admin", invitation.public_id, null, connection);
            return {
                id: invitation.public_id,
                name: invitation.name,
                email: invitation.email,
                role: invitation.role,
                active: true
            };
        });
    }

    async updateAdmin(publicId, changes, actorId) {
        return this.transaction(async (connection) => {
            const [rows] = await connection.execute(
                "SELECT id, public_id, role, active, email, password_changed_at FROM admins WHERE public_id = ? LIMIT 1 FOR UPDATE",
                [publicId]
            );
            const admin = rows[0];
            if (!admin || admin.role === "owner") {
                throw new AppError(404, "staff_not_found", "Funcionário não encontrado.");
            }
            const nextActive = typeof changes.active === "boolean" ? changes.active : Boolean(admin.active);
            const nextRole = ["editor", "viewer"].includes(changes.role) ? changes.role : admin.role;
            if (nextActive && !admin.password_changed_at) {
                throw new AppError(409, "staff_invitation_pending", "Reenvie o convite para o funcionário criar a senha antes de ativar a conta.");
            }
            await connection.execute("UPDATE admins SET active = ?, role = ? WHERE id = ?", [nextActive ? 1 : 0, nextRole, admin.id]);
            await connection.execute("DELETE FROM admin_sessions WHERE admin_id = ?", [admin.id]);
            await connection.execute("DELETE FROM admin_mfa_challenges WHERE admin_id = ?", [admin.id]);
            await connection.execute("DELETE FROM password_reset_tokens WHERE admin_id = ?", [admin.id]);
            if (changes.active === false) {
                await connection.execute(
                    "UPDATE admin_invitations SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(3)) WHERE admin_id = ? AND accepted_at IS NULL",
                    [admin.id]
                );
            } else if (changes.active === true) {
                await connection.execute(
                    `UPDATE admin_invitations SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(3))
                     WHERE admin_id = ? AND accepted_at IS NULL`,
                    [admin.id]
                );
            }
            const action = nextRole !== admin.role
                ? "role_change"
                : (nextActive ? "activate" : "deactivate");
            await this.audit(actorId, action, "admin", publicId, { email: admin.email, role: nextRole, active: nextActive }, connection);
            return this.getAdminByPublicId(publicId, connection);
        });
    }

    async createSession(adminId, tokenHash, expiresAt, context) {
        const metadata = context || {};
        await this.transaction(async (connection) => {
            await connection.execute("DELETE FROM admin_sessions WHERE expires_at <= UTC_TIMESTAMP(3)");
            await connection.execute(
                `INSERT INTO admin_sessions (public_id, admin_id, token_hash, ip_hash, user_agent, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [crypto.randomUUID(), adminId, tokenHash, metadata.ipHash || null, metadata.userAgent || null, expiresAt]
            );
            await connection.execute("UPDATE admins SET last_login_at = UTC_TIMESTAMP(3) WHERE id = ?", [adminId]);
        });
    }

    async findSession(tokenHash) {
        const [rows] = await this.pool.execute(
            `SELECT s.admin_id, s.expires_at, a.public_id, a.name, a.email, a.role, a.active, a.mfa_enabled
             FROM admin_sessions s
             INNER JOIN admins a ON a.id = s.admin_id
             WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP(3)
             LIMIT 1`,
            [tokenHash]
        );
        if (!rows[0]) return null;
        return {
            adminId: rows[0].admin_id,
            expiresAt: rows[0].expires_at,
            publicId: rows[0].public_id,
            name: rows[0].name,
            email: rows[0].email,
            role: rows[0].role,
            active: Boolean(rows[0].active),
            mfaEnabled: Boolean(rows[0].mfa_enabled)
        };
    }

    async touchSession(tokenHash) {
        await this.pool.execute(
            "UPDATE admin_sessions SET last_seen_at = UTC_TIMESTAMP(3) WHERE token_hash = ? AND last_seen_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 5 MINUTE)",
            [tokenHash]
        );
    }

    async deleteSession(tokenHash) {
        await this.pool.execute("DELETE FROM admin_sessions WHERE token_hash = ?", [tokenHash]);
    }

    async listSessions(adminId, currentTokenHash) {
        const [rows] = await this.pool.execute(
            `SELECT public_id, token_hash, user_agent, expires_at, last_seen_at, created_at
             FROM admin_sessions
             WHERE admin_id = ? AND expires_at > UTC_TIMESTAMP(3)
             ORDER BY last_seen_at DESC`,
            [adminId]
        );
        return rows.map((row) => ({
            id: row.public_id,
            userAgent: row.user_agent || "Dispositivo não identificado",
            current: row.token_hash === currentTokenHash,
            expiresAt: iso(row.expires_at),
            lastSeenAt: iso(row.last_seen_at),
            createdAt: iso(row.created_at)
        }));
    }

    async deleteOtherSessions(adminId, currentTokenHash) {
        const [result] = await this.pool.execute(
            "DELETE FROM admin_sessions WHERE admin_id = ? AND token_hash <> ?",
            [adminId, currentTokenHash]
        );
        return result.affectedRows;
    }

    async getAdminSecurity(adminId) {
        const [rows] = await this.pool.execute(
            `SELECT id, public_id, name, email, password_hash, role, active, mfa_secret_encrypted,
                    mfa_enabled, mfa_recovery_codes_json, password_changed_at, last_login_at
             FROM admins WHERE id = ? LIMIT 1`,
            [adminId]
        );
        if (!rows[0]) return null;
        return {
            id: rows[0].id,
            publicId: rows[0].public_id,
            name: rows[0].name,
            email: rows[0].email,
            passwordHash: rows[0].password_hash,
            role: rows[0].role,
            active: Boolean(rows[0].active),
            mfaSecretEncrypted: rows[0].mfa_secret_encrypted || "",
            mfaEnabled: Boolean(rows[0].mfa_enabled),
            recoveryCodeHashes: parseJson(rows[0].mfa_recovery_codes_json, []),
            passwordChangedAt: iso(rows[0].password_changed_at),
            lastLoginAt: iso(rows[0].last_login_at)
        };
    }

    async updatePassword(adminId, passwordHash) {
        await this.transaction(async (connection) => {
            await connection.execute(
                "UPDATE admins SET password_hash = ?, password_changed_at = UTC_TIMESTAMP(3) WHERE id = ?",
                [passwordHash, adminId]
            );
            await connection.execute("DELETE FROM admin_sessions WHERE admin_id = ?", [adminId]);
            await connection.execute("DELETE FROM password_reset_tokens WHERE admin_id = ?", [adminId]);
            await connection.execute("DELETE FROM admin_mfa_challenges WHERE admin_id = ?", [adminId]);
            await this.audit(adminId, "password_change", "admin", null, null, connection);
        });
    }

    async storePendingMfaSecret(adminId, encryptedSecret) {
        await this.pool.execute(
            `UPDATE admins SET mfa_secret_encrypted = ?, mfa_enabled = 0, mfa_recovery_codes_json = NULL
             WHERE id = ?`,
            [encryptedSecret, adminId]
        );
    }

    async enableMfa(adminId, recoveryCodeHashes) {
        await this.transaction(async (connection) => {
            await connection.execute(
                `UPDATE admins SET mfa_enabled = 1, mfa_recovery_codes_json = ?
                 WHERE id = ? AND mfa_secret_encrypted IS NOT NULL`,
                [JSON.stringify(recoveryCodeHashes), adminId]
            );
            await this.audit(adminId, "mfa_enable", "admin", null, null, connection);
        });
    }

    async disableMfa(adminId) {
        await this.transaction(async (connection) => {
            await connection.execute(
                `UPDATE admins SET mfa_secret_encrypted = NULL, mfa_enabled = 0, mfa_recovery_codes_json = NULL
                 WHERE id = ?`,
                [adminId]
            );
            await connection.execute("DELETE FROM admin_mfa_challenges WHERE admin_id = ?", [adminId]);
            await this.audit(adminId, "mfa_disable", "admin", null, null, connection);
        });
    }

    async consumeRecoveryCode(adminId, codeHash) {
        return this.transaction(async (connection) => {
            const [rows] = await connection.execute(
                "SELECT mfa_recovery_codes_json FROM admins WHERE id = ? FOR UPDATE",
                [adminId]
            );
            const hashes = parseJson(rows[0]?.mfa_recovery_codes_json, []);
            const index = hashes.indexOf(codeHash);
            if (index < 0) return false;
            hashes.splice(index, 1);
            await connection.execute(
                "UPDATE admins SET mfa_recovery_codes_json = ? WHERE id = ?",
                [JSON.stringify(hashes), adminId]
            );
            return true;
        });
    }

    async createMfaChallenge(adminId, tokenHash, remember, expiresAt) {
        await this.transaction(async (connection) => {
            await connection.execute("DELETE FROM admin_mfa_challenges WHERE expires_at <= UTC_TIMESTAMP(3) OR consumed_at IS NOT NULL");
            await connection.execute("DELETE FROM admin_mfa_challenges WHERE admin_id = ?", [adminId]);
            await connection.execute(
                `INSERT INTO admin_mfa_challenges (admin_id, token_hash, remember_session, expires_at)
                 VALUES (?, ?, ?, ?)`,
                [adminId, tokenHash, remember ? 1 : 0, expiresAt]
            );
        });
    }

    async findMfaChallenge(tokenHash) {
        const [rows] = await this.pool.execute(
            `SELECT c.admin_id, c.remember_session, c.attempts, c.expires_at,
                    a.public_id, a.name, a.email, a.role, a.active, a.mfa_secret_encrypted,
                    a.mfa_enabled, a.mfa_recovery_codes_json
             FROM admin_mfa_challenges c
             INNER JOIN admins a ON a.id = c.admin_id
             WHERE c.token_hash = ? AND c.consumed_at IS NULL AND c.expires_at > UTC_TIMESTAMP(3)
             LIMIT 1`,
            [tokenHash]
        );
        if (!rows[0]) return null;
        return {
            adminId: rows[0].admin_id,
            remember: Boolean(rows[0].remember_session),
            attempts: Number(rows[0].attempts || 0),
            expiresAt: iso(rows[0].expires_at),
            publicId: rows[0].public_id,
            name: rows[0].name,
            email: rows[0].email,
            role: rows[0].role,
            active: Boolean(rows[0].active),
            mfaSecretEncrypted: rows[0].mfa_secret_encrypted || "",
            mfaEnabled: Boolean(rows[0].mfa_enabled),
            recoveryCodeHashes: parseJson(rows[0].mfa_recovery_codes_json, [])
        };
    }

    async failMfaChallenge(tokenHash) {
        await this.pool.execute(
            `UPDATE admin_mfa_challenges SET attempts = attempts + 1,
             consumed_at = CASE WHEN attempts + 1 >= 5 THEN UTC_TIMESTAMP(3) ELSE consumed_at END
             WHERE token_hash = ?`,
            [tokenHash]
        );
    }

    async consumeMfaChallenge(tokenHash) {
        await this.pool.execute(
            "UPDATE admin_mfa_challenges SET consumed_at = UTC_TIMESTAMP(3) WHERE token_hash = ?",
            [tokenHash]
        );
    }

    async createPasswordReset(adminId, tokenHash, expiresAt) {
        await this.transaction(async (connection) => {
            await connection.execute("DELETE FROM password_reset_tokens WHERE expires_at <= UTC_TIMESTAMP(3) OR consumed_at IS NOT NULL");
            await connection.execute("DELETE FROM password_reset_tokens WHERE admin_id = ?", [adminId]);
            await connection.execute(
                "INSERT INTO password_reset_tokens (admin_id, token_hash, expires_at) VALUES (?, ?, ?)",
                [adminId, tokenHash, expiresAt]
            );
        });
    }

    async findPasswordReset(tokenHash) {
        const [rows] = await this.pool.execute(
            `SELECT r.admin_id, r.expires_at, a.email, a.active
             FROM password_reset_tokens r
             INNER JOIN admins a ON a.id = r.admin_id
             WHERE r.token_hash = ? AND r.consumed_at IS NULL AND r.expires_at > UTC_TIMESTAMP(3)
             LIMIT 1`,
            [tokenHash]
        );
        return rows[0] ? {
            adminId: rows[0].admin_id,
            email: rows[0].email,
            active: Boolean(rows[0].active),
            expiresAt: iso(rows[0].expires_at)
        } : null;
    }

    async recordSecurityEvent(event) {
        await this.transaction(async (connection) => {
            await connection.execute(
                `INSERT INTO security_events
                 (event_type, outcome, admin_id, subject_hash, ip_hash, user_agent_hash, request_id, details_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    event.type, event.outcome || "info", event.adminId || null, event.subjectHash || null,
                    event.ipHash || null, event.userAgentHash || null, event.requestId || null,
                    event.details ? JSON.stringify(event.details) : null
                ]
            );
            await connection.execute(
                "DELETE FROM security_events WHERE created_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 400 DAY)"
            );
        });
    }

    async listSecurityEvents(adminId, limit) {
        const size = Math.max(1, Math.min(100, Number(limit) || 30));
        const [rows] = await this.pool.execute(
            `SELECT event_type, outcome, request_id, details_json, created_at
             FROM security_events
             WHERE admin_id = ? OR admin_id IS NULL
             ORDER BY created_at DESC LIMIT ?`,
            [adminId, size]
        );
        return rows.map((row) => ({
            type: row.event_type,
            outcome: row.outcome,
            requestId: row.request_id || "",
            details: parseJson(row.details_json, {}),
            createdAt: iso(row.created_at)
        }));
    }

    async audit(adminId, action, entityType, entityUid, details, connection) {
        const executor = connection || this.pool;
        await executor.execute(
            "INSERT INTO audit_logs (admin_id, action, entity_type, entity_uid, details_json) VALUES (?, ?, ?, ?, ?)",
            [adminId || null, action, entityType, entityUid || null, details ? JSON.stringify(details) : null]
        );
    }

    async getContentSubmission(publicId, executor, lock) {
        const connection = executor || this.pool;
        const [rows] = await connection.execute(
            `${submissionSelect} WHERE s.public_id = ? LIMIT 1${lock ? " FOR UPDATE" : ""}`,
            [publicId]
        );
        return rows[0] ? reviewFromRow(rows[0]) : null;
    }

    async listContentSubmissions(options) {
        const settings = options || {};
        const where = [];
        const values = [];
        if (settings.status && settings.status !== "all") {
            if (Array.isArray(settings.status)) {
                where.push(`s.status IN (${settings.status.map(() => "?").join(", ")})`);
                values.push(...settings.status);
            } else {
                where.push("s.status = ?");
                values.push(settings.status);
            }
        }
        if (settings.submittedBy) {
            where.push("s.submitted_by = ?");
            values.push(settings.submittedBy);
        }
        if (settings.entityType) {
            where.push("s.entity_type = ?");
            values.push(settings.entityType);
        }
        const size = Math.max(1, Math.min(500, Number(settings.limit) || 200));
        const [rows] = await this.pool.execute(
            `${submissionSelect}${where.length ? ` WHERE ${where.join(" AND ")}` : ""}
             ORDER BY COALESCE(s.submitted_at, s.updated_at) DESC, s.updated_at DESC LIMIT ?`,
            [...values, size]
        );
        return rows.map(reviewFromRow);
    }

    async findContentTarget(entityType, entityUid, entityKey, executor, lock) {
        const connection = executor || this.pool;
        const table = entityType === "product" ? "products" : "articles";
        const lookupByUid = Boolean(entityUid);
        const [rows] = await connection.execute(
            `SELECT * FROM ${table} WHERE ${lookupByUid ? "uid = ?" : "slug = ?"}
             LIMIT 1${lock ? " FOR UPDATE" : ""}`,
            [lookupByUid ? entityUid : entityKey]
        );
        return rows[0] || null;
    }

    async assertEditorialKeyAvailable(entityType, entityKey, entityUid, executor) {
        const connection = executor || this.pool;
        const [rows] = await connection.execute(
            `SELECT public_id FROM editorial_submissions
             WHERE entity_type = ? AND entity_key = ? AND status = 'pending'
               AND (entity_uid IS NULL OR entity_uid <> ?)
             LIMIT 1 FOR UPDATE`,
            [entityType, entityKey, entityUid || ""]
        );
        if (rows[0]) {
            throw new AppError(409, "editorial_key_reserved", "Este identificador está reservado por uma publicação que aguarda análise.");
        }
    }

    async createContentSubmission(input, adminId) {
        return this.transaction(async (connection) => {
            const entityKey = input.entityType === "product" ? input.payload.id : input.payload.slug;
            const requestedUid = String(input.entityUid || "").startsWith("submission:") ? "" : String(input.entityUid || "");
            const intent = input.intent === "create" ? "create" : "update";
            const target = intent === "update" && requestedUid
                ? await this.findContentTarget(input.entityType, requestedUid, entityKey, connection, true)
                : null;
            const keyTarget = await this.findContentTarget(input.entityType, "", entityKey, connection, true);
            if (keyTarget && (!target || target.uid !== keyTarget.uid)) {
                throw new AppError(409, "review_slug_conflict", "Outro conteúdo já usa este identificador.");
            }
            if (intent === "update" && requestedUid && !target) {
                throw new AppError(404, "review_target_not_found", "O conteúdo original não foi encontrado.");
            }
            if (intent === "update" && !requestedUid && !input.submissionId) {
                throw new AppError(404, "review_target_not_found", "O conteúdo original não foi encontrado.");
            }
            const entityUid = target?.uid || null;
            const operation = target ? (target.deleted_at ? "restore" : "update") : "create";
            const status = input.status === "pending" ? "pending" : "draft";
            let existingRows;
            if (input.submissionId) {
                [existingRows] = await connection.execute(
                    `SELECT * FROM editorial_submissions
                     WHERE public_id = ? AND submitted_by = ? AND entity_type = ? LIMIT 1 FOR UPDATE`,
                    [input.submissionId, adminId, input.entityType]
                );
            } else {
                [existingRows] = await connection.execute(
                    `SELECT * FROM editorial_submissions
                     WHERE submitted_by = ? AND entity_type = ?
                       AND status IN ('draft', 'pending', 'rejected')
                       AND ((? IS NOT NULL AND entity_uid = ?) OR (? IS NULL AND entity_uid IS NULL AND entity_key = ?))
                     ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
                    [adminId, input.entityType, entityUid, entityUid, entityUid, entityKey]
                );
            }
            const existing = existingRows[0];
            const [competingRows] = await connection.execute(
                `SELECT public_id FROM editorial_submissions
                 WHERE entity_type = ? AND entity_key = ? AND public_id <> ?
                   AND ((submitted_by = ? AND status IN ('draft', 'pending', 'rejected'))
                     OR (submitted_by <> ? AND status = 'pending'))
                 LIMIT 1 FOR UPDATE`,
                [input.entityType, entityKey, existing?.public_id || "", adminId, adminId]
            );
            if (competingRows[0]) {
                throw new AppError(409, "submission_key_in_progress", "Já existe outra proposta ativa com este identificador.");
            }
            if (existing && ((existing.entity_uid && existing.entity_uid !== entityUid)
                || (!existing.entity_uid && requestedUid))) {
                throw new AppError(409, "submission_target_mismatch", "Esta proposta pertence a outro conteúdo.");
            }
            if (existing?.status === "pending") {
                throw new AppError(409, "submission_pending", "Esta publicação já está aguardando análise e não pode ser alterada.");
            }
            if (existing && !["draft", "rejected"].includes(existing.status)) {
                throw new AppError(409, "submission_closed", "Esta solicitação editorial já foi encerrada.");
            }
            if (!existing) {
                const [countRows] = await connection.execute(
                    `SELECT COUNT(*) AS total FROM editorial_submissions
                     WHERE submitted_by = ? AND status IN ('draft', 'pending', 'rejected')`,
                    [adminId]
                );
                if (Number(countRows[0]?.total || 0) >= 200) {
                    throw new AppError(429, "submission_limit", "Descarte propostas antigas antes de criar novos envios.");
                }
            }

            let publicId = existing?.public_id;
            const baseVersion = existing
                ? existing.base_version
                : (Number.isInteger(input.baseVersion) ? input.baseVersion : (target ? Number(target.version) : null));
            if (existing) {
                await connection.execute(
                    `UPDATE editorial_submissions
                     SET operation = ?, entity_uid = ?, entity_key = ?, product_type = ?, payload_json = ?,
                         base_version = ?, status = ?, reviewed_by = NULL, review_note = NULL, reviewed_at = NULL,
                         submitted_at = CASE WHEN ? = 'pending' THEN UTC_TIMESTAMP(3) ELSE NULL END
                     WHERE id = ?`,
                    [
                        operation, entityUid, entityKey, input.entityType === "product" ? input.productType : null,
                        JSON.stringify(input.payload), baseVersion, status, status, existing.id
                    ]
                );
            } else {
                publicId = crypto.randomUUID();
                await connection.execute(
                    `INSERT INTO editorial_submissions
                     (public_id, entity_type, operation, entity_uid, entity_key, product_type, payload_json,
                      base_version, status, submitted_by, submitted_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'pending' THEN UTC_TIMESTAMP(3) ELSE NULL END)`,
                    [
                        publicId, input.entityType, operation, entityUid, entityKey,
                        input.entityType === "product" ? input.productType : null,
                        JSON.stringify(input.payload), baseVersion, status, adminId, status
                    ]
                );
            }
            await this.audit(
                adminId,
                status === "pending" ? "submit_review" : "save_draft",
                "editorial_submission",
                publicId,
                { entityType: input.entityType, operation, entityUid, entityKey },
                connection
            );
            return this.getContentSubmission(publicId, connection, false);
        });
    }

    async rejectContentSubmission(publicId, reviewerId, note) {
        return this.transaction(async (connection) => {
            const review = await this.getContentSubmission(publicId, connection, true);
            if (!review) throw new AppError(404, "review_not_found", "Publicação para análise não encontrada.");
            if (review.status !== "pending") {
                throw new AppError(409, "review_already_decided", "Esta publicação já foi analisada ou cancelada.");
            }
            await connection.execute(
                `UPDATE editorial_submissions SET status = 'rejected', reviewed_by = ?, review_note = ?,
                 reviewed_at = UTC_TIMESTAMP(3) WHERE public_id = ?`,
                [reviewerId, note, publicId]
            );
            await this.audit(reviewerId, "reject", "editorial_submission", publicId, {
                entityType: review.entityType,
                entityUid: review.entityUid,
                submittedBy: review.submittedBy.id
            }, connection);
            return this.getContentSubmission(publicId, connection, false);
        });
    }

    async approveContentSubmission(publicId, reviewerId, validatedPayload, note) {
        try {
            return await this.transaction(async (connection) => {
                const review = await this.getContentSubmission(publicId, connection, true);
                if (!review) throw new AppError(404, "review_not_found", "Publicação para análise não encontrada.");
                if (review.status !== "pending") {
                    throw new AppError(409, "review_already_decided", "Esta publicação já foi analisada ou cancelada.");
                }
                const [submissionRows] = await connection.execute(
                    "SELECT submitted_by FROM editorial_submissions WHERE public_id = ? LIMIT 1",
                    [publicId]
                );
                const submittedById = submissionRows[0]?.submitted_by;
                if (!submittedById) throw new AppError(409, "review_submitter_missing", "O autor desta proposta não está mais disponível.");
                const entityKey = review.entityType === "product" ? review.payload.id : review.payload.slug;
                const target = await this.findContentTarget(
                    review.entityType,
                    review.entityUid || "",
                    entityKey,
                    connection,
                    true
                );
                if (review.operation === "update") {
                    if (!target || target.uid !== review.entityUid) {
                        throw new AppError(409, "review_target_changed", "O conteúdo original não está mais disponível para esta aprovação.");
                    }
                    if (target.deleted_at) {
                        throw new AppError(409, "review_target_deleted", "O conteúdo original foi excluído depois do envio e não pode ser restaurado por esta aprovação.");
                    }
                    if (Number(target.version) !== Number(review.baseVersion)) {
                        throw new AppError(409, "review_version_conflict", "O conteúdo foi alterado depois do envio. Revise a versão mais recente antes de aprovar.");
                    }
                } else if (review.operation === "restore") {
                    if (!target || target.uid !== review.entityUid || !target.deleted_at) {
                        throw new AppError(409, "review_target_changed", "O item arquivado mudou depois do envio. Refaça a solicitação antes de aprovar.");
                    }
                    if (Number(target.version) !== Number(review.baseVersion)) {
                        throw new AppError(409, "review_version_conflict", "O item arquivado foi alterado depois do envio. Refaça a solicitação antes de aprovar.");
                    }
                } else if (target) {
                    throw new AppError(409, "review_slug_conflict", "Já existe conteúdo publicado com este identificador.");
                }

                const payload = { ...(validatedPayload || review.payload) };
                const uid = target?.uid || crypto.randomUUID();
                const adminMetadata = { ...(payload._admin || {}) };
                delete adminMetadata.submissionId;
                delete adminMetadata.submissionStatus;
                delete adminMetadata.reviewNote;
                delete adminMetadata.reviewedBy;
                delete adminMetadata.version;
                delete adminMetadata.createdAt;
                delete adminMetadata.updatedAt;
                adminMetadata.uid = uid;
                adminMetadata.status = "published";
                adminMetadata.visible = adminMetadata.visible !== false;
                payload._admin = adminMetadata;

                let product = null;
                let article = null;
                if (review.entityType === "product") {
                    const values = [
                        payload.id,
                        review.productType,
                        payload.modelo,
                        payload.categoria || "",
                        "published",
                        adminMetadata.visible ? 1 : 0,
                        isProductFeatured(payload) ? 1 : 0,
                        JSON.stringify(payload),
                        reviewerId
                    ];
                    if (target) {
                        await connection.execute(
                            `UPDATE products SET slug = ?, product_type = ?, model = ?, category = ?, publication_status = ?,
                             visible = ?, featured = ?, data_json = ?, updated_by = ?, version = version + 1,
                             published_at = COALESCE(published_at, UTC_TIMESTAMP(3)), deleted_at = NULL WHERE uid = ?`,
                            [...values, uid]
                        );
                        await this.audit(reviewerId, review.operation === "restore" ? "restore" : "update", "product", uid, { slug: payload.id, status: "published" }, connection);
                    } else {
                        await connection.execute(
                            `INSERT INTO products
                             (uid, slug, product_type, model, category, publication_status, visible, featured,
                              data_json, created_by, updated_by, published_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
                            [uid, ...values.slice(0, -1), submittedById, reviewerId]
                        );
                        await this.audit(reviewerId, "create", "product", uid, { slug: payload.id, status: "published" }, connection);
                    }
                    product = (await this.getProductByUid(uid, connection)).data;
                } else {
                    const values = [
                        payload.slug,
                        payload.title,
                        payload.category || "",
                        payload.author || "Equipe Brutusmaq",
                        "published",
                        adminMetadata.visible ? 1 : 0,
                        payload.popular ? 1 : 0,
                        JSON.stringify(payload),
                        reviewerId
                    ];
                    if (target) {
                        await connection.execute(
                            `UPDATE articles SET slug = ?, title = ?, category = ?, author = ?, publication_status = ?,
                             visible = ?, popular = ?, data_json = ?, updated_by = ?, version = version + 1,
                             published_at = COALESCE(published_at, UTC_TIMESTAMP(3)), deleted_at = NULL WHERE uid = ?`,
                            [...values, uid]
                        );
                        await this.audit(reviewerId, review.operation === "restore" ? "restore" : "update", "article", uid, { slug: payload.slug, status: "published" }, connection);
                    } else {
                        await connection.execute(
                            `INSERT INTO articles
                             (uid, slug, title, category, author, publication_status, visible, popular,
                              data_json, created_by, updated_by, published_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
                            [uid, ...values.slice(0, -1), submittedById, reviewerId]
                        );
                        await this.audit(reviewerId, "create", "article", uid, { slug: payload.slug, status: "published" }, connection);
                    }
                    article = (await this.getArticleByUid(uid, connection)).data;
                }

                await connection.execute(
                    `UPDATE editorial_submissions SET status = 'approved', entity_uid = ?, reviewed_by = ?,
                     review_note = ?, reviewed_at = UTC_TIMESTAMP(3) WHERE public_id = ?`,
                    [uid, reviewerId, note || null, publicId]
                );
                await this.audit(reviewerId, "approve", "editorial_submission", publicId, {
                    entityType: review.entityType,
                    entityUid: uid,
                    submittedBy: review.submittedBy.id
                }, connection);
                return {
                    review: await this.getContentSubmission(publicId, connection, false),
                    ...(product ? { product } : { article })
                };
            });
        } catch (error) {
            if (error?.code === "ER_DUP_ENTRY") {
                throw new AppError(409, "review_slug_conflict", "Já existe conteúdo com este identificador.");
            }
            throw error;
        }
    }

    async cancelContentSubmission(identifier, adminId) {
        return this.transaction(async (connection) => {
            const publicId = String(identifier || "").replace(/^submission:/, "");
            const [rows] = await connection.execute(
                `SELECT public_id, entity_type, status FROM editorial_submissions
                 WHERE submitted_by = ? AND public_id = ?
                   AND status IN ('draft', 'pending', 'rejected')
                 LIMIT 1 FOR UPDATE`,
                [adminId, publicId]
            );
            const submission = rows[0];
            if (!submission) throw new AppError(404, "submission_not_found", "Rascunho ou publicação pendente não encontrado.");
            await connection.execute(
                `UPDATE editorial_submissions SET status = 'cancelled', review_note = NULL,
                 reviewed_by = NULL, reviewed_at = NULL WHERE public_id = ?`,
                [submission.public_id]
            );
            await this.audit(adminId, "cancel", "editorial_submission", submission.public_id, {
                entityType: submission.entity_type
            }, connection);
            return this.getContentSubmission(submission.public_id, connection, false);
        });
    }

    async listProducts(options) {
        const settings = options || {};
        const where = ["deleted_at IS NULL"];
        const values = [];
        if (settings.publicOnly) {
            where.push("publication_status = 'published'", "visible = 1");
        }
        const [rows] = await this.pool.execute(
            `SELECT * FROM products WHERE ${where.join(" AND ")}
             ORDER BY featured DESC, updated_at DESC, model ASC`,
            values
        );
        return rows.map((row) => ({ type: row.product_type, data: productFromRow(row) }));
    }

    async getPublicProduct(slug) {
        const [rows] = await this.pool.execute(
            `SELECT * FROM products
             WHERE slug = ? AND publication_status = 'published' AND visible = 1 AND deleted_at IS NULL
             LIMIT 1`,
            [slug]
        );
        return rows[0] ? { type: rows[0].product_type, data: productFromRow(rows[0]) } : null;
    }

    async getProductByUid(uid, connection) {
        const executor = connection || this.pool;
        const [rows] = await executor.execute("SELECT * FROM products WHERE uid = ? LIMIT 1", [uid]);
        return rows[0] ? { type: rows[0].product_type, data: productFromRow(rows[0]), deletedAt: rows[0].deleted_at } : null;
    }

    async getProductBySlug(slug, connection) {
        const executor = connection || this.pool;
        const [rows] = await executor.execute("SELECT * FROM products WHERE slug = ? LIMIT 1", [slug]);
        return rows[0] ? { type: rows[0].product_type, data: productFromRow(rows[0]), deletedAt: rows[0].deleted_at } : null;
    }

    async saveProduct(type, product, adminId, originalUid) {
        try {
            return await this.transaction(async (connection) => {
                let existing = originalUid ? await this.getProductByUid(originalUid, connection) : null;
                if (!originalUid) {
                    const matchingSlug = await this.getProductBySlug(product.id, connection);
                    if (matchingSlug && !matchingSlug.deletedAt) {
                        throw new AppError(409, "product_already_exists", "Já existe um produto com este identificador.");
                    }
                    existing = matchingSlug;
                }
                const uid = existing?.data?._admin?.uid || product._admin?.uid || crypto.randomUUID();
                await this.assertEditorialKeyAvailable("product", product.id, uid, connection);
                const status = product._admin?.status || "draft";
                const visible = product._admin?.visible !== false;
                const stored = {
                    ...product,
                    _admin: { ...(product._admin || {}), uid, status, visible }
                };
                const values = [
                    product.id,
                    type,
                    product.modelo,
                    product.categoria || "",
                    status,
                    visible ? 1 : 0,
                    isProductFeatured(product) ? 1 : 0,
                    JSON.stringify(stored),
                    adminId
                ];

                if (existing) {
                    await connection.execute(
                        `UPDATE products SET slug = ?, product_type = ?, model = ?, category = ?, publication_status = ?,
                         visible = ?, featured = ?, data_json = ?, updated_by = ?, version = version + 1,
                         published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, UTC_TIMESTAMP(3)) ELSE published_at END,
                         deleted_at = NULL WHERE uid = ?`,
                        [...values, status, uid]
                    );
                    await this.audit(adminId, "update", "product", uid, { slug: product.id, status }, connection);
                } else {
                    await connection.execute(
                        `INSERT INTO products
                         (uid, slug, product_type, model, category, publication_status, visible, featured, data_json, created_by, updated_by, published_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN UTC_TIMESTAMP(3) ELSE NULL END)`,
                        [uid, ...values, adminId, status]
                    );
                    await this.audit(adminId, "create", "product", uid, { slug: product.id, status }, connection);
                }
                return (await this.getProductByUid(uid, connection)).data;
            });
        } catch (error) {
            throw duplicateError(error, "product");
        }
    }

    async deleteProduct(uid, adminId) {
        return this.transaction(async (connection) => {
            const existing = await this.getProductByUid(uid, connection);
            if (!existing || existing.deletedAt) throw new AppError(404, "product_not_found", "Produto não encontrado.");
            await connection.execute(
                "UPDATE products SET deleted_at = UTC_TIMESTAMP(3), updated_by = ?, version = version + 1 WHERE uid = ?",
                [adminId, uid]
            );
            await this.audit(adminId, "delete", "product", uid, { slug: existing.data.id }, connection);
            return existing.data;
        });
    }

    async restoreProduct(uid, adminId) {
        return this.transaction(async (connection) => {
            const existing = await this.getProductByUid(uid, connection);
            if (!existing) throw new AppError(404, "product_not_found", "Produto não encontrado.");
            await connection.execute(
                "UPDATE products SET deleted_at = NULL, updated_by = ?, version = version + 1 WHERE uid = ?",
                [adminId, uid]
            );
            await this.audit(adminId, "restore", "product", uid, { slug: existing.data.id }, connection);
            return (await this.getProductByUid(uid, connection)).data;
        });
    }

    async replaceProducts(catalog, adminId) {
        const items = [
            ...catalog.novos.map((data) => ({ type: "new", data })),
            ...catalog.usados.map((data) => ({ type: "used", data }))
        ];
        try {
            return await this.transaction(async (connection) => {
                const [pendingRows] = await connection.execute(
                    "SELECT COUNT(*) AS total FROM editorial_submissions WHERE entity_type = 'product' AND status = 'pending'"
                );
                if (Number(pendingRows[0]?.total || 0) > 0) {
                    throw new AppError(409, "editorial_queue_not_empty", "Analise as publicações de produtos pendentes antes de substituir o catálogo.");
                }
                const activeUids = [];
                for (const item of items) {
                    const [matchingRows] = await connection.execute(
                        "SELECT uid FROM products WHERE uid = ? OR slug = ? ORDER BY uid = ? DESC LIMIT 1",
                        [item.data._admin?.uid || "", item.data.id, item.data._admin?.uid || ""]
                    );
                    const uid = matchingRows[0]?.uid || item.data._admin?.uid || crypto.randomUUID();
                    const status = item.data._admin?.status || "draft";
                    const visible = item.data._admin?.visible !== false;
                    const stored = { ...item.data, _admin: { ...(item.data._admin || {}), uid, status, visible } };
                    await connection.execute(
                        `INSERT INTO products
                         (uid, slug, product_type, model, category, publication_status, visible, featured, data_json, created_by, updated_by, published_at, deleted_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN UTC_TIMESTAMP(3) ELSE NULL END, NULL)
                         ON DUPLICATE KEY UPDATE slug = VALUES(slug), product_type = VALUES(product_type), model = VALUES(model),
                         category = VALUES(category), publication_status = VALUES(publication_status), visible = VALUES(visible),
                         featured = VALUES(featured), data_json = VALUES(data_json), updated_by = VALUES(updated_by),
                         version = version + 1, deleted_at = NULL,
                         published_at = CASE WHEN VALUES(publication_status) = 'published' THEN COALESCE(published_at, UTC_TIMESTAMP(3)) ELSE published_at END`,
                        [
                            uid, item.data.id, item.type, item.data.modelo, item.data.categoria || "", status,
                            visible ? 1 : 0, isProductFeatured(item.data) ? 1 : 0,
                            JSON.stringify(stored), adminId, adminId, status
                        ]
                    );
                    activeUids.push(uid);
                }
                if (activeUids.length) {
                    await connection.query(
                        "UPDATE products SET deleted_at = UTC_TIMESTAMP(3), updated_by = ?, version = version + 1 WHERE uid NOT IN (?) AND deleted_at IS NULL",
                        [adminId, activeUids]
                    );
                } else {
                    await connection.execute(
                        "UPDATE products SET deleted_at = UTC_TIMESTAMP(3), updated_by = ?, version = version + 1 WHERE deleted_at IS NULL",
                        [adminId]
                    );
                }
                await this.audit(adminId, "replace", "catalog", null, { count: items.length }, connection);
                const [rows] = await connection.execute("SELECT * FROM products WHERE deleted_at IS NULL ORDER BY updated_at DESC");
                return rows.map((row) => ({ type: row.product_type, data: productFromRow(row) }));
            });
        } catch (error) {
            throw duplicateError(error, "product");
        }
    }

    async listArticles(options) {
        const settings = options || {};
        const where = ["deleted_at IS NULL"];
        if (settings.publicOnly) where.push("publication_status = 'published'", "visible = 1");
        const [rows] = await this.pool.execute(
            `SELECT * FROM articles WHERE ${where.join(" AND ")}
             ORDER BY published_at DESC, popular DESC, updated_at DESC`,
            []
        );
        return rows.map(articleFromRow);
    }

    async getPublicArticle(slug) {
        const [rows] = await this.pool.execute(
            `SELECT * FROM articles WHERE slug = ? AND publication_status = 'published'
             AND visible = 1 AND deleted_at IS NULL LIMIT 1`,
            [slug]
        );
        return rows[0] ? articleFromRow(rows[0]) : null;
    }

    async getArticleByUid(uid, connection) {
        const executor = connection || this.pool;
        const [rows] = await executor.execute("SELECT * FROM articles WHERE uid = ? LIMIT 1", [uid]);
        return rows[0] ? { data: articleFromRow(rows[0]), deletedAt: rows[0].deleted_at } : null;
    }

    async getArticleBySlug(slug, connection) {
        const executor = connection || this.pool;
        const [rows] = await executor.execute("SELECT * FROM articles WHERE slug = ? LIMIT 1", [slug]);
        return rows[0] ? { data: articleFromRow(rows[0]), deletedAt: rows[0].deleted_at } : null;
    }

    async saveArticle(article, adminId, originalUid) {
        try {
            return await this.transaction(async (connection) => {
                let existing = originalUid ? await this.getArticleByUid(originalUid, connection) : null;
                if (!originalUid) {
                    const matchingSlug = await this.getArticleBySlug(article.slug, connection);
                    if (matchingSlug && !matchingSlug.deletedAt) {
                        throw new AppError(409, "article_already_exists", "Já existe um artigo com este identificador.");
                    }
                    existing = matchingSlug;
                }
                const uid = existing?.data?._admin?.uid || article._admin?.uid || crypto.randomUUID();
                await this.assertEditorialKeyAvailable("article", article.slug, uid, connection);
                const status = article._admin?.status || "draft";
                const visible = article._admin?.visible !== false;
                const stored = { ...article, _admin: { ...(article._admin || {}), uid, status, visible } };
                const values = [
                    article.slug, article.title, article.category || "", article.author || "Equipe Brutusmaq",
                    status, visible ? 1 : 0, article.popular ? 1 : 0, JSON.stringify(stored), adminId
                ];
                if (existing) {
                    await connection.execute(
                        `UPDATE articles SET slug = ?, title = ?, category = ?, author = ?, publication_status = ?, visible = ?,
                         popular = ?, data_json = ?, updated_by = ?, version = version + 1,
                         published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, UTC_TIMESTAMP(3)) ELSE published_at END,
                         deleted_at = NULL WHERE uid = ?`,
                        [...values, status, uid]
                    );
                    await this.audit(adminId, "update", "article", uid, { slug: article.slug, status }, connection);
                } else {
                    await connection.execute(
                        `INSERT INTO articles
                         (uid, slug, title, category, author, publication_status, visible, popular, data_json, created_by, updated_by, published_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN UTC_TIMESTAMP(3) ELSE NULL END)`,
                        [uid, ...values, adminId, status]
                    );
                    await this.audit(adminId, "create", "article", uid, { slug: article.slug, status }, connection);
                }
                return (await this.getArticleByUid(uid, connection)).data;
            });
        } catch (error) {
            throw duplicateError(error, "article");
        }
    }

    async deleteArticle(uid, adminId) {
        return this.transaction(async (connection) => {
            const existing = await this.getArticleByUid(uid, connection);
            if (!existing || existing.deletedAt) throw new AppError(404, "article_not_found", "Artigo não encontrado.");
            await connection.execute(
                "UPDATE articles SET deleted_at = UTC_TIMESTAMP(3), updated_by = ?, version = version + 1 WHERE uid = ?",
                [adminId, uid]
            );
            await this.audit(adminId, "delete", "article", uid, { slug: existing.data.slug }, connection);
            return existing.data;
        });
    }

    async restoreArticle(uid, adminId) {
        return this.transaction(async (connection) => {
            const existing = await this.getArticleByUid(uid, connection);
            if (!existing) throw new AppError(404, "article_not_found", "Artigo não encontrado.");
            await connection.execute(
                "UPDATE articles SET deleted_at = NULL, updated_by = ?, version = version + 1 WHERE uid = ?",
                [adminId, uid]
            );
            await this.audit(adminId, "restore", "article", uid, { slug: existing.data.slug }, connection);
            return (await this.getArticleByUid(uid, connection)).data;
        });
    }

    async replaceArticles(articles, adminId) {
        try {
            return await this.transaction(async (connection) => {
                const [pendingRows] = await connection.execute(
                    "SELECT COUNT(*) AS total FROM editorial_submissions WHERE entity_type = 'article' AND status = 'pending'"
                );
                if (Number(pendingRows[0]?.total || 0) > 0) {
                    throw new AppError(409, "editorial_queue_not_empty", "Analise as publicações de artigos pendentes antes de substituir o blog.");
                }
                const activeUids = [];
                for (const article of articles) {
                    const [matchingRows] = await connection.execute(
                        "SELECT uid FROM articles WHERE uid = ? OR slug = ? ORDER BY uid = ? DESC LIMIT 1",
                        [article._admin?.uid || "", article.slug, article._admin?.uid || ""]
                    );
                    const uid = matchingRows[0]?.uid || article._admin?.uid || crypto.randomUUID();
                    const status = article._admin?.status || "draft";
                    const visible = article._admin?.visible !== false;
                    const stored = { ...article, _admin: { ...(article._admin || {}), uid, status, visible } };
                    await connection.execute(
                        `INSERT INTO articles
                         (uid, slug, title, category, author, publication_status, visible, popular, data_json, created_by, updated_by, published_at, deleted_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN UTC_TIMESTAMP(3) ELSE NULL END, NULL)
                         ON DUPLICATE KEY UPDATE slug = VALUES(slug), title = VALUES(title), category = VALUES(category),
                         author = VALUES(author), publication_status = VALUES(publication_status), visible = VALUES(visible),
                         popular = VALUES(popular), data_json = VALUES(data_json), updated_by = VALUES(updated_by),
                         version = version + 1, deleted_at = NULL,
                         published_at = CASE WHEN VALUES(publication_status) = 'published' THEN COALESCE(published_at, UTC_TIMESTAMP(3)) ELSE published_at END`,
                        [
                            uid, article.slug, article.title, article.category || "", article.author || "Equipe Brutusmaq",
                            status, visible ? 1 : 0, article.popular ? 1 : 0, JSON.stringify(stored), adminId, adminId, status
                        ]
                    );
                    activeUids.push(uid);
                }
                if (activeUids.length) {
                    await connection.query(
                        "UPDATE articles SET deleted_at = UTC_TIMESTAMP(3), updated_by = ?, version = version + 1 WHERE uid NOT IN (?) AND deleted_at IS NULL",
                        [adminId, activeUids]
                    );
                } else {
                    await connection.execute(
                        "UPDATE articles SET deleted_at = UTC_TIMESTAMP(3), updated_by = ?, version = version + 1 WHERE deleted_at IS NULL",
                        [adminId]
                    );
                }
                await this.audit(adminId, "replace", "articles", null, { count: articles.length }, connection);
                const [rows] = await connection.execute("SELECT * FROM articles WHERE deleted_at IS NULL ORDER BY updated_at DESC");
                return rows.map(articleFromRow);
            });
        } catch (error) {
            throw duplicateError(error, "article");
        }
    }

    async createLead(lead) {
        const publicId = crypto.randomUUID();
        await this.pool.execute(
            `INSERT INTO leads
             (public_id, reason, name, phone, email, company, city_state, interest, product_slug, product_name,
              message, source, payload_json, privacy_version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                publicId, lead.reason, lead.name, lead.phone, lead.email || null, lead.company || null,
                lead.cityState || null, lead.interest || null, lead.productSlug || null, lead.productName || null,
                lead.message || null, lead.source, JSON.stringify(lead.payload), lead.privacyVersion
            ]
        );
        return { publicId, status: "new", createdAt: new Date().toISOString() };
    }

    async listLeads(options) {
        const settings = options || {};
        const page = Math.max(1, Number(settings.page) || 1);
        const pageSize = Math.max(10, Math.min(100, Number(settings.pageSize) || 30));
        const where = [];
        const values = [];
        const searchWhere = [];
        const searchValues = [];
        if (settings.status && settings.status !== "all") {
            where.push("status = ?");
            values.push(settings.status);
        }
        if (settings.search) {
            const searchClause = "(name LIKE ? OR company LIKE ? OR email LIKE ? OR phone LIKE ? OR product_name LIKE ?)";
            where.push(searchClause);
            searchWhere.push(searchClause);
            const term = `%${settings.search}%`;
            values.push(term, term, term, term, term);
            searchValues.push(term, term, term, term, term);
        }
        const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const [countRows] = await this.pool.execute(`SELECT COUNT(*) AS total FROM leads ${clause}`, values);
        const searchClause = searchWhere.length ? `WHERE ${searchWhere.join(" AND ")}` : "";
        const [statusRows] = await this.pool.execute(
            `SELECT status, COUNT(*) AS total FROM leads ${searchClause} GROUP BY status`,
            searchValues
        );
        const [rows] = await this.pool.execute(
            `SELECT public_id, status, reason, name, phone, email, company, city_state, interest, product_slug,
                    product_name, message, source, payload_json, created_at, updated_at
             FROM leads ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...values, pageSize, (page - 1) * pageSize]
        );
        return {
            items: rows.map((row) => ({
                id: row.public_id,
                status: row.status,
                reason: row.reason,
                name: row.name,
                phone: row.phone,
                email: row.email || "",
                company: row.company || "",
                cityState: row.city_state || "",
                interest: row.interest || "",
                productSlug: row.product_slug || "",
                productName: row.product_name || "",
                message: row.message || "",
                source: row.source,
                details: parseJson(row.payload_json, {}),
                createdAt: iso(row.created_at),
                updatedAt: iso(row.updated_at)
            })),
            total: Number(countRows[0]?.total || 0),
            statusCounts: statusRows.reduce((counts, row) => {
                counts[row.status] = Number(row.total || 0);
                return counts;
            }, { new: 0, in_progress: 0, closed: 0, spam: 0 }),
            page,
            pageSize
        };
    }

    async updateLeadStatus(publicId, status, adminId) {
        return this.transaction(async (connection) => {
            const [result] = await connection.execute(
                `UPDATE leads SET status = ?, assigned_to = CASE WHEN ? = 'in_progress' THEN ? ELSE assigned_to END,
                 closed_at = CASE WHEN ? = 'closed' THEN UTC_TIMESTAMP(3) ELSE NULL END
                 WHERE public_id = ?`,
                [status, status, adminId, status, publicId]
            );
            if (!result.affectedRows) throw new AppError(404, "lead_not_found", "Solicitação não encontrada.");
            await this.audit(adminId, "status_change", "lead", publicId, { status }, connection);
            return { id: publicId, status };
        });
    }

    async insertAnalytics(events) {
        if (!events.length) return 0;
        const placeholders = events.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
        const values = events.flatMap((event) => [
            event.id, event.type, event.occurredAt, event.sessionHash, event.page, event.entityType,
            event.entityId || null, event.entityName || null, event.channel || null,
            event.formType || null, event.source || null, event.deviceType || "unknown",
            event.trafficSource || "unknown", event.trafficMedium || "unknown"
        ]);
        const [result] = await this.pool.execute(
            `INSERT IGNORE INTO analytics_events
             (event_uid, event_type, occurred_at, session_hash, page, entity_type, entity_id, entity_name, channel,
              form_type, source, device_type, traffic_source, traffic_medium)
             VALUES ${placeholders}`,
            values
        );
        await this.pool.execute("DELETE FROM analytics_events WHERE occurred_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 400 DAY)");
        return result.affectedRows;
    }

    async listAnalytics(options) {
        const settings = options || {};
        const from = settings.from || new Date(Date.now() - 400 * 86400000);
        const to = settings.to || new Date(Date.now() + 86400000);
        const limit = Math.max(1, Math.min(15000, Number(settings.limit) || 15000));
        const [rows] = await this.pool.execute(
            `SELECT event_uid, event_type, occurred_at, session_hash, page, entity_type, entity_id,
                    entity_name, channel, form_type, source, device_type, traffic_source, traffic_medium
             FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ?
             ORDER BY occurred_at ASC LIMIT ?`,
            [from, to, limit]
        );
        return rows.map((row) => ({
            id: row.event_uid,
            type: row.event_type,
            timestamp: iso(row.occurred_at),
            sessionId: row.session_hash.slice(0, 16),
            page: row.page,
            entityType: row.entity_type,
            entityId: row.entity_id || "",
            entityName: row.entity_name || "",
            channel: row.channel || "",
            formType: row.form_type || "",
            source: row.source || "",
            deviceType: row.device_type || "unknown",
            trafficSource: row.traffic_source || "unknown",
            trafficMedium: row.traffic_medium || "unknown"
        }));
    }

    async clearAnalytics(adminId) {
        return this.transaction(async (connection) => {
            const [result] = await connection.execute("DELETE FROM analytics_events");
            await this.audit(adminId, "clear", "analytics", null, { count: result.affectedRows }, connection);
            return result.affectedRows;
        });
    }

    async createMediaAsset(asset, adminId) {
        const publicId = crypto.randomUUID();
        await this.pool.execute(
            `INSERT INTO media_assets
             (public_id, file_name, storage_path, public_url, mime_type, size_bytes, width, height, alt_text, uploaded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                publicId, asset.fileName, asset.storagePath, asset.publicUrl, asset.mimeType,
                asset.sizeBytes, asset.width || null, asset.height || null, asset.altText || "", adminId
            ]
        );
        return { id: publicId, ...asset };
    }
}

module.exports = { MySqlRepository, databaseConnectionOptions, productFromRow, articleFromRow };
