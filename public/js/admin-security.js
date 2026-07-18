(function () {
    "use strict";

    const api = window.BrutusmaqAdminApi;
    const ui = window.BrutusmaqAdminUI;
    const alertBox = document.getElementById("adminSecurityAlert");
    const setupForm = document.getElementById("adminMfaSetupForm");
    const setupResult = document.getElementById("adminMfaSetupResult");
    const enableForm = document.getElementById("adminMfaEnableForm");
    const disableForm = document.getElementById("adminMfaDisableForm");
    const passwordForm = document.getElementById("adminPasswordChangeForm");
    const sessionList = document.getElementById("adminSessionList");
    const eventRows = document.getElementById("adminSecurityEventRows");
    const recoveryPanel = document.getElementById("adminRecoveryCodes");
    const recoveryList = document.getElementById("adminRecoveryCodeList");
    let securityState = null;
    let recoveryCodes = [];

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
    }

    function showAlert(message, success) {
        if (!alertBox) return;
        alertBox.textContent = message || "";
        alertBox.hidden = !message;
        alertBox.classList.toggle("is-success", Boolean(success));
    }

    function formatDate(value) {
        const date = new Date(value || "");
        if (Number.isNaN(date.getTime())) return "Não informado";
        return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
    }

    function deviceLabel(userAgent) {
        const value = String(userAgent || "");
        const browser = /Edg\//.test(value) ? "Edge"
            : /Firefox\//.test(value) ? "Firefox"
                : /Chrome\//.test(value) ? "Chrome"
                    : /Safari\//.test(value) ? "Safari" : "Navegador";
        const system = /Android/.test(value) ? "Android"
            : /iPhone|iPad/.test(value) ? "iPhone / iPad"
                : /Windows/.test(value) ? "Windows"
                    : /Mac OS/.test(value) ? "macOS"
                        : /Linux/.test(value) ? "Linux" : "dispositivo não identificado";
        return `${browser} em ${system}`;
    }

    function eventLabel(type) {
        return {
            admin_login: "Entrada no painel",
            admin_login_password: "Senha confirmada",
            admin_mfa_login: "Verificação em dois fatores",
            admin_logout: "Saída do painel",
            password_reset_request: "Recuperação solicitada",
            password_reset: "Senha redefinida",
            password_change: "Senha alterada",
            mfa_setup: "Configuração de MFA iniciada",
            mfa_enable: "MFA ativado",
            mfa_disable: "MFA desativado",
            sessions_revoke_others: "Outras sessões encerradas"
        }[type] || String(type || "Evento de segurança").replace(/_/g, " ");
    }

    function outcomeLabel(outcome) {
        return {
            success: "Sucesso",
            failure: "Falha",
            blocked: "Bloqueado",
            info: "Informativo"
        }[outcome] || outcome;
    }

    function render(data) {
        securityState = data.security || {};
        const sessions = data.sessions || [];
        const events = data.events || [];
        const enabled = Boolean(securityState.mfaEnabled);

        setText("adminMfaStatus", enabled ? "Ativa" : "Inativa");
        setText("adminMfaStatusDetail", enabled ? "Código exigido após a senha" : "Ative antes da publicação");
        setText("adminSessionCount", sessions.length);
        setText("adminRecoveryCount", securityState.recoveryCodesRemaining || 0);
        setText("adminMfaBadge", enabled ? "Ativo" : "Inativo");

        const badge = document.getElementById("adminMfaBadge");
        badge?.classList.toggle("is-published", enabled);
        badge?.classList.toggle("is-draft", !enabled);
        if (setupForm) setupForm.hidden = enabled;
        if (disableForm) disableForm.hidden = !enabled;
        if (setupResult && enabled && !recoveryCodes.length) setupResult.hidden = true;
        const passwordMfaField = document.getElementById("adminPasswordMfaField");
        if (passwordMfaField) {
            passwordMfaField.hidden = !enabled;
            const input = passwordMfaField.querySelector("input");
            if (input) input.required = enabled;
        }

        if (securityState.mfaRequired && !enabled) {
            showAlert("A autenticação em dois fatores é obrigatória no ambiente de produção. Configure o autenticador antes de publicar.");
        } else if (enabled && !alertBox?.classList.contains("is-success")) {
            showAlert("Sua conta está protegida por senha e autenticação em dois fatores.", true);
        }

        if (sessionList) {
            sessionList.innerHTML = sessions.length ? sessions.map((session) => `<div class="admin-session-item">
                <div><strong>${escapeHtml(deviceLabel(session.userAgent))}</strong><small>Conectada em ${escapeHtml(formatDate(session.createdAt))}</small></div>
                <span>Último acesso<br><strong>${escapeHtml(formatDate(session.lastSeenAt))}</strong></span>
                ${session.current ? '<span class="admin-session-current">Sessão atual</span>' : `<span>Expira em<br><strong>${escapeHtml(formatDate(session.expiresAt))}</strong></span>`}
            </div>`).join("") : "<p>Nenhuma sessão ativa encontrada.</p>";
        }

        if (eventRows) {
            eventRows.innerHTML = events.length ? events.map((event) => `<tr>
                <td>${escapeHtml(eventLabel(event.type))}</td>
                <td><span class="admin-status ${event.outcome === "success" ? "is-published" : event.outcome === "failure" || event.outcome === "blocked" ? "is-warning" : "is-draft"}">${escapeHtml(outcomeLabel(event.outcome))}</span></td>
                <td>${escapeHtml(formatDate(event.createdAt))}</td>
                <td>${escapeHtml(event.requestId ? event.requestId.slice(0, 12) : "-")}</td>
            </tr>`).join("") : '<tr><td colspan="4">Nenhum evento de segurança registrado.</td></tr>';
        }
    }

    async function refresh() {
        if (!api?.isDatabase?.()) {
            showAlert("Conecte a API e o MySQL para gerenciar a segurança da conta.");
            document.querySelectorAll(".admin-security-view form input, .admin-security-view form button, #adminRevokeSessions").forEach((control) => {
                control.disabled = true;
            });
            return;
        }
        if (api.isMfaSetupRequired?.() && !document.getElementById("view-security")?.classList.contains("is-active")) {
            document.querySelector('[data-admin-view="security"]')?.click();
        }
        const button = document.getElementById("adminRefreshSecurity");
        if (button) button.disabled = true;
        try {
            render(await api.getSecurity());
        } catch (error) {
            showAlert(error.message || "Não foi possível carregar a segurança da conta.");
        } finally {
            if (button) button.disabled = false;
        }
    }

    setupForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!setupForm.checkValidity()) return setupForm.reportValidity();
        const submit = setupForm.querySelector('button[type="submit"]');
        if (submit) submit.disabled = true;
        try {
            const result = await api.setupMfa(String(new FormData(setupForm).get("password") || ""));
            document.getElementById("adminMfaQrCode").src = result.qrCode;
            setText("adminMfaSecret", result.secret);
            setupResult.hidden = false;
            setupForm.reset();
            showAlert("Escaneie o QR Code e confirme com o código exibido no aplicativo.");
        } catch (error) {
            showAlert(error.message || "Não foi possível iniciar a configuração.");
        } finally {
            if (submit) submit.disabled = false;
        }
    });

    enableForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!enableForm.checkValidity()) return enableForm.reportValidity();
        const submit = enableForm.querySelector('button[type="submit"]');
        if (submit) submit.disabled = true;
        try {
            const result = await api.enableMfa(String(new FormData(enableForm).get("code") || ""));
            recoveryCodes = result.recoveryCodes || [];
            if (recoveryList) recoveryList.innerHTML = recoveryCodes.map((code) => `<code>${escapeHtml(code)}</code>`).join("");
            if (recoveryPanel) recoveryPanel.hidden = false;
            enableForm.reset();
            await refresh();
            showAlert("Autenticação em dois fatores ativada. Guarde os códigos de recuperação antes de sair desta página.", true);
        } catch (error) {
            showAlert(error.message || "Não foi possível ativar o autenticador.");
        } finally {
            if (submit) submit.disabled = false;
        }
    });

    disableForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!disableForm.checkValidity()) return disableForm.reportValidity();
        if (!window.confirm("Desativar a autenticação em dois fatores reduzirá a proteção da conta. Continuar?")) return;
        const data = new FormData(disableForm);
        const submit = disableForm.querySelector('button[type="submit"]');
        if (submit) submit.disabled = true;
        try {
            await api.disableMfa(String(data.get("password") || ""), String(data.get("code") || ""));
            recoveryCodes = [];
            recoveryPanel.hidden = true;
            disableForm.reset();
            await refresh();
            showAlert("Autenticação em dois fatores desativada.");
        } catch (error) {
            showAlert(error.message || "Não foi possível desativar o autenticador.");
        } finally {
            if (submit) submit.disabled = false;
        }
    });

    passwordForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(passwordForm);
        const next = String(data.get("newPassword") || "");
        const confirmation = String(data.get("confirmPassword") || "");
        const confirmationInput = passwordForm.querySelector('[name="confirmPassword"]');
        confirmationInput?.setCustomValidity(next === confirmation ? "" : "As senhas não coincidem.");
        if (!passwordForm.checkValidity()) return passwordForm.reportValidity();
        const submit = passwordForm.querySelector('button[type="submit"]');
        if (submit) submit.disabled = true;
        try {
            await api.changePassword({
                currentPassword: String(data.get("currentPassword") || ""),
                newPassword: next,
                code: String(data.get("code") || "")
            });
            window.location.href = "painel-admin.html";
        } catch (error) {
            const validationMessage = Array.isArray(error.details)
                ? error.details.find((item) => item.field === "newPassword")?.message
                : "";
            showAlert(validationMessage || error.message || "Não foi possível alterar a senha.");
            if (submit) submit.disabled = false;
        }
    });

    document.getElementById("adminRevokeSessions")?.addEventListener("click", async () => {
        if (!window.confirm("Encerrar todas as outras sessões administrativas?")) return;
        try {
            const result = await api.revokeOtherSessions();
            await refresh();
            showAlert(`${result.revoked || 0} sessão(ões) encerrada(s).`, true);
        } catch (error) {
            showAlert(error.message || "Não foi possível encerrar as sessões.");
        }
    });

    document.getElementById("adminDownloadRecoveryCodes")?.addEventListener("click", () => {
        if (!recoveryCodes.length) return;
        const blob = new Blob([
            `Códigos de recuperação do painel Brutusmaq\nGerados em ${new Date().toLocaleString("pt-BR")}\n\n${recoveryCodes.join("\n")}\n`
        ], { type: "text/plain;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "brutusmaq-codigos-recuperacao.txt";
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    });

    document.getElementById("adminRefreshSecurity")?.addEventListener("click", refresh);
    document.querySelector('[data-admin-view="security"]')?.addEventListener("click", refresh);
    window.addEventListener("brutusmaq:admin-ready", refresh);
    api?.ready?.then(refresh);
}());
