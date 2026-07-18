"use strict";

const crypto = require("node:crypto");
const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { generate } = require("otplib");
const request = require("supertest");
const { loadConfig } = require("../server/config");
const { createApp } = require("../server/app");
const { AppError } = require("../server/errors");
const { encryptBackup, decryptBackup } = require("../scripts/backup-crypto");

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

test("backup criptografado preserva os dados e rejeita chave incorreta", () => {
    const payload = {
        createdAt: new Date("2026-07-16T12:00:00.000Z"),
        tables: { products: [{ id: 1, name: "TR-700" }] }
    };
    const encrypted = encryptBackup(payload, "chave-segura-de-teste");
    const restored = decryptBackup(encrypted, "chave-segura-de-teste");

    assert.notDeepEqual(encrypted.subarray(0, 64).toString("utf8"), JSON.stringify(payload));
    assert.equal(restored.tables.products[0].name, "TR-700");
    assert.equal(restored.createdAt.toISOString(), payload.createdAt.toISOString());
    assert.throws(() => decryptBackup(encrypted, "chave-incorreta"));
});

class MemoryRepository {
    constructor(passwordHash) {
        this.admin = {
            id: 1,
            publicId: "11111111-1111-4111-8111-111111111111",
            name: "Administrador de Teste",
            email: "admin@brutusmaq.test",
            passwordHash,
            role: "owner",
            active: true,
            mfaSecretEncrypted: "",
            mfaEnabled: false,
            recoveryCodeHashes: []
        };
        this.admins = [this.admin];
        this.sessions = new Map();
        this.mfaChallenges = new Map();
        this.passwordResets = new Map();
        this.invitations = new Map();
        this.submissions = [];
        this.securityEvents = [];
        this.products = [{
            type: "new",
            data: {
                id: "tr-700",
                modelo: "TR-700",
                categoria: "Trituradores",
                descricao: "Equipamento de teste",
                specs: [["Potência", "30 cv"]],
                _admin: { uid: "new:tr-700:0", status: "published", visible: true, version: 1 }
            }
        }];
        this.articles = [{
            slug: "artigo-inicial",
            title: "Artigo inicial de teste",
            category: "Guia técnico",
            author: "Equipe Brutusmaq",
            _admin: { uid: "article:artigo-inicial:0", status: "published", visible: true, version: 1 }
        }];
        this.leads = [];
        this.events = [];
        this.media = [];
    }

    async ping() { return true; }
    adminById(adminId) {
        return this.admins.find((admin) => admin.id === Number(adminId)) || null;
    }
    adminByPublicId(publicId) {
        return this.admins.find((admin) => admin.publicId === publicId) || null;
    }
    publicAdmin(admin) {
        if (!admin) return null;
        const latestInvitation = Array.from(this.invitations?.values?.() || [])
            .filter((invitation) => invitation.adminId === admin.id)
            .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))[0];
        return {
            id: admin.publicId,
            publicId: admin.publicId,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            active: Boolean(admin.active),
            mfaEnabled: Boolean(admin.mfaEnabled),
            createdAt: admin.createdAt || new Date().toISOString(),
            invitation: latestInvitation ? this.publicInvitation(latestInvitation) : null
        };
    }
    async findAdminByEmail(email) {
        return this.admins.find((admin) => admin.email === String(email || "").toLowerCase()) || null;
    }
    async createSession(adminId, tokenHash, expiresAt, context) {
        this.sessions.set(tokenHash, {
            id: crypto.randomUUID(),
            adminId,
            expiresAt,
            userAgent: context?.userAgent || "Teste",
            createdAt: new Date(),
            lastSeenAt: new Date()
        });
    }
    async findSession(tokenHash) {
        const session = this.sessions.get(tokenHash);
        if (!session) return null;
        const admin = this.adminById(session.adminId);
        if (!admin) return null;
        return {
            adminId: admin.id,
            expiresAt: session.expiresAt,
            publicId: admin.publicId,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            active: admin.active,
            mfaEnabled: admin.mfaEnabled
        };
    }
    async touchSession() {}
    async deleteSession(tokenHash) { this.sessions.delete(tokenHash); }
    async listSessions(adminId, currentTokenHash) {
        return Array.from(this.sessions.entries())
            .filter(([, session]) => session.adminId === Number(adminId))
            .map(([tokenHash, session]) => ({
                id: session.id,
                userAgent: session.userAgent,
                current: tokenHash === currentTokenHash,
                expiresAt: new Date(session.expiresAt).toISOString(),
                lastSeenAt: new Date(session.lastSeenAt).toISOString(),
                createdAt: new Date(session.createdAt).toISOString()
            }));
    }
    async deleteOtherSessions(adminId, currentTokenHash) {
        let count = 0;
        for (const [tokenHash, session] of this.sessions) {
            if (session.adminId === Number(adminId) && tokenHash !== currentTokenHash) {
                this.sessions.delete(tokenHash);
                count += 1;
            }
        }
        return count;
    }
    async getAdminSecurity(adminId) {
        const admin = this.adminById(adminId);
        return admin ? { ...admin, passwordChangedAt: null, lastLoginAt: null } : null;
    }
    async updatePassword(adminId, passwordHash) {
        const admin = this.adminById(adminId);
        if (!admin) return;
        admin.passwordHash = passwordHash;
        for (const [tokenHash, session] of this.sessions) {
            if (session.adminId === admin.id) this.sessions.delete(tokenHash);
        }
        for (const [tokenHash, reset] of this.passwordResets) {
            if (reset.adminId === admin.id) this.passwordResets.delete(tokenHash);
        }
    }
    async storePendingMfaSecret(adminId, encryptedSecret) {
        const admin = this.adminById(adminId);
        admin.mfaSecretEncrypted = encryptedSecret;
        admin.mfaEnabled = false;
        admin.recoveryCodeHashes = [];
    }
    async enableMfa(adminId, hashes) {
        const admin = this.adminById(adminId);
        admin.mfaEnabled = true;
        admin.recoveryCodeHashes = [...hashes];
    }
    async disableMfa(adminId) {
        const admin = this.adminById(adminId);
        admin.mfaSecretEncrypted = "";
        admin.mfaEnabled = false;
        admin.recoveryCodeHashes = [];
    }
    async consumeRecoveryCode(adminId, hash) {
        const admin = this.adminById(adminId);
        const index = admin.recoveryCodeHashes.indexOf(hash);
        if (index < 0) return false;
        admin.recoveryCodeHashes.splice(index, 1);
        return true;
    }
    async createMfaChallenge(adminId, tokenHash, remember, expiresAt) {
        this.mfaChallenges.set(tokenHash, { adminId, remember, expiresAt, attempts: 0 });
    }
    async findMfaChallenge(tokenHash) {
        const challenge = this.mfaChallenges.get(tokenHash);
        if (!challenge || new Date(challenge.expiresAt).getTime() <= Date.now()) return null;
        const admin = this.adminById(challenge.adminId);
        if (!admin) return null;
        return {
            ...challenge,
            publicId: admin.publicId,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            active: admin.active,
            mfaSecretEncrypted: admin.mfaSecretEncrypted,
            mfaEnabled: admin.mfaEnabled,
            recoveryCodeHashes: [...admin.recoveryCodeHashes]
        };
    }
    async failMfaChallenge(tokenHash) {
        const challenge = this.mfaChallenges.get(tokenHash);
        if (challenge) challenge.attempts += 1;
    }
    async consumeMfaChallenge(tokenHash) { this.mfaChallenges.delete(tokenHash); }
    async createPasswordReset(adminId, tokenHash, expiresAt) {
        this.passwordResets.clear();
        this.passwordResets.set(tokenHash, { adminId, expiresAt });
    }
    async findPasswordReset(tokenHash) {
        const reset = this.passwordResets.get(tokenHash);
        if (!reset || new Date(reset.expiresAt).getTime() <= Date.now()) return null;
        const admin = this.adminById(reset.adminId);
        return admin ? { ...reset, email: admin.email, active: admin.active } : null;
    }
    async recordSecurityEvent(event) { this.securityEvents.unshift(clone(event)); }
    async listSecurityEvents() {
        return this.securityEvents.map((event) => ({ ...clone(event), createdAt: new Date().toISOString() }));
    }
    async listAdmins() {
        return this.admins.map((admin) => this.publicAdmin(admin));
    }
    async getAdminByPublicId(publicId) {
        return this.publicAdmin(this.adminByPublicId(publicId));
    }
    async createInvitation(input, invitedBy) {
        const email = String(input.email || "").trim().toLowerCase();
        if (this.admins.some((admin) => admin.email === email)) {
            throw new AppError(409, "admin_already_exists", "Já existe uma conta com este e-mail.");
        }
        const admin = {
            id: Math.max(0, ...this.admins.map((item) => item.id)) + 1,
            publicId: crypto.randomUUID(),
            name: String(input.name || "Funcionário").trim(),
            email,
            passwordHash: "$2b$12$C6UzMDM.H6dfI/f/IKcEe.4NqEw3pYtOQY6G8V3i0RZPl8qgQYw4K",
            role: input.role === "viewer" ? "viewer" : "editor",
            active: false,
            mfaSecretEncrypted: "",
            mfaEnabled: false,
            recoveryCodeHashes: [],
            createdAt: new Date().toISOString()
        };
        this.admins.push(admin);
        const invitation = {
            id: crypto.randomUUID(),
            publicId: crypto.randomUUID(),
            adminId: admin.id,
            invitedBy: Number(invitedBy),
            tokenHash: input.tokenHash,
            expiresAt: new Date(input.expiresAt),
            acceptedAt: null,
            revokedAt: null,
            createdAt: new Date()
        };
        this.invitations.set(input.tokenHash, invitation);
        return {
            member: this.publicAdmin(admin),
            invitation: { id: invitation.publicId, expiresAt: invitation.expiresAt.toISOString() }
        };
    }
    publicInvitation(invitation) {
        if (!invitation) return null;
        const admin = this.adminById(invitation.adminId);
        return {
            id: invitation.publicId || invitation.id,
            publicId: invitation.publicId || invitation.id,
            adminId: admin?.publicId || invitation.adminId,
            name: admin?.name || "",
            email: admin?.email || "",
            role: admin?.role || "editor",
            status: invitation.acceptedAt
                ? "accepted"
                : (invitation.revokedAt ? "revoked" : (new Date(invitation.expiresAt).getTime() <= Date.now() ? "expired" : "pending")),
            expiresAt: new Date(invitation.expiresAt).toISOString(),
            acceptedAt: invitation.acceptedAt ? new Date(invitation.acceptedAt).toISOString() : null,
            createdAt: new Date(invitation.createdAt).toISOString()
        };
    }
    async findInvitation(tokenHash) {
        const invitation = this.invitations.get(tokenHash);
        if (!invitation) return null;
        const admin = this.adminById(invitation.adminId);
        return {
            ...invitation,
            ...this.publicInvitation(invitation),
            adminId: invitation.adminId,
            adminPublicId: admin?.publicId || null,
            name: admin?.name || "",
            email: admin?.email || "",
            role: admin?.role || "editor",
            active: Boolean(admin?.active),
            valid: !invitation.acceptedAt && !invitation.revokedAt && new Date(invitation.expiresAt).getTime() > Date.now()
        };
    }
    async acceptInvitation(tokenHash, passwordHash) {
        const invitation = this.invitations.get(tokenHash);
        if (!invitation || invitation.acceptedAt || invitation.revokedAt || new Date(invitation.expiresAt).getTime() <= Date.now()) {
            throw new AppError(400, "invitation_invalid", "O convite é inválido, expirou ou já foi utilizado.");
        }
        const admin = this.adminById(invitation.adminId);
        if (!admin) throw new AppError(400, "invitation_invalid", "O convite é inválido, expirou ou já foi utilizado.");
        admin.passwordHash = passwordHash;
        admin.active = true;
        invitation.acceptedAt = new Date();
        for (const [storedHash, storedInvitation] of this.invitations) {
            if (storedInvitation.adminId === admin.id && storedHash !== tokenHash) this.invitations.delete(storedHash);
        }
        return {
            id: admin.publicId,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            active: true
        };
    }
    async resendInvitation(publicId, input, invitedBy) {
        const admin = this.adminByPublicId(publicId);
        if (!admin || admin.active) return null;
        for (const [storedHash, invitation] of this.invitations) {
            if (invitation.adminId === admin.id) invitation.revokedAt = new Date();
        }
        const invitation = {
            id: crypto.randomUUID(),
            publicId: crypto.randomUUID(),
            adminId: admin.id,
            invitedBy: Number(invitedBy),
            tokenHash: input.tokenHash,
            expiresAt: new Date(input.expiresAt),
            acceptedAt: null,
            revokedAt: null,
            createdAt: new Date()
        };
        this.invitations.set(input.tokenHash, invitation);
        return {
            member: this.publicAdmin(admin),
            invitation: { id: invitation.publicId, expiresAt: invitation.expiresAt.toISOString() }
        };
    }
    async updateAdmin(publicId, changes) {
        const admin = this.adminByPublicId(publicId);
        if (!admin) throw new AppError(404, "admin_not_found", "Conta não encontrada.");
        if (typeof changes.active === "boolean") admin.active = changes.active;
        if (["editor", "viewer"].includes(changes.role)) admin.role = changes.role;
        if (!admin.active) {
            for (const [tokenHash, session] of this.sessions) {
                if (session.adminId === admin.id) this.sessions.delete(tokenHash);
            }
        }
        return this.publicAdmin(admin);
    }
    async listProducts(options) {
        return clone(this.products.filter((item) => (
            !item.deleted && (!options?.publicOnly || (item.data._admin.status === "published" && item.data._admin.visible))
        )));
    }
    async getPublicProduct(slug) {
        return clone(this.products.find((item) => (
            !item.deleted && item.data.id === slug && item.data._admin.status === "published" && item.data._admin.visible
        )) || null);
    }
    async getProductByUid(uid) {
        const item = this.products.find((product) => product.data._admin.uid === uid);
        return item ? { type: item.type, data: clone(item.data), deletedAt: item.deleted ? new Date() : null } : null;
    }
    async getProductBySlug(slug) {
        const item = this.products.find((product) => product.data.id === slug);
        return item ? { type: item.type, data: clone(item.data), deletedAt: item.deleted ? new Date() : null } : null;
    }
    async saveProduct(type, product, adminId, originalUid) {
        const uid = originalUid || product._admin?.uid || crypto.randomUUID();
        const reserved = this.submissions.find((submission) => (
            submission.entityType === "product" && submission.status === "pending"
            && submission.entitySlug === product.id && submission.entityUid !== uid
        ));
        if (reserved) throw new AppError(409, "editorial_key_reserved", "Identificador reservado por uma proposta pendente.");
        const existingIndex = this.products.findIndex((item) => item.data._admin.uid === uid);
        const previousVersion = existingIndex >= 0 ? Number(this.products[existingIndex].data._admin.version || 1) : 0;
        const data = {
            ...clone(product),
            _admin: {
                ...(product._admin || {}),
                uid,
                status: product._admin?.status || "draft",
                visible: product._admin?.visible !== false,
                version: previousVersion + 1
            }
        };
        if (this.products.some((item, index) => item.data.id === data.id && index !== existingIndex && !item.deleted)) {
            throw new AppError(409, "product_already_exists", "Já existe um produto com este identificador.");
        }
        const item = { type, data, deleted: false };
        if (existingIndex >= 0) this.products[existingIndex] = item;
        else this.products.unshift(item);
        return clone(data);
    }
    async deleteProduct(uid) {
        const item = this.products.find((product) => product.data._admin.uid === uid && !product.deleted);
        if (!item) throw new AppError(404, "product_not_found", "Produto não encontrado.");
        item.deleted = true;
        return clone(item.data);
    }
    async restoreProduct(uid) {
        const item = this.products.find((product) => product.data._admin.uid === uid);
        if (!item) throw new AppError(404, "product_not_found", "Produto não encontrado.");
        item.deleted = false;
        return clone(item.data);
    }
    async replaceProducts(catalog) {
        this.products = [
            ...catalog.novos.map((data) => ({
                type: "new",
                data: { ...clone(data), _admin: { ...(data._admin || {}), version: Number(data._admin?.version || 1) } },
                deleted: false
            })),
            ...catalog.usados.map((data) => ({
                type: "used",
                data: { ...clone(data), _admin: { ...(data._admin || {}), version: Number(data._admin?.version || 1) } },
                deleted: false
            }))
        ];
        return this.listProducts({ publicOnly: false });
    }
    async listArticles(options) {
        return clone(this.articles.filter((article) => (
            !article.deleted && (!options?.publicOnly || (article._admin.status === "published" && article._admin.visible))
        )));
    }
    async getPublicArticle(slug) {
        return clone(this.articles.find((article) => (
            !article.deleted && article.slug === slug && article._admin.status === "published" && article._admin.visible
        )) || null);
    }
    async getArticleByUid(uid) {
        const article = this.articles.find((item) => item._admin.uid === uid);
        return article ? { data: clone(article), deletedAt: article.deleted ? new Date() : null } : null;
    }
    async getArticleBySlug(slug) {
        const article = this.articles.find((item) => item.slug === slug);
        return article ? { data: clone(article), deletedAt: article.deleted ? new Date() : null } : null;
    }
    async saveArticle(article, adminId, originalUid) {
        const uid = originalUid || article._admin?.uid || crypto.randomUUID();
        const reserved = this.submissions.find((submission) => (
            submission.entityType === "article" && submission.status === "pending"
            && submission.entitySlug === article.slug && submission.entityUid !== uid
        ));
        if (reserved) throw new AppError(409, "editorial_key_reserved", "Identificador reservado por uma proposta pendente.");
        const index = this.articles.findIndex((item) => item._admin.uid === uid);
        const previousVersion = index >= 0 ? Number(this.articles[index]._admin.version || 1) : 0;
        const data = {
            ...clone(article),
            _admin: {
                ...(article._admin || {}),
                uid,
                status: article._admin?.status || "draft",
                visible: article._admin?.visible !== false,
                version: previousVersion + 1
            }
        };
        if (index >= 0) this.articles[index] = data;
        else this.articles.unshift(data);
        return clone(data);
    }
    async deleteArticle(uid) {
        const item = this.articles.find((article) => article._admin.uid === uid && !article.deleted);
        if (!item) throw new AppError(404, "article_not_found", "Artigo não encontrado.");
        item.deleted = true;
        return clone(item);
    }
    async restoreArticle(uid) {
        const item = this.articles.find((article) => article._admin.uid === uid);
        if (!item) throw new AppError(404, "article_not_found", "Artigo não encontrado.");
        delete item.deleted;
        return clone(item);
    }
    async replaceArticles(articles) {
        this.articles = clone(articles).map((article) => ({
            ...article,
            _admin: { ...(article._admin || {}), version: Number(article._admin?.version || 1) }
        }));
        return this.listArticles({ publicOnly: false });
    }
    publicSubmission(submission) {
        const submitter = this.adminById(submission.submittedBy);
        const reviewer = this.adminById(submission.reviewedBy);
        return {
            id: submission.publicId,
            publicId: submission.publicId,
            entityType: submission.entityType,
            operation: submission.operation,
            entityUid: submission.entityUid,
            entitySlug: submission.entitySlug,
            productType: submission.productType || null,
            payload: clone(submission.payload),
            baseVersion: submission.baseVersion,
            status: submission.status,
            note: submission.note || "",
            submittedBy: submitter ? this.publicAdmin(submitter) : null,
            submittedById: submitter?.publicId || null,
            reviewedBy: reviewer ? this.publicAdmin(reviewer) : null,
            submittedAt: new Date(submission.submittedAt).toISOString(),
            reviewedAt: submission.reviewedAt ? new Date(submission.reviewedAt).toISOString() : null,
            result: submission.result ? clone(submission.result) : null
        };
    }
    async createContentSubmission(input, submitterId) {
        const entityType = input.entityType === "article" ? "article" : "product";
        const sourcePayload = input.payload || input.data || input.product || input.article || {};
        const payload = clone(sourcePayload);
        const entity = entityType === "product"
            ? (payload.product || input.product || payload)
            : (payload.article || input.article || payload);
        const entityKey = entityType === "product" ? entity?.id : entity?.slug;
        const collision = entityType === "product"
            ? this.products.find((item) => !item.deleted && item.data.id === entityKey)
            : this.articles.find((item) => !item.deleted && item.slug === entityKey);
        const collisionUid = entityType === "product" ? collision?.data?._admin?.uid : collision?._admin?.uid;
        if (collision && (input.intent === "create" || collisionUid !== input.entityUid)) {
            throw new AppError(409, "review_slug_conflict", "Outro conteúdo já usa este identificador.");
        }
        const entityUid = input.entityUid || entity?._admin?.uid || crypto.randomUUID();
        let baseVersion = input.baseVersion == null ? null : Number(input.baseVersion);
        if (baseVersion == null && input.operation === "update") {
            const current = entityType === "product"
                ? await this.getProductByUid(entityUid)
                : await this.getArticleByUid(entityUid);
            baseVersion = Number(current?.data?._admin?.version || 0);
        }
        const submission = {
            id: this.submissions.length + 1,
            publicId: crypto.randomUUID(),
            entityType,
            operation: input.operation || (input.entityUid ? "update" : "create"),
            entityUid,
            entitySlug: input.entitySlug || (entityType === "product" ? entity?.id : entity?.slug) || "",
            productType: input.productType || input.type || payload.type || null,
            payload,
            baseVersion,
            status: "pending",
            submittedBy: Number(submitterId),
            reviewedBy: null,
            note: "",
            submittedAt: new Date(),
            reviewedAt: null,
            result: null
        };
        this.submissions.unshift(submission);
        return this.publicSubmission(submission);
    }
    async listContentSubmissions(options) {
        const settings = options || {};
        return this.submissions
            .filter((submission) => !settings.status || settings.status === "all"
                || (Array.isArray(settings.status) ? settings.status.includes(submission.status) : submission.status === settings.status))
            .filter((submission) => !settings.submittedBy || submission.submittedBy === Number(settings.submittedBy))
            .filter((submission) => !settings.entityType || submission.entityType === settings.entityType)
            .map((submission) => this.publicSubmission(submission));
    }
    async getContentSubmission(publicId) {
        const submission = this.submissions.find((item) => item.publicId === publicId);
        return submission ? this.publicSubmission(submission) : null;
    }
    rawContentSubmission(publicId) {
        return this.submissions.find((item) => item.publicId === publicId) || null;
    }
    async approveContentSubmission(publicId, reviewerId, validatedPayload, note) {
        const submission = this.rawContentSubmission(publicId);
        if (!submission) throw new AppError(404, "submission_not_found", "Revisão não encontrada.");
        if (submission.status !== "pending") throw new AppError(409, "submission_already_reviewed", "Esta revisão já foi analisada.");

        let result;
        if (submission.entityType === "product") {
            const wrapper = submission.payload.product ? submission.payload : { product: submission.payload };
            const current = await this.getProductByUid(submission.entityUid);
            if (submission.operation === "update" && Number(current?.data?._admin?.version || 0) !== Number(submission.baseVersion || 0)) {
                throw new AppError(409, "submission_version_conflict", "O produto foi alterado depois do envio para análise.");
            }
            if (submission.operation === "delete") {
                result = await this.deleteProduct(submission.entityUid, reviewerId);
            } else {
                const product = clone(validatedPayload || wrapper.product);
                product._admin = {
                    ...(product._admin || {}),
                    uid: submission.entityUid,
                    status: "published",
                    visible: product._admin?.visible !== false
                };
                result = await this.saveProduct(
                    wrapper.type || submission.productType || "new",
                    product,
                    reviewerId,
                    submission.entityUid
                );
            }
        } else {
            const wrapper = submission.payload.article ? submission.payload : { article: submission.payload };
            const current = await this.getArticleByUid(submission.entityUid);
            if (submission.operation === "update" && Number(current?.data?._admin?.version || 0) !== Number(submission.baseVersion || 0)) {
                throw new AppError(409, "submission_version_conflict", "O artigo foi alterado depois do envio para análise.");
            }
            if (submission.operation === "delete") {
                result = await this.deleteArticle(submission.entityUid, reviewerId);
            } else {
                const article = clone(validatedPayload || wrapper.article);
                article._admin = {
                    ...(article._admin || {}),
                    uid: submission.entityUid,
                    status: "published",
                    visible: article._admin?.visible !== false
                };
                result = await this.saveArticle(article, reviewerId, submission.entityUid);
            }
        }
        submission.status = "approved";
        submission.reviewedBy = Number(reviewerId);
        submission.note = String(note || "").trim();
        submission.reviewedAt = new Date();
        submission.result = result;
        return {
            review: this.publicSubmission(submission),
            ...(submission.entityType === "product" ? { product: clone(result) } : { article: clone(result) })
        };
    }
    async rejectContentSubmission(publicId, reviewerId, note) {
        const submission = this.rawContentSubmission(publicId);
        if (!submission) throw new AppError(404, "submission_not_found", "Revisão não encontrada.");
        if (submission.status !== "pending") throw new AppError(409, "submission_already_reviewed", "Esta revisão já foi analisada.");
        submission.status = "rejected";
        submission.reviewedBy = Number(reviewerId);
        submission.note = String(note || "").trim();
        submission.reviewedAt = new Date();
        return this.publicSubmission(submission);
    }
    async cancelContentSubmission(identifier, submitterId) {
        const publicId = String(identifier || "").replace(/^submission:/, "");
        const submission = this.submissions.find((item) => (
            item.submittedBy === Number(submitterId)
            && item.publicId === publicId
        ));
        if (!submission) throw new AppError(404, "submission_not_found", "Proposta não encontrada.");
        if (!["draft", "pending", "rejected"].includes(submission.status)) {
            throw new AppError(409, "submission_already_reviewed", "Esta revisão já foi analisada.");
        }
        submission.status = "cancelled";
        submission.reviewedAt = new Date();
        return this.publicSubmission(submission);
    }
    async createSubmission(input, submitterId) { return this.createContentSubmission(input, submitterId); }
    async listSubmissions(options) { return this.listContentSubmissions(options); }
    async approveSubmission(publicId, reviewerId, validatedPayload, note) {
        return this.approveContentSubmission(publicId, reviewerId, validatedPayload, note);
    }
    async rejectSubmission(publicId, reviewerId, note) { return this.rejectContentSubmission(publicId, reviewerId, note); }
    async createLead(lead) {
        const item = { id: crypto.randomUUID(), status: "new", ...clone(lead), createdAt: new Date().toISOString() };
        this.leads.unshift(item);
        return { publicId: item.id, status: item.status, createdAt: item.createdAt };
    }
    async listLeads() {
        const counts = this.leads.reduce((result, item) => {
            result[item.status] += 1;
            return result;
        }, { new: 0, in_progress: 0, closed: 0, spam: 0 });
        return { items: clone(this.leads), total: this.leads.length, statusCounts: counts, page: 1, pageSize: 30 };
    }
    async updateLeadStatus(id, status) {
        const item = this.leads.find((lead) => lead.id === id);
        if (!item) throw new AppError(404, "lead_not_found", "Solicitação não encontrada.");
        item.status = status;
        return { id, status };
    }
    async insertAnalytics(events) {
        events.forEach((event) => {
            if (!this.events.some((saved) => saved.id === event.id)) this.events.push(clone(event));
        });
        return events.length;
    }
    async listAnalytics() {
        return this.events.map((event) => ({ ...clone(event), timestamp: new Date(event.occurredAt).toISOString() }));
    }
    async clearAnalytics() { const count = this.events.length; this.events = []; return count; }
    async createMediaAsset(asset) {
        const saved = { id: crypto.randomUUID(), ...clone(asset) };
        this.media.push(saved);
        return saved;
    }
}

async function setup(options) {
    const settings = options || {};
    const repository = new MemoryRepository(await bcrypt.hash("SenhaDeTeste!2026", 4));
    const config = loadConfig({
        NODE_ENV: "test",
        BASE_URL: "http://localhost",
        SESSION_SECRET: "session-secret-for-tests-with-32-characters",
        ANALYTICS_SECRET: "analytics-secret-for-tests-with-32-characters",
        REQUIRE_ADMIN_MFA: "false",
        ...(settings.config || {})
    });
    const app = createApp({
        config,
        repository,
        mailer: settings.mailer || {
            enabled: false,
            sendLead: async () => ({ delivered: true }),
            sendPasswordReset: async () => ({ delivered: false }),
            sendInvitation: async () => ({ delivered: false })
        },
        mediaService: {
            saveImage: async (file, alt) => ({
                fileName: "test.webp",
                storagePath: "tests/test.webp",
                publicUrl: "/uploads/tests/test.webp",
                mimeType: "image/webp",
                sizeBytes: file.size,
                width: 1,
                height: 1,
                altText: alt || ""
            })
        }
    });
    return { app, repository };
}

async function loginAs(agent, email, password) {
    const response = await agent
        .post("/api/auth/login")
        .set("Origin", "http://localhost")
        .send({ email, password, remember: false })
        .expect(200);
    return response.body.csrfToken;
}

async function login(agent) {
    return loginAs(agent, "admin@brutusmaq.test", "SenhaDeTeste!2026");
}

function invitationToken(url) {
    const parsed = new URL(url);
    const fragment = parsed.hash.replace(/^#/, "");
    const query = fragment.includes("?") ? fragment.slice(fragment.indexOf("?") + 1) : fragment;
    const params = new URLSearchParams(query);
    return params.get("invite") || params.get("token") || (fragment.startsWith("invite=") ? fragment.slice(7) : "");
}

function responseSubmission(body) {
    return body?.submission || body?.review || body?.item || body;
}

function responseItems(body) {
    if (Array.isArray(body)) return body;
    return body?.items || body?.submissions || body?.reviews || [];
}

test("configuração de produção rejeita placeholders e segredos repetidos", () => {
    assert.throws(() => loadConfig({
        NODE_ENV: "production",
        BASE_URL: "https://www.brutusmaq.com.br",
        DB_NAME: "brutusmaq",
        DB_USER: "brutusmaq",
        DB_PASSWORD: "SenhaReal!2026",
        SESSION_SECRET: "troque-por-um-segredo-longo-e-aleatorio",
        ANALYTICS_SECRET: "outro-segredo-real-com-mais-de-32-caracteres"
    }), /SESSION_SECRET/);

    const sharedSecret = "segredo-real-igual-com-mais-de-32-caracteres";
    assert.throws(() => loadConfig({
        NODE_ENV: "production",
        BASE_URL: "https://www.brutusmaq.com.br",
        DB_NAME: "brutusmaq",
        DB_USER: "brutusmaq",
        DB_PASSWORD: "SenhaReal!2026",
        SESSION_SECRET: sharedSecret,
        ANALYTICS_SECRET: sharedSecret,
        MFA_ENCRYPTION_KEY: "mfa-segredo-real-unico-com-mais-de-32-caracteres",
        BACKUP_ENCRYPTION_KEY: "backup-segredo-real-unico-com-mais-de-32-caracteres"
    }), /precisam ser diferentes/);
});

test("API pública, 404 e cabeçalhos de segurança", async () => {
    const { app, repository } = await setup();
    const products = await request(app).get("/api/products").expect(200);
    assert.equal(products.body.catalog.novos[0].id, "tr-700");
    assert.match(products.headers["content-security-policy"], /default-src 'self'/);
    assert.doesNotMatch(products.headers["content-security-policy"], /script-src[^;]*'unsafe-inline'/);
    assert.doesNotMatch(products.headers["content-security-policy"], /style-src[^;]*'unsafe-inline'/);
    assert.match(products.headers["content-security-policy"], /style-src-attr 'none'/);
    assert.doesNotMatch(products.headers["content-security-policy"], /fonts\.googleapis|fonts\.gstatic/);
    assert.equal(products.headers["x-content-type-options"], "nosniff");
    const health = await request(app).get("/api/health").expect(200);
    assert.equal(health.body.status, "ok");
    assert.equal(health.body.database, true);
    assert.match(health.headers["cache-control"], /no-store/);
    repository.ping = async () => false;
    const degradedHealth = await request(app).get("/api/health").expect(503);
    assert.equal(degradedHealth.body.status, "degraded");
    assert.equal(degradedHealth.body.database, false);
    const robots = await request(app).get("/robots.txt").expect(200);
    assert.match(robots.text, /Disallow: \/painel-admin\.html/);
    const sitemap = await request(app).get("/sitemap.xml").expect(200);
    assert.match(sitemap.text, /produto\.html\?produto=tr-700/);
    assert.match(sitemap.text, /artigo-blog\.html\?artigo=artigo-inicial/);
    await request(app).get("/api/products/inexistente").expect(404);
    const notFound = await request(app).get("/area/interna/pagina-que-nao-existe").expect(404);
    assert.match(notFound.text, /href="\/css\/error-page\.css/);
    assert.match(notFound.text, /src="\/js\/error-page\.js/);
    assert.doesNotMatch(notFound.text, /(?:href|src)="(?:css|js|assets)\//);
    const errorStyles = await request(app).get("/css/error-page.css").expect(200);
    assert.match(errorStyles.headers["content-type"], /^text\/css/);
    assert.match(notFound.text, /Página não encontrada/i);
});

test("login usa cookie, exige CSRF e permite CRUD de produto", async () => {
    const { app } = await setup();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").set("Origin", "http://localhost")
        .send({ email: "admin@brutusmaq.test", password: "senha-incorreta" }).expect(401);
    const csrf = await login(agent);
    const session = await agent.get("/api/auth/session").expect(200);
    assert.equal(session.body.user.role, "owner");
    assert.equal(session.body.user.id, "11111111-1111-4111-8111-111111111111");

    await agent.post("/api/admin/products").set("Origin", "http://localhost")
        .send({ type: "new", product: { id: "tr-900", modelo: "TR-900" } }).expect(403);
    const created = await agent.post("/api/admin/products")
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", csrf)
        .send({
            type: "new",
            product: {
                id: "tr-900",
                modelo: "TR-900",
                categoria: "Trituradores",
                _admin: { status: "draft", visible: true }
            }
        })
        .expect(201);
    const uid = created.body.product._admin.uid;
    await agent.delete(`/api/admin/products/${encodeURIComponent(uid)}`)
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", csrf)
        .expect(200);
    await agent.post(`/api/admin/products/${encodeURIComponent(uid)}/restore`)
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", csrf)
        .expect(200);
});

test("owner convida editor e controla publicação por análise sem retirar a versão pública", async () => {
    let setupUrl = "";
    const { app } = await setup({
        mailer: {
            enabled: true,
            sendLead: async () => ({ delivered: true }),
            sendPasswordReset: async () => ({ delivered: true }),
            sendInvitation: async (...args) => {
                setupUrl = args.find((value) => typeof value === "string")
                    || args.find((value) => value && typeof value.setupUrl === "string")?.setupUrl
                    || "";
                return { delivered: true };
            }
        }
    });
    const owner = request.agent(app);
    const ownerCsrf = await login(owner);

    const invited = await owner.post("/api/admin/team/invitations")
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", ownerCsrf)
        .send({ name: "Editora de Teste", email: "editora@brutusmaq.test" });
    assert.ok([201, 202].includes(invited.status), `convite retornou HTTP ${invited.status}`);
    assert.match(setupUrl, /#invite/i);
    const token = invitationToken(setupUrl);
    assert.ok(token, "o e-mail de convite deve conter o token no fragmento #invite");

    await request(app).post("/api/auth/login")
        .set("Origin", "http://localhost")
        .send({ email: "editora@brutusmaq.test", password: "SenhaDoEditor!2026", remember: false })
        .expect(401);

    await request(app).post("/api/auth/invitations/accept")
        .set("Origin", "http://localhost")
        .send({ token, password: "                " })
        .expect(422);

    const accepted = await request(app).post("/api/auth/invitations/accept")
        .set("Origin", "http://localhost")
        .send({ token, password: "SenhaDoEditor!2026" });
    assert.ok([200, 201].includes(accepted.status), `aceite do convite retornou HTTP ${accepted.status}`);

    const editor = request.agent(app);
    const editorCsrf = await loginAs(editor, "editora@brutusmaq.test", "SenhaDoEditor!2026");
    const editorSession = await editor.get("/api/auth/session").expect(200);
    assert.equal(editorSession.body.user.role, "editor");

    await editor.post("/api/admin/products")
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", editorCsrf)
        .send({
            type: "new",
            product: {
                id: "tr-700",
                modelo: "Slug repetido",
                categoria: "Trituradores",
                resumo: "Tentativa de colisão.",
                descricao: "Este cadastro não deve virar uma edição.",
                specs: [["Potência", "30 cv"]],
                _admin: { status: "published", visible: true }
            }
        })
        .expect(409);

    const incomplete = await editor.post("/api/admin/products")
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", editorCsrf)
        .send({
            type: "new",
            product: {
                id: "tr-incompleto",
                modelo: "TR Incompleto",
                categoria: "Trituradores",
                _admin: { status: "published", visible: true }
            }
        })
        .expect(201);
    const incompleteSubmission = responseSubmission(incomplete.body);
    await owner.post(`/api/admin/reviews/${encodeURIComponent(incompleteSubmission.id)}/approve`)
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", ownerCsrf)
        .send({})
        .expect(422);
    await editor.delete(`/api/admin/submissions/${encodeURIComponent(incompleteSubmission.id)}`)
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", editorCsrf)
        .expect(200);

    const created = await editor.post("/api/admin/products")
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", editorCsrf)
        .send({
            type: "new",
            product: {
                id: "tr-editor",
                modelo: "TR Editor",
                categoria: "Trituradores",
                resumo: "Equipamento preparado pela equipe editorial.",
                descricao: "Primeira versão enviada pela funcionária.",
                specs: [["Potência", "50 cv"]],
                _admin: { status: "published", visible: true }
            }
        });
    assert.ok([201, 202].includes(created.status), `envio para análise retornou HTTP ${created.status}`);
    const firstSubmission = responseSubmission(created.body);
    assert.equal(firstSubmission.status, "pending");
    await request(app).get("/api/products/tr-editor").expect(404);

    const pendingList = await owner.get("/api/admin/reviews?status=pending").expect(200);
    const pending = responseItems(pendingList.body);
    const queuedCreation = pending.find((item) => item.id === firstSubmission.id || item.publicId === firstSubmission.publicId);
    assert.ok(queuedCreation, "a criação do editor deve aparecer na caixa de análise do owner");

    const approved = await owner.post(`/api/admin/reviews/${encodeURIComponent(queuedCreation.id || queuedCreation.publicId)}/approve`)
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", ownerCsrf)
        .send({ note: "Conteúdo conferido." })
        .expect(200);
    assert.equal(responseSubmission(approved.body).status, "approved");

    const published = await request(app).get("/api/products/tr-editor").expect(200);
    assert.equal(published.body.product.modelo, "TR Editor");
    const productUid = published.body.product._admin.uid;
    assert.ok(productUid);

    const edited = await editor.put(`/api/admin/products/${encodeURIComponent(productUid)}`)
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", editorCsrf)
        .send({
            type: "new",
            product: {
                ...published.body.product,
                id: "tr-editor-revisada",
                modelo: "TR Editor Revisada",
                descricao: "Alteração que ainda depende de aprovação.",
                _admin: { ...published.body.product._admin, status: "published", visible: true }
            }
        });
    assert.ok([200, 202].includes(edited.status), `edição para análise retornou HTTP ${edited.status}`);
    const secondSubmission = responseSubmission(edited.body);
    assert.equal(secondSubmission.status, "pending");

    await owner.post("/api/admin/products")
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", ownerCsrf)
        .send({
            type: "new",
            product: {
                id: "tr-editor-revisada",
                modelo: "Cadastro concorrente",
                categoria: "Trituradores",
                resumo: "Não deve ocupar um slug reservado.",
                descricao: "A proposta da funcionária tem prioridade sobre este identificador.",
                specs: [["Potência", "60 cv"]],
                _admin: { status: "published", visible: true }
            }
        })
        .expect(409);

    const publicWhilePending = await request(app).get("/api/products/tr-editor").expect(200);
    assert.equal(publicWhilePending.body.product.modelo, "TR Editor");
    assert.equal(publicWhilePending.body.product.descricao, "Primeira versão enviada pela funcionária.");

    const rejected = await owner.post(`/api/admin/reviews/${encodeURIComponent(secondSubmission.id || secondSubmission.publicId)}/reject`)
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", ownerCsrf)
        .send({ note: "Ajustar a descrição técnica antes de publicar." })
        .expect(200);
    const rejectedSubmission = responseSubmission(rejected.body);
    assert.equal(rejectedSubmission.status, "rejected");
    assert.match(rejectedSubmission.note || rejectedSubmission.reviewNote || "", /descrição técnica/i);

    const publicAfterRejection = await request(app).get("/api/products/tr-editor").expect(200);
    assert.equal(publicAfterRejection.body.product.modelo, "TR Editor");
    assert.equal(publicAfterRejection.body.product.descricao, "Primeira versão enviada pela funcionária.");

    await owner.delete(`/api/admin/submissions/${encodeURIComponent(secondSubmission.id || secondSubmission.publicId)}`)
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", ownerCsrf)
        .expect(403);
    const cancelled = await editor.delete(`/api/admin/submissions/${encodeURIComponent(secondSubmission.id || secondSubmission.publicId)}`)
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", editorCsrf)
        .expect(200);
    assert.equal(cancelled.body.submission.status, "cancelled");
    const editorAfterCancel = await editor.get("/api/admin/bootstrap").expect(200);
    const editorProduct = editorAfterCancel.body.catalog.novos.find((item) => item.id === "tr-editor");
    assert.equal(editorProduct.modelo, "TR Editor");

    const team = await owner.get("/api/admin/team").expect(200);
    const members = team.body.items || team.body.team || team.body.admins || team.body.members || [];
    const employee = members.find((item) => item.email === "editora@brutusmaq.test");
    assert.equal(employee?.role, "editor");
    assert.equal(employee?.active, true);

    await editor.get("/api/admin/team").expect(403);
    await editor.post("/api/admin/team/invitations")
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", editorCsrf)
        .send({ name: "Sem permissão", email: "outro@brutusmaq.test" })
        .expect(403);
    await editor.post(`/api/admin/reviews/${encodeURIComponent(firstSubmission.id || firstSubmission.publicId)}/approve`)
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", editorCsrf)
        .send({})
        .expect(403);
    await editor.put("/api/admin/catalog")
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", editorCsrf)
        .send({ catalog: { novos: [], usados: [] } })
        .expect(403);
    await editor.put("/api/admin/articles")
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", editorCsrf)
        .send({ articles: [] })
        .expect(403);
    await editor.delete(`/api/admin/products/${encodeURIComponent(productUid)}`)
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", editorCsrf)
        .expect(403);
});

test("MFA protege o login, emite recuperação e registra sessões", async () => {
    const { app } = await setup({ config: { REQUIRE_ADMIN_MFA: "true" } });
    const agent = request.agent(app);
    const csrf = await login(agent);

    const restrictedBootstrap = await agent.get("/api/admin/bootstrap").expect(200);
    assert.equal(restrictedBootstrap.body.mfaSetupRequired, true);
    assert.equal(restrictedBootstrap.body.catalog, undefined);
    await agent.get("/api/admin/analytics/events").expect(403);

    const setupResponse = await agent.post("/api/admin/security/mfa/setup")
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", csrf)
        .send({ password: "SenhaDeTeste!2026" })
        .expect(200);
    assert.match(setupResponse.body.qrCode, /^data:image\/png;base64,/);

    const code = await generate({ secret: setupResponse.body.secret });
    const enabled = await agent.post("/api/admin/security/mfa/enable")
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", csrf)
        .send({ code })
        .expect(200);
    assert.equal(enabled.body.recoveryCodes.length, 10);

    const completeBootstrap = await agent.get("/api/admin/bootstrap").expect(200);
    assert.equal(completeBootstrap.body.mfaSetupRequired, false);
    assert.equal(completeBootstrap.body.catalog.novos[0].id, "tr-700");

    await agent.post("/api/auth/logout")
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", csrf)
        .expect(204);

    const challenge = await agent.post("/api/auth/login")
        .set("Origin", "http://localhost")
        .send({ email: "admin@brutusmaq.test", password: "SenhaDeTeste!2026", remember: false })
        .expect(202);
    assert.equal(challenge.body.mfaRequired, true);

    const verified = await agent.post("/api/auth/mfa")
        .set("Origin", "http://localhost")
        .send({ challengeToken: challenge.body.challengeToken, code: enabled.body.recoveryCodes[0] })
        .expect(200);
    assert.equal(verified.body.user.mfaEnabled, true);

    const security = await agent.get("/api/admin/security").expect(200);
    assert.equal(security.body.security.recoveryCodesRemaining, 9);
    assert.equal(security.body.sessions.length, 1);
});

test("recuperação de senha usa token curto e invalida a senha anterior", async () => {
    let resetUrl = "";
    const { app } = await setup({
        mailer: {
            enabled: true,
            sendLead: async () => ({ delivered: true }),
            sendPasswordReset: async (admin, url) => {
                resetUrl = url;
                return { delivered: true };
            }
        }
    });
    await request(app).post("/api/auth/password/forgot")
        .set("Origin", "http://localhost")
        .send({ email: "admin@brutusmaq.test" })
        .expect(202);
    const token = new URLSearchParams(new URL(resetUrl).hash.replace(/^#/, "")).get("reset");
    assert.ok(token);

    await request(app).post("/api/auth/password/reset")
        .set("Origin", "http://localhost")
        .send({ token, newPassword: "NovaSenhaSegura!2026" })
        .expect(200);
    await request(app).post("/api/auth/login").set("Origin", "http://localhost")
        .send({ email: "admin@brutusmaq.test", password: "SenhaDeTeste!2026", remember: false })
        .expect(401);
    await request(app).post("/api/auth/login").set("Origin", "http://localhost")
        .send({ email: "admin@brutusmaq.test", password: "NovaSenhaSegura!2026", remember: false })
        .expect(200);
});

test("formulário aceita telefone formatado e centraliza a solicitação", async () => {
    const { app, repository } = await setup();
    const response = await request(app)
        .post("/api/leads")
        .set("Origin", "http://localhost")
        .send({
            motivo: "Solicitar proposta técnica",
            nome: "Cliente Teste",
            telefone: "(41) 98875-4003",
            email: "cliente@example.com",
            interesse: "Trituradores",
            mensagem: "Preciso processar plástico.",
            equipamento_solicitado: "TR-700",
            produto_slug: "tr-700"
        })
        .expect(201);
    assert.equal(response.body.accepted, true);
    assert.equal(repository.leads[0].phone, "41988754003");

    await request(app).post("/api/leads").set("Origin", "http://localhost")
        .send({ motivo: "Contato", nome: "Bot", telefone: "41999999999", _honey: "site.example" })
        .expect(202);
    assert.equal(repository.leads.length, 1);
});

test("métricas anônimas, solicitações e upload funcionam com sessão administrativa", async () => {
    const { app, repository } = await setup();
    const event = {
        id: "event-12345678",
        type: "page_view",
        timestamp: new Date().toISOString(),
        sessionId: "session-12345678",
        page: "produto.html",
        entityType: "product",
        entityId: "tr-700",
        entityName: "TR-700",
        channel: "site",
        formType: "",
        source: "produto.html",
        deviceType: "mobile",
        trafficSource: "google",
        trafficMedium: "organic"
    };
    await request(app).post("/api/analytics/events").set("Origin", "http://localhost")
        .send({ events: [event] }).expect(422);
    await request(app).post("/api/analytics/events").set("Origin", "http://localhost")
        .send({ consent: { version: "2026-07-17", analytics: true }, events: [event] }).expect(202);

    await request(app).post("/api/leads").set("Origin", "http://localhost")
        .send({ motivo: "Assistência técnica", nome: "Operador", telefone: "41999999999" }).expect(201);

    const agent = request.agent(app);
    const csrf = await login(agent);
    const metrics = await agent.get("/api/admin/analytics/events").expect(200);
    assert.equal(metrics.body.events.length, 1);
    assert.equal(metrics.body.events[0].deviceType, "mobile");
    assert.equal(metrics.body.events[0].trafficSource, "google");
    assert.equal(metrics.body.events[0].trafficMedium, "organic");
    const leads = await agent.get("/api/admin/leads").expect(200);
    assert.equal(leads.body.total, 1);

    const image = await agent.post("/api/admin/media")
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", csrf)
        .field("alt", "Imagem de teste")
        .attach("file", Buffer.from("imagem"), { filename: "teste.png", contentType: "image/png" })
        .expect(201);
    assert.equal(image.body.asset.publicUrl, "/uploads/tests/test.webp");
    assert.equal(repository.media.length, 1);
});

test("origens externas não podem enviar mutações", async () => {
    const { app } = await setup();
    await request(app).post("/api/leads").set("Origin", "https://site-malicioso.example")
        .send({ motivo: "Contato", nome: "Teste", telefone: "41999999999" })
        .expect(403);
});
