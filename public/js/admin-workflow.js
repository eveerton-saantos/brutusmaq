(function () {
    "use strict";

    const api = window.BrutusmaqAdminApi;
    const ui = window.BrutusmaqAdminUI;
    const catalogStore = window.BrutusmaqCatalogStore;
    const blogStore = window.BrutusmaqBlogStore;

    const reviewNav = document.querySelector('[data-admin-view="reviews"]');
    const teamNav = document.querySelector('[data-admin-view="team"]');
    const reviewNavCount = document.getElementById("adminNavReviewCount");
    const reviewLocalNotice = document.getElementById("adminReviewsLocalNotice");
    const reviewRemoteContent = document.getElementById("adminReviewsRemoteContent");
    const teamLocalNotice = document.getElementById("adminTeamLocalNotice");
    const teamRemoteContent = document.getElementById("adminTeamRemoteContent");
    const refreshReviewsButton = document.getElementById("adminRefreshReviews");
    const refreshTeamButton = document.getElementById("adminRefreshTeam");
    const reviewSearch = document.getElementById("adminReviewSearch");
    const reviewEntityFilter = document.getElementById("adminReviewEntityFilter");
    const clearReviewFilters = document.getElementById("adminClearReviewFilters");
    const reviewRows = document.getElementById("adminReviewRows");
    const reviewEmpty = document.getElementById("adminReviewEmpty");
    const reviewCount = document.getElementById("adminReviewCount");
    const reviewDialog = document.getElementById("adminReviewDialog");
    const reviewDialogTitle = document.getElementById("adminReviewDialogTitle");
    const reviewPreview = document.getElementById("adminReviewPreview");
    const reviewNote = document.getElementById("adminReviewNote");
    const reviewDialogMessage = document.getElementById("adminReviewDialogMessage");
    const approveReviewButton = document.getElementById("adminApproveReview");
    const rejectReviewButton = document.getElementById("adminRejectReview");
    const inviteForm = document.getElementById("adminInviteForm");
    const inviteMessage = document.getElementById("adminInviteMessage");
    const teamRows = document.getElementById("adminTeamRows");
    const teamEmpty = document.getElementById("adminTeamEmpty");
    const teamSummary = document.getElementById("adminTeamSummary");
    const accessRequestRows = document.getElementById("adminAccessRequestRows");
    const accessRequestEmpty = document.getElementById("adminAccessRequestEmpty");
    const accessRequestSummary = document.getElementById("adminAccessRequestSummary");
    const setupLink = document.getElementById("adminTeamSetupLink");
    const setupUrlInput = document.getElementById("adminTeamSetupUrl");
    const copySetupUrlButton = document.getElementById("adminCopySetupUrl");

    let reviews = [];
    let team = [];
    let accessRequests = [];
    let selectedReviewId = "";
    let accessMode = "checking";
    let accessRole = "viewer";
    let reviewLoading = false;
    let teamLoading = false;
    let accessRequestsLoading = false;

    function escapeHtml(value) {
        if (ui?.escapeHtml) return ui.escapeHtml(value);
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalizeText(value) {
        if (ui?.normalizeText) return ui.normalizeText(value);
        return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    }

    function formatDate(value, fallback) {
        if (!value) return fallback || "Não informado";
        if (ui?.formatDate) return ui.formatDate(value);
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("pt-BR");
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
    }

    function showMessage(element, message, type) {
        if (!element) return;
        element.textContent = message || "";
        element.classList.toggle("is-error", type === "error");
        element.classList.toggle("is-success", type === "success");
        element.hidden = !message;
    }

    function ownerConnected() {
        return accessMode === "database" && accessRole === "owner";
    }

    function setButtonBusy(button, busy, busyLabel) {
        if (!button) return;
        if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent;
        button.disabled = busy;
        button.textContent = busy ? busyLabel : button.dataset.defaultLabel;
    }

    function reviewEntity(review) {
        const payload = review?.payload && typeof review.payload === "object" ? review.payload : {};
        if (review?.entityType === "article") return payload.article || payload;
        return payload.product || payload;
    }

    function reviewType(review) {
        return normalizeText(review?.entityType).includes("article") ? "article" : "product";
    }

    function reviewTitle(review) {
        const entity = reviewEntity(review);
        return entity.title || entity.modelo || entity.model || entity.nome || entity.id || "Conteúdo sem título";
    }

    function reviewTypeLabel(review) {
        if (reviewType(review) === "article") return "Artigo";
        const type = normalizeText(review?.productType || review?.payload?.type);
        return type === "used" || type === "usado" ? "Produto usado" : "Produto";
    }

    function reviewOperationLabel(operation) {
        return {
            create: "Novo cadastro",
            update: "Alteração",
            restore: "Restauração",
            delete: "Exclusão"
        }[operation] || "Alteração";
    }

    function filteredReviews() {
        const query = normalizeText(reviewSearch?.value);
        const type = reviewEntityFilter?.value || "all";
        return reviews.filter((review) => {
            const author = review.submittedBy || {};
            const searchable = normalizeText(`${reviewTitle(review)} ${author.name || ""} ${author.email || ""}`);
            return (!query || searchable.includes(query)) && (type === "all" || reviewType(review) === type);
        });
    }

    function renderReviewMetrics() {
        const products = reviews.filter((review) => reviewType(review) === "product").length;
        const articles = reviews.length - products;
        setText("adminReviewMetricPending", reviews.length);
        setText("adminReviewMetricProducts", products);
        setText("adminReviewMetricArticles", articles);
        if (reviewNavCount) reviewNavCount.textContent = String(reviews.length);
    }

    function renderReviews() {
        renderReviewMetrics();
        const visible = filteredReviews();
        if (reviewCount) reviewCount.textContent = `${visible.length} envio${visible.length === 1 ? "" : "s"}`;
        if (reviewEmpty) reviewEmpty.hidden = visible.length > 0 || reviewLoading;
        if (!reviewRows) return;
        if (reviewLoading) {
            reviewRows.innerHTML = '<tr><td colspan="6" class="admin-table-message">Carregando publicações para análise...</td></tr>';
            return;
        }
        reviewRows.innerHTML = visible.map((review) => {
            const author = review.submittedBy || {};
            return `<tr>
                <td><div class="admin-review-content"><strong>${escapeHtml(reviewTitle(review))}</strong><small>${escapeHtml(reviewOperationLabel(review.operation))}</small></div></td>
                <td>${escapeHtml(reviewTypeLabel(review))}</td>
                <td><div class="admin-review-author"><strong>${escapeHtml(author.name || "Funcionário")}</strong><small>${escapeHtml(author.email || "")}</small></div></td>
                <td>${escapeHtml(formatDate(review.submittedAt || review.updatedAt))}</td>
                <td><span class="admin-status is-review">Aguardando</span></td>
                <td><span class="admin-row-actions"><button class="admin-row-action" type="button" data-open-review="${escapeHtml(review.id)}">Analisar</button></span></td>
            </tr>`;
        }).join("");
    }

    function openReview(id) {
        const review = reviews.find((item) => String(item.id) === String(id));
        if (!review || !reviewDialog) return;
        selectedReviewId = String(review.id);
        const entity = reviewEntity(review);
        const author = review.submittedBy || {};
        const summary = entity.excerpt || entity.resumo || entity.summary || entity.descricao || entity.description || "Sem resumo informado.";
        if (reviewDialogTitle) reviewDialogTitle.textContent = reviewTitle(review);
        if (reviewPreview) {
            reviewPreview.innerHTML = `<dl>
                <div><dt>Tipo</dt><dd>${escapeHtml(reviewTypeLabel(review))}</dd></div>
                <div><dt>Operação</dt><dd>${escapeHtml(reviewOperationLabel(review.operation))}</dd></div>
                <div><dt>Enviado por</dt><dd>${escapeHtml(author.name || author.email || "Funcionário")}</dd></div>
                <div><dt>Recebido em</dt><dd>${escapeHtml(formatDate(review.submittedAt || review.updatedAt))}</dd></div>
            </dl><div class="admin-review-summary"><strong>Resumo da publicação</strong><p>${escapeHtml(summary)}</p></div>`;
        }
        if (reviewNote) reviewNote.value = "";
        showMessage(reviewDialogMessage, "");
        if (typeof reviewDialog.showModal === "function") reviewDialog.showModal();
        else reviewDialog.setAttribute("open", "");
    }

    function closeReviewDialog() {
        selectedReviewId = "";
        if (!reviewDialog) return;
        if (typeof reviewDialog.close === "function") reviewDialog.close();
        else reviewDialog.removeAttribute("open");
    }

    async function refreshPublishedData() {
        try {
            await api.bootstrap();
        } catch (error) {
            if (catalogStore?.hydrateFromApi) await catalogStore.hydrateFromApi().catch(() => {});
            if (blogStore?.hydrateFromApi) await blogStore.hydrateFromApi().catch(() => {});
        }
    }

    async function decideReview(action) {
        if (!ownerConnected() || !selectedReviewId) return;
        const note = String(reviewNote?.value || "").trim();
        if (action === "reject" && note.length < 3) {
            showMessage(reviewDialogMessage, "Explique o ajuste necessário antes de devolver a publicação.", "error");
            reviewNote?.focus();
            return;
        }
        setButtonBusy(approveReviewButton, true, "Publicando...");
        setButtonBusy(rejectReviewButton, true, "Enviando...");
        try {
            if (action === "approve") await api.approveReview(selectedReviewId, note);
            else await api.rejectReview(selectedReviewId, note);
            closeReviewDialog();
            if (action === "approve") await refreshPublishedData();
            await loadReviews();
            ui?.showToast?.(action === "approve"
                ? "Publicação aprovada e disponibilizada no site."
                : "Publicação devolvida ao funcionário com a orientação informada.");
        } catch (error) {
            const validationMessage = Array.isArray(error.details) ? error.details[0]?.message : "";
            showMessage(reviewDialogMessage, validationMessage || error.message || "Não foi possível concluir a análise.", "error");
        } finally {
            setButtonBusy(approveReviewButton, false, "");
            setButtonBusy(rejectReviewButton, false, "");
        }
    }

    async function loadReviews() {
        if (!ownerConnected() || reviewLoading) return;
        reviewLoading = true;
        setButtonBusy(refreshReviewsButton, true, "Atualizando...");
        renderReviews();
        try {
            const payload = await api.getReviews({ status: "pending" });
            const items = Array.isArray(payload) ? payload : (payload.reviews || payload.items || []);
            reviews = items.slice().sort((first, second) => (
                new Date(first.submittedAt || first.updatedAt || 0) - new Date(second.submittedAt || second.updatedAt || 0)
            ));
        } catch (error) {
            reviews = [];
            ui?.showToast?.(error.message || "Não foi possível carregar a caixa de análise.");
        } finally {
            reviewLoading = false;
            setButtonBusy(refreshReviewsButton, false, "");
            renderReviews();
        }
    }

    function memberId(member) {
        return String(member?.id || member?.publicId || "");
    }

    function memberInvitationStatus(member) {
        return normalizeText(member?.invitation?.status || member?.invitationStatus || member?.status);
    }

    function memberPending(member) {
        const status = memberInvitationStatus(member);
        return member?.needsInvitation === true || member?.invitationPending === true || member?.pendingInvitation === true
            || ["pending", "invited", "convite pendente", "invitation_pending"].includes(status);
    }

    function memberInvitationIncomplete(member) {
        const status = memberInvitationStatus(member);
        return member?.needsInvitation === true || (Boolean(status) && status !== "accepted" && status !== "aceito");
    }

    function memberActive(member) {
        return member?.active !== false;
    }

    function teamRoleLabel(role) {
        return { owner: "Proprietário", editor: "Funcionário editorial", viewer: "Somente leitura" }[role] || "Funcionário editorial";
    }

    function roleOptions(selectedRole) {
        return [
            ["editor", "Funcionário editorial"],
            ["viewer", "Somente leitura"]
        ].map(([value, label]) => `<option value="${value}"${selectedRole === value ? " selected" : ""}>${label}</option>`).join("");
    }

    function renderTeam() {
        const active = team.filter(memberActive).length;
        const pending = team.filter(memberPending).length;
        setText("adminTeamMetricTotal", team.length);
        setText("adminTeamMetricActive", active);
        setText("adminTeamMetricPending", pending);
        if (teamSummary) teamSummary.textContent = `${team.length} conta${team.length === 1 ? "" : "s"}`;
        if (teamEmpty) teamEmpty.hidden = team.length > 0 || teamLoading;
        if (!teamRows) return;
        if (teamLoading) {
            teamRows.innerHTML = '<tr><td colspan="5" class="admin-table-message">Carregando equipe...</td></tr>';
            return;
        }
        const currentUser = api?.getUser?.() || {};
        teamRows.innerHTML = team.map((member) => {
            const id = memberId(member);
            const pendingInvitation = memberPending(member);
            const invitationStatus = memberInvitationStatus(member);
            const incompleteInvitation = memberInvitationIncomplete(member);
            const activeMember = memberActive(member);
            const isCurrent = id && [currentUser.id, currentUser.publicId].map(String).includes(id);
            const invitationLabel = {
                pending: "Convite pendente",
                invited: "Convite pendente",
                expired: "Convite expirado",
                revoked: "Convite revogado"
            }[invitationStatus] || "Convite pendente";
            const status = incompleteInvitation
                ? `<span class="admin-status is-warning">${escapeHtml(invitationLabel)}</span>`
                : (!activeMember
                    ? '<span class="admin-status is-draft">Inativo</span>'
                    : '<span class="admin-status is-published">Ativo</span>');
            const resend = incompleteInvitation
                ? `<button class="admin-row-action" type="button" data-resend-invitation="${escapeHtml(id)}">Reenviar convite</button>`
                : "";
            const toggle = isCurrent || member.role === "owner" || incompleteInvitation
                ? ""
                : `<button class="admin-row-action ${activeMember ? "is-danger" : "is-success"}" type="button" data-toggle-member="${escapeHtml(id)}" data-member-active="${activeMember}">${activeMember ? "Desativar" : "Reativar"}</button>`;
            const roleControl = isCurrent || member.role === "owner" || incompleteInvitation
                ? ""
                : `<label class="admin-row-role"><span class="sr-only">Perfil de ${escapeHtml(member.name || "funcionário")}</span><select data-member-role="${escapeHtml(id)}">${roleOptions(member.role)}</select></label><button class="admin-row-action" type="button" data-save-member-role="${escapeHtml(id)}">Salvar perfil</button>`;
            return `<tr>
                <td><div class="admin-review-author"><strong>${escapeHtml(member.name || "Funcionário")}${isCurrent ? " (você)" : ""}</strong><small>${escapeHtml(member.email || "")}</small></div></td>
                <td>${escapeHtml(teamRoleLabel(member.role))}</td>
                <td>${status}</td>
                <td>${escapeHtml(formatDate(member.lastLoginAt, pendingInvitation ? "Ainda não acessou" : "Sem registro"))}</td>
                <td><span class="admin-row-actions">${resend}${roleControl}${toggle || (!resend && !roleControl ? '<span class="admin-readonly-label">Conta principal</span>' : "")}</span></td>
            </tr>`;
        }).join("");
    }

    function renderAccessRequests() {
        setText("adminAccessRequestMetricPending", accessRequests.length);
        if (accessRequestSummary) accessRequestSummary.textContent = `${accessRequests.length} pedido${accessRequests.length === 1 ? "" : "s"}`;
        if (accessRequestEmpty) accessRequestEmpty.hidden = accessRequests.length > 0 || accessRequestsLoading;
        if (!accessRequestRows) return;
        if (accessRequestsLoading) {
            accessRequestRows.innerHTML = '<tr><td colspan="5" class="admin-table-message">Carregando solicitações de acesso...</td></tr>';
            return;
        }
        accessRequestRows.innerHTML = accessRequests.map((item) => `<tr data-access-request-row="${escapeHtml(item.id)}">
            <td><div class="admin-review-author"><strong>${escapeHtml(item.name || "Solicitante")}</strong><small>${escapeHtml(item.email || "")}</small></div></td>
            <td><select data-access-request-role aria-label="Perfil para ${escapeHtml(item.name || "solicitante")}">${roleOptions(item.requestedRole)}</select></td>
            <td><span class="admin-access-request-reason" title="${escapeHtml(item.reason || "Não informado")}">${escapeHtml(item.reason || "Não informado")}</span></td>
            <td>${escapeHtml(formatDate(item.createdAt))}</td>
            <td><span class="admin-row-actions"><button class="admin-row-action is-success" type="button" data-approve-access-request="${escapeHtml(item.id)}">Aprovar</button><button class="admin-row-action is-danger" type="button" data-reject-access-request="${escapeHtml(item.id)}">Recusar</button></span></td>
        </tr>`).join("");
    }

    function revealSetupUrl(result) {
        const url = result?.setupUrl || result?.invitation?.setupUrl || "";
        if (!setupLink || !setupUrlInput) return;
        setupUrlInput.value = url;
        setupLink.hidden = !url;
        if (url) setupUrlInput.focus();
    }

    async function loadTeam() {
        if (!ownerConnected() || teamLoading) return;
        teamLoading = true;
        setButtonBusy(refreshTeamButton, true, "Atualizando...");
        renderTeam();
        try {
            const payload = await api.getTeam();
            team = Array.isArray(payload) ? payload : (payload.members || payload.team || payload.users || []);
        } catch (error) {
            team = [];
            ui?.showToast?.(error.message || "Não foi possível carregar a equipe.");
        } finally {
            teamLoading = false;
            setButtonBusy(refreshTeamButton, false, "");
            renderTeam();
        }
    }

    async function loadAccessRequests() {
        if (!ownerConnected() || accessRequestsLoading) return;
        accessRequestsLoading = true;
        renderAccessRequests();
        try {
            const payload = await api.getAccessRequests("pending");
            accessRequests = Array.isArray(payload) ? payload : (payload.requests || payload.items || []);
        } catch (error) {
            accessRequests = [];
            ui?.showToast?.(error.message || "Não foi possível carregar as solicitações de acesso.");
        } finally {
            accessRequestsLoading = false;
            renderAccessRequests();
        }
    }

    async function inviteMember(event) {
        event.preventDefault();
        if (!ownerConnected() || !inviteForm) return;
        if (!inviteForm.checkValidity()) {
            inviteForm.reportValidity();
            return;
        }
        const data = new FormData(inviteForm);
        const submit = inviteForm.querySelector('button[type="submit"]');
        setButtonBusy(submit, true, "Criando convite...");
        showMessage(inviteMessage, "");
        revealSetupUrl({});
        try {
            const result = await api.inviteTeamMember({
                name: String(data.get("name") || "").trim(),
                email: String(data.get("email") || "").trim(),
                role: String(data.get("role") || "editor")
            });
            inviteForm.reset();
            revealSetupUrl(result);
            showMessage(inviteMessage, result.message || "Convite criado com sucesso.", "success");
            await loadTeam();
        } catch (error) {
            showMessage(inviteMessage, error.message || "Não foi possível criar o convite.", "error");
        } finally {
            setButtonBusy(submit, false, "");
        }
    }

    async function resendInvitation(id, button) {
        if (!ownerConnected() || !id) return;
        setButtonBusy(button, true, "Enviando...");
        revealSetupUrl({});
        try {
            const result = await api.resendTeamInvitation(id);
            revealSetupUrl(result);
            ui?.showToast?.(result.message || "Convite reenviado.");
            await loadTeam();
        } catch (error) {
            ui?.showToast?.(error.message || "Não foi possível reenviar o convite.");
        } finally {
            setButtonBusy(button, false, "");
        }
    }

    async function toggleMember(id, currentlyActive, button) {
        if (!ownerConnected() || !id) return;
        if (currentlyActive && !window.confirm("Desativar este acesso? As sessões atuais deixarão de funcionar.")) return;
        setButtonBusy(button, true, currentlyActive ? "Desativando..." : "Reativando...");
        try {
            await api.updateTeamMember(id, { active: !currentlyActive });
            ui?.showToast?.(currentlyActive ? "Acesso desativado." : "Acesso reativado.");
            await loadTeam();
        } catch (error) {
            ui?.showToast?.(error.message || "Não foi possível alterar este acesso.");
        } finally {
            setButtonBusy(button, false, "");
        }
    }

    async function saveMemberRole(id, button) {
        if (!ownerConnected() || !id) return;
        const roleSelect = button.closest("tr")?.querySelector("[data-member-role]");
        const role = String(roleSelect?.value || "");
        if (!["editor", "viewer"].includes(role)) return;
        setButtonBusy(button, true, "Salvando...");
        try {
            await api.updateTeamMember(id, { role });
            ui?.showToast?.("Perfil de acesso atualizado. A pessoa deverá entrar novamente.");
            await loadTeam();
        } catch (error) {
            ui?.showToast?.(error.message || "Não foi possível alterar o perfil.");
        } finally {
            setButtonBusy(button, false, "");
        }
    }

    async function approveAccessRequest(id, button) {
        if (!ownerConnected() || !id) return;
        const row = button.closest("[data-access-request-row]");
        const role = String(row?.querySelector("[data-access-request-role]")?.value || "editor");
        setButtonBusy(button, true, "Aprovando...");
        try {
            const result = await api.approveAccessRequest(id, role);
            revealSetupUrl(result);
            ui?.showToast?.(result.message || "Solicitação aprovada e convite enviado.");
            await Promise.all([loadAccessRequests(), loadTeam()]);
        } catch (error) {
            ui?.showToast?.(error.message || "Não foi possível aprovar a solicitação.");
        } finally {
            setButtonBusy(button, false, "");
        }
    }

    async function rejectAccessRequest(id, button) {
        if (!ownerConnected() || !id) return;
        const note = window.prompt("Motivo da recusa (opcional):", "");
        if (note === null) return;
        setButtonBusy(button, true, "Recusando...");
        try {
            const result = await api.rejectAccessRequest(id, String(note).trim());
            ui?.showToast?.(result.message || "Solicitação recusada.");
            await loadAccessRequests();
        } catch (error) {
            ui?.showToast?.(error.message || "Não foi possível recusar a solicitação.");
        } finally {
            setButtonBusy(button, false, "");
        }
    }

    async function copySetupUrl() {
        const value = String(setupUrlInput?.value || "");
        if (!value) return;
        try {
            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
            else {
                setupUrlInput.select();
                document.execCommand("copy");
            }
            ui?.showToast?.("Link de ativação copiado.");
        } catch (error) {
            setupUrlInput?.select();
            ui?.showToast?.("Selecione e copie o link exibido.");
        }
    }

    function applyWorkflowAccess(detail) {
        accessMode = detail?.mode || api?.getMode?.() || "checking";
        const user = detail?.user || api?.getUser?.();
        accessRole = user?.role || "viewer";
        const connected = ownerConnected();
        const local = accessMode !== "database";
        const canSeeNavigation = connected || local;

        if (reviewNav) reviewNav.hidden = !canSeeNavigation;
        if (teamNav) teamNav.hidden = !canSeeNavigation;
        if (reviewLocalNotice) reviewLocalNotice.hidden = !local;
        if (teamLocalNotice) teamLocalNotice.hidden = !local;
        if (reviewRemoteContent) reviewRemoteContent.hidden = !connected;
        if (teamRemoteContent) teamRemoteContent.hidden = !connected;
        if (refreshReviewsButton) refreshReviewsButton.hidden = !connected;
        if (refreshTeamButton) refreshTeamButton.hidden = !connected;

        if (!canSeeNavigation && ["reviews", "team"].includes(ui?.getCurrentView?.())) {
            ui.showView("dashboard");
        }
        if (connected) {
            loadReviews();
            loadTeam();
            loadAccessRequests();
        } else {
            reviews = [];
            team = [];
            accessRequests = [];
            renderReviews();
            renderTeam();
            renderAccessRequests();
        }
    }

    reviewSearch?.addEventListener("input", renderReviews);
    reviewEntityFilter?.addEventListener("change", renderReviews);
    clearReviewFilters?.addEventListener("click", () => {
        if (reviewSearch) reviewSearch.value = "";
        if (reviewEntityFilter) reviewEntityFilter.value = "all";
        renderReviews();
        reviewSearch?.focus();
    });
    reviewRows?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-open-review]");
        if (button) openReview(button.dataset.openReview);
    });
    teamRows?.addEventListener("click", (event) => {
        const resend = event.target.closest("[data-resend-invitation]");
        const toggle = event.target.closest("[data-toggle-member]");
        const saveRole = event.target.closest("[data-save-member-role]");
        if (resend) resendInvitation(resend.dataset.resendInvitation, resend);
        else if (toggle) toggleMember(toggle.dataset.toggleMember, toggle.dataset.memberActive === "true", toggle);
        else if (saveRole) saveMemberRole(saveRole.dataset.saveMemberRole, saveRole);
    });
    accessRequestRows?.addEventListener("click", (event) => {
        const approve = event.target.closest("[data-approve-access-request]");
        const reject = event.target.closest("[data-reject-access-request]");
        if (approve) approveAccessRequest(approve.dataset.approveAccessRequest, approve);
        else if (reject) rejectAccessRequest(reject.dataset.rejectAccessRequest, reject);
    });
    reviewDialog?.addEventListener("close", () => {
        selectedReviewId = "";
        showMessage(reviewDialogMessage, "");
    });
    refreshReviewsButton?.addEventListener("click", loadReviews);
    refreshTeamButton?.addEventListener("click", () => {
        loadTeam();
        loadAccessRequests();
    });
    approveReviewButton?.addEventListener("click", () => decideReview("approve"));
    rejectReviewButton?.addEventListener("click", () => decideReview("reject"));
    inviteForm?.addEventListener("submit", inviteMember);
    copySetupUrlButton?.addEventListener("click", copySetupUrl);
    window.addEventListener("brutusmaq:review-submitted", () => {
        if (ownerConnected()) loadReviews();
    });
    window.addEventListener("brutusmaq:admin-ready", (event) => applyWorkflowAccess(event.detail));

    renderReviews();
    renderTeam();
    renderAccessRequests();
    if (api?.ready?.then) api.ready.then(() => applyWorkflowAccess()).catch(() => applyWorkflowAccess());
}());
