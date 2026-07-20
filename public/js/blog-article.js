(async function () {
    "use strict";

    await Promise.resolve(window.BrutusmaqBlogReady);

    const articles = Array.isArray(window.BRUTUS_BLOG_ARTICLES) ? window.BRUTUS_BLOG_ARTICLES : [];
    const fallbackImage = "assets/main/tr-700.webp";
    const productionOrigin = "https://www.brutusmaq.com.br";
    let tocObserver = null;
    let shareFeedbackTimer = 0;

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

    function normalizeText(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    function createAnchorId(value, index) {
        const slug = normalizeText(value)
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        return `topico-${slug || "secao"}-${index + 1}`;
    }

    function splitTitle(article) {
        const title = escapeHtml(article.title);
        const accentFrom = article.accentFrom || "";

        if (!accentFrom || !article.title.includes(accentFrom)) return title;
        return title.replace(
            escapeHtml(accentFrom),
            `<span class="article-title-accent">${escapeHtml(accentFrom)}</span>`
        );
    }

    function articleUrl(article) {
        return `artigo-blog.html?artigo=${encodeURIComponent(article.slug)}`;
    }

    function productionArticleUrl(article) {
        return `${productionOrigin}/${articleUrl(article)}`;
    }

    function absoluteImageUrl(image) {
        const value = String(image || "").trim();
        if (/^https:\/\//i.test(value)) return value;
        if (/^data:image\//i.test(value)) return "";
        return `${productionOrigin}/${value.replace(/^\.\//, "").replace(/^\//, "")}`;
    }

    function renderParagraphs(paragraphs) {
        return (paragraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
    }

    function renderCards(items, className) {
        return (items || []).map((item) => {
            if (className === "article-check-card") {
                return `<div class="${className}"><span aria-hidden="true">✓</span><p>${escapeHtml(item)}</p></div>`;
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

    function renderToc() {
        const toc = document.getElementById("article-toc");
        const sections = Array.from(document.querySelectorAll("#article-sections > section"));
        if (!toc) return;

        if (!sections.length) {
            toc.closest(".article-toc").hidden = true;
            return;
        }

        toc.closest(".article-toc").hidden = false;
        toc.innerHTML = sections.map((section, index) => {
            const heading = section.querySelector("h2");
            return `<li><a href="#${escapeHtml(section.id)}"><span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(heading ? heading.textContent : `Tópico ${index + 1}`)}</a></li>`;
        }).join("");

        if (tocObserver) tocObserver.disconnect();
        if (!("IntersectionObserver" in window)) return;

        const links = Array.from(toc.querySelectorAll("a"));
        tocObserver = new IntersectionObserver((entries) => {
            const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top)[0];
            if (!visible) return;
            links.forEach((link) => {
                link.classList.toggle("is-current", link.getAttribute("href") === `#${visible.target.id}`);
            });
        }, { rootMargin: "-18% 0px -68%", threshold: [0.05, 0.25] });
        sections.forEach((section) => tocObserver.observe(section));
    }

    function renderSections(article) {
        const sections = document.getElementById("article-sections");
        if (!sections) return;

        const bodySections = (article.sections || []).map((section, index) => `
            <section id="${createAnchorId(section.title, index)}">
                <h2>${escapeHtml(section.title)}</h2>
                ${renderParagraphs(section.paragraphs)}
            </section>
        `);

        if (article.benefits && article.benefits.length) {
            bodySections.push(`
                <section id="topico-beneficios">
                    <h2><span>+</span> Benefícios principais</h2>
                    <div class="article-benefit-grid">${renderCards(article.benefits, "article-benefit-card")}</div>
                </section>
            `);
        }

        if (article.applications && article.applications.length) {
            bodySections.push(`
                <section id="topico-aplicacoes">
                    <h2><span>+</span> Aplicações</h2>
                    <div class="article-application-grid">${renderCards(article.applications, "article-application-card")}</div>
                </section>
            `);
        }

        if (article.checks && article.checks.length) {
            bodySections.push(`
                <section id="topico-pontos-importantes">
                    <h2><span>+</span> Pontos importantes</h2>
                    <div class="article-check-grid">${renderCards(article.checks, "article-check-card")}</div>
                </section>
            `);
        }

        sections.innerHTML = bodySections.join("");
        renderToc();
    }

    function relatedArticles(currentArticle) {
        const sameCategory = articles.filter((article) => (
            article.slug !== currentArticle.slug && article.category === currentArticle.category
        ));
        const otherCategories = articles.filter((article) => (
            article.slug !== currentArticle.slug && article.category !== currentArticle.category
        ));
        return [...sameCategory, ...otherCategories].slice(0, 3);
    }

    function renderRelated(currentArticle) {
        const relatedList = document.getElementById("related-list");
        if (!relatedList) return;
        const related = relatedArticles(currentArticle);

        if (!related.length) {
            relatedList.innerHTML = `<p class="article-sidebar-empty">Sem artigos relacionados no momento.</p>`;
            return;
        }

        relatedList.innerHTML = related.map((article) => `
            <a class="article-related-item" href="${articleUrl(article)}">
                <figure class="${escapeHtml(article.cardClass || "blog-media-machine")}">
                    <img src="${escapeHtml(article.image || fallbackImage)}" alt="${escapeHtml(article.imageAlt || "")}">
                </figure>
                <div>
                    <span class="article-related-category">${escapeHtml(article.category || "Conteúdo técnico")}</span>
                    <h3>${escapeHtml(article.title)}</h3>
                    <div class="article-related-meta"><span>${escapeHtml(article.date || "")}</span><span>${escapeHtml(article.reading || "")}</span></div>
                </div>
            </a>
        `).join("");
    }

    function setNavigationLink(linkId, titleId, article) {
        const link = document.getElementById(linkId);
        const title = document.getElementById(titleId);
        if (!link || !title) return;
        if (!article) {
            link.hidden = true;
            return;
        }
        link.href = articleUrl(article);
        title.textContent = article.title;
        link.hidden = false;
    }

    function renderArticleNavigation(currentArticle) {
        const index = articles.findIndex((article) => article.slug === currentArticle.slug);
        setNavigationLink("article-previous", "article-previous-title", index >= 0 ? articles[index + 1] : null);
        setNavigationLink("article-next", "article-next-title", index > 0 ? articles[index - 1] : null);

        const navigation = document.querySelector(".article-navigation-section");
        const hasPrevious = !document.getElementById("article-previous")?.hidden;
        const hasNext = !document.getElementById("article-next")?.hidden;
        if (navigation) navigation.hidden = !hasPrevious && !hasNext;
    }

    function updateArticleMeta(article) {
        const title = `${article.title} | Blog Brutusmaq`;
        const descriptionValue = article.excerpt || article.title;
        const articlePageUrl = productionArticleUrl(article);
        const imageUrl = absoluteImageUrl(article.image);
        document.title = title;

        const selectors = {
            'meta[name="description"]': descriptionValue,
            'meta[property="og:title"]': title,
            'meta[property="og:description"]': descriptionValue,
            'meta[property="og:url"]': articlePageUrl,
            'meta[name="twitter:title"]': title,
            'meta[name="twitter:description"]': descriptionValue
        };
        Object.entries(selectors).forEach(([selector, value]) => {
            const element = document.querySelector(selector);
            if (element) element.setAttribute("content", value);
        });

        if (imageUrl) {
            ['meta[property="og:image"]', 'meta[name="twitter:image"]'].forEach((selector) => {
                const element = document.querySelector(selector);
                if (element) element.setAttribute("content", imageUrl);
            });
        }

        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) canonical.href = articlePageUrl;

        const jsonLd = document.getElementById("article-json-ld");
        if (jsonLd) {
            jsonLd.textContent = JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: article.title,
                description: descriptionValue,
                image: imageUrl || undefined,
                datePublished: article.datetime || undefined,
                dateModified: article._admin && article._admin.updatedAt ? article._admin.updatedAt : article.datetime || undefined,
                author: { "@type": "Organization", name: article.author || "Equipe Brutusmaq" },
                publisher: {
                    "@type": "Organization",
                    name: "Brutusmaq",
                    logo: { "@type": "ImageObject", url: `${productionOrigin}/assets/logo/logo-brutusmaq.svg` }
                },
                mainEntityOfPage: articlePageUrl
            });
        }
    }

    function setMetaField(id, value) {
        const field = document.getElementById(id);
        if (!field) return;
        field.textContent = value || "";
        const container = field.closest("div");
        if (container && container.parentElement?.classList.contains("article-meta")) container.hidden = !value;
    }

    function setupShare(article) {
        const pageUrl = window.location.href;
        const shareText = `${article.title} | Blog Brutusmaq`;
        const whatsapp = document.getElementById("share-whatsapp");
        const linkedin = document.getElementById("share-linkedin");
        const email = document.getElementById("share-email");
        const help = document.querySelector(".article-help > a");

        if (whatsapp) whatsapp.href = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${pageUrl}`)}`;
        if (linkedin) linkedin.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`;
        if (email) email.href = `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(`${article.excerpt || ""}\n\n${pageUrl}`)}`;
        if (help) {
            help.href = `https://wa.me/5541988754003?text=${encodeURIComponent(`Olá, li o artigo "${article.title}" e gostaria de conversar sobre uma aplicação. ${pageUrl}`)}`;
        }
    }

    function showShareFeedback(message) {
        const feedback = document.getElementById("article-share-feedback");
        if (!feedback) return;
        window.clearTimeout(shareFeedbackTimer);
        feedback.textContent = message;
        feedback.hidden = false;
        shareFeedbackTimer = window.setTimeout(() => { feedback.hidden = true; }, 1800);
    }

    async function copyArticleLink() {
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                await navigator.clipboard.writeText(window.location.href);
            } else {
                const input = document.createElement("textarea");
                input.value = window.location.href;
                input.setAttribute("readonly", "");
                input.style.position = "fixed";
                input.style.opacity = "0";
                document.body.appendChild(input);
                input.select();
                document.execCommand("copy");
                input.remove();
            }
            showShareFeedback("Link copiado.");
        } catch (error) {
            showShareFeedback("Não foi possível copiar o link.");
        }
    }

    function setupActions() {
        document.getElementById("copy-link")?.addEventListener("click", copyArticleLink);
        document.getElementById("print-article")?.addEventListener("click", () => window.print());
    }

    function setupReadingProgress() {
        const progress = document.getElementById("article-reading-progress");
        const readingSection = document.getElementById("article-content-start");
        if (!progress || !readingSection) return;
        let ticking = false;

        function update() {
            const start = readingSection.offsetTop;
            const end = Math.max(start + 1, document.documentElement.scrollHeight - window.innerHeight);
            const ratio = Math.max(0, Math.min(1, (window.scrollY - start) / (end - start)));
            progress.style.width = `${ratio * 100}%`;
            ticking = false;
        }

        function requestUpdate() {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(update);
        }

        window.addEventListener("scroll", requestUpdate, { passive: true });
        window.addEventListener("resize", requestUpdate);
        update();
    }

    function renderArticle(article) {
        updateArticleMeta(article);

        document.getElementById("breadcrumb-current").textContent = article.title;
        document.getElementById("article-category").textContent = article.category || "Conteúdo técnico";
        document.getElementById("article-title").innerHTML = splitTitle(article);
        document.getElementById("article-excerpt").textContent = article.excerpt || "";
        setMetaField("article-date", article.date || "");
        setMetaField("article-reading", article.reading || "");
        setMetaField("article-author", article.author || "Equipe Brutusmaq");
        document.getElementById("article-intro").innerHTML = renderParagraphs(article.intro || []);

        const cover = document.getElementById("article-cover");
        const heroMedia = document.getElementById("article-hero-media");
        if (cover) {
            cover.src = article.image || fallbackImage;
            cover.alt = article.imageAlt || article.title;
            cover.addEventListener("error", () => {
                if (!cover.src.endsWith(fallbackImage)) cover.src = fallbackImage;
            }, { once: true });
        }
        if (heroMedia) {
            const mediaClass = /^blog-media-[a-z-]+$/.test(article.cardClass || "")
                ? article.cardClass
                : "blog-media-machine";
            heroMedia.className = `article-hero-media ${mediaClass}`;
        }

        renderSections(article);
        renderRelated(article);
        renderArticleNavigation(article);
        setupShare(article);

        const highlight = document.getElementById("article-highlight");
        if (highlight && article.highlight) {
            highlight.textContent = article.highlight;
            highlight.hidden = false;
        } else if (highlight) {
            highlight.hidden = true;
        }

        document.documentElement.dataset.articleReady = "true";
    }

    const slug = getArticleSlug();
    const article = articles.find((item) => item.slug === slug);

    if (!article) {
        window.location.replace("/404.html?origem=artigo");
        return;
    }

    renderArticle(article);
    setupActions();
    setupReadingProgress();
}());
