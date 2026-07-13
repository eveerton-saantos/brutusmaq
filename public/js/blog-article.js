(function () {
    const articles = Array.isArray(window.BRUTUS_BLOG_ARTICLES) ? window.BRUTUS_BLOG_ARTICLES : [];

    function getArticleSlug() {
        const params = new URLSearchParams(window.location.search);
        return params.get("artigo") || "";
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function splitTitle(article) {
        const title = escapeHtml(article.title);
        const accentFrom = article.accentFrom || "";

        if (!accentFrom || !article.title.includes(accentFrom)) {
            return title;
        }

        return title.replace(
            escapeHtml(accentFrom),
            `<span class="article-title-accent">${escapeHtml(accentFrom)}</span>`
        );
    }

    function articleUrl(article) {
        return `artigo-blog.html?artigo=${encodeURIComponent(article.slug)}`;
    }

    function renderParagraphs(paragraphs) {
        return (paragraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
    }

    function renderCards(items, className) {
        return (items || []).map((item) => {
            if (className === "article-check-card") {
                return `<div class="${className}"><span>✓</span><p>${escapeHtml(item)}</p></div>`;
            }

            return `
                <div class="${className}">
                    <span aria-hidden="true">${escapeHtml(item[0])}</span>
                    <h3>${escapeHtml(item[1])}</h3>
                    <p>${escapeHtml(item[2])}</p>
                </div>
            `;
        }).join("");
    }

    function renderSections(article) {
        const sections = document.getElementById("article-sections");
        if (!sections) return;

        const bodySections = (article.sections || []).map((section) => `
            <section>
                <h2>${escapeHtml(section.title)}</h2>
                ${renderParagraphs(section.paragraphs)}
            </section>
        `);

        if (article.benefits && article.benefits.length) {
            bodySections.push(`
                <section>
                    <h2><span>+</span> Benefícios principais</h2>
                    <div class="article-benefit-grid">${renderCards(article.benefits, "article-benefit-card")}</div>
                </section>
            `);
        }

        if (article.applications && article.applications.length) {
            bodySections.push(`
                <section>
                    <h2><span>+</span> Aplicações</h2>
                    <div class="article-application-grid">${renderCards(article.applications, "article-application-card")}</div>
                </section>
            `);
        }

        if (article.checks && article.checks.length) {
            bodySections.push(`
                <section>
                    <h2><span>+</span> Pontos importantes</h2>
                    <div class="article-check-grid">${renderCards(article.checks, "article-check-card")}</div>
                </section>
            `);
        }

        sections.innerHTML = bodySections.join("");
    }

    function renderRelated(currentArticle) {
        const relatedList = document.getElementById("related-list");
        if (!relatedList) return;

        const related = articles
            .filter((article) => article.slug !== currentArticle.slug)
            .slice(0, 4);

        relatedList.className = "article-related-list";

        if (!related.length) {
            relatedList.innerHTML = `<p class="article-sidebar-empty">Sem artigos relacionados.</p>`;
            return;
        }

        relatedList.innerHTML = related.map((article) => `
            <a class="article-related-item" href="${articleUrl(article)}">
                <figure><img src="${article.image || "assets/main/tr-700.png"}" alt="${escapeHtml(article.imageAlt || "")}"></figure>
                <div>
                    <h3>${escapeHtml(article.title)}</h3>
                    <span>${escapeHtml(article.date || "")}</span>
                    <span>${escapeHtml(article.reading || "")}</span>
                </div>
            </a>
        `).join("");
    }

    function updateArticleMeta(article) {
        document.title = `${article.title} | Blog Brutusmaq`;

        const description = document.querySelector('meta[name="description"]');
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogDescription = document.querySelector('meta[property="og:description"]');
        const ogImage = document.querySelector('meta[property="og:image"]');

        if (description) description.setAttribute("content", article.excerpt || article.title);
        if (ogTitle) ogTitle.setAttribute("content", `${article.title} | Blog Brutusmaq`);
        if (ogDescription) ogDescription.setAttribute("content", article.excerpt || article.title);
        if (ogImage && article.image) ogImage.setAttribute("content", article.image);
    }

    function renderNotFound() {
        const fallback = {
            title: "Artigo não encontrado",
            category: "Blog",
            excerpt: "Volte para o Blog e escolha um artigo publicado.",
            date: "",
            reading: "",
            author: "Brutusmaq",
            intro: ["Este artigo ainda não foi cadastrado ou o link informado está incorreto."],
            sections: [],
            slug: ""
        };

        renderArticle(fallback);
    }

    function renderArticle(article) {
        updateArticleMeta(article);

        document.getElementById("breadcrumb-current").textContent = article.title;
        document.getElementById("article-category").textContent = article.category || "Artigo";
        document.getElementById("article-title").innerHTML = splitTitle(article);
        document.getElementById("article-excerpt").textContent = article.excerpt || "";
        document.getElementById("article-date").textContent = article.date || "";
        document.getElementById("article-reading").textContent = article.reading || "";
        document.getElementById("article-author").textContent = article.author || "Equipe Brutusmaq";
        document.getElementById("article-intro").innerHTML = renderParagraphs(article.intro || []);

        renderSections(article);
        renderRelated(article);

        const highlight = document.getElementById("article-highlight");
        if (highlight && article.highlight) {
            highlight.textContent = article.highlight;
            highlight.hidden = false;
        } else if (highlight) {
            highlight.hidden = true;
        }
    }

    function setupCopyLink() {
        const copyButton = document.getElementById("copy-link");
        if (!copyButton) return;

        copyButton.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(window.location.href);
                copyButton.textContent = "✓";
                setTimeout(() => {
                    copyButton.textContent = "⌁";
                }, 1400);
            } catch (error) {
                copyButton.textContent = "!";
                setTimeout(() => {
                    copyButton.textContent = "⌁";
                }, 1400);
            }
        });
    }

    const slug = getArticleSlug();
    const article = articles.find((item) => item.slug === slug);

    if (article) {
        renderArticle(article);
    } else {
        renderNotFound();
    }

    setupCopyLink();
})();
