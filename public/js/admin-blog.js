(function () {
    "use strict";

    const store = window.BrutusmaqBlogStore;
    const ui = window.BrutusmaqAdminUI;
    const api = window.BrutusmaqAdminApi;
    const fallbackImage = "assets/main/tr-700.webp";
    const maxImageBytes = 1000000;
    const statusMap = {
        published: { label: "Publicado", className: "is-published" },
        review: { label: "Em revisão", className: "is-review" },
        draft: { label: "Rascunho", className: "is-draft" }
    };

    const articleSearch = document.getElementById("adminArticleSearch");
    const categoryFilter = document.getElementById("adminArticleCategoryFilter");
    const statusFilter = document.getElementById("adminArticleStatusFilter");
    const clearFiltersButton = document.getElementById("clearArticleFilters");
    const rowsContainer = document.getElementById("adminArticleRows");
    const articleCount = document.getElementById("adminArticleCount");
    const articleEmpty = document.getElementById("adminArticleEmpty");
    const navCount = document.getElementById("adminNavArticleCount");
    const recentRows = document.getElementById("adminRecentArticleRows");
    const metricTotal = document.getElementById("adminBlogMetricTotal");
    const metricPublished = document.getElementById("adminBlogMetricPublished");
    const metricPending = document.getElementById("adminBlogMetricPending");
    const form = document.getElementById("adminArticleForm");
    const formMessage = document.getElementById("adminArticleFormMessage");
    const sectionList = document.getElementById("adminArticleSectionList");
    const sectionCount = document.getElementById("adminArticleSectionCount");
    const addSectionButton = document.getElementById("adminAddArticleSection");
    const imageInput = document.getElementById("adminArticleImage");
    const imagePreview = document.getElementById("adminArticleImagePreview");
    const previewLink = document.getElementById("adminArticlePreviewLink");
    const exportButton = document.getElementById("adminExportArticles");
    const importInput = document.getElementById("adminImportArticles");
    const resetButton = document.getElementById("adminResetArticles");
    const categoryDatalist = document.getElementById("adminArticleCategories");

    let articles = [];
    let editingUid = "";
    let slugEdited = false;
    let dirty = false;
    let imageData = "";
    let lastRemoved = null;
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

    function applyArticleAccess(detail) {
        const user = detail?.user || api?.getUser?.();
        accessRole = api?.isDatabase?.() ? (user?.role || "viewer") : "owner";
        const owner = isOwner();
        const editor = isEditor();
        const viewer = isViewer();
        const publicationStatus = getField("articleStatus");
        const publishOption = publicationStatus?.querySelector('[value="published"]');

        if (publishOption) {
            publishOption.hidden = !owner;
            publishOption.disabled = !owner;
        }
        if (editor && publicationStatus) publicationStatus.value = "review";
        if (publicationStatus) publicationStatus.disabled = editor || viewer;

        document.querySelectorAll("[data-article-submit]").forEach((button) => {
            button.textContent = editor ? "Enviar para análise" : "Salvar artigo";
            button.hidden = viewer;
        });
        document.querySelectorAll("[data-save-article-draft]").forEach((button) => { button.hidden = viewer; });
        document.querySelectorAll('[data-go-to="new-article"]').forEach((button) => { button.hidden = viewer; });
        document.querySelectorAll('[data-admin-view="new-article"]').forEach((button) => { button.hidden = viewer; });
        if (importInput?.closest("label")) importInput.closest("label").hidden = !owner;
        if (resetButton) resetButton.hidden = !owner;
        if (addSectionButton) addSectionButton.hidden = viewer;
        form?.querySelectorAll("input, select, textarea, button").forEach((control) => {
            if (control.matches('[name="articleStatus"]')) return;
            control.disabled = viewer;
        });
        if (editor && !editingUid && user?.name && getFieldValue("articleAuthor") === "Equipe Brutusmaq") {
            setFieldValue("articleAuthor", user.name);
        }
        renderAll();
    }

    function normalizeText(value) {
        if (ui && typeof ui.normalizeText === "function") return ui.normalizeText(value);
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    function createSlug(value) {
        if (ui && typeof ui.createSlug === "function") return ui.createSlug(value);
        return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    }

    function escapeHtml(value) {
        if (ui && typeof ui.escapeHtml === "function") return ui.escapeHtml(value);
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

    function localDate() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function formatUpdatedAt(value) {
        if (!value) return "Artigo-base";
        return ui && typeof ui.formatDate === "function" ? ui.formatDate(value) : value;
    }

    function getField(name) {
        return form && form.querySelector(`[name="${name}"]`);
    }

    function getFieldValue(name) {
        const field = getField(name);
        return field ? String(field.value || "").trim() : "";
    }

    function setFieldValue(name, value) {
        const field = getField(name);
        if (field) field.value = value == null ? "" : value;
    }

    function splitParagraphs(value) {
        return String(value || "")
            .split(/\n\s*\n/)
            .map((item) => item.replace(/\s*\n\s*/g, " ").trim())
            .filter(Boolean);
    }

    function splitLines(value) {
        return String(value || "")
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter(Boolean);
    }

    function parseCards(value) {
        return splitLines(value).map((line, index) => {
            const separator = line.indexOf("|");
            if (separator < 0) return null;
            const title = line.slice(0, separator).trim();
            const description = line.slice(separator + 1).trim();
            return title && description
                ? [String(index + 1).padStart(2, "0"), title, description]
                : null;
        }).filter(Boolean);
    }

    function serializeCards(items) {
        return (items || []).map((item) => `${item[1]} | ${item[2]}`).join("\n");
    }

    function articleUrl(article) {
        return `artigo-blog.html?artigo=${encodeURIComponent(article.slug)}`;
    }

    function articleStatus(article) {
        return statusMap[article && article._admin && article._admin.status] || statusMap.draft;
    }

    function showMessage(message, type) {
        if (!formMessage) return;
        formMessage.textContent = message;
        formMessage.classList.toggle("is-error", type === "error");
        formMessage.classList.toggle("is-success", type === "success");
        formMessage.hidden = false;
        formMessage.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function hideMessage() {
        if (!formMessage) return;
        formMessage.hidden = true;
        formMessage.classList.remove("is-error", "is-success");
    }

    function findArticle(uid) {
        return articles.find((article) => article._admin.uid === uid) || null;
    }

    function sortedArticles(list) {
        return list.slice().sort((first, second) => {
            const dateDifference = String(second.datetime || "").localeCompare(String(first.datetime || ""));
            if (dateDifference) return dateDifference;
            return String(second._admin.updatedAt || "").localeCompare(String(first._admin.updatedAt || ""));
        });
    }

    function renderCategoryOptions() {
        if (!categoryFilter && !categoryDatalist) return;
        const selected = categoryFilter ? categoryFilter.value : "all";
        const categories = Array.from(new Set(articles.map((article) => article.category).filter(Boolean)))
            .sort((first, second) => first.localeCompare(second, "pt-BR"));

        if (categoryFilter) {
            categoryFilter.innerHTML = `<option value="all">Todas</option>${categories.map((category) => (
                `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
            )).join("")}`;
            categoryFilter.value = categories.includes(selected) ? selected : "all";
        }

        if (categoryDatalist) {
            categoryDatalist.innerHTML = categories.map((category) => (
                `<option value="${escapeHtml(category)}"></option>`
            )).join("");
        }
    }

    function renderDashboard() {
        const published = articles.filter((article) => (
            article._admin.status === "published" && article._admin.visible !== false
        )).length;
        const pending = articles.filter((article) => article._admin.status !== "published").length;

        if (metricTotal) metricTotal.textContent = articles.length;
        if (metricPublished) metricPublished.textContent = published;
        if (metricPending) metricPending.textContent = pending;
        if (navCount) navCount.textContent = articles.length;

        if (!recentRows) return;
        const recent = articles.slice().sort((first, second) => {
            const firstDate = first._admin.updatedAt || `${first.datetime}T00:00:00`;
            const secondDate = second._admin.updatedAt || `${second.datetime}T00:00:00`;
            return secondDate.localeCompare(firstDate);
        }).slice(0, 4);

        if (!recent.length) {
            recentRows.innerHTML = `<tr><td colspan="3">Nenhum artigo cadastrado.</td></tr>`;
            return;
        }

        recentRows.innerHTML = recent.map((article) => {
            const status = articleStatus(article);
            return `<tr>
                <td title="${escapeHtml(article.title)}">${escapeHtml(article.title)}</td>
                <td><span class="admin-status ${status.className}">${status.label}</span></td>
                <td>${escapeHtml(formatUpdatedAt(article._admin.updatedAt))}</td>
            </tr>`;
        }).join("");
    }

    function filteredArticles() {
        const query = normalizeText(articleSearch ? articleSearch.value : "");
        const category = categoryFilter ? categoryFilter.value : "all";
        const status = statusFilter ? statusFilter.value : "all";

        return sortedArticles(articles.filter((article) => {
            const searchable = normalizeText([
                article.title,
                article.category,
                article.author,
                article.excerpt,
                article.slug
            ].join(" "));
            const matchesQuery = !query || searchable.includes(query);
            const matchesCategory = category === "all" || article.category === category;
            const matchesStatus = status === "all" || article._admin.status === status;
            return matchesQuery && matchesCategory && matchesStatus;
        }));
    }

    function renderRows() {
        if (!rowsContainer) return;
        const filtered = filteredArticles();
        const amount = filtered.length;
        if (articleCount) articleCount.textContent = `${amount} artigo${amount === 1 ? "" : "s"}`;
        if (articleEmpty) articleEmpty.hidden = amount > 0;

        rowsContainer.innerHTML = filtered.map((article) => {
            const status = articleStatus(article);
            const editorialMeta = api?.getEditorialMeta?.("article", article) || {};
            const isPublished = article._admin.status === "published";
            const isPublic = isPublished && article._admin.visible !== false;
            const visibility = isPublished && !isPublic ? `<small class="admin-article-visibility">Oculto do blog</small>` : "";
            const openAction = isPublic ? `<a class="admin-row-action" href="${articleUrl(article)}" target="_blank" rel="noopener">Abrir</a>` : "";
            const awaitingReview = isEditor() && editorialMeta.submissionStatus === "pending";
            const editAction = isViewer() || awaitingReview ? "" : `<button class="admin-row-action" type="button" data-edit-article="${escapeHtml(article._admin.uid)}">Editar</button>`;
            const cancelAction = isEditor() && editorialMeta.submissionId
                ? `<button class="admin-row-action is-danger" type="button" data-cancel-article-submission="${escapeHtml(editorialMeta.submissionId)}" data-submission-title="${escapeHtml(article.title)}">${awaitingReview ? "Retirar envio" : "Descartar"}</button>`
                : "";
            const ownerActions = isOwner()
                ? `<button class="admin-row-action ${isPublished ? "is-muted" : "is-success"}" type="button" data-toggle-article="${escapeHtml(article._admin.uid)}">${isPublished ? "Rascunho" : "Publicar"}</button>
                    <button class="admin-row-action" type="button" data-duplicate-article="${escapeHtml(article._admin.uid)}">Duplicar</button>
                    <button class="admin-row-action is-danger" type="button" data-delete-article="${escapeHtml(article._admin.uid)}">Excluir</button>`
                : "";
            const actions = openAction || editAction || cancelAction || ownerActions
                ? `${awaitingReview ? '<span class="admin-readonly-label">Aguardando análise</span>' : ""}${openAction}${editAction}${cancelAction}${ownerActions}`
                : `<span class="admin-readonly-label">${awaitingReview ? "Aguardando análise" : "Somente leitura"}</span>`;
            const feedback = editorialMeta.submissionStatus === "rejected" && editorialMeta.reviewNote
                ? `<small class="admin-review-feedback" title="${escapeHtml(editorialMeta.reviewNote)}">Ajustes solicitados</small>`
                : "";
            return `<tr>
                <td>
                    <div class="admin-product-cell">
                        <img src="${escapeHtml(article.image || fallbackImage)}" alt="">
                        <span><strong title="${escapeHtml(article.title)}">${escapeHtml(article.title)}</strong><small>/${escapeHtml(article.slug)}</small></span>
                    </div>
                </td>
                <td>${escapeHtml(article.category)}</td>
                <td><span class="admin-status ${status.className}">${status.label}</span>${visibility}${feedback}</td>
                <td>${escapeHtml(article.date || article.datetime)}</td>
                <td>${escapeHtml(formatUpdatedAt(article._admin.updatedAt))}</td>
                <td>
                    <div class="admin-row-actions">
                        ${actions}
                    </div>
                </td>
            </tr>`;
        }).join("");
    }

    function renderAll() {
        if (!store) return;
        articles = store.getArticles();
        renderCategoryOptions();
        renderDashboard();
        renderRows();
    }

    function updateSectionLabels() {
        if (!sectionList) return;
        const rows = Array.from(sectionList.querySelectorAll(".admin-article-section-row"));
        rows.forEach((row, index) => {
            const label = row.querySelector(".admin-article-section-row-head strong");
            const removeButton = row.querySelector("[data-remove-article-section]");
            if (label) label.textContent = `Seção ${String(index + 1).padStart(2, "0")}`;
            if (removeButton) removeButton.disabled = rows.length === 1;
        });
        if (sectionCount) sectionCount.textContent = `${rows.length} seç${rows.length === 1 ? "ão" : "ões"}`;
    }

    function addSection(section) {
        if (!sectionList) return;
        const source = section || {};
        const row = document.createElement("div");
        row.className = "admin-article-section-row";
        row.innerHTML = `
            <div class="admin-article-section-row-head">
                <strong>Seção</strong>
                <button type="button" data-remove-article-section aria-label="Remover seção">×</button>
            </div>
            <label><span>Título da seção</span><input type="text" data-article-section-title maxlength="180" placeholder="Ex.: 1. Comece pelo material" value="${escapeHtml(source.title || "")}"></label>
            <label><span>Parágrafos</span><textarea data-article-section-paragraphs rows="6" placeholder="Separe os parágrafos com uma linha em branco.">${escapeHtml((source.paragraphs || []).join("\n\n"))}</textarea></label>`;
        sectionList.appendChild(row);
        updateSectionLabels();
    }

    function renderSections(sections) {
        if (!sectionList) return;
        sectionList.innerHTML = "";
        const list = Array.isArray(sections) && sections.length ? sections : [{}];
        list.forEach(addSection);
        updateSectionLabels();
    }

    function collectSections() {
        if (!sectionList) return [];
        return Array.from(sectionList.querySelectorAll(".admin-article-section-row")).map((row) => ({
            title: String(row.querySelector("[data-article-section-title]")?.value || "").trim(),
            paragraphs: splitParagraphs(row.querySelector("[data-article-section-paragraphs]")?.value || "")
        })).filter((section) => section.title || section.paragraphs.length);
    }

    function updateFormHeading(title, description) {
        const heading = document.getElementById("newArticleTitle");
        const paragraph = heading && heading.parentElement ? heading.parentElement.querySelector("p") : null;
        if (heading) heading.textContent = title;
        if (paragraph) paragraph.textContent = description;
    }

    function prepareNewArticle() {
        if (!form) return;
        form.reset();
        editingUid = "";
        slugEdited = false;
        dirty = false;
        imageData = "";
        const currentUser = api?.getUser?.();
        setFieldValue("articleAuthor", isEditor() && currentUser?.name ? currentUser.name : "Equipe Brutusmaq");
        setFieldValue("articleDatetime", localDate());
        setFieldValue("articleStatus", isEditor() ? "review" : "draft");
        const visible = getField("articleVisible");
        if (visible) visible.checked = true;
        if (imagePreview) {
            imagePreview.src = fallbackImage;
            imagePreview.alt = "Prévia da imagem de capa";
        }
        if (imageInput) imageInput.value = "";
        if (previewLink) previewLink.hidden = true;
        renderSections([{}]);
        hideMessage();
        updateFormHeading("Novo artigo", "Organize o conteúdo, revise a apresentação e escolha quando ele ficará público.");
    }

    function confirmDiscardChanges() {
        return !dirty || window.confirm("Existem alterações não salvas no artigo. Deseja descartá-las?");
    }

    function editArticle(uid) {
        if (isViewer()) return;
        const article = findArticle(uid);
        if (!article || !form || !ui) return;
        const editorialMeta = api?.getEditorialMeta?.("article", article) || {};
        if (isEditor() && editorialMeta.submissionStatus === "pending") {
            ui.showToast("Este artigo está aguardando a análise do proprietário.");
            return;
        }
        if (ui.getCurrentView() === "new-article" && !confirmDiscardChanges()) return;

        form.reset();
        editingUid = uid;
        slugEdited = true;
        imageData = String(article.image || "").startsWith("data:image/") ? article.image : "";
        setFieldValue("articleTitle", article.title);
        setFieldValue("articleCategory", article.category);
        setFieldValue("articleAuthor", article.author);
        setFieldValue("articleSlug", article.slug);
        setFieldValue("articleExcerpt", article.excerpt);
        setFieldValue("articleImagePath", imageData ? "" : article.image);
        setFieldValue("articleImageAlt", article.imageAlt);
        setFieldValue("articleIntro", (article.intro || []).join("\n\n"));
        setFieldValue("articleBenefits", serializeCards(article.benefits));
        setFieldValue("articleApplications", serializeCards(article.applications));
        setFieldValue("articleChecks", (article.checks || []).join("\n"));
        setFieldValue("articleHighlight", article.highlight);
        setFieldValue("articleStatus", isEditor() ? "review" : article._admin.status);
        setFieldValue("articleDatetime", article.datetime);
        const readingMatch = String(article.reading || "").match(/^\s*(\d+)/);
        setFieldValue("articleReadingMinutes", readingMatch ? readingMatch[1] : "");
        setFieldValue("articleAccentFrom", article.accentFrom);
        const visible = getField("articleVisible");
        const popular = getField("articlePopular");
        if (visible) visible.checked = article._admin.visible !== false;
        if (popular) popular.checked = article.popular === true;
        renderSections(article.sections);

        if (imagePreview) {
            imagePreview.src = article.image || fallbackImage;
            imagePreview.alt = `Prévia de ${article.title}`;
        }
        if (previewLink) {
            previewLink.href = articleUrl(article);
            previewLink.hidden = !(article._admin.status === "published" && article._admin.visible !== false);
        }

        updateFormHeading(
            "Editar artigo",
            api?.isDatabase?.()
                ? `Revise “${article.title}” e salve para atualizar o conteúdo publicado.`
                : `Revise “${article.title}” e salve para atualizar o conteúdo deste navegador.`
        );
        hideMessage();
        dirty = false;
        ui.showView("new-article");
        if (editorialMeta.submissionStatus === "rejected" && editorialMeta.reviewNote) {
            showMessage(`Ajustes solicitados: ${editorialMeta.reviewNote}`, "error");
        }
    }

    function validateImagePath(value) {
        return !value || /^(?:https:\/\/|(?:\.\/|\/)?(?:assets|uploads)\/|data:image\/)/i.test(value);
    }

    function validateForStatus(article, status) {
        if (!article.title || !article.slug) throw new Error("Informe ao menos o título e o slug do artigo.");
        if (article.accentFrom && !article.title.includes(article.accentFrom)) {
            throw new Error("O trecho laranja precisa aparecer exatamente no título do artigo.");
        }
        if (status === "draft") return;
        if (!article.category || !article.excerpt || !article.datetime) {
            throw new Error("Para enviar à revisão, preencha categoria, resumo e data do artigo.");
        }
        if (!article.imageAlt || !article.intro.length || !article.sections.length) {
            const action = status === "review" ? "enviar à análise" : "publicar";
            throw new Error(`Para ${action}, preencha imagem alternativa, introdução e ao menos uma seção.`);
        }
        const incompleteSection = article.sections.some((section) => !section.title || !section.paragraphs.length);
        if (incompleteSection) throw new Error("Cada seção precisa de título e ao menos um parágrafo.");
    }

    function buildArticle(statusOverride) {
        const existing = editingUid ? findArticle(editingUid) : null;
        const previous = existing ? clone(existing) : {};
        const editorialMeta = existing ? (api?.getEditorialMeta?.("article", existing) || {}) : {};
        const title = getFieldValue("articleTitle");
        const slug = createSlug(getFieldValue("articleSlug") || title);
        let status = statusOverride || getFieldValue("articleStatus") || "draft";
        if (isViewer()) throw new Error("Sua conta possui acesso somente para leitura.");
        if (isEditor() && status !== "draft") status = "review";
        const imagePath = getFieldValue("articleImagePath");
        if (!validateImagePath(imagePath)) {
            throw new Error("Use uma imagem da pasta assets, uma URL HTTPS ou selecione um arquivo válido.");
        }

        const readingMinutes = Number.parseInt(getFieldValue("articleReadingMinutes"), 10);
        const visible = getField("articleVisible");
        const popular = getField("articlePopular");
        const article = {
            ...previous,
            title,
            slug,
            category: getFieldValue("articleCategory"),
            author: getFieldValue("articleAuthor") || "Equipe Brutusmaq",
            excerpt: getFieldValue("articleExcerpt"),
            accentFrom: getFieldValue("articleAccentFrom"),
            datetime: getFieldValue("articleDatetime") || localDate(),
            reading: Number.isFinite(readingMinutes) && readingMinutes > 0
                ? `${readingMinutes} min de leitura`
                : "",
            image: imageData || imagePath || previous.image || fallbackImage,
            imageAlt: getFieldValue("articleImageAlt"),
            popular: popular ? popular.checked : false,
            intro: splitParagraphs(getFieldValue("articleIntro")),
            sections: collectSections(),
            benefits: parseCards(getFieldValue("articleBenefits")),
            applications: parseCards(getFieldValue("articleApplications")),
            checks: splitLines(getFieldValue("articleChecks")),
            highlight: getFieldValue("articleHighlight"),
            _admin: {
                ...(previous._admin || {}),
                uid: editingUid || undefined,
                status,
                submissionId: editorialMeta.submissionId || previous._admin?.submissionId || undefined,
                version: Number.isInteger(editorialMeta.version) ? editorialMeta.version : previous._admin?.version,
                visible: visible ? visible.checked : true,
                updatedAt: new Date().toISOString()
            }
        };
        delete article.cardClass;
        validateForStatus(article, status);
        return article;
    }

    function setArticleSaving(saving) {
        form?.querySelectorAll('button[type="submit"]').forEach((button) => { button.disabled = saving; });
        document.querySelectorAll('[type="submit"][form="adminArticleForm"]').forEach((button) => { button.disabled = saving; });
        document.querySelectorAll("[data-save-article-draft]").forEach((button) => { button.disabled = saving; });
    }

    async function uploadArticleImage(article) {
        const file = imageInput?.files?.[0];
        if (!file || !api?.isDatabase?.()) return article;
        const result = await api.uploadMedia(file, article.imageAlt || article.title);
        article.image = result.asset.publicUrl;
        return article;
    }

    async function saveArticle(statusOverride) {
        if (!form || !store || !ui) return;
        if (isViewer()) {
            showMessage("Sua conta possui acesso somente para leitura.", "error");
            return;
        }
        const intendedStatus = statusOverride || getFieldValue("articleStatus") || "draft";
        if (intendedStatus !== "draft" && !form.checkValidity()) {
            form.reportValidity();
            return;
        }

        setArticleSaving(true);
        try {
            const article = await uploadArticleImage(buildArticle(statusOverride));
            let saved;
            let submission = null;
            if (api?.isDatabase?.()) {
                const result = await api.saveArticle(article, editingUid || undefined);
                submission = result.submission || result.review || null;
                if (result.article) {
                    saved = store.upsert(result.article, editingUid || undefined);
                } else if (submission) {
                    dirty = false;
                    editingUid = "";
                    renderAll();
                    ui.showView("articles");
                    ui.showToast(`${article.title} foi enviado para análise do proprietário.`);
                    window.dispatchEvent(new CustomEvent("brutusmaq:review-submitted", { detail: submission }));
                    return;
                } else {
                    throw new Error("O servidor não retornou o artigo nem a solicitação de análise.");
                }
            } else {
                saved = store.upsert(article, editingUid || undefined);
            }
            editingUid = saved._admin.uid;
            dirty = false;
            renderAll();
            ui.showView("articles");
            if (submission?.status === "pending") {
                ui.showToast(`${saved.title} foi enviado para análise do proprietário.`);
                window.dispatchEvent(new CustomEvent("brutusmaq:review-submitted", { detail: submission }));
                return;
            }
            const status = articleStatus(saved);
            ui.showToast(`${saved.title} foi salvo como ${status.label.toLowerCase()}.`);
        } catch (error) {
            showMessage(error instanceof Error ? error.message : "Não foi possível salvar o artigo.", "error");
        } finally {
            setArticleSaving(false);
        }
    }

    function validateStoredArticleForPublication(article) {
        validateForStatus(article, "published");
        if (!article.image) throw new Error("Adicione uma imagem antes de publicar o artigo.");
    }

    async function togglePublication(uid) {
        if (!isOwner()) return;
        const current = findArticle(uid);
        if (!current || !store || !ui) return;
        const next = clone(current);
        const publishing = current._admin.status !== "published";
        next._admin.status = publishing ? "published" : "draft";
        if (publishing) next._admin.visible = true;

        try {
            if (publishing) validateStoredArticleForPublication(next);
            if (api?.isDatabase?.()) {
                const result = await api.saveArticle(next, uid);
                store.upsert(result.article, uid);
            } else {
                store.upsert(next, uid);
            }
            renderAll();
            ui.showToast(publishing
                ? `${current.title} foi publicado no blog.`
                : `${current.title} voltou para rascunho.`);
        } catch (error) {
            ui.showToast(error instanceof Error ? error.message : "Não foi possível alterar a publicação.");
        }
    }

    function uniqueCopySlug(slug) {
        const base = `${slug || "artigo"}-copia`;
        let candidate = base;
        let index = 2;
        const existing = new Set(articles.map((article) => article.slug));
        while (existing.has(candidate)) {
            candidate = `${base}-${index}`;
            index += 1;
        }
        return candidate;
    }

    async function duplicateArticle(uid) {
        if (!isOwner()) return;
        const current = findArticle(uid);
        if (!current || !store || !ui) return;
        try {
            const copy = clone(current);
            copy.title = `${current.title} (cópia)`;
            copy.slug = uniqueCopySlug(current.slug);
            copy.popular = false;
            copy._admin = { status: "draft", visible: true, updatedAt: new Date().toISOString() };
            const saved = api?.isDatabase?.()
                ? store.upsert((await api.saveArticle(copy)).article)
                : store.upsert(copy);
            renderAll();
            editArticle(saved._admin.uid);
            ui.showToast("Uma cópia em rascunho foi criada.");
        } catch (error) {
            ui.showToast(error instanceof Error ? error.message : "Não foi possível duplicar o artigo.");
        }
    }

    function deleteArticle(uid) {
        if (!isOwner()) return;
        const article = findArticle(uid);
        if (!article || !store || !ui) return;
        ui.openConfirmation(
            `Excluir ${article.title}?`,
            api?.isDatabase?.()
                ? "O artigo será removido do blog publicado. Você poderá desfazer logo após a exclusão."
                : "O artigo será removido deste navegador. Você poderá desfazer logo após a exclusão.",
            "Excluir artigo",
            async () => {
                try {
                    if (api?.isDatabase?.()) await api.deleteArticle(uid);
                    lastRemoved = store.remove(uid);
                    if (editingUid === uid) prepareNewArticle();
                    renderAll();
                    ui.showToast(`${article.title} foi excluído.`, "Desfazer", async () => {
                        try {
                            if (api?.isDatabase?.()) await api.restoreArticle(uid);
                            store.restore(lastRemoved);
                            lastRemoved = null;
                            renderAll();
                            ui.showToast(`${article.title} foi restaurado.`);
                        } catch (error) {
                            ui.showToast(error instanceof Error ? error.message : "Não foi possível restaurar o artigo.");
                        }
                    });
                } catch (error) {
                    ui.showToast(error instanceof Error ? error.message : "Não foi possível excluir o artigo.");
                }
            }
        );
    }

    function cancelArticleSubmission(submissionId, title) {
        if (!isEditor() || !submissionId || !api?.isDatabase?.() || !ui) return;
        ui.openConfirmation(
            `Descartar a proposta de ${title || "artigo"}?`,
            "Ela sairá da caixa de análise. Depois você poderá abrir a versão atual do site e preparar um novo envio.",
            "Descartar proposta",
            async () => {
                try {
                    await api.cancelSubmission(submissionId);
                    await api.bootstrap();
                    renderAll();
                    ui.showToast("A proposta foi descartada. A versão publicada não foi alterada.");
                } catch (error) {
                    ui.showToast(error instanceof Error ? error.message : "Não foi possível descartar a proposta.");
                }
            }
        );
    }

    function exportArticles() {
        if (!store) return;
        const data = JSON.stringify(store.exportArticles(), null, 2);
        const blob = new Blob([data], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `brutusmaq-artigos-${localDate()}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        if (ui) ui.showToast("Backup dos artigos exportado.");
    }

    function importArticles(file) {
        if (!isOwner()) return;
        if (!file || !store || !ui) return;
        if (file.size > 5000000) {
            ui.showToast("O backup ultrapassa o limite de 5 MB.");
            if (importInput) importInput.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result || ""));
                ui.openConfirmation(
                    "Importar backup de artigos?",
                    "Os artigos atuais serão substituídos pelo conteúdo validado do arquivo.",
                    "Importar artigos",
                    async () => {
                        const previousArticles = store.getArticles();
                        try {
                            if (api?.isDatabase?.()) {
                                const normalized = store.replaceArticles(parsed);
                                const result = await api.replaceArticles(normalized);
                                store.setRemoteArticles(result.articles);
                            } else {
                                store.replaceArticles(parsed);
                            }
                            prepareNewArticle();
                            renderAll();
                            ui.showView("articles");
                            ui.showToast("Backup de artigos importado com sucesso.");
                        } catch (error) {
                            if (api?.isDatabase?.()) store.setRemoteArticles(previousArticles);
                            ui.showToast(error instanceof Error ? error.message : "Não foi possível importar os artigos.");
                        }
                    }
                );
            } catch (error) {
                ui.showToast("O arquivo selecionado não contém um backup JSON válido.");
            } finally {
                if (importInput) importInput.value = "";
            }
        };
        reader.onerror = () => {
            ui.showToast("Não foi possível ler o arquivo selecionado.");
            if (importInput) importInput.value = "";
        };
        reader.readAsText(file, "utf-8");
    }

    function resetArticles() {
        if (!isOwner()) return;
        if (!store || !ui) return;
        ui.openConfirmation(
            "Restaurar artigos-base?",
            "Artigos criados ou alterados serão substituídos pelos artigos-base. Exporte um backup antes de continuar.",
            "Restaurar artigos",
            async () => {
                try {
                    if (api?.isDatabase?.()) {
                        const result = await api.replaceArticles(store.getBaseArticles());
                        store.setRemoteArticles(result.articles);
                    } else {
                        store.reset();
                    }
                    prepareNewArticle();
                    renderAll();
                    ui.showView("articles");
                    ui.showToast("Os artigos-base foram restaurados.");
                } catch (error) {
                    ui.showToast(error instanceof Error ? error.message : "Não foi possível restaurar os artigos-base.");
                }
            }
        );
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error(`Não foi possível ler ${file.name}.`));
            reader.readAsDataURL(file);
        });
    }

    async function selectImage(file) {
        if (!file || !ui) return;
        try {
            if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
                throw new Error("A imagem precisa estar em PNG, JPG ou WebP.");
            }
            if (file.size > maxImageBytes) throw new Error("A imagem ultrapassa o limite de 1 MB.");
            imageData = await readFileAsDataUrl(file);
            if (imagePreview) imagePreview.src = imageData;
            setFieldValue("articleImagePath", "");
            dirty = true;
            ui.showToast("Imagem de capa carregada.");
        } catch (error) {
            if (imageInput) imageInput.value = "";
            ui.showToast(error instanceof Error ? error.message : "Não foi possível carregar a imagem.");
        }
    }

    function ownsView(viewName) {
        return viewName === "articles" || viewName === "new-article";
    }

    function navigate(viewName) {
        if (!ownsView(viewName) || !ui) return;
        if (viewName === "new-article") {
            if (!confirmDiscardChanges()) return;
            prepareNewArticle();
            ui.showView("new-article");
            return;
        }
        if (!confirmDiscardChanges()) return;
        dirty = false;
        renderAll();
        ui.showView("articles");
    }

    function canLeave() {
        if (!ui || ui.getCurrentView() !== "new-article") return true;
        if (!confirmDiscardChanges()) return false;
        dirty = false;
        return true;
    }

    window.BrutusmaqAdminBlog = Object.freeze({
        ownsView,
        navigate,
        canLeave,
        isDirty: () => dirty,
        editArticle
    });

    if (!store || !ui) {
        if (ui) ui.showToast("A camada de dados dos artigos não foi carregada. Atualize a página.");
        return;
    }

    [articleSearch, categoryFilter, statusFilter].forEach((control) => {
        if (!control) return;
        control.addEventListener(control.tagName === "INPUT" ? "input" : "change", renderRows);
    });

    if (clearFiltersButton) {
        clearFiltersButton.addEventListener("click", () => {
            if (articleSearch) articleSearch.value = "";
            if (categoryFilter) categoryFilter.value = "all";
            if (statusFilter) statusFilter.value = "all";
            renderRows();
            if (articleSearch) articleSearch.focus();
        });
    }

    if (rowsContainer) {
        rowsContainer.addEventListener("click", (event) => {
            const editButton = event.target.closest("[data-edit-article]");
            const toggleButton = event.target.closest("[data-toggle-article]");
            const duplicateButton = event.target.closest("[data-duplicate-article]");
            const deleteButton = event.target.closest("[data-delete-article]");
            const cancelButton = event.target.closest("[data-cancel-article-submission]");
            if (editButton) editArticle(editButton.dataset.editArticle);
            else if (toggleButton) togglePublication(toggleButton.dataset.toggleArticle);
            else if (duplicateButton) duplicateArticle(duplicateButton.dataset.duplicateArticle);
            else if (deleteButton) deleteArticle(deleteButton.dataset.deleteArticle);
            else if (cancelButton) cancelArticleSubmission(cancelButton.dataset.cancelArticleSubmission, cancelButton.dataset.submissionTitle);
        });
    }

    if (form) {
        form.addEventListener("input", () => { dirty = true; });
        form.addEventListener("change", () => { dirty = true; });
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            saveArticle(isEditor() ? "review" : undefined);
        });
    }

    const titleInput = getField("articleTitle");
    const slugInput = getField("articleSlug");
    const imagePathInput = getField("articleImagePath");
    if (slugInput) {
        slugInput.addEventListener("input", () => {
            slugEdited = slugInput.value.trim().length > 0;
        });
    }
    if (titleInput && slugInput) {
        titleInput.addEventListener("input", () => {
            if (!slugEdited) slugInput.value = createSlug(titleInput.value);
        });
    }
    if (imagePathInput) {
        imagePathInput.addEventListener("input", () => {
            imageData = "";
            if (validateImagePath(imagePathInput.value) && imagePathInput.value.trim() && imagePreview) {
                imagePreview.src = imagePathInput.value.trim();
            }
        });
    }
    if (imagePreview) {
        imagePreview.addEventListener("error", () => {
            if (imagePreview.src.endsWith(fallbackImage)) return;
            imagePreview.src = fallbackImage;
        });
    }
    if (imageInput) {
        imageInput.addEventListener("change", () => selectImage(imageInput.files && imageInput.files[0]));
    }
    if (addSectionButton) {
        addSectionButton.addEventListener("click", () => {
            addSection({});
            dirty = true;
            const rows = sectionList ? sectionList.querySelectorAll(".admin-article-section-row") : [];
            const last = rows.length ? rows[rows.length - 1] : null;
            const input = last && last.querySelector("[data-article-section-title]");
            if (input) input.focus();
        });
    }
    if (sectionList) {
        sectionList.addEventListener("click", (event) => {
            const removeButton = event.target.closest("[data-remove-article-section]");
            if (!removeButton || removeButton.disabled) return;
            removeButton.closest(".admin-article-section-row")?.remove();
            updateSectionLabels();
            dirty = true;
        });
    }

    document.querySelectorAll("[data-save-article-draft]").forEach((button) => {
        button.addEventListener("click", () => saveArticle("draft"));
    });
    if (exportButton) exportButton.addEventListener("click", exportArticles);
    if (importInput) importInput.addEventListener("change", () => importArticles(importInput.files && importInput.files[0]));
    if (resetButton) resetButton.addEventListener("click", resetArticles);
    window.addEventListener("brutusmaq:blog-changed", renderAll);
    window.addEventListener("brutusmaq:admin-ready", (event) => applyArticleAccess(event.detail));

    prepareNewArticle();
    renderAll();
    api?.ready?.then?.(() => applyArticleAccess()).catch?.(() => applyArticleAccess());
    const storeError = store.getLastError();
    if (storeError) ui.showToast(`Os artigos salvos não puderam ser carregados: ${storeError}`);
}());
