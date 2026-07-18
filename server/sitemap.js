"use strict";

function escapeXml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function absoluteUrl(baseUrl, pathname, params) {
    const url = new URL(pathname, `${String(baseUrl).replace(/\/+$/, "")}/`);
    Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, value));
    return url.href;
}

function lastModified(value) {
    const date = new Date(value || "");
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function sitemapEntry(entry) {
    return `<url><loc>${escapeXml(entry.url)}</loc>${entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ""}<changefreq>${entry.changefreq || "monthly"}</changefreq><priority>${entry.priority || "0.5"}</priority></url>`;
}

async function buildSitemap(repository, config) {
    const staticPages = [
        ["index.html", "weekly", "1.0"],
        ["equipamentos.html", "weekly", "0.9"],
        ["usadas.html", "daily", "0.9"],
        ["blog.html", "weekly", "0.8"],
        ["sobre-nos.html", "monthly", "0.6"],
        ["contato.html", "monthly", "0.7"],
        ["politica-de-privacidade.html", "yearly", "0.3"],
        ["termos-de-uso.html", "yearly", "0.3"]
    ].map(([pathname, changefreq, priority]) => ({
        url: absoluteUrl(config.baseUrl, pathname),
        changefreq,
        priority
    }));

    let products = [];
    let articles = [];
    try {
        [products, articles] = await Promise.all([
            repository.listProducts({ publicOnly: true }),
            repository.listArticles({ publicOnly: true })
        ]);
    } catch (error) {
        products = [];
        articles = [];
    }

    const productPages = products.map((item) => ({
        url: item.type === "used"
            ? absoluteUrl(config.baseUrl, "maquina-usada.html", { id: item.data.id })
            : absoluteUrl(config.baseUrl, "produto.html", { produto: item.data.id }),
        lastmod: lastModified(item.data._admin?.updatedAt),
        changefreq: item.type === "used" ? "daily" : "weekly",
        priority: "0.8"
    }));
    const articlePages = articles.map((article) => ({
        url: absoluteUrl(config.baseUrl, "artigo-blog.html", { artigo: article.slug }),
        lastmod: lastModified(article._admin?.updatedAt || article.datetime),
        changefreq: "monthly",
        priority: "0.7"
    }));

    const entries = [...staticPages, ...productPages, ...articlePages];
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(sitemapEntry).join("")}</urlset>`;
}

function buildRobots(config) {
    return [
        "User-agent: *",
        "Allow: /",
        "Disallow: /api/",
        "Disallow: /painel-admin.html",
        "",
        `Sitemap: ${absoluteUrl(config.baseUrl, "sitemap.xml")}`,
        ""
    ].join("\n");
}

module.exports = { buildSitemap, buildRobots, escapeXml, absoluteUrl };

