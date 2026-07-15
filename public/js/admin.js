(function () {
    "use strict";

    const viewLabels = {
        dashboard: "Visão geral",
        products: "Produtos",
        "new-product": "Novo produto"
    };

    const sidebar = document.getElementById("adminSidebar");
    const sidebarBackdrop = document.querySelector("[data-close-sidebar]");
    const menuButton = document.querySelector(".admin-menu-button");
    const currentViewLabel = document.getElementById("adminCurrentView");
    const navButtons = Array.from(document.querySelectorAll("[data-admin-view]"));
    const viewPanels = Array.from(document.querySelectorAll("[data-view-panel]"));

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

        if (currentViewLabel) currentViewLabel.textContent = viewLabels[viewName] || "Painel";
        document.title = `${viewLabels[viewName] || "Painel"} | Brutusmaq`;
        closeSidebar();

        if (settings.scroll !== false) {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }

    navButtons.forEach((button) => {
        button.addEventListener("click", () => showView(button.dataset.adminView));
    });

    document.querySelectorAll("[data-go-to]").forEach((button) => {
        button.addEventListener("click", () => showView(button.dataset.goTo));
    });

    if (menuButton) {
        menuButton.addEventListener("click", () => {
            const isOpen = sidebar && sidebar.classList.contains("is-open");
            if (isOpen) closeSidebar();
            else openSidebar();
        });
    }

    if (sidebarBackdrop) sidebarBackdrop.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeSidebar();
    });

    const productSearch = document.getElementById("adminProductSearch");
    const typeFilter = document.getElementById("adminTypeFilter");
    const statusFilter = document.getElementById("adminStatusFilter");
    const clearFiltersButton = document.getElementById("clearProductFilters");
    const productRows = Array.from(document.querySelectorAll("[data-product-row]"));
    const productCount = document.getElementById("adminProductCount");
    const productEmpty = document.getElementById("adminProductEmpty");

    function normalizeText(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
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

    const productForm = document.getElementById("adminProductForm");
    const formMessage = document.getElementById("adminFormMessage");
    const productTypeInputs = Array.from(document.querySelectorAll('input[name="productType"]'));
    const usedFields = document.getElementById("adminUsedFields");
    const modelInput = productForm && productForm.elements.model;
    const slugInput = productForm && productForm.elements.slug;
    let slugEdited = false;

    function updateProductType() {
        const checked = productTypeInputs.find((input) => input.checked);
        if (usedFields) usedFields.hidden = !checked || checked.value !== "usado";
    }

    productTypeInputs.forEach((input) => input.addEventListener("change", updateProductType));
    updateProductType();

    function createSlug(value) {
        return normalizeText(value)
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

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

    const mainImageInput = document.getElementById("adminMainImage");
    const mainImagePreview = document.getElementById("adminMainPreview");
    let previewUrl = "";

    if (mainImageInput && mainImagePreview) {
        mainImageInput.addEventListener("change", () => {
            const file = mainImageInput.files && mainImageInput.files[0];
            if (!file) return;
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = URL.createObjectURL(file);
            mainImagePreview.src = previewUrl;
            mainImagePreview.alt = `Prévia de ${file.name}`;
        });
    }

    const galleryInput = document.getElementById("adminGalleryImages");
    const galleryStatus = document.getElementById("adminGalleryStatus");

    if (galleryInput && galleryStatus) {
        galleryInput.addEventListener("change", () => {
            const amount = galleryInput.files ? galleryInput.files.length : 0;
            if (!amount) galleryStatus.textContent = "Adicione de 3 a 8 imagens";
            else if (amount < 3) galleryStatus.textContent = `${amount} selecionada(s). Recomendamos pelo menos 3.`;
            else galleryStatus.textContent = `${amount} imagem(ns) selecionada(s)`;
        });
    }

    const specList = document.getElementById("adminSpecList");
    const addSpecButton = document.getElementById("adminAddSpec");

    function createSpecRow() {
        const row = document.createElement("div");
        row.className = "admin-spec-row";
        row.innerHTML = [
            '<input type="text" aria-label="Nome da especificação" placeholder="Ex.: Dimensões">',
            '<input type="text" aria-label="Valor da especificação" placeholder="Ex.: 2.000 x 1.450 x 1.750 mm">',
            '<button type="button" data-remove-spec aria-label="Remover especificação">×</button>'
        ].join("");
        return row;
    }

    if (addSpecButton && specList) {
        addSpecButton.addEventListener("click", () => {
            const row = createSpecRow();
            specList.appendChild(row);
            const firstInput = row.querySelector("input");
            if (firstInput) firstInput.focus();
        });
    }

    if (specList) {
        specList.addEventListener("click", (event) => {
            const button = event.target.closest("[data-remove-spec]");
            if (!button) return;
            const rows = specList.querySelectorAll(".admin-spec-row");
            if (rows.length === 1) {
                rows[0].querySelectorAll("input").forEach((input) => { input.value = ""; });
                return;
            }
            button.closest(".admin-spec-row").remove();
        });
    }

    function showFormMessage(message) {
        if (!formMessage) return;
        formMessage.textContent = message;
        formMessage.hidden = false;
        formMessage.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    document.querySelectorAll("[data-save-draft]").forEach((button) => {
        button.addEventListener("click", () => {
            showView("new-product", { scroll: false });
            showFormMessage("Rascunho demonstrativo: a interface está pronta, mas o salvamento dependerá da API e do banco de dados.");
        });
    });

    if (productForm) {
        productForm.addEventListener("submit", (event) => {
            event.preventDefault();
            if (!productForm.checkValidity()) {
                productForm.reportValidity();
                return;
            }
            showFormMessage("Produto pronto para revisão visual. A publicação real será conectada ao backend na próxima etapa.");
        });
    }

    document.querySelectorAll(".admin-inline-action").forEach((button) => {
        button.addEventListener("click", () => {
            showFormMessage("A criação de categorias será conectada ao banco para manter filtros e menus sincronizados.");
        });
    });

    document.querySelectorAll(".admin-row-action").forEach((button) => {
        button.addEventListener("click", () => {
            showView("new-product");
            showFormMessage(`Modo de edição preparado para ${button.getAttribute("aria-label").replace("Editar ", "")}. O carregamento dos dados virá da API.`);
        });
    });

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

    window.addEventListener("beforeunload", () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
    });

    filterProducts();
})();
