(function () {
    "use strict";

    const api = window.BrutusmaqAdminApi;
    const ui = window.BrutusmaqAdminUI;
    const searchInput = document.getElementById("adminLeadSearch");
    const statusFilter = document.getElementById("adminLeadStatus");
    const rows = document.getElementById("adminLeadRows");
    const empty = document.getElementById("adminLeadEmpty");
    const dialog = document.getElementById("adminLeadDialog");
    const details = document.getElementById("adminLeadDetails");
    const dialogTitle = document.getElementById("adminLeadDialogTitle");
    const dialogStatus = document.getElementById("adminLeadDialogStatus");
    const saveStatus = document.getElementById("adminSaveLeadStatus");
    let items = [];
    let selectedId = "";
    let searchTimer = 0;

    const statusMap = {
        new: { label: "Nova", className: "is-warning" },
        in_progress: { label: "Em atendimento", className: "is-review" },
        closed: { label: "Concluída", className: "is-published" },
        spam: { label: "Spam", className: "is-draft" }
    };

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(value) {
        const date = new Date(value || "");
        if (Number.isNaN(date.getTime())) return "-";
        return new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short"
        }).format(date);
    }

    function formatPhone(value) {
        const digits = String(value || "").replace(/\D/g, "");
        if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
        if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
        return value || "-";
    }

    function getWhatsAppUrl(value) {
        const digits = String(value || "").replace(/\D/g, "");
        if (!digits) return "";
        return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
    }

    function render(data) {
        items = data.items || [];
        const counts = data.statusCounts || {};
        setText("adminLeadMetricTotal", data.total || 0);
        setText("adminLeadMetricNew", counts.new || 0);
        setText("adminLeadMetricProgress", counts.in_progress || 0);
        setText("adminNavLeadCount", counts.new || 0);
        setText("adminLeadCount", `${data.total || 0} solicitaç${data.total === 1 ? "ão" : "ões"}`);
        if (empty) empty.hidden = items.length > 0;
        if (!rows) return;
        rows.innerHTML = items.map((lead) => {
            const status = statusMap[lead.status] || statusMap.new;
            return `<tr>
                <td><span class="admin-lead-contact"><strong>${escapeHtml(lead.name)}</strong><small>${escapeHtml(formatPhone(lead.phone))}${lead.company ? ` · ${escapeHtml(lead.company)}` : ""}</small></span></td>
                <td><span class="admin-lead-subject"><strong>${escapeHtml(lead.reason)}</strong><small>${escapeHtml(lead.interest || lead.source)}</small></span></td>
                <td>${escapeHtml(lead.productName || "Não informado")}</td>
                <td>${escapeHtml(formatDate(lead.createdAt))}</td>
                <td><span class="admin-status ${status.className}">${status.label}</span></td>
                <td><button class="admin-text-button" type="button" data-open-lead="${escapeHtml(lead.id)}">Abrir</button></td>
            </tr>`;
        }).join("");
    }

    async function refresh() {
        if (!api?.isDatabase?.()) {
            render({ items: [], total: 0, statusCounts: {} });
            if (empty) empty.querySelector("p").textContent = "Conecte a API e o MySQL para centralizar os contatos recebidos.";
            return;
        }
        const refreshButton = document.getElementById("adminRefreshLeads");
        if (refreshButton) refreshButton.disabled = true;
        try {
            const data = await api.getLeads({
                status: statusFilter?.value || "all",
                search: searchInput?.value.trim() || "",
                page: "1",
                pageSize: "100"
            });
            render(data);
        } catch (error) {
            ui?.showToast(error.message || "Não foi possível carregar as solicitações.");
        } finally {
            if (refreshButton) refreshButton.disabled = false;
        }
    }

    function appendDetail(label, value, options) {
        if (!details || !value) return;
        const wrapper = document.createElement("div");
        if (options?.wide) wrapper.classList.add("is-wide");
        const term = document.createElement("dt");
        const description = document.createElement("dd");
        term.textContent = label;
        if (options?.href) {
            const link = document.createElement("a");
            link.href = options.href;
            link.textContent = value;
            if (options.external) {
                link.target = "_blank";
                link.rel = "noopener";
            }
            description.appendChild(link);
        } else {
            description.textContent = value;
        }
        wrapper.append(term, description);
        details.appendChild(wrapper);
    }

    function openLead(id) {
        const lead = items.find((item) => item.id === id);
        if (!lead || !details || !dialog) return;
        selectedId = id;
        details.replaceChildren();
        if (dialogTitle) dialogTitle.textContent = lead.name;
        appendDetail("Motivo", lead.reason);
        appendDetail("Recebida em", formatDate(lead.createdAt));
        appendDetail("Telefone", formatPhone(lead.phone), { href: getWhatsAppUrl(lead.phone), external: true });
        appendDetail("E-mail", lead.email, lead.email ? { href: `mailto:${lead.email}` } : undefined);
        appendDetail("Empresa", lead.company);
        appendDetail("Cidade / Estado", lead.cityState);
        appendDetail("Interesse", lead.interest);
        appendDetail("Equipamento", lead.productName);
        appendDetail("Origem", lead.source);
        appendDetail("Mensagem", lead.message || "Sem mensagem adicional.", { wide: true });
        if (dialogStatus) dialogStatus.value = lead.status;
        if (typeof dialog.showModal === "function") dialog.showModal();
    }

    rows?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-open-lead]");
        if (button) openLead(button.dataset.openLead);
    });
    saveStatus?.addEventListener("click", async (event) => {
        event.preventDefault();
        if (!selectedId || !dialogStatus) return;
        saveStatus.disabled = true;
        try {
            await api.updateLeadStatus(selectedId, dialogStatus.value);
            dialog.close("save");
            await refresh();
            ui?.showToast("Status da solicitação atualizado.");
        } catch (error) {
            ui?.showToast(error.message || "Não foi possível atualizar a solicitação.");
        } finally {
            saveStatus.disabled = false;
        }
    });

    document.getElementById("adminRefreshLeads")?.addEventListener("click", refresh);
    document.getElementById("adminClearLeadFilters")?.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        if (statusFilter) statusFilter.value = "all";
        refresh();
    });
    statusFilter?.addEventListener("change", refresh);
    searchInput?.addEventListener("input", () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(refresh, 350);
    });
    document.querySelector('[data-admin-view="leads"]')?.addEventListener("click", refresh);
    window.addEventListener("brutusmaq:admin-ready", refresh);
    api?.ready?.then(() => refresh());
}());
