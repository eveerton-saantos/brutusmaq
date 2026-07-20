(function () {
    "use strict";

    const store = window.BrutusmaqCatalogStore;
    const api = window.BrutusmaqAdminApi;
    const viewLabels = {
        performance: "Desempenho",
        dashboard: "Visão geral",
        products: "Produtos",
        leads: "Solicitações",
        "new-product": "Novo produto",
        articles: "Artigos",
        "new-article": "Novo artigo",
        reviews: "Caixa de análise",
        team: "Equipe e acessos",
        security: "Segurança"
    };
    const statusMap = {
        published: { filter: "publicado", label: "Publicado", className: "is-published" },
        review: { filter: "revisao", label: "Em revisão", className: "is-review" },
        draft: { filter: "rascunho", label: "Rascunho", className: "is-draft" }
    };
    const fallbackImage = "assets/main/tr-700.webp";
    const maxMainImageBytes = 1000000;
    const maxGalleryImageBytes = 300000;
    const maxProductBenefits = 4;
    const maxUsedInfoCards = 4;
    const defaultUsedInfoCards = ["ano", "condicao", "garantia", "localizacao"];
    const allowedUsedInfoCards = new Set([
        "ano", "condicao", "garantia", "localizacao", "disponibilidade", "preco",
        "entrega", "pagamento", "transporte", "horas-uso", "potencia", "boca-alimentacao"
    ]);
    const defaultUsedCommercialInfo = [
        ["Preço", "Consultar valor"],
        ["Prazo de entrega", "A combinar"],
        ["Condições de pagamento", "Conforme proposta"],
        ["Transporte", "A combinar"]
    ];

    const sidebar = document.getElementById("adminSidebar");
    const sidebarBackdrop = document.querySelector("[data-close-sidebar]");
    const menuButton = document.querySelector(".admin-menu-button");
    const currentViewLabel = document.getElementById("adminCurrentView");
    const navButtons = Array.from(document.querySelectorAll("[data-admin-view]"));
    const viewPanels = Array.from(document.querySelectorAll("[data-view-panel]"));
    const productSearch = document.getElementById("adminProductSearch");
    const typeFilter = document.getElementById("adminTypeFilter");
    const statusFilter = document.getElementById("adminStatusFilter");
    const clearFiltersButton = document.getElementById("clearProductFilters");
    const productRowsContainer = document.getElementById("adminProductRows");
    const recentProductRows = document.getElementById("adminRecentProductRows");
    const productCount = document.getElementById("adminProductCount");
    const productEmpty = document.getElementById("adminProductEmpty");
    const productForm = document.getElementById("adminProductForm");
    const formMessage = document.getElementById("adminFormMessage");
    const productTypeInputs = Array.from(document.querySelectorAll('input[name="productType"]'));
    const benefitOptionInputs = Array.from(document.querySelectorAll('input[name="benefitOptions"]'));
    const customBenefitsInput = productForm?.querySelector('[name="benefitsCustom"]');
    const benefitCounter = document.getElementById("adminBenefitCounter");
    const usedFields = document.getElementById("adminUsedFields");
    const usedInfoCardSelects = Array.from(document.querySelectorAll("[data-used-info-card]"));
    const usedInfoCardCounter = document.getElementById("adminUsedCardCounter");
    const summaryInput = getField("summary");
    const summaryCounter = document.getElementById("adminSummaryCounter");
    const mainImageInput = document.getElementById("adminMainImage");
    const mainImagePreview = document.getElementById("adminMainPreview");
    const galleryInput = document.getElementById("adminGalleryImages");
    const galleryStatus = document.getElementById("adminGalleryStatus");
    const specList = document.getElementById("adminSpecList");
    const addSpecButton = document.getElementById("adminAddSpec");
    const commercialList = document.getElementById("adminCommercialList");
    const addCommercialButton = document.getElementById("adminAddCommercial");
    const exportButton = document.getElementById("adminExportCatalog");
    const importInput = document.getElementById("adminImportCatalog");
    const resetButton = document.getElementById("adminResetCatalog");
    const deleteDialog = document.getElementById("adminDeleteDialog");
    const deleteDialogTitle = document.getElementById("adminDeleteTitle");
    const deleteDialogDescription = document.getElementById("adminDeleteDescription");
    const confirmDeleteButton = document.getElementById("adminConfirmDelete");
    const toast = document.getElementById("adminToast");
    const toastMessage = document.getElementById("adminToastMessage");
    const toastAction = document.getElementById("adminToastAction");
    const toastClose = document.getElementById("adminToastClose");

    let catalog = { novos: [], usados: [] };
    let adminProducts = [];
    let productRows = [];
    let currentView = "performance";
    let editingUid = "";
    let slugEdited = false;
    let dirty = false;
    let mainImageData = "";
    let galleryData = [];
    let pendingConfirmation = null;
    let lastRemoved = null;
    let toastTimer = 0;
    let accessRole = "owner";

    function isDatabaseRole(role) {
        return api?.isDatabase?.() && accessRole === role;
    }

    function isOwner() {
        return !api?.isDatabase?.() || accessRole === "owner";
    }

    function isEditor() {
        return isDatabaseRole("editor");
    }

    function isViewer() {
        return isDatabaseRole("viewer");
    }

    function applyProductAccess(detail) {
        const user = detail?.user || api?.getUser?.();
        accessRole = api?.isDatabase?.() ? (user?.role || "viewer") : "owner";
        const owner = isOwner();
        const editor = isEditor();
        const viewer = isViewer();
        const statusSelect = getField("status");
        const publishOption = statusSelect?.querySelector('[value="published"]');

        if (publishOption) {
            publishOption.hidden = !owner;
            publishOption.disabled = !owner;
        }
        if (editor && statusSelect) statusSelect.value = "review";
        if (statusSelect) statusSelect.disabled = editor || viewer;

        document.querySelectorAll("[data-product-submit]").forEach((button) => {
            button.textContent = editor ? "Enviar para análise" : "Salvar produto";
            button.hidden = viewer;
        });
        document.querySelectorAll("[data-save-draft]").forEach((button) => { button.hidden = viewer; });
        document.querySelectorAll('[data-go-to="new-product"]').forEach((button) => { button.hidden = viewer; });
        document.querySelectorAll('[data-admin-view="new-product"]').forEach((button) => { button.hidden = viewer; });
        if (importInput?.closest("label")) importInput.closest("label").hidden = !owner;
        if (resetButton) resetButton.hidden = !owner;
        if (addSpecButton) addSpecButton.hidden = viewer;
        if (addCommercialButton) addCommercialButton.hidden = viewer;
        document.querySelectorAll(".admin-inline-action").forEach((button) => { button.hidden = viewer; });
        productForm?.querySelectorAll("input, select, textarea, button").forEach((control) => {
            if (control.matches('[name="status"]')) return;
            control.disabled = viewer;
        });
        lockProductType(Boolean(editingUid) || viewer);
        updateProductType();
        if (api?.isDatabase?.() && accessRole !== "owner" && ["performance", "leads"].includes(currentView)) {
            showView("dashboard", { instant: true });
        }
        renderAll();
    }

    function normalizeText(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    function createSlug(value) {
        return normalizeText(value)
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function formatDate(value) {
        const date = new Date(value || "");
        if (Number.isNaN(date.getTime())) return "Catálogo-base";
        try {
            return new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "short",
                timeStyle: "short"
            }).format(date);
        } catch (error) {
            return date.toLocaleString("pt-BR");
        }
    }

    function getField(name) {
        return productForm && productForm.querySelector(`[name="${name}"]`);
    }

    function getFieldValue(name) {
        const field = getField(name);
        return field ? field.value.trim() : "";
    }

    function setFieldValue(name, value) {
        const field = getField(name);
        if (field) field.value = value == null ? "" : value;
    }

    function setSelectValue(name, value) {
        const select = getField(name);
        if (!select) return;
        const normalizedValue = String(value || "").trim();
        if (normalizedValue && !Array.from(select.options).some((option) => option.value === normalizedValue)) {
            select.add(new Option(normalizedValue, normalizedValue));
        }
        select.value = normalizedValue;
    }

    function getLines(value) {
        return String(value || "")
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter(Boolean);
    }

    function benefitLines(value) {
        return (Array.isArray(value) ? value : []).map((item) => {
            if (typeof item === "string") return item;
            const title = String(item?.titulo || item?.nome || "").trim();
            const description = String(item?.texto || item?.descricao || "").trim();
            return [title, description].filter(Boolean).join(" | ");
        }).filter(Boolean);
    }

    function canonicalProductLine(value, categorySlug) {
        const identify = (source) => {
            if (source.includes("outro")) return "Outros equipamentos";
            if (source.includes("tritur")) return "Trituradores";
            if (source.includes("moinho")) return "Moinhos";
            if (source.includes("esteira")) return "Esteiras transportadoras";
            return "";
        };
        const explicitLine = normalizeText(value);
        const explicitMatch = identify(explicitLine);
        if (explicitMatch) return explicitMatch;
        const storedSlug = normalizeText(categorySlug);
        const storedMatch = identify(storedSlug);
        if (storedMatch) return storedMatch;
        if (explicitLine || storedSlug) return "Outros equipamentos";
        return "";
    }

    function productLineSlug(value) {
        const line = canonicalProductLine(value);
        if (line === "Trituradores") return "trituradores";
        if (line === "Moinhos") return "moinhos";
        if (line === "Esteiras transportadoras") return "esteiras";
        return line ? "outros-equipamentos" : "";
    }

    function usedAvailabilitySlug(value) {
        const normalized = normalizeText(value);
        if (normalized.includes("vendid") || normalized.includes("indisponivel")) return "vendido";
        if (normalized.includes("revisao")) return "revisao";
        if (normalized.includes("reservad")) return "reservado";
        if (normalized.includes("disponivel")) return "disponivel";
        return createSlug(value) || "sob-consulta";
    }

    function uniqueBenefits(values) {
        const unique = new Map();
        values.forEach((value) => {
            const benefit = String(value || "").trim();
            const key = normalizeText(benefit).replace(/\s+/g, " ");
            if (benefit && key && !unique.has(key)) unique.set(key, benefit);
        });
        return [...unique.values()];
    }

    function selectedBenefitValues() {
        return benefitOptionInputs.filter((input) => input.checked).map((input) => input.value);
    }

    function currentBenefitValues() {
        return uniqueBenefits([
            ...selectedBenefitValues(),
            ...getLines(customBenefitsInput?.value)
        ]);
    }

    function updateBenefitSelectionState(announcement) {
        const total = currentBenefitValues().length;
        const invalid = total > maxProductBenefits;
        const message = `Escolha no máximo ${maxProductBenefits} benefícios, contando as opções marcadas e as linhas personalizadas.`;
        if (customBenefitsInput) customBenefitsInput.setCustomValidity(invalid ? message : "");
        if (!benefitCounter) return total;

        const strong = benefitCounter.querySelector("strong");
        if (strong) {
            strong.textContent = announcement || (invalid
                ? `${total} selecionados — reduza para ${maxProductBenefits}`
                : `${total} de ${maxProductBenefits} selecionados`);
        }
        benefitCounter.classList.toggle("is-limit", total === maxProductBenefits && !invalid);
        benefitCounter.classList.toggle("is-error", invalid || Boolean(announcement));
        return total;
    }

    function setBenefitSelection(value) {
        benefitOptionInputs.forEach((input) => { input.checked = false; });
        const presetInputs = new Map(benefitOptionInputs.map((input) => [normalizeText(input.value), input]));
        const custom = [];

        uniqueBenefits(benefitLines(value)).forEach((benefit) => {
            const preset = presetInputs.get(normalizeText(benefit));
            if (preset && !preset.checked) preset.checked = true;
            else custom.push(benefit);
        });

        if (customBenefitsInput) customBenefitsInput.value = custom.join("\n");
        updateBenefitSelectionState();
    }

    function collectBenefits() {
        const benefits = currentBenefitValues();
        if (benefits.length > maxProductBenefits) {
            throw new Error(`Escolha no máximo ${maxProductBenefits} benefícios comerciais.`);
        }
        return benefits;
    }

    function updateUsedInfoCardState() {
        const values = usedInfoCardSelects.map((select) => select.value).filter(Boolean);
        const duplicates = new Set(values.filter((value, index) => values.indexOf(value) !== index));
        const errorMessage = duplicates.size ? "Não repita o mesmo card em mais de uma posição." : "";

        usedInfoCardSelects.forEach((select) => {
            const currentValue = select.value;
            select.classList.toggle("is-duplicate", duplicates.has(currentValue));
            select.setCustomValidity(duplicates.has(currentValue) ? errorMessage : "");
            Array.from(select.options).forEach((option) => {
                option.disabled = Boolean(option.value && option.value !== currentValue && values.includes(option.value));
            });
        });

        if (usedInfoCardCounter) {
            const strong = usedInfoCardCounter.querySelector("strong");
            if (strong) strong.textContent = errorMessage || `${values.length} de ${maxUsedInfoCards} selecionados`;
            usedInfoCardCounter.classList.toggle("is-error", Boolean(errorMessage));
        }
        return { values, hasDuplicates: duplicates.size > 0 };
    }

    function setUsedInfoCardSelection(value) {
        const source = Array.isArray(value) && value.length ? value : defaultUsedInfoCards;
        const cards = [...new Set(source.map((item) => String(item || "").trim()))]
            .filter((item) => allowedUsedInfoCards.has(item))
            .slice(0, maxUsedInfoCards);
        usedInfoCardSelects.forEach((select, index) => {
            select.value = cards[index] || "";
        });
        updateUsedInfoCardState();
    }

    function collectUsedInfoCards() {
        const state = updateUsedInfoCardState();
        if (state.hasDuplicates) throw new Error("Escolha cards diferentes para o topo da página.");
        return state.values.filter((item) => allowedUsedInfoCards.has(item)).slice(0, maxUsedInfoCards);
    }

    function updateSummaryCounter() {
        if (!summaryCounter || !summaryInput) return;
        const length = summaryInput.value.length;
        summaryCounter.textContent = `${length} de 120 caracteres`;
        summaryCounter.classList.toggle("is-near-limit", length >= 110);
    }

    function youtubeIdFromInput(value) {
        const input = String(value || "").trim();
        if (!input) return "";
        if (/^[a-z0-9_-]{6,20}$/i.test(input)) return input;

        try {
            const url = new URL(input);
            const host = url.hostname.replace(/^www\./i, "").toLowerCase();
            let candidate = "";
            if (host === "youtu.be") {
                candidate = url.pathname.split("/").filter(Boolean)[0] || "";
            } else if (["youtube.com", "youtube-nocookie.com"].includes(host)) {
                candidate = url.searchParams.get("v") || "";
                if (!candidate) {
                    const parts = url.pathname.split("/").filter(Boolean);
                    if (["embed", "shorts", "live"].includes(parts[0])) candidate = parts[1] || "";
                }
            }
            return /^[a-z0-9_-]{6,20}$/i.test(candidate) ? candidate : "";
        } catch (error) {
            return "";
        }
    }

    function safeDownloadInput(value) {
        const url = String(value || "").trim();
        if (!url) return "";
        if (!/^(?:https:\/\/|assets\/)[^<>\s]+$/i.test(url) || url.includes("..")) {
            throw new Error("Nos arquivos técnicos, use um caminho iniciado por assets/ ou uma URL HTTPS.");
        }
        return url;
    }

    function downloadFieldValue(value) {
        return typeof value === "string" ? value : String(value?.url || "");
    }

    function preserveDownloadMetadata(previousValue, url) {
        if (previousValue && typeof previousValue === "object" && previousValue.url === url) {
            return previousValue;
        }
        return url;
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function closeSidebar() {
        if (!sidebar || !sidebarBackdrop || !menuButton) return;
        sidebar.classList.remove("is-open");
        sidebarBackdrop.hidden = true;
        menuButton.setAttribute("aria-expanded", "false");
    }

    function openSidebar() {
        if (!sidebar || !sidebarBackdrop || !menuButton) return;
        sidebar.classList.add("is-open");
        sidebarBackdrop.hidden = false;
        menuButton.setAttribute("aria-expanded", "true");
    }

    function showView(viewName, options) {
        const settings = options || {};
        const selectedPanel = viewPanels.find((panel) => panel.dataset.viewPanel === viewName);
        if (!selectedPanel) return;

        viewPanels.forEach((panel) => {
            const isSelected = panel === selectedPanel;
            panel.hidden = !isSelected;
            panel.classList.toggle("is-active", isSelected);
        });

        navButtons.forEach((button) => {
            const isSelected = button.dataset.adminView === viewName;
            button.classList.toggle("is-active", isSelected);
            if (isSelected) button.setAttribute("aria-current", "page");
            else button.removeAttribute("aria-current");
        });

        currentView = viewName;
        if (currentViewLabel) currentViewLabel.textContent = viewLabels[viewName] || "Painel";
        document.title = `${viewLabels[viewName] || "Painel"} | Brutusmaq`;
        closeSidebar();

        if (settings.scroll !== false) {
            window.scrollTo({ top: 0, behavior: settings.instant ? "auto" : "smooth" });
        }
    }

    function confirmDiscardChanges() {
        return !dirty || window.confirm("Existem alterações não salvas. Deseja descartá-las?");
    }

    function navigateTo(viewName) {
        const blogController = window.BrutusmaqAdminBlog;
        const isBlogView = blogController
            && typeof blogController.ownsView === "function"
            && blogController.ownsView(viewName);

        if (!isBlogView && blogController && typeof blogController.canLeave === "function"
            && !blogController.canLeave(viewName)) {
            return;
        }

        if (isBlogView) {
            if (currentView === "new-product" && !confirmDiscardChanges()) return;
            dirty = false;
            blogController.navigate(viewName);
            return;
        }

        if (viewName === "new-product") {
            if (currentView !== "new-product" || editingUid || dirty) {
                if (!confirmDiscardChanges()) return;
                prepareNewProduct();
            }
            showView(viewName);
            return;
        }

        if (currentView === "new-product" && !confirmDiscardChanges()) return;
        dirty = false;
        showView(viewName);
    }

    function showFormMessage(message, type) {
        if (!formMessage) return;
        formMessage.textContent = message;
        formMessage.classList.toggle("is-error", type === "error");
        formMessage.classList.toggle("is-success", type === "success");
        formMessage.hidden = false;
        formMessage.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function hideFormMessage() {
        if (!formMessage) return;
        formMessage.hidden = true;
        formMessage.classList.remove("is-error", "is-success");
    }

    function showToast(message, actionLabel, action) {
        if (!toast || !toastMessage || !toastAction) return;
        window.clearTimeout(toastTimer);
        toastMessage.textContent = message;
        toast.hidden = false;
        toastAction.hidden = !actionLabel || typeof action !== "function";
        toastAction.textContent = actionLabel || "";
        toastAction.onclick = typeof action === "function" ? action : null;
        if (!actionLabel) {
            toastTimer = window.setTimeout(() => {
                toast.hidden = true;
            }, 5500);
        }
    }

    function closeToast() {
        window.clearTimeout(toastTimer);
        if (toast) toast.hidden = true;
    }

    function createAdminProduct(source, type) {
        const isUsed = type === "usado";
        const editorialMeta = api?.getEditorialMeta?.("product", source) || {};
        const admin = { ...(source._admin || {}), ...editorialMeta };
        const status = statusMap[admin.status] || statusMap.published;
        const model = source.modelo || source.id;
        const category = isUsed
            ? source.categoria || "Máquinas usadas"
            : source.linha || source.categoria || "Sem categoria";
        const image = source.imagemPrincipal || source.imagem || fallbackImage;
        const skuPrefix = isUsed ? "US" : "BM";

        return {
            uid: admin.uid,
            id: source.id,
            model: isUsed ? `${model} usado` : model,
            rawModel: model,
            sku: admin.sku || `${skuPrefix}-${String(source.id).toUpperCase()}`,
            category,
            type,
            typeLabel: isUsed ? "Usado" : "Novo",
            statusKey: admin.status || "published",
            statusFilter: status.filter,
            statusLabel: status.label,
            statusClass: status.className,
            image,
            source,
            editorialMeta,
            submissionStatus: editorialMeta.submissionStatus || "",
            reviewNote: editorialMeta.reviewNote || "",
            visible: admin.visible !== false,
            updatedAt: admin.updatedAt,
            incomplete: !source.id || !model || !category || !image || !source.descricao || !Array.isArray(source.specs) || !source.specs.length
        };
    }

    function refreshCatalog() {
        catalog = store.getCatalog();
        adminProducts = [
            ...catalog.novos.map((product) => createAdminProduct(product, "novo")),
            ...catalog.usados.map((product) => createAdminProduct(product, "usado"))
        ];
    }

    function productCellMarkup(product, includeSku) {
        const detailParts = includeSku ? [product.sku] : [product.category];
        if (!product.visible) detailParts.push("Oculto no site");
        return `<span class="admin-product-cell"><img src="${escapeHtml(product.image)}" alt=""><span><strong>${escapeHtml(product.model)}</strong><small>${escapeHtml(detailParts.join(" · "))}</small></span></span>`;
    }

    function renderProductRows() {
        if (!productRowsContainer) return;

        productRowsContainer.innerHTML = adminProducts.map((product) => {
            const searchText = `${product.model} ${product.rawModel} ${product.category} ${product.id} ${product.sku}`;
            const awaitingReview = isEditor() && product.submissionStatus === "pending";
            const editAction = isViewer() || awaitingReview
                ? ""
                : `<button class="admin-row-action" type="button" data-edit-product="${escapeHtml(product.uid)}" aria-label="Editar ${escapeHtml(product.rawModel)}">Editar</button>`;
            const cancelAction = isEditor() && product.editorialMeta?.submissionId
                ? `<button class="admin-row-action is-danger" type="button" data-cancel-product-submission="${escapeHtml(product.editorialMeta.submissionId)}" data-submission-title="${escapeHtml(product.rawModel)}">${awaitingReview ? "Retirar envio" : "Descartar"}</button>`
                : "";
            const ownerAction = isOwner()
                ? `<button class="admin-row-action is-danger" type="button" data-delete-product="${escapeHtml(product.uid)}" aria-label="Excluir ${escapeHtml(product.rawModel)}">Excluir</button>`
                : "";
            const publicUrl = product.type === "usado"
                ? `maquina-usada.html?id=${encodeURIComponent(product.id)}`
                : `produto.html?produto=${encodeURIComponent(product.id)}`;
            const viewAction = product.statusKey === "published" && product.visible
                ? `<a class="admin-row-action" href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener">Ver no site</a>`
                : "";
            const actions = `${awaitingReview ? '<span class="admin-readonly-label">Aguardando análise</span>' : ""}${viewAction}${editAction}${cancelAction}${ownerAction}`
                || `<span class="admin-readonly-label">Somente leitura</span>`;
            const feedback = product.submissionStatus === "rejected" && product.reviewNote
                ? `<small class="admin-review-feedback" title="${escapeHtml(product.reviewNote)}">Ajustes solicitados</small>`
                : "";
            return `<tr data-product-row data-search="${escapeHtml(searchText)}" data-type="${product.type}" data-status="${product.statusFilter}">
                <td>${productCellMarkup(product, true)}</td>
                <td>${escapeHtml(product.category)}</td>
                <td>${product.typeLabel}</td>
                <td><span class="admin-status ${product.statusClass}">${product.statusLabel}</span>${feedback}</td>
                <td>${escapeHtml(formatDate(product.updatedAt))}</td>
                <td><span class="admin-row-actions">${actions}</span></td>
            </tr>`;
        }).join("");

        productRows = Array.from(productRowsContainer.querySelectorAll("[data-product-row]"));
    }

    function renderDashboard() {
        const publishedCount = adminProducts.filter((product) => product.statusKey === "published" && product.visible).length;
        const incompleteCount = adminProducts.filter((product) => product.incomplete).length;
        const availableUsedCount = catalog.usados.filter((product) => (
            product._admin.status === "published"
            && product._admin.visible !== false
            && normalizeText(product.statusSlug || product.status) === "disponivel"
        )).length;

        setText("adminNavProductCount", adminProducts.length);
        setText("adminMetricTotal", adminProducts.length);
        setText("adminMetricBreakdown", `${catalog.novos.length} novos e ${catalog.usados.length} usados`);
        setText("adminMetricPublished", publishedCount);
        setText("adminMetricIssues", incompleteCount);
        setText("adminMetricAvailableUsed", availableUsedCount);

        if (recentProductRows) {
            const recentProducts = [...adminProducts]
                .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
                .slice(0, 3);
            recentProductRows.innerHTML = recentProducts.map((product) => `<tr>
                <td>${productCellMarkup(product, false)}</td>
                <td>${product.typeLabel}</td>
                <td><span class="admin-status ${product.statusClass}">${product.statusLabel}</span></td>
                <td>${escapeHtml(formatDate(product.updatedAt))}</td>
            </tr>`).join("");
        }

        const diagnostics = document.getElementById("adminCatalogDiagnostics");
        if (diagnostics) {
            const demoCount = catalog.usados.filter((product) => normalizeText(product.id).includes("demo")).length;
            const databaseMode = api?.isDatabase?.();
            const backupMessage = databaseMode
                ? "O catálogo está sincronizado com o banco central. Exporte um backup antes de alterações maiores."
                : (store.hasCustomCatalog()
                    ? "Há alterações locais salvas. Exporte um backup antes de limpar os dados do navegador."
                    : "O catálogo-base está ativo e ainda não possui alterações locais.");
            diagnostics.innerHTML = [
                {
                    label: "DADOS",
                    className: "is-green",
                    message: backupMessage,
                    detail: databaseMode ? "API e MySQL" : "Armazenamento local"
                },
                {
                    label: "QA",
                    className: incompleteCount ? "is-orange" : "is-green",
                    message: incompleteCount
                        ? `<strong>${incompleteCount} produto(s)</strong> têm campos essenciais incompletos.`
                        : "Todos os produtos têm os campos essenciais preenchidos.",
                    detail: "Verificação automática"
                },
                {
                    label: "AVISO",
                    className: demoCount ? "" : "is-green",
                    message: demoCount
                        ? `<strong>${demoCount} máquina(s) usada(s)</strong> ainda estão identificadas como demonstração.`
                        : "Não há máquinas de demonstração no catálogo de usados.",
                    detail: "Antes da publicação"
                }
            ].map((item) => `<li><span class="admin-activity-time">${item.label}</span><span class="admin-activity-mark ${item.className}"></span><p>${item.message}</p><small>${item.detail}</small></li>`).join("");
        }
    }

    function filterProducts() {
        const term = normalizeText(productSearch && productSearch.value);
        const type = typeFilter ? typeFilter.value : "all";
        const status = statusFilter ? statusFilter.value : "all";
        let visibleCount = 0;

        productRows.forEach((row) => {
            const matchesTerm = !term || normalizeText(row.dataset.search).includes(term);
            const matchesType = type === "all" || row.dataset.type === type;
            const matchesStatus = status === "all" || row.dataset.status === status;
            const visible = matchesTerm && matchesType && matchesStatus;
            row.hidden = !visible;
            if (visible) visibleCount += 1;
        });

        if (productCount) productCount.textContent = `${visibleCount} ${visibleCount === 1 ? "produto" : "produtos"}`;
        if (productEmpty) productEmpty.hidden = visibleCount !== 0;
    }

    function renderAll() {
        refreshCatalog();
        renderProductRows();
        renderDashboard();
        filterProducts();
    }

    function updateProductType() {
        const checked = productTypeInputs.find((input) => input.checked);
        const isUsed = checked && checked.value === "usado";
        if (usedFields) usedFields.hidden = !isUsed;
        document.querySelectorAll("[data-new-product-only]").forEach((element) => {
            element.hidden = isUsed;
        });
        document.querySelectorAll("[data-used-product-only]").forEach((element) => {
            element.hidden = !isUsed;
        });
        const lineField = getField("line");
        if (lineField) {
            lineField.required = !isUsed;
            lineField.disabled = Boolean(isUsed || isViewer());
        }
        if (customBenefitsInput) {
            if (isUsed) customBenefitsInput.setCustomValidity("");
            else updateBenefitSelectionState();
        }
        const slugPrefix = document.querySelector(".admin-input-prefix small");
        if (slugPrefix) slugPrefix.textContent = isUsed ? "maquina-usada/" : "produto/";
    }

    function lockProductType(locked) {
        productTypeInputs.forEach((input) => {
            input.disabled = Boolean(locked);
        });
        const help = document.getElementById("adminProductTypeHelp");
        if (help) {
            help.textContent = locked
                ? "O tipo fica bloqueado durante a edição para evitar perda de informações."
                : "O tipo não poderá ser alterado depois do primeiro salvamento.";
        }
    }

    function updateFormHeading(title, description) {
        const heading = document.getElementById("newProductTitle");
        const paragraph = heading && heading.parentElement.querySelector("p");
        if (heading) heading.textContent = title;
        if (paragraph) paragraph.textContent = description;
    }

    function createSpecRow(name, value) {
        const row = document.createElement("div");
        row.className = "admin-spec-row";
        row.innerHTML = [
            '<input type="text" aria-label="Nome da especificação" placeholder="Ex.: Dimensões">',
            '<input type="text" aria-label="Valor da especificação" placeholder="Ex.: 2.000 x 1.450 x 1.750 mm">',
            '<button type="button" data-remove-spec aria-label="Remover especificação">×</button>'
        ].join("");
        const inputs = row.querySelectorAll("input");
        inputs[0].value = name || "";
        inputs[1].value = value || "";
        return row;
    }

    function renderSpecRows(specs) {
        if (!specList) return;
        const rows = Array.isArray(specs) && specs.length ? specs : [["", ""], ["", ""]];
        specList.innerHTML = "";
        rows.forEach((spec) => specList.appendChild(createSpecRow(spec[0], spec[1])));
    }

    function collectSpecs() {
        if (!specList) return [];
        return Array.from(specList.querySelectorAll(".admin-spec-row")).map((row) => {
            const inputs = row.querySelectorAll("input");
            return [inputs[0].value.trim(), inputs[1].value.trim()];
        }).filter((spec) => spec[0] && spec[1]);
    }

    function createCommercialRow(label, value) {
        const row = document.createElement("div");
        row.className = "admin-spec-row admin-commercial-row";
        row.innerHTML = [
            '<input type="text" aria-label="Nome da informação comercial" placeholder="Ex.: Aceita máquina na troca">',
            '<input type="text" aria-label="Valor da informação comercial" placeholder="Ex.: Sob avaliação">',
            '<button type="button" data-remove-commercial aria-label="Remover informação comercial">×</button>'
        ].join("");
        const inputs = row.querySelectorAll("input");
        inputs[0].value = label || "";
        inputs[1].value = value || "";
        return row;
    }

    function commercialRowsWithoutAvailability(items) {
        return (Array.isArray(items) ? items : []).filter((item) => (
            Array.isArray(item) && normalizeText(item[0]) !== "disponibilidade"
        ));
    }

    function renderCommercialRows(items) {
        if (!commercialList) return;
        const storedRows = commercialRowsWithoutAvailability(items);
        const rows = storedRows.length ? storedRows : defaultUsedCommercialInfo;
        commercialList.innerHTML = "";
        rows.forEach((item) => commercialList.appendChild(createCommercialRow(item[0], item[1])));
    }

    function collectCommercialInfo(availability) {
        if (!commercialList) return availability ? [["Disponibilidade", availability]] : [];
        const rows = Array.from(commercialList.querySelectorAll(".admin-commercial-row")).map((row) => {
            const inputs = row.querySelectorAll("input");
            return [inputs[0].value.trim(), inputs[1].value.trim()];
        }).filter((item) => item[0] && item[1] && normalizeText(item[0]) !== "disponibilidade");
        const availabilityRow = availability ? [["Disponibilidade", availability]] : [];
        const priceIndex = rows.findIndex((item) => normalizeText(item[0]) === "preco");
        const insertAt = priceIndex >= 0 ? priceIndex + 1 : 0;
        rows.splice(insertAt, 0, ...availabilityRow);
        return rows;
    }

    function prepareNewProduct() {
        if (!productForm) return;
        lockProductType(false);
        productForm.reset();
        editingUid = "";
        slugEdited = false;
        dirty = false;
        mainImageData = "";
        galleryData = [];
        setSelectValue("status", isEditor() ? "review" : "draft");
        const visibleInput = getField("catalogVisible");
        if (visibleInput) visibleInput.checked = true;
        setFieldValue("imagePath", "");
        setBenefitSelection([]);
        setUsedInfoCardSelection(defaultUsedInfoCards);
        updateSummaryCounter();
        updateProductType();
        updateFormHeading("Novo produto", "Preencha o essencial primeiro. Os campos avançados podem ser concluídos depois.");
        hideFormMessage();
        if (mainImagePreview) {
            mainImagePreview.src = fallbackImage;
            mainImagePreview.alt = "Prévia da imagem principal";
        }
        if (galleryStatus) galleryStatus.textContent = "Adicione de 3 a 8 imagens";
        renderSpecRows([]);
        renderCommercialRows(defaultUsedCommercialInfo);
    }

    function findAdminProduct(uid) {
        return adminProducts.find((product) => product.uid === uid);
    }

    function editProduct(uid) {
        if (isViewer()) return;
        const product = findAdminProduct(uid);
        if (!product || !productForm) return;
        if (isEditor() && product.submissionStatus === "pending") {
            showToast("Esta publicação está aguardando a análise do proprietário.");
            return;
        }
        if (currentView === "new-product" && !confirmDiscardChanges()) return;

        const source = product.source;
        lockProductType(false);
        productForm.reset();
        editingUid = product.uid;
        slugEdited = true;
        mainImageData = String(product.image).startsWith("data:image/") ? product.image : "";
        galleryData = clone(source.galeria || []);

        const typeInput = productTypeInputs.find((input) => input.value === product.type);
        if (typeInput) typeInput.checked = true;
        lockProductType(true);
        updateProductType();
        setFieldValue("model", product.rawModel);
        setFieldValue("sku", product.sku);
        setFieldValue("line", canonicalProductLine(source.linha, source.categoriaSlug));
        setFieldValue("category", source.categoria || product.category);
        setFieldValue("slug", product.id);
        setFieldValue("summary", (source.resumo || source.descricao || "").slice(0, 120));
        setFieldValue("description", source.descricao);
        setFieldValue("applications", product.type === "novo"
            ? (source.aplicacoes || [source.aplicacao]).filter(Boolean).join("\n")
            : (source.aplicacoes || source.especificacoes || []).join("\n"));
        setFieldValue("materials", (source.materiais || []).join("\n"));
        setFieldValue("resources", (source.recursos || []).join("\n"));
        setFieldValue("highlights", (source.destaques || []).join("\n"));
        setFieldValue("aboutTitle", source.sobreTitulo);
        setFieldValue("aboutParagraphs", (source.sobre || []).join("\n"));
        setBenefitSelection(source.beneficios);
        setFieldValue("applicationsIntro", source.aplicacoesTexto);
        setFieldValue("mainApplication", source.aplicacao);
        setFieldValue("newWarranty", source.garantia);
        setFieldValue("manufacturing", source.fabricacao);
        setFieldValue("publicStatus", product.type === "novo" ? source.status : "");
        setFieldValue("technicalNote", source.notaTecnica);
        setFieldValue("imageAlt", source.alt);
        setSelectValue("imageType", source.tipoImagem || "ilustrativa");
        setFieldValue("imageNote", source.observacaoImagens);
        setFieldValue("youtubeVideo", source.youtubeId || source.youtubeEmbed);
        setFieldValue("downloadCatalog", downloadFieldValue(source.downloads?.catalogoTecnico));
        setFieldValue("downloadManual", downloadFieldValue(source.downloads?.manualOperacao));
        setFieldValue("downloadDrawing", downloadFieldValue(source.downloads?.desenhoTecnico));
        setFieldValue("downloadNr12", downloadFieldValue(source.downloads?.certificadoNr12));
        setFieldValue("usedYear", source.ano);
        setFieldValue("condition", source.condicao);
        setFieldValue("location", source.localizacao);
        setFieldValue("usedWarranty", source.garantia);
        setFieldValue("includedItems", (source.oQueAcompanha || source.itensInclusos || []).join("\n"));
        setFieldValue("technicalAssessment", (source.avaliacaoTecnica || source.revisoes || []).join("\n"));
        setFieldValue("usedTechnicalNote", source.notaTecnica);
        setSelectValue("status", isEditor() ? "review" : source._admin.status);
        setSelectValue("availability", source.disponibilidade || "Sob consulta");
        setSelectValue("usedAvailability", source.status || "Sob consulta");
        setSelectValue("priceVisibility", source.precoVisibilidade || "Consultar proposta");
        setSelectValue("featured", source._admin.featured ? "yes" : "no");
        const visibleInput = getField("catalogVisible");
        const priorityInput = getField("priority");
        if (visibleInput) visibleInput.checked = source._admin.visible !== false;
        if (priorityInput) priorityInput.checked = source._admin.priority === true;
        setFieldValue("imagePath", mainImageData ? "" : product.image);
        renderSpecRows(source.specs);
        renderCommercialRows(source.informacoesComerciais);
        setUsedInfoCardSelection(source.cardsInformativos);
        updateSummaryCounter();

        if (mainImagePreview) {
            mainImagePreview.src = product.image;
            mainImagePreview.alt = `Prévia de ${product.rawModel}`;
        }
        if (galleryStatus) {
            galleryStatus.textContent = galleryData.length
                ? `${galleryData.length} imagem(ns) cadastrada(s)`
                : "Nenhuma galeria cadastrada";
        }

        updateFormHeading(
            `Editar ${product.rawModel}`,
            api?.isDatabase?.()
                ? "Revise os dados e salve para atualizar o catálogo publicado."
                : "Revise os dados e salve para atualizar o catálogo deste navegador."
        );
        hideFormMessage();
        dirty = false;
        showView("new-product");
        if (product.submissionStatus === "rejected" && product.reviewNote) {
            showFormMessage(`Ajustes solicitados: ${product.reviewNote}`, "error");
        }
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error(`Não foi possível ler ${file.name}.`));
            reader.readAsDataURL(file);
        });
    }

    function validateImageFile(file, maxBytes) {
        const validTypes = ["image/png", "image/jpeg", "image/webp"];
        if (!validTypes.includes(file.type)) throw new Error(`${file.name} não está em PNG, JPG ou WebP.`);
        if (file.size > maxBytes) {
            const maxKb = Math.round(maxBytes / 1000);
            throw new Error(`${file.name} ultrapassa o limite de ${maxKb} KB.`);
        }
    }

    function buildProduct(statusOverride) {
        const existing = editingUid ? findAdminProduct(editingUid) : null;
        const previous = existing ? clone(existing.source) : {};
        const editorialMeta = existing?.editorialMeta || api?.getEditorialMeta?.("product", previous) || {};
        const typeInput = productTypeInputs.find((input) => input.checked);
        const type = typeInput ? typeInput.value : "novo";
        const model = getFieldValue("model");
        const id = createSlug(getFieldValue("slug") || model);
        const category = getFieldValue("category");
        const line = type === "novo" ? canonicalProductLine(getFieldValue("line")) : "";
        const summary = getFieldValue("summary");
        const description = getFieldValue("description");
        const applications = getLines(getFieldValue("applications"));
        const materials = getLines(getFieldValue("materials"));
        const resources = getLines(getFieldValue("resources"));
        const highlights = getLines(getFieldValue("highlights"));
        const aboutParagraphs = getLines(getFieldValue("aboutParagraphs"));
        const includedItems = getLines(getFieldValue("includedItems"));
        const technicalAssessment = getLines(getFieldValue("technicalAssessment"));
        const benefits = type === "novo" ? collectBenefits() : [];
        const specs = collectSpecs();
        const imagePath = getFieldValue("imagePath");
        const explicitImage = mainImageData || imagePath || previous.imagemPrincipal || previous.imagem || "";
        const image = explicitImage || fallbackImage;
        let status = statusOverride || getFieldValue("status") || "draft";
        if (isViewer()) throw new Error("Sua conta possui acesso somente para leitura.");
        if (isEditor() && status !== "draft") status = "review";
        const visibleInput = getField("catalogVisible");
        const priorityInput = getField("priority");

        if (!model || !id) {
            throw new Error("Informe ao menos o modelo para salvar este rascunho.");
        }
        if (status !== "draft" && (!category || !summary)) {
            throw new Error("Preencha categoria e resumo antes de publicar ou enviar para análise.");
        }
        if (type === "novo" && status !== "draft" && !line) {
            throw new Error("Selecione uma das quatro linhas do equipamento antes de salvar.");
        }
        if (status !== "draft" && (!description || !specs.length)) {
            const action = status === "review" ? "enviar à análise" : "publicar";
            throw new Error(`Para ${action}, preencha a descrição completa e ao menos uma especificação técnica.`);
        }
        if (type === "usado" && status !== "draft" && !explicitImage) {
            throw new Error("Adicione uma imagem real da máquina usada antes de publicar ou enviar para análise.");
        }
        if (imagePath && !/^(?:https:\/\/|(?:\.\/|\/)?(?:assets|uploads)\/|data:image\/)/i.test(imagePath)) {
            throw new Error("Use uma imagem da pasta assets, uma URL HTTPS ou selecione um arquivo válido.");
        }

        const youtubeInput = getFieldValue("youtubeVideo");
        const youtubeId = youtubeIdFromInput(youtubeInput);
        if (youtubeInput && !youtubeId) {
            throw new Error("Informe uma URL válida do YouTube ou somente o ID do vídeo.");
        }

        const product = {
            ...previous,
            id,
            modelo: model,
            descricao: description,
            resumo: summary,
            imagemPrincipal: image,
            imagem: image,
            alt: getFieldValue("imageAlt") || previous.alt || `${model} Brutusmaq`,
            specs,
            galeria: galleryData,
            observacaoImagens: getFieldValue("imageNote"),
            youtubeId,
            _admin: {
                ...(previous._admin || {}),
                uid: editingUid || undefined,
                status,
                submissionId: editorialMeta.submissionId || previous._admin?.submissionId || undefined,
                version: Number.isInteger(editorialMeta.version) ? editorialMeta.version : previous._admin?.version,
                visible: visibleInput ? visibleInput.checked : true,
                featured: getFieldValue("featured") === "yes",
                priority: priorityInput ? priorityInput.checked : false,
                sku: getFieldValue("sku"),
                updatedAt: new Date().toISOString()
            }
        };

        if (type === "novo") {
            product.linha = line;
            product.categoria = category;
            product.categoriaSlug = productLineSlug(line);
            product.aplicacao = getFieldValue("mainApplication") || applications[0] || "";
            product.aplicacoes = applications;
            product.materiais = materials;
            product.recursos = resources;
            product.destaques = highlights;
            product.sobreTitulo = getFieldValue("aboutTitle");
            product.sobre = aboutParagraphs;
            product.beneficios = benefits;
            product.aplicacoesTexto = getFieldValue("applicationsIntro");
            product.garantia = getFieldValue("newWarranty");
            product.fabricacao = getFieldValue("manufacturing");
            product.status = getFieldValue("publicStatus");
            product.notaTecnica = getFieldValue("technicalNote");
            product.tipoImagem = getFieldValue("imageType");
            delete product.youtubeEmbed;
            const downloadUrls = {
                catalogoTecnico: safeDownloadInput(getFieldValue("downloadCatalog")),
                manualOperacao: safeDownloadInput(getFieldValue("downloadManual")),
                desenhoTecnico: safeDownloadInput(getFieldValue("downloadDrawing")),
                certificadoNr12: safeDownloadInput(getFieldValue("downloadNr12"))
            };
            product.downloads = Array.isArray(previous.downloads) && !Object.values(downloadUrls).some(Boolean)
                ? previous.downloads
                : Object.fromEntries(Object.entries(downloadUrls).map(([key, url]) => [
                    key,
                    preserveDownloadMetadata(previous.downloads?.[key], url)
                ]));
            product.disponibilidade = getFieldValue("availability");
            product.precoVisibilidade = getFieldValue("priceVisibility");
        } else {
            const availability = getFieldValue("usedAvailability") || "Sob consulta";
            const availabilitySlug = usedAvailabilitySlug(availability);
            product.categoria = category;
            product.categoriaSlug = createSlug(category);
            product.ano = getFieldValue("usedYear");
            product.condicao = getFieldValue("condition");
            product.localizacao = getFieldValue("location");
            product.garantia = getFieldValue("usedWarranty");
            product.status = availability;
            product.statusSlug = availabilitySlug;
            product.statusClasse = `status-${availabilitySlug}`;
            product.aplicacoes = applications;
            product.materiais = materials;
            product.especificacoes = applications;
            product.oQueAcompanha = includedItems;
            product.avaliacaoTecnica = technicalAssessment;
            product.informacoesComerciais = collectCommercialInfo(availability);
            product.cardsInformativos = collectUsedInfoCards();
            product.notaTecnica = getFieldValue("usedTechnicalNote");
            product.url = `maquina-usada.html?id=${id}`;
            product.cta = previous.cta || "Ver detalhes";
            delete product.youtubeEmbed;
        }

        return { type, product };
    }

    function setProductSaving(saving) {
        productForm?.querySelectorAll('button[type="submit"]').forEach((button) => { button.disabled = saving; });
        document.querySelectorAll('[type="submit"][form="adminProductForm"]').forEach((button) => { button.disabled = saving; });
        document.querySelectorAll("[data-save-draft]").forEach((button) => { button.disabled = saving; });
    }

    async function uploadProductMedia(built) {
        if (!api?.isDatabase?.()) return built;
        const mainFile = mainImageInput?.files?.[0];
        if (mainFile) {
            const result = await api.uploadMedia(mainFile, built.product.alt || built.product.modelo);
            built.product.imagemPrincipal = result.asset.publicUrl;
            built.product.imagem = result.asset.publicUrl;
        }
        const galleryFiles = Array.from(galleryInput?.files || []).slice(0, 8);
        if (galleryFiles.length) {
            const uploaded = await Promise.all(galleryFiles.map((file, index) => (
                api.uploadMedia(file, `${built.product.modelo} - imagem ${index + 1}`)
            )));
            built.product.galeria = uploaded.map((result, index) => ({
                src: result.asset.publicUrl,
                alt: result.asset.altText || `${built.product.modelo} - imagem ${index + 1}`
            }));
        }
        return built;
    }

    async function saveProduct(statusOverride) {
        if (!productForm) return;
        if (isViewer()) {
            showFormMessage("Sua conta possui acesso somente para leitura.", "error");
            return;
        }
        const intendedStatus = statusOverride || getFieldValue("status") || "draft";
        if (intendedStatus !== "draft" && !productForm.checkValidity()) {
            productForm.reportValidity();
            return;
        }

        setProductSaving(true);
        try {
            const built = await uploadProductMedia(buildProduct(statusOverride));
            let saved;
            let submission = null;
            if (api?.isDatabase?.()) {
                const result = await api.saveProduct(built.type, built.product, editingUid || undefined);
                submission = result.submission || result.review || null;
                if (result.product) {
                    saved = store.upsert(built.type, result.product, editingUid || undefined);
                } else if (submission) {
                    dirty = false;
                    editingUid = "";
                    renderAll();
                    showView("products");
                    showToast(`${built.product.modelo} foi enviado para análise do proprietário.`);
                    window.dispatchEvent(new CustomEvent("brutusmaq:review-submitted", { detail: submission }));
                    return;
                } else {
                    throw new Error("O servidor não retornou o produto nem a solicitação de análise.");
                }
            } else {
                saved = store.upsert(built.type, built.product, editingUid || undefined);
            }
            editingUid = saved._admin.uid;
            dirty = false;
            renderAll();
            showView("products");
            if (submission?.status === "pending") {
                showToast(`${saved.modelo} foi enviado para análise do proprietário.`);
                window.dispatchEvent(new CustomEvent("brutusmaq:review-submitted", { detail: submission }));
                return;
            }
            const status = statusMap[saved._admin.status] || statusMap.draft;
            const publicUrl = built.type === "usado"
                ? `maquina-usada.html?id=${encodeURIComponent(saved.id)}`
                : `produto.html?produto=${encodeURIComponent(saved.id)}`;
            const canPreview = saved._admin.status === "published" && saved._admin.visible !== false;
            showToast(
                `${saved.modelo} foi salvo como ${status.label.toLowerCase()}.`,
                canPreview ? "Ver página" : "",
                canPreview ? () => window.open(publicUrl, "_blank", "noopener") : null
            );
        } catch (error) {
            showFormMessage(error instanceof Error ? error.message : "Não foi possível salvar o produto.", "error");
        } finally {
            setProductSaving(false);
        }
    }

    function openConfirmation(title, description, actionLabel, action) {
        if (!deleteDialog || typeof deleteDialog.showModal !== "function") {
            if (window.confirm(`${title}\n\n${description}`)) action();
            return;
        }
        if (deleteDialogTitle) deleteDialogTitle.textContent = title;
        if (deleteDialogDescription) deleteDialogDescription.textContent = description;
        if (confirmDeleteButton) confirmDeleteButton.textContent = actionLabel;
        pendingConfirmation = action;
        deleteDialog.showModal();
    }

    function deleteProduct(uid) {
        if (!isOwner()) return;
        const product = findAdminProduct(uid);
        if (!product) return;
        openConfirmation(
            `Excluir ${product.rawModel}?`,
            api?.isDatabase?.()
                ? "O produto será removido do catálogo publicado. Você poderá desfazer logo após a exclusão."
                : "O produto será removido do catálogo salvo neste navegador. Você poderá desfazer logo após a exclusão.",
            "Excluir produto",
            async () => {
                try {
                    if (api?.isDatabase?.()) await api.deleteProduct(uid);
                    lastRemoved = store.remove(uid);
                    if (editingUid === uid) prepareNewProduct();
                    renderAll();
                    showToast(`${product.rawModel} foi excluído.`, "Desfazer", async () => {
                        try {
                            if (api?.isDatabase?.()) await api.restoreProduct(uid);
                            store.restore(lastRemoved);
                            lastRemoved = null;
                            renderAll();
                            showToast(`${product.rawModel} foi restaurado.`);
                        } catch (error) {
                            showToast(error instanceof Error ? error.message : "Não foi possível restaurar o produto.");
                        }
                    });
                } catch (error) {
                    showToast(error instanceof Error ? error.message : "Não foi possível excluir o produto.");
                }
            }
        );
    }

    function cancelProductSubmission(submissionId, title) {
        if (!isEditor() || !submissionId || !api?.isDatabase?.()) return;
        openConfirmation(
            `Descartar a proposta de ${title || "produto"}?`,
            "Ela sairá da caixa de análise. Depois você poderá abrir a versão atual do site e preparar um novo envio.",
            "Descartar proposta",
            async () => {
                try {
                    await api.cancelSubmission(submissionId);
                    await api.bootstrap();
                    renderAll();
                    showToast("A proposta foi descartada. A versão publicada não foi alterada.");
                } catch (error) {
                    showToast(error instanceof Error ? error.message : "Não foi possível descartar a proposta.");
                }
            }
        );
    }

    function exportCatalog() {
        const data = JSON.stringify(store.exportCatalog(), null, 2);
        const blob = new Blob([data], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const date = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `brutusmaq-catalogo-${date}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast("Backup do catálogo exportado.");
    }

    function importCatalog(file) {
        if (!isOwner()) return;
        if (!file) return;
        if (file.size > 5000000) {
            showToast("O arquivo ultrapassa o limite de 5 MB.");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result || ""));
                openConfirmation(
                    "Importar backup?",
                    "O catálogo salvo atualmente será substituído pelos dados validados deste arquivo.",
                    "Importar catálogo",
                    async () => {
                        const previousCatalog = store.getCatalog();
                        try {
                            if (api?.isDatabase?.()) {
                                const normalized = store.replaceCatalog(parsed);
                                const result = await api.replaceCatalog(normalized);
                                store.setRemoteCatalog(result.catalog);
                            } else {
                                store.replaceCatalog(parsed);
                            }
                            dirty = false;
                            editingUid = "";
                            renderAll();
                            showView("products");
                            showToast("Backup importado com sucesso.");
                        } catch (error) {
                            if (api?.isDatabase?.()) store.setRemoteCatalog(previousCatalog);
                            showToast(error instanceof Error ? error.message : "O backup não pôde ser importado.");
                        }
                    }
                );
            } catch (error) {
                showToast("O arquivo selecionado não contém um JSON válido.");
            } finally {
                if (importInput) importInput.value = "";
            }
        };
        reader.onerror = () => showToast("Não foi possível ler o arquivo selecionado.");
        reader.readAsText(file, "utf-8");
    }

    function resetCatalog() {
        if (!isOwner()) return;
        openConfirmation(
            "Restaurar catálogo-base?",
            "Todos os produtos criados ou alterados serão substituídos pelo catálogo-base. Exporte um backup antes de continuar.",
            "Restaurar catálogo",
            async () => {
                try {
                    if (api?.isDatabase?.()) {
                        const result = await api.replaceCatalog(store.getBaseCatalog());
                        store.setRemoteCatalog(result.catalog);
                    } else {
                        store.reset();
                    }
                    dirty = false;
                    editingUid = "";
                    prepareNewProduct();
                    renderAll();
                    showView("products");
                    showToast("O catálogo-base foi restaurado.");
                } catch (error) {
                    showToast(error instanceof Error ? error.message : "Não foi possível restaurar o catálogo-base.");
                }
            }
        );
    }

    navButtons.forEach((button) => {
        button.addEventListener("click", () => navigateTo(button.dataset.adminView));
    });

    document.querySelectorAll("[data-go-to]").forEach((button) => {
        button.addEventListener("click", () => navigateTo(button.dataset.goTo));
    });

    if (menuButton) {
        menuButton.addEventListener("click", () => {
            if (sidebar && sidebar.classList.contains("is-open")) closeSidebar();
            else openSidebar();
        });
    }
    if (sidebarBackdrop) sidebarBackdrop.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeSidebar();
    });

    [productSearch, typeFilter, statusFilter].forEach((control) => {
        if (!control) return;
        control.addEventListener(control.tagName === "INPUT" ? "input" : "change", filterProducts);
    });

    if (clearFiltersButton) {
        clearFiltersButton.addEventListener("click", () => {
            if (productSearch) productSearch.value = "";
            if (typeFilter) typeFilter.value = "all";
            if (statusFilter) statusFilter.value = "all";
            filterProducts();
            if (productSearch) productSearch.focus();
        });
    }

    productTypeInputs.forEach((input) => input.addEventListener("change", () => {
        updateProductType();
        dirty = true;
    }));

    const modelInput = getField("model");
    const slugInput = getField("slug");
    if (slugInput) {
        slugInput.addEventListener("input", () => {
            slugEdited = slugInput.value.trim().length > 0;
        });
    }
    if (modelInput && slugInput) {
        modelInput.addEventListener("input", () => {
            if (!slugEdited) slugInput.value = createSlug(modelInput.value);
        });
    }

    benefitOptionInputs.forEach((input) => {
        input.addEventListener("change", () => {
            if (input.checked && currentBenefitValues().length > maxProductBenefits) {
                input.checked = false;
                updateBenefitSelectionState(`Limite de ${maxProductBenefits} benefícios atingido`);
                return;
            }
            updateBenefitSelectionState();
        });
    });

    if (customBenefitsInput) {
        customBenefitsInput.addEventListener("input", () => updateBenefitSelectionState());
    }

    usedInfoCardSelects.forEach((select) => {
        select.addEventListener("change", updateUsedInfoCardState);
    });

    if (summaryInput) {
        summaryInput.addEventListener("input", updateSummaryCounter);
    }

    if (productForm) {
        productForm.addEventListener("input", () => { dirty = true; });
        productForm.addEventListener("change", () => { dirty = true; });
        productForm.addEventListener("submit", (event) => {
            event.preventDefault();
            saveProduct(isEditor() ? "review" : undefined);
        });
    }

    document.querySelectorAll("[data-save-draft]").forEach((button) => {
        button.addEventListener("click", () => saveProduct("draft"));
    });

    if (mainImageInput && mainImagePreview) {
        mainImageInput.addEventListener("change", async () => {
            const file = mainImageInput.files && mainImageInput.files[0];
            if (!file) return;
            try {
                validateImageFile(file, maxMainImageBytes);
                mainImageData = await readFileAsDataUrl(file);
                setFieldValue("imagePath", "");
                mainImagePreview.src = mainImageData;
                mainImagePreview.alt = `Prévia de ${file.name}`;
                dirty = true;
                showFormMessage("Imagem principal pronta para ser salva com o produto.", "success");
            } catch (error) {
                mainImageInput.value = "";
                showFormMessage(error instanceof Error ? error.message : "Imagem inválida.", "error");
            }
        });
    }

    const imagePathInput = getField("imagePath");
    if (imagePathInput && mainImagePreview) {
        imagePathInput.addEventListener("change", () => {
            const path = imagePathInput.value.trim();
            if (!path) return;
            mainImageData = "";
            mainImagePreview.src = path;
            mainImagePreview.alt = "Prévia da imagem informada";
        });
    }

    if (galleryInput && galleryStatus) {
        galleryInput.addEventListener("change", async () => {
            const files = Array.from(galleryInput.files || []).slice(0, 8);
            if (!files.length) {
                galleryData = [];
                galleryStatus.textContent = "Adicione de 3 a 8 imagens";
                return;
            }
            try {
                files.forEach((file) => validateImageFile(file, maxGalleryImageBytes));
                const images = await Promise.all(files.map(readFileAsDataUrl));
                galleryData = images.map((src, index) => ({
                    src,
                    alt: `${getFieldValue("model") || "Equipamento"} - imagem ${index + 1}`
                }));
                galleryStatus.textContent = files.length < 3
                    ? `${files.length} selecionada(s). Recomendamos pelo menos 3.`
                    : `${files.length} imagem(ns) pronta(s) para salvar`;
                dirty = true;
            } catch (error) {
                galleryInput.value = "";
                showFormMessage(error instanceof Error ? error.message : "Uma das imagens da galeria é inválida.", "error");
            }
        });
    }

    if (addSpecButton && specList) {
        addSpecButton.addEventListener("click", () => {
            const row = createSpecRow("", "");
            specList.appendChild(row);
            const firstInput = row.querySelector("input");
            if (firstInput) firstInput.focus();
            dirty = true;
        });
    }

    if (addCommercialButton && commercialList) {
        addCommercialButton.addEventListener("click", () => {
            const row = createCommercialRow("", "");
            commercialList.appendChild(row);
            row.querySelector("input")?.focus();
            dirty = true;
        });
    }

    if (commercialList) {
        commercialList.addEventListener("click", (event) => {
            const button = event.target.closest("[data-remove-commercial]");
            if (!button) return;
            const rows = commercialList.querySelectorAll(".admin-commercial-row");
            if (rows.length === 1) {
                rows[0].querySelectorAll("input").forEach((input) => { input.value = ""; });
            } else {
                button.closest(".admin-commercial-row")?.remove();
            }
            dirty = true;
        });
    }

    if (specList) {
        specList.addEventListener("click", (event) => {
            const button = event.target.closest("[data-remove-spec]");
            if (!button) return;
            const rows = specList.querySelectorAll(".admin-spec-row");
            if (rows.length === 1) {
                rows[0].querySelectorAll("input").forEach((input) => { input.value = ""; });
            } else {
                button.closest(".admin-spec-row").remove();
            }
            dirty = true;
        });
    }

    document.querySelectorAll(".admin-inline-action").forEach((button) => {
        button.addEventListener("click", () => {
            const category = window.prompt("Nome da nova categoria:", "");
            if (category === null) return;
            const name = category.replace(/[<>]/g, "").trim().slice(0, 60);
            if (name.length < 2) {
                showFormMessage("Informe um nome de categoria com pelo menos 2 caracteres.", "error");
                return;
            }
            setSelectValue("category", name);
            dirty = true;
            showFormMessage(`Categoria \"${name}\" adicionada ao cadastro atual.`, "success");
        });
    });

    if (productRowsContainer) {
        productRowsContainer.addEventListener("click", (event) => {
            const editButton = event.target.closest("[data-edit-product]");
            const deleteButton = event.target.closest("[data-delete-product]");
            const cancelButton = event.target.closest("[data-cancel-product-submission]");
            if (editButton) editProduct(editButton.dataset.editProduct);
            else if (deleteButton) deleteProduct(deleteButton.dataset.deleteProduct);
            else if (cancelButton) cancelProductSubmission(cancelButton.dataset.cancelProductSubmission, cancelButton.dataset.submissionTitle);
        });
    }

    if (confirmDeleteButton) {
        confirmDeleteButton.addEventListener("click", (event) => {
            event.preventDefault();
            const action = pendingConfirmation;
            pendingConfirmation = null;
            if (deleteDialog && deleteDialog.open) deleteDialog.close("confirm");
            if (typeof action === "function") action();
        });
    }
    if (deleteDialog) {
        deleteDialog.addEventListener("close", () => {
            pendingConfirmation = null;
        });
    }

    if (exportButton) exportButton.addEventListener("click", exportCatalog);
    if (importInput) importInput.addEventListener("change", () => importCatalog(importInput.files && importInput.files[0]));
    if (resetButton) resetButton.addEventListener("click", resetCatalog);
    if (toastClose) toastClose.addEventListener("click", closeToast);
    window.addEventListener("brutusmaq:catalog-changed", renderAll);
    window.addEventListener("brutusmaq:admin-ready", (event) => applyProductAccess(event.detail));

    const formStepLinks = Array.from(document.querySelectorAll(".admin-form-steps a"));
    const formSections = formStepLinks
        .map((link) => document.querySelector(link.getAttribute("href")))
        .filter(Boolean);
    if ("IntersectionObserver" in window && formSections.length) {
        const sectionObserver = new IntersectionObserver((entries) => {
            const visibleEntry = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (!visibleEntry) return;
            formStepLinks.forEach((link) => {
                link.classList.toggle("is-current", link.getAttribute("href") === `#${visibleEntry.target.id}`);
            });
        }, { rootMargin: "-25% 0px -60%", threshold: [0.05, 0.25, 0.5] });
        formSections.forEach((section) => sectionObserver.observe(section));
    }

    window.addEventListener("beforeunload", (event) => {
        const blogDirty = window.BrutusmaqAdminBlog
            && typeof window.BrutusmaqAdminBlog.isDirty === "function"
            && window.BrutusmaqAdminBlog.isDirty();
        if (!dirty && !blogDirty) return;
        event.preventDefault();
        event.returnValue = "";
    });

    window.BrutusmaqAdminUI = Object.freeze({
        showView,
        showToast,
        openConfirmation,
        normalizeText,
        createSlug,
        escapeHtml,
        clone,
        formatDate,
        getCurrentView: () => currentView
    });

    if (!store) {
        showToast("A camada de dados do catálogo não foi carregada. Atualize a página.");
        return;
    }

    const notice = document.querySelector(".admin-local-notice div");
    if (notice) notice.innerHTML = api?.isDatabase?.()
        ? "<strong>Banco central ativo</strong><p>Produtos e artigos são publicados pela API e ficam disponíveis para todos os visitantes.</p>"
        : "<strong>Dados locais ativos</strong><p>Produtos e artigos são salvos neste navegador e refletidos nas páginas públicas desta origem. Exporte backups regularmente.</p>";

    prepareNewProduct();
    renderAll();
    updateProductType();
    filterProducts();
    api?.ready?.then?.(() => applyProductAccess()).catch?.(() => applyProductAccess());

    const storeError = store.getLastError();
    if (storeError) showToast(`O catálogo salvo não pôde ser carregado: ${storeError}`);
}());
