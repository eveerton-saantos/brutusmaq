(function () {
    const articles = Array.isArray(window.BRUTUS_BLOG_ARTICLES) ? window.BRUTUS_BLOG_ARTICLES : [];
    const grid = document.getElementById("blog-article-grid");
    const emptyState = document.getElementById("blog-empty-state");
    const categoryList = document.getElementById("blog-category-list");
    const popularList = document.getElementById("blog-popular-list");
    const searchForm = document.querySelector(".blog-search");
    const searchInput = document.getElementById("blog-search-input");

    function normalizeText(value) {
        return String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    function articleUrl(article) {
        return `artigo-blog.html?artigo=${encodeURIComponent(article.slug)}`;
    }

    function renderCards(list) {
        if (!grid || !emptyState) return;

        if (!list.length) {
            grid.innerHTML = "";
            emptyState.hidden = false;
            return;
        }

        emptyState.hidden = true;
        grid.innerHTML = list.map((article) => `
            <article class="blog-article-card">
                <a href="${articleUrl(article)}" aria-label="Ler artigo ${article.title}">
                    <figure class="blog-card-media ${article.cardClass || "blog-media-machine"}">
                        <span>${article.category || "Artigo"}</span>
                        <img src="${article.image || "assets/main/tr-700.png"}" alt="${article.imageAlt || ""}">
                    </figure>
                    <div class="blog-card-body">
                        <time datetime="${article.datetime || ""}">${article.date || ""}</time>
                        <h3>${article.title}</h3>
                        <p>${article.excerpt || ""}</p>
                        <strong>Leia mais →</strong>
                    </div>
                </a>
            </article>
        `).join("");
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

        categoryList.innerHTML = categories.map(([category, count]) => `
            <a class="blog-sidebar-link" href="#artigos" data-blog-category="${category}">
                ${category} <span>${String(count).padStart(2, "0")}</span>
            </a>
        `).join("");

        categoryList.querySelectorAll("[data-blog-category]").forEach((link) => {
            link.addEventListener("click", (event) => {
                event.preventDefault();
                const category = link.getAttribute("data-blog-category");
                renderCards(articles.filter((article) => article.category === category));
            });
        });
    }

    function renderPopular() {
        if (!popularList) return;

        const popularArticles = articles.filter((article) => article.popular).slice(0, 5);
        const list = popularArticles.length ? popularArticles : articles.slice(0, 5);

        if (!list.length) {
            popularList.innerHTML = `<p class="blog-sidebar-empty">Sem artigos cadastrados.</p>`;
            return;
        }

        popularList.innerHTML = list.map((article, index) => `
            <a class="blog-popular-link" href="${articleUrl(article)}">
                <span>${String(index + 1).padStart(2, "0")}</span>
                ${article.title}
            </a>
        `).join("");
    }

    function setupSearch() {
        if (!searchForm || !searchInput) return;

        searchForm.addEventListener("submit", (event) => {
            event.preventDefault();
            const query = normalizeText(searchInput.value);

            if (!query) {
                renderCards(articles);
                return;
            }

            renderCards(articles.filter((article) => {
                const content = normalizeText([
                    article.title,
                    article.excerpt,
                    article.category,
                    article.author
                ].join(" "));

                return content.includes(query);
            }));
        });
    }

    renderCards(articles);
    renderCategories();
    renderPopular();
    setupSearch();
})();
