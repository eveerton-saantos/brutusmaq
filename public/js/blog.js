(function () {
    const articles = Array.isArray(window.BRUTUS_BLOG_ARTICLES) ? window.BRUTUS_BLOG_ARTICLES : [];
    const grid = document.getElementById("blog-article-grid");
    const emptyState = document.getElementById("blog-empty-state");
    const categoryList = document.getElementById("blog-category-list");
    const popularList = document.getElementById("blog-popular-list");
    const searchForm = document.querySelector(".blog-search");
    const searchInput = document.getElementById("blog-search-input");
    const resultsLabel = document.getElementById("blog-results-label");
    const clearFilters = document.getElementById("blog-clear-filters");

    let activeCategory = "";
    let activeQuery = "";

    function normalizeText(value) {
        return String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function articleUrl(article) {
        return `artigo-blog.html?artigo=${encodeURIComponent(article.slug)}`;
    }

    function updateResults(list) {
        if (resultsLabel) {
            if (activeQuery) {
                resultsLabel.textContent = `${list.length} resultado${list.length === 1 ? "" : "s"} para “${activeQuery}”`;
            } else if (activeCategory) {
                resultsLabel.textContent = `${activeCategory} · ${list.length} artigo${list.length === 1 ? "" : "s"}`;
            } else {
                resultsLabel.textContent = `${list.length} artigo${list.length === 1 ? "" : "s"} publicados`;
            }
        }

        if (clearFilters) {
            clearFilters.hidden = !activeCategory && !activeQuery;
        }
    }

    function renderCards(list) {
        if (!grid || !emptyState) return;

        updateResults(list);

        if (!list.length) {
            grid.innerHTML = "";
            emptyState.hidden = false;
            return;
        }

        emptyState.hidden = true;
        grid.innerHTML = list.map((article, index) => `
            <article class="blog-article-card${index === 0 ? " blog-article-featured" : ""}">
                <a href="${articleUrl(article)}" aria-label="Ler artigo ${escapeHtml(article.title)}">
                    <figure class="blog-card-media ${escapeHtml(article.cardClass || "blog-media-machine")}">
                        <span>${escapeHtml(article.category || "Artigo")}</span>
                        <img src="${escapeHtml(article.image || "assets/main/tr-700.png")}" alt="${escapeHtml(article.imageAlt || "")}">
                    </figure>
                    <div class="blog-card-body">
                        <div class="blog-card-meta">
                            <time datetime="${escapeHtml(article.datetime || "")}">${escapeHtml(article.date || "")}</time>
                            <span>${escapeHtml(article.reading || "")}</span>
                        </div>
                        <h3>${escapeHtml(article.title)}</h3>
                        <p>${escapeHtml(article.excerpt || "")}</p>
                        <strong>Leia o artigo <span aria-hidden="true">→</span></strong>
                    </div>
                </a>
            </article>
        `).join("");
    }

    function filteredArticles() {
        return articles.filter((article) => {
            const matchesCategory = !activeCategory || article.category === activeCategory;
            const content = normalizeText([
                article.title,
                article.excerpt,
                article.category,
                article.author
            ].join(" "));
            const matchesQuery = !activeQuery || content.includes(normalizeText(activeQuery));
            return matchesCategory && matchesQuery;
        });
    }

    function updateCategoryState() {
        if (!categoryList) return;

        categoryList.querySelectorAll("[data-blog-category]").forEach((link) => {
            const isActive = link.getAttribute("data-blog-category") === activeCategory;
            link.classList.toggle("is-active", isActive);
            link.setAttribute("aria-current", isActive ? "true" : "false");
        });
    }

    function applyFilters() {
        renderCards(filteredArticles());
        updateCategoryState();
    }

    function renderCategories() {
        if (!categoryList) return;

        const counts = articles.reduce((accumulator, article) => {
            const category = article.category || "Artigos";
            accumulator[category] = (accumulator[category] || 0) + 1;
            return accumulator;
        }, {});

        const categories = Object.entries(counts);

        if (!categories.length) {
            categoryList.innerHTML = `<p class="blog-sidebar-empty">Sem categorias cadastradas.</p>`;
            return;
        }

        categoryList.innerHTML = `
            <a class="blog-sidebar-link is-active" href="#artigos" data-blog-category="" aria-current="true">
                Todos os artigos <span>${String(articles.length).padStart(2, "0")}</span>
            </a>
            ${categories.map(([category, count]) => `
                <a class="blog-sidebar-link" href="#artigos" data-blog-category="${escapeHtml(category)}">
                    ${escapeHtml(category)} <span>${String(count).padStart(2, "0")}</span>
                </a>
            `).join("")}
        `;

        categoryList.querySelectorAll("[data-blog-category]").forEach((link) => {
            link.addEventListener("click", (event) => {
                event.preventDefault();
                activeCategory = link.getAttribute("data-blog-category") || "";
                applyFilters();
            });
        });
    }

    function renderPopular() {
        if (!popularList) return;

        const popularArticles = articles.filter((article) => article.popular).slice(0, 4);
        const list = popularArticles.length ? popularArticles : articles.slice(0, 4);

        if (!list.length) {
            popularList.innerHTML = `<p class="blog-sidebar-empty">Sem artigos cadastrados.</p>`;
            return;
        }

        popularList.innerHTML = list.map((article, index) => `
            <a class="blog-popular-link" href="${articleUrl(article)}">
                <span>${String(index + 1).padStart(2, "0")}</span>
                <strong>${escapeHtml(article.title)}</strong>
            </a>
        `).join("");
    }

    function setupSearch() {
        if (!searchForm || !searchInput) return;

        const initialQuery = new URLSearchParams(window.location.search).get("busca") || "";
        if (initialQuery) {
            searchInput.value = initialQuery;
            activeQuery = initialQuery.trim();
        }

        searchForm.addEventListener("submit", (event) => {
            event.preventDefault();
            activeQuery = searchInput.value.trim();
            applyFilters();
        });

        searchInput.addEventListener("input", () => {
            if (!searchInput.value && activeQuery) {
                activeQuery = "";
                applyFilters();
            }
        });
    }

    clearFilters?.addEventListener("click", () => {
        activeCategory = "";
        activeQuery = "";
        if (searchInput) searchInput.value = "";
        applyFilters();
    });

    renderCategories();
    renderPopular();
    setupSearch();
    applyFilters();
})();
