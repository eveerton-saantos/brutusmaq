"use strict";

const nodemailer = require("nodemailer");

function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function safeHeader(value) {
    return String(value || "").replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
}

function createMailer(config) {
    if (!config.smtp.enabled) {
        return Object.freeze({
            enabled: false,
            sendLead: async () => ({ delivered: false, reason: "smtp_not_configured" }),
            sendPasswordReset: async () => ({ delivered: false, reason: "smtp_not_configured" }),
            sendInvitation: async () => ({ delivered: false, reason: "smtp_not_configured" })
        });
    }

    const transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
        disableFileAccess: true,
        disableUrlAccess: true,
        pool: true,
        maxConnections: 3,
        maxMessages: 100
    });

    return Object.freeze({
        enabled: true,
        async sendLead(lead, publicId) {
            const rows = [
                ["Protocolo", publicId],
                ["Motivo", lead.reason],
                ["Nome", lead.name],
                ["Telefone", lead.phone],
                ["E-mail", lead.email],
                ["Empresa", lead.company],
                ["Cidade / Estado", lead.cityState],
                ["Interesse", lead.interest],
                ["Equipamento", lead.productName],
                ["Mensagem", lead.message],
                ["Origem", lead.source]
            ].filter((item) => item[1]);
            const html = `<h1>Nova solicitação pelo site</h1><table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse">${rows
                .map(([label, value]) => `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`)
                .join("")}</table>`;
            await transporter.sendMail({
                from: config.smtp.from,
                to: config.smtp.contactTo,
                replyTo: lead.email || undefined,
                subject: safeHeader(`Nova solicitação: ${lead.reason}`).slice(0, 180),
                text: rows.map(([label, value]) => `${label}: ${value}`).join("\n"),
                html,
                disableFileAccess: true,
                disableUrlAccess: true
            });
            return { delivered: true };
        },
        async sendPasswordReset(admin, resetUrl) {
            const name = safeHeader(admin.name || "Administrador");
            await transporter.sendMail({
                from: config.smtp.from,
                to: admin.email,
                subject: "Redefinição de senha do painel Brutusmaq",
                text: [
                    `Olá, ${name}.`,
                    "",
                    "Recebemos uma solicitação para redefinir a senha do painel Brutusmaq.",
                    `Use este endereço nos próximos 30 minutos: ${resetUrl}`,
                    "",
                    "Se você não solicitou a alteração, ignore esta mensagem."
                ].join("\n"),
                html: `<h1>Redefinição de senha</h1>
                    <p>Olá, ${escapeHtml(name)}.</p>
                    <p>Use o botão abaixo nos próximos 30 minutos para criar uma nova senha do painel.</p>
                    <p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 18px;background:#e85d04;color:#fff;text-decoration:none">Criar nova senha</a></p>
                    <p>Se você não solicitou a alteração, ignore esta mensagem.</p>`,
                disableFileAccess: true,
                disableUrlAccess: true
            });
            return { delivered: true };
        },
        async sendInvitation(admin, setupUrl, expiresAt) {
            const name = safeHeader(admin.name || "Funcionário");
            const expiration = new Date(expiresAt).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "America/Sao_Paulo"
            });
            await transporter.sendMail({
                from: config.smtp.from,
                to: admin.email,
                subject: "Convite para o painel Brutusmaq",
                text: [
                    `Olá, ${name}.`,
                    "",
                    "Você foi convidado para colaborar no painel Brutusmaq.",
                    `Crie sua senha usando este endereço até ${expiration}: ${setupUrl}`,
                    "",
                    "O link é pessoal, expira após o uso e não deve ser encaminhado."
                ].join("\n"),
                html: `<h1>Convite para o painel Brutusmaq</h1>
                    <p>Olá, ${escapeHtml(name)}.</p>
                    <p>Você foi convidado para colaborar no cadastro de produtos e artigos.</p>
                    <p><a href="${escapeHtml(setupUrl)}" style="display:inline-block;padding:12px 18px;background:#e85d04;color:#fff;text-decoration:none">Criar minha senha</a></p>
                    <p>Este link pessoal é válido até ${escapeHtml(expiration)} e expira após o uso.</p>`,
                disableFileAccess: true,
                disableUrlAccess: true
            });
            return { delivered: true };
        }
    });
}

module.exports = { createMailer };
