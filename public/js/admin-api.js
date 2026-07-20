(function () {
    "use strict";

    const catalogStore = window.BrutusmaqCatalogStore;
    const blogStore = window.BrutusmaqBlogStore;
    const analyticsStore = window.BrutusmaqAnalytics;
    const authShell = document.getElementById("adminAuthShell");
    const app = document.getElementById("adminApp");
    const authTitle = document.getElementById("adminAuthTitle");
    const loginForm = document.getElementById("adminLoginForm");
    const mfaLoginForm = document.getElementById("adminMfaLoginForm");
    const forgotPasswordForm = document.getElementById("adminForgotPasswordForm");
    const accessRequestForm = document.getElementById("adminAccessRequestForm");
    const resetPasswordForm = document.getElementById("adminResetPasswordForm");
    const authMessage = document.getElementById("adminAuthMessage");
    const mfaMessage = document.getElementById("adminMfaMessage");
    const forgotMessage = document.getElementById("adminForgotMessage");
    const accessRequestMessage = document.getElementById("adminAccessRequestMessage");
    const resetMessage = document.getElementById("adminResetMessage");
    const queryParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const resetToken = hashParams.get("reset") || queryParams.get("reset") || "";
    const invitationToken = hashParams.get("invite") || "";
    if (resetToken || invitationToken) {
        queryParams.delete("reset");
        const remainingQuery = queryParams.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${remainingQuery ? `?${remainingQuery}` : ""}`);
    }
    const migrationNotice = document.getElementById("adminMigrationNotice");
    const healthCheckIntervalMs = 30000;
    const healthTimeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    let healthTimer = 0;
    const localSnapshot = {
        catalog: catalogStore?.getLocalCatalog?.() || null,
        articles: blogStore?.getLocalArticles?.() || null
    };
    const state = {
        mode: "checking",
        user: null,
        csrfToken: "",
        authenticated: false,
        challengeToken: "",
        mfaSetupRequired: false,
        health: "checking",
        healthCheckedAt: null,
        editorialMeta: { product: [], article: [] }
    };

    class ApiError extends Error {
        constructor(status, code, message, details) {
            super(message);
            this.name = "ApiError";
            this.status = status;
            this.code = code;
            this.details = details;
        }
    }

    function isLocalHost() {
        return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    }

    function showAuthMessage(message) {
        if (!authMessage) return;
        authMessage.textContent = message || "";
        authMessage.hidden = !message;
    }

    function setFormMessage(element, message) {
        if (!element) return;
        element.textContent = message || "";
        element.hidden = !message;
    }

    function showAuthMode(mode, message) {
        const titles = {
            login: "Acessar o painel",
            mfa: "Confirmar acesso",
            forgot: "Recuperar senha",
            access: "Solicitar acesso",
            reset: invitationToken ? "Ativar acesso" : "Criar nova senha"
        };
        document.querySelectorAll("[data-auth-form]").forEach((form) => {
            form.hidden = form.dataset.authForm !== mode;
        });
        if (authTitle) authTitle.textContent = titles[mode] || titles.login;
        if (mode === "login") showAuthMessage(message || "");
        if (mode === "mfa") setFormMessage(mfaMessage, message || "Use o código do seu aplicativo autenticador.");
        if (mode === "forgot") setFormMessage(forgotMessage, message || "");
        if (mode === "access") setFormMessage(accessRequestMessage, message || "");
        if (mode === "reset") {
            const submit = document.getElementById("adminResetSubmit");
            if (submit) submit.textContent = invitationToken ? "Ativar minha conta" : "Criar nova senha";
            setFormMessage(
                resetMessage,
                message || (invitationToken ? "Crie uma senha exclusiva para concluir seu acesso ao painel." : "")
            );
        }
    }

    function showAuth(message) {
        document.body.classList.add("admin-locked");
        if (app) {
            app.hidden = true;
            app.setAttribute("aria-hidden", "true");
        }
        if (authShell) authShell.hidden = false;
        showAuthMode("login", message);
    }

    function roleLabel(role) {
        return { owner: "Proprietário", editor: "Funcionário editorial", viewer: "Somente leitura" }[role] || "Administrador";
    }

    function editorialKeys(content) {
        const admin = content?._admin || {};
        return [admin.uid, content?.id, content?.slug].filter(Boolean).map(String);
    }

    function captureEditorialMeta(kind, items, replace) {
        if (!state.editorialMeta[kind]) return;
        if (replace) state.editorialMeta[kind] = [];
        (items || []).forEach((content) => {
            if (!content || typeof content !== "object") return;
            const keys = editorialKeys(content);
            if (!keys.length) return;
            state.editorialMeta[kind] = state.editorialMeta[kind].filter((entry) => (
                !entry.keys.some((key) => keys.includes(key))
            ));
            const admin = content._admin || {};
            if (!admin.submissionId && !admin.submissionStatus && !admin.reviewNote) return;
            state.editorialMeta[kind].push({
                keys,
                submissionId: admin.submissionId || "",
                submissionStatus: admin.submissionStatus || "",
                reviewNote: admin.reviewNote || "",
                reviewedBy: admin.reviewedBy || null,
                version: admin.version,
                updatedAt: admin.updatedAt || ""
            });
        });
    }

    function getEditorialMeta(kind, content) {
        const keys = typeof content === "string" ? [content] : editorialKeys(content);
        const entry = state.editorialMeta[kind]?.find((candidate) => candidate.keys.some((key) => keys.includes(key)));
        return entry ? { ...entry, keys: [...entry.keys] } : null;
    }

    function updateHealthIndicator() {
        const container = document.querySelector(".admin-topbar-status");
        const label = document.getElementById("adminDataMode");
        const dot = document.querySelector(".admin-status-dot");
        const states = {
            checking: { label: "Verificando servidor", detail: "Verificando a conexão com a API" },
            online: { label: "Site e servidor online", detail: "API e banco de dados estão respondendo normalmente" },
            degraded: { label: "Servidor online · banco indisponível", detail: "A API respondeu, mas o banco de dados não está acessível" },
            offline: { label: "API offline · prévia local", detail: "O painel não conseguiu acessar a API deste endereço" }
        };
        const current = states[state.health] || states.checking;
        if (label) label.textContent = current.label;
        if (dot) {
            dot.classList.remove("is-checking", "is-online", "is-degraded", "is-offline");
            dot.classList.add(`is-${state.health}`);
        }
        if (container) {
            const checked = state.healthCheckedAt ? ` Última verificação: ${healthTimeFormatter.format(state.healthCheckedAt)}.` : "";
            container.dataset.health = state.health;
            container.title = `${current.detail}.${checked}`;
            container.setAttribute("aria-label", current.label);
        }
    }

    function setHealthStatus(value) {
        state.health = ["checking", "online", "degraded", "offline"].includes(value) ? value : "offline";
        state.healthCheckedAt = new Date();
        if (state.mode === "checking") updateHealthIndicator();
        else updateInterface();
        return state.health;
    }

    async function checkHealth() {
        if (!window.fetch || window.navigator?.onLine === false) return setHealthStatus("offline");
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        const timeout = controller ? window.setTimeout(() => controller.abort(), 5000) : 0;
        try {
            const response = await window.fetch("/api/health", {
                headers: { Accept: "application/json" },
                cache: "no-store",
                credentials: "same-origin",
                signal: controller?.signal
            });
            const contentType = response.headers.get("content-type") || "";
            const payload = contentType.includes("application/json") ? await response.json().catch(() => ({})) : {};
            if (payload.service !== "brutusmaq") return setHealthStatus("offline");
            if (response.ok && payload.status === "ok" && payload.database) return setHealthStatus("online");
            return setHealthStatus("degraded");
        } catch (error) {
            return setHealthStatus("offline");
        } finally {
            if (timeout) window.clearTimeout(timeout);
        }
    }

    function startHealthMonitoring() {
        checkHealth();
        window.clearInterval(healthTimer);
        healthTimer = window.setInterval(() => {
            if (!document.hidden) checkHealth();
        }, healthCheckIntervalMs);
        window.addEventListener("online", checkHealth);
        window.addEventListener("offline", () => setHealthStatus("offline"));
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) checkHealth();
        });
    }

    function updateInterface() {
        const databaseMode = state.mode === "database";
        const databaseConnected = databaseMode && state.health === "online";
        const degradedMode = state.health === "degraded";
        const accountName = document.getElementById("adminAccountName");
        const accountRole = document.getElementById("adminAccountRole");
        const accountAvatar = document.getElementById("adminAccountAvatar");
        const localNotice = document.querySelector(".admin-local-notice div");
        const analyticsNotice = document.querySelector(".admin-analytics-notice div");
        const analyticsMode = document.querySelector(".admin-analytics-mode");
        const logoutButton = document.getElementById("adminLogout");
        const interfaceRole = databaseMode ? (state.user?.role || "viewer") : "local";
        const analyticsClearButton = document.getElementById("adminAnalyticsClear");
        const leadStatusSelect = document.getElementById("adminLeadDialogStatus");
        const leadStatusSave = document.getElementById("adminSaveLeadStatus");

        document.body.dataset.adminRole = interfaceRole;
        document.body.dataset.adminMode = state.mode;
        document.querySelectorAll("[data-owner-only]").forEach((element) => {
            element.hidden = databaseMode && interfaceRole !== "owner";
        });
        if (analyticsClearButton) analyticsClearButton.hidden = databaseMode && interfaceRole !== "owner";
        if (leadStatusSelect) leadStatusSelect.disabled = databaseMode && interfaceRole === "viewer";
        if (leadStatusSave) leadStatusSave.hidden = databaseMode && interfaceRole === "viewer";

        if (accountName) accountName.textContent = state.user?.name || "Administrador local";
        if (accountRole) accountRole.textContent = databaseMode
            ? roleLabel(state.user?.role)
            : (degradedMode ? "Servidor online · MySQL indisponível" : "Sem conexão com a API");
        if (accountAvatar) {
            const initials = String(state.user?.name || "Admin")
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part.charAt(0))
                .join("")
                .toUpperCase();
            accountAvatar.textContent = initials || "AD";
        }
        if (localNotice) {
            localNotice.innerHTML = databaseConnected
                ? "<strong>Banco central ativo</strong><p>Produtos e artigos são publicados pela API e ficam disponíveis para todos os visitantes.</p>"
                : (databaseMode
                    ? "<strong>Conexão com o servidor interrompida</strong><p>Os dados já carregados continuam visíveis, mas alterações devem aguardar a API voltar a responder.</p>"
                    : degradedMode
                    ? "<strong>Servidor acessível, banco indisponível</strong><p>O site respondeu, mas o MySQL não está conectado. As alterações permanecem somente neste navegador.</p>"
                    : "<strong>Prévia local ativa</strong><p>Abra o painel pelo servidor Express em http://localhost:3000. Enquanto a API estiver indisponível, as alterações ficam somente neste navegador.</p>");
        }
        if (analyticsNotice) {
            analyticsNotice.innerHTML = databaseConnected
                ? "<strong>Métricas anônimas centralizadas</strong><p>Eventos dos visitantes são reunidos no banco sem armazenar nome, e-mail, telefone ou mensagem.</p>"
                : (databaseMode
                    ? "<strong>Atualização das métricas interrompida</strong><p>O histórico carregado permanece visível enquanto o painel tenta restabelecer a conexão com a API.</p>"
                    : degradedMode
                    ? "<strong>Métricas locais: banco indisponível</strong><p>A API respondeu, mas não consegue acessar o MySQL. Os eventos continuam preservados neste navegador.</p>"
                    : "<strong>Métricas anônimas deste navegador</strong><p>A API deste endereço não está disponível; os eventos continuam preservados localmente.</p>");
        }
        if (analyticsMode) analyticsMode.textContent = databaseConnected ? "BANCO CENTRAL" : (databaseMode ? "SEM CONEXÃO" : "MODO LOCAL");
        if (logoutButton) logoutButton.hidden = !databaseMode;
        if (migrationNotice) {
            const hasLocalData = Boolean(localSnapshot.catalog || localSnapshot.articles);
            migrationNotice.hidden = !databaseConnected || !hasLocalData || state.user?.role !== "owner";
        }
        updateHealthIndicator();
    }

    function showApp(mode) {
        state.mode = mode;
        document.body.classList.remove("admin-locked");
        if (authShell) authShell.hidden = true;
        if (app) {
            app.hidden = false;
            app.setAttribute("aria-hidden", "false");
        }
        updateInterface();
    }

    async function request(path, options) {
        const settings = options || {};
        const headers = { Accept: "application/json", ...(settings.headers || {}) };
        if (settings.body != null && !(settings.body instanceof FormData)) headers["Content-Type"] = "application/json";
        if (settings.csrf !== false && state.csrfToken && !["GET", "HEAD"].includes(settings.method || "GET")) {
            headers["X-CSRF-Token"] = state.csrfToken;
        }
        const response = await window.fetch(path, {
            method: settings.method || "GET",
            headers,
            credentials: "same-origin",
            body: settings.body instanceof FormData
                ? settings.body
                : (settings.body == null ? undefined : JSON.stringify(settings.body))
        });
        const contentType = response.headers.get("content-type") || "";
        const payload = contentType.includes("application/json") ? await response.json().catch(() => ({})) : {};
        if (!response.ok) {
            const error = new ApiError(
                response.status,
                payload.error?.code || "request_failed",
                payload.error?.message || "Não foi possível concluir a operação.",
                payload.error?.details
            );
            const publicAuthRequest = [
                "/api/auth/login",
                "/api/auth/mfa",
                "/api/auth/password/forgot",
                "/api/auth/password/reset",
                "/api/auth/access-requests",
                "/api/auth/invitations/accept"
            ].includes(path);
            if (response.status === 401 && !publicAuthRequest) {
                state.authenticated = false;
                state.csrfToken = "";
                showAuth("Sua sessão expirou. Entre novamente para continuar.");
            }
            throw error;
        }
        return payload;
    }

    function applyBootstrap(payload) {
        captureEditorialMeta("product", [
            ...(payload.catalog?.novos || []),
            ...(payload.catalog?.usados || [])
        ], true);
        captureEditorialMeta("article", payload.articles || [], true);
        if (payload.catalog && catalogStore?.setRemoteCatalog) catalogStore.setRemoteCatalog(payload.catalog);
        if (payload.articles && blogStore?.setRemoteArticles) blogStore.setRemoteArticles(payload.articles);
        state.user = payload.user || state.user;
        state.mfaSetupRequired = Boolean(payload.mfaSetupRequired);
        state.authenticated = true;
        setHealthStatus("online");
        showApp("database");
        window.dispatchEvent(new CustomEvent("brutusmaq:admin-ready", {
            detail: { mode: state.mode, user: state.user }
        }));
    }

    async function refreshAnalytics() {
        if (state.mode !== "database" || state.user?.role !== "owner" || !analyticsStore?.setRemoteState) return null;
        const payload = await request("/api/admin/analytics/events?limit=15000");
        analyticsStore.setRemoteState(payload);
        return payload;
    }

    async function bootstrap() {
        const payload = await request("/api/admin/bootstrap");
        applyBootstrap(payload);
        refreshAnalytics().catch(() => {});
        return payload;
    }

    async function initialize() {
        if (resetToken || invitationToken) {
            showAuth("");
            showAuthMode("reset");
            return false;
        }
        if (!window.fetch) {
            setHealthStatus("offline");
            if (isLocalHost()) {
                showApp("local");
                window.dispatchEvent(new CustomEvent("brutusmaq:admin-ready", { detail: { mode: "local" } }));
                return false;
            }
            showAuth("Este navegador não oferece os recursos necessários para acessar o painel.");
            return false;
        }
        try {
            const session = await request("/api/auth/session", { csrf: false });
            state.user = session.user;
            state.csrfToken = session.csrfToken;
            state.authenticated = true;
            state.mfaSetupRequired = Boolean(session.mfaSetupRequired);
            await bootstrap();
            return true;
        } catch (error) {
            if (error.status === 401) {
                if (isLocalHost()) {
                    const health = await checkHealth();
                    if (health !== "online") {
                        showApp("local");
                        window.dispatchEvent(new CustomEvent("brutusmaq:admin-ready", { detail: { mode: "local" } }));
                        return false;
                    }
                }
                showAuth("");
                return false;
            }
            if (isLocalHost()) {
                await checkHealth();
                showApp("local");
                window.dispatchEvent(new CustomEvent("brutusmaq:admin-ready", { detail: { mode: "local" } }));
                return false;
            }
            showAuth("O servidor administrativo está indisponível. Tente novamente em alguns minutos.");
            return false;
        }
    }

    async function login(credentials) {
        const payload = await request("/api/auth/login", {
            method: "POST",
            csrf: false,
            body: credentials
        });
        if (payload.mfaRequired) {
            state.challengeToken = payload.challengeToken;
            return payload;
        }
        state.user = payload.user;
        state.csrfToken = payload.csrfToken;
        state.authenticated = true;
        return bootstrap();
    }

    async function verifyMfa(code) {
        if (!state.challengeToken) throw new ApiError(401, "mfa_challenge_missing", "Entre novamente para continuar.");
        const payload = await request("/api/auth/mfa", {
            method: "POST",
            csrf: false,
            body: { challengeToken: state.challengeToken, code }
        });
        state.challengeToken = "";
        state.user = payload.user;
        state.csrfToken = payload.csrfToken;
        state.authenticated = true;
        return bootstrap();
    }

    function forgotPassword(email) {
        return request("/api/auth/password/forgot", {
            method: "POST",
            csrf: false,
            body: { email }
        });
    }

    function requestAccess(body) {
        return request("/api/auth/access-requests", {
            method: "POST",
            csrf: false,
            body
        });
    }

    function resetPassword(token, newPassword) {
        return request("/api/auth/password/reset", {
            method: "POST",
            csrf: false,
            body: { token, newPassword }
        });
    }

    function acceptInvitation(token, password) {
        return request("/api/auth/invitations/accept", {
            method: "POST",
            csrf: false,
            body: { token, password }
        });
    }

    async function logout() {
        if (state.mode === "database" && state.authenticated) {
            await request("/api/auth/logout", { method: "POST" });
        }
        state.user = null;
        state.csrfToken = "";
        state.authenticated = false;
        state.challengeToken = "";
        showAuth("Sessão encerrada com segurança.");
    }

    async function migrateLocalData() {
        if (state.mode !== "database") throw new Error("Conecte o banco de dados antes de migrar conteúdo.");
        if (localSnapshot.catalog) {
            const result = await request("/api/admin/catalog", { method: "PUT", body: { catalog: localSnapshot.catalog } });
            catalogStore?.setRemoteCatalog?.(result.catalog);
        }
        if (localSnapshot.articles) {
            const result = await request("/api/admin/articles", { method: "PUT", body: { articles: localSnapshot.articles } });
            blogStore?.setRemoteArticles?.(result.articles);
        }
        if (migrationNotice) migrationNotice.hidden = true;
        return true;
    }

    async function enableMfa(code) {
        const result = await request("/api/admin/security/mfa/enable", { method: "POST", body: { code } });
        if (state.user) state.user.mfaEnabled = true;
        state.mfaSetupRequired = false;
        return result;
    }

    async function disableMfa(password, code) {
        const result = await request("/api/admin/security/mfa/disable", {
            method: "POST",
            body: { password, code }
        });
        if (state.user) state.user.mfaEnabled = false;
        state.mfaSetupRequired = Boolean(result.mfaSetupRequired);
        return result;
    }

    async function saveProduct(type, product, uid) {
        const result = await request(
            uid ? `/api/admin/products/${encodeURIComponent(uid)}` : "/api/admin/products",
            { method: uid ? "PUT" : "POST", body: { type: type === "usado" ? "used" : "new", product } }
        );
        if (result.product) captureEditorialMeta("product", [result.product], false);
        return result;
    }

    async function saveArticle(article, uid) {
        const result = await request(
            uid ? `/api/admin/articles/${encodeURIComponent(uid)}` : "/api/admin/articles",
            { method: uid ? "PUT" : "POST", body: { article } }
        );
        if (result.article) captureEditorialMeta("article", [result.article], false);
        return result;
    }

    const api = {
        ready: null,
        getMode: () => state.mode,
        getHealth: () => ({ status: state.health, checkedAt: state.healthCheckedAt?.toISOString() || null }),
        getUser: () => state.user ? { ...state.user } : null,
        getEditorialMeta,
        isMfaSetupRequired: () => state.mfaSetupRequired,
        isDatabase: () => state.mode === "database",
        request,
        login,
        verifyMfa,
        forgotPassword,
        requestAccess,
        resetPassword,
        acceptInvitation,
        logout,
        bootstrap,
        refreshAnalytics,
        checkHealth,
        migrateLocalData,
        saveProduct,
        deleteProduct: (uid) => request(`/api/admin/products/${encodeURIComponent(uid)}`, { method: "DELETE" }),
        restoreProduct: (uid) => request(`/api/admin/products/${encodeURIComponent(uid)}/restore`, { method: "POST" }),
        replaceCatalog: (catalog) => request("/api/admin/catalog", { method: "PUT", body: { catalog } }),
        saveArticle,
        deleteArticle: (uid) => request(`/api/admin/articles/${encodeURIComponent(uid)}`, { method: "DELETE" }),
        restoreArticle: (uid) => request(`/api/admin/articles/${encodeURIComponent(uid)}/restore`, { method: "POST" }),
        replaceArticles: (articles) => request("/api/admin/articles", { method: "PUT", body: { articles } }),
        getReviews: (params) => request(`/api/admin/reviews?${new URLSearchParams(params || { status: "pending" }).toString()}`),
        approveReview: (id, note) => request(`/api/admin/reviews/${encodeURIComponent(id)}/approve`, { method: "POST", body: { note: note || "" } }),
        rejectReview: (id, note) => request(`/api/admin/reviews/${encodeURIComponent(id)}/reject`, { method: "POST", body: { note } }),
        cancelSubmission: (id) => request(`/api/admin/submissions/${encodeURIComponent(id)}`, { method: "DELETE" }),
        getTeam: () => request("/api/admin/team"),
        inviteTeamMember: (body) => request("/api/admin/team/invitations", { method: "POST", body }),
        resendTeamInvitation: (id) => request(`/api/admin/team/${encodeURIComponent(id)}/resend-invitation`, { method: "POST" }),
        updateTeamMember: (id, changes) => request(`/api/admin/team/${encodeURIComponent(id)}`, { method: "PATCH", body: changes }),
        getAccessRequests: (status) => request(`/api/admin/access-requests?status=${encodeURIComponent(status || "pending")}`),
        approveAccessRequest: (id, role) => request(`/api/admin/access-requests/${encodeURIComponent(id)}/approve`, { method: "POST", body: { role } }),
        rejectAccessRequest: (id, note) => request(`/api/admin/access-requests/${encodeURIComponent(id)}/reject`, { method: "POST", body: { note: note || "" } }),
        getLeads: (params) => state.user?.role === "owner"
            ? request(`/api/admin/leads?${new URLSearchParams(params || {}).toString()}`)
            : Promise.resolve({ items: [], total: 0, statusCounts: {} }),
        updateLeadStatus: (id, status) => state.user?.role === "owner"
            ? request(`/api/admin/leads/${encodeURIComponent(id)}`, { method: "PATCH", body: { status } })
            : Promise.reject(new ApiError(403, "owner_required", "Somente o proprietário pode alterar solicitações.")),
        clearAnalytics: () => request("/api/admin/analytics/events", { method: "DELETE" }),
        getSecurity: () => request("/api/admin/security"),
        changePassword: (body) => request("/api/admin/security/password", { method: "POST", body }),
        setupMfa: (password) => request("/api/admin/security/mfa/setup", { method: "POST", body: { password } }),
        enableMfa,
        disableMfa,
        revokeOtherSessions: () => request("/api/admin/security/sessions/revoke-others", { method: "POST" }),
        uploadMedia: async (file, alt) => {
            const body = new FormData();
            body.append("file", file);
            body.append("alt", alt || "");
            return request("/api/admin/media", { method: "POST", body });
        }
    };
    loginForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!loginForm.checkValidity()) {
            loginForm.reportValidity();
            return;
        }
        const submit = loginForm.querySelector('button[type="submit"]');
        const data = new FormData(loginForm);
        if (submit) {
            submit.disabled = true;
            submit.textContent = "Verificando acesso...";
        }
        showAuthMessage("");
        try {
            const result = await login({
                email: String(data.get("email") || "").trim(),
                password: String(data.get("password") || ""),
                remember: data.get("remember") === "on"
            });
            loginForm.reset();
            if (result?.mfaRequired) showAuthMode("mfa", "Digite o código do autenticador ou um código de recuperação.");
        } catch (error) {
            showAuthMessage(error.message || "Não foi possível entrar no painel.");
        } finally {
            if (submit) {
                submit.disabled = false;
                submit.textContent = "Entrar no painel";
            }
        }
    });

    mfaLoginForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!mfaLoginForm.checkValidity()) {
            mfaLoginForm.reportValidity();
            return;
        }
        const submit = mfaLoginForm.querySelector('button[type="submit"]');
        const code = String(new FormData(mfaLoginForm).get("code") || "").trim();
        if (submit) {
            submit.disabled = true;
            submit.textContent = "Confirmando...";
        }
        setFormMessage(mfaMessage, "");
        try {
            await verifyMfa(code);
            mfaLoginForm.reset();
        } catch (error) {
            setFormMessage(mfaMessage, error.message || "Não foi possível confirmar o código.");
        } finally {
            if (submit) {
                submit.disabled = false;
                submit.textContent = "Confirmar acesso";
            }
        }
    });

    forgotPasswordForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!forgotPasswordForm.checkValidity()) {
            forgotPasswordForm.reportValidity();
            return;
        }
        const submit = forgotPasswordForm.querySelector('button[type="submit"]');
        const email = String(new FormData(forgotPasswordForm).get("email") || "").trim();
        if (submit) submit.disabled = true;
        setFormMessage(forgotMessage, "");
        try {
            const result = await forgotPassword(email);
            setFormMessage(forgotMessage, result.message || "Verifique seu e-mail para continuar.");
        } catch (error) {
            setFormMessage(forgotMessage, error.message || "Não foi possível solicitar a redefinição.");
        } finally {
            if (submit) submit.disabled = false;
        }
    });

    accessRequestForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!accessRequestForm.checkValidity()) {
            accessRequestForm.reportValidity();
            return;
        }
        const data = new FormData(accessRequestForm);
        const submit = accessRequestForm.querySelector('button[type="submit"]');
        if (submit) {
            submit.disabled = true;
            submit.textContent = "Enviando solicitação...";
        }
        setFormMessage(accessRequestMessage, "");
        try {
            const result = await requestAccess({
                name: String(data.get("name") || "").trim(),
                email: String(data.get("email") || "").trim(),
                requestedRole: String(data.get("requestedRole") || "editor"),
                reason: String(data.get("reason") || "").trim()
            });
            accessRequestForm.reset();
            setFormMessage(accessRequestMessage, result.message || "Solicitação enviada para análise.");
        } catch (error) {
            const validationMessage = Array.isArray(error.details) ? error.details[0]?.message : "";
            setFormMessage(accessRequestMessage, validationMessage || error.message || "Não foi possível enviar a solicitação.");
        } finally {
            if (submit) {
                submit.disabled = false;
                submit.textContent = "Enviar solicitação";
            }
        }
    });

    resetPasswordForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(resetPasswordForm);
        const password = String(data.get("newPassword") || "");
        const confirmation = String(data.get("confirmPassword") || "");
        const confirmationInput = resetPasswordForm.querySelector('[name="confirmPassword"]');
        confirmationInput?.setCustomValidity(password === confirmation ? "" : "As senhas não coincidem.");
        if (!resetPasswordForm.checkValidity()) {
            resetPasswordForm.reportValidity();
            return;
        }
        const submit = resetPasswordForm.querySelector('button[type="submit"]');
        if (submit) submit.disabled = true;
        setFormMessage(resetMessage, "");
        try {
            const result = invitationToken
                ? await acceptInvitation(invitationToken, password)
                : await resetPassword(resetToken, password);
            resetPasswordForm.reset();
            window.history.replaceState(null, "", window.location.pathname);
            showAuthMode("login", result.message || (invitationToken
                ? "Acesso ativado. Entre com seu e-mail e a senha criada."
                : "Senha alterada. Entre novamente."));
        } catch (error) {
            const validationMessage = Array.isArray(error.details)
                ? error.details.find((item) => ["password", "newPassword"].includes(item.field))?.message
                : "";
            setFormMessage(resetMessage, validationMessage || error.message || (invitationToken
                ? "Não foi possível ativar este convite. Solicite um novo link ao proprietário."
                : "Não foi possível redefinir a senha."));
        } finally {
            if (submit) submit.disabled = false;
        }
    });

    document.getElementById("adminForgotPasswordOpen")?.addEventListener("click", () => showAuthMode("forgot"));
    document.getElementById("adminAccessRequestOpen")?.addEventListener("click", () => showAuthMode("access"));
    document.querySelectorAll("[data-auth-back]").forEach((button) => {
        button.addEventListener("click", () => {
            state.challengeToken = "";
            if (resetToken) window.history.replaceState(null, "", window.location.pathname);
            showAuthMode("login");
        });
    });

    document.getElementById("adminLogout")?.addEventListener("click", () => {
        logout().catch((error) => showAuthMessage(error.message));
    });
    document.getElementById("adminMigrateLocal")?.addEventListener("click", async () => {
        const confirmed = window.confirm("Enviar os produtos e artigos salvos neste navegador ao banco? O conteúdo atual do banco será substituído.");
        if (!confirmed) return;
        const button = document.getElementById("adminMigrateLocal");
        if (button) button.disabled = true;
        try {
            await migrateLocalData();
            window.BrutusmaqAdminUI?.showToast?.("Dados locais migrados para o banco com sucesso.");
        } catch (error) {
            window.BrutusmaqAdminUI?.showToast?.(error.message || "Não foi possível migrar os dados locais.");
        } finally {
            if (button) button.disabled = false;
        }
    });

    api.ready = initialize();
    startHealthMonitoring();
    window.BrutusmaqAdminApi = Object.freeze(api);
}());
