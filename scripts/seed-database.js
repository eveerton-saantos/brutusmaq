"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const vm = require("node:vm");
const bcrypt = require("bcryptjs");
const { projectRoot, loadConfig } = require("../server/config");
const { MySqlRepository } = require("../server/database");
const { createConnection, validateAdminEnvironment } = require("./database-tools");

async function readFrontendData(filename, property) {
    const source = await fs.readFile(path.join(projectRoot, "public", "js", filename), "utf8");
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename, timeout: 2000 });
    return JSON.parse(JSON.stringify(sandbox.window[property] || []));
}

async function ensureInitialAdmin() {
    const admin = validateAdminEnvironment();
    const passwordHash = await bcrypt.hash(admin.password, 12);
    const { connection } = await createConnection();
    try {
        await connection.execute(
            `INSERT IGNORE INTO admins (public_id, name, email, password_hash, role, active)
             VALUES (?, ?, ?, ?, 'owner', 1)`,
            [crypto.randomUUID(), admin.name, admin.email, passwordHash]
        );
        const [rows] = await connection.execute(
            "SELECT id, email FROM admins WHERE email = ? LIMIT 1",
            [admin.email]
        );
        if (!rows[0]) throw new Error("Não foi possível localizar o administrador inicial.");
        return rows[0];
    } finally {
        await connection.end();
    }
}

function initialProduct(product, type, index) {
    return {
        ...product,
        _admin: {
            ...(product._admin || {}),
            uid: product._admin?.uid || `${type}:${product.id}:${index}`,
            status: product._admin?.status || "published",
            visible: product._admin?.visible !== false
        }
    };
}

function initialArticle(article, index) {
    return {
        ...article,
        _admin: {
            ...(article._admin || {}),
            uid: article._admin?.uid || `article:${article.slug}:${index}`,
            status: article._admin?.status || "published",
            visible: article._admin?.visible !== false
        }
    };
}

async function seed() {
    const admin = await ensureInitialAdmin();
    const config = loadConfig();
    const repository = MySqlRepository.create(config.database);
    try {
        const [existingProducts, existingArticles, newProducts, usedProducts, articles] = await Promise.all([
            repository.listProducts({ publicOnly: false }),
            repository.listArticles({ publicOnly: false }),
            readFrontendData("catalogo-produtos.js", "brutusmaqProdutosNovos"),
            readFrontendData("catalogo-produtos.js", "brutusmaqMaquinasUsadas"),
            readFrontendData("blog-data.js", "BRUTUS_BLOG_ARTICLES")
        ]);

        if (!existingProducts.length) {
            for (const [index, product] of newProducts.entries()) {
                await repository.saveProduct("new", initialProduct(product, "new", index), admin.id);
            }
            for (const [index, product] of usedProducts.entries()) {
                await repository.saveProduct("used", initialProduct(product, "used", index), admin.id);
            }
            console.log(`Catálogo inicial carregado: ${newProducts.length + usedProducts.length} produtos.`);
        } else {
            console.log("Catálogo preservado: o banco já possui produtos.");
        }

        if (!existingArticles.length) {
            for (const [index, article] of articles.entries()) {
                await repository.saveArticle(initialArticle(article, index), admin.id);
            }
            console.log(`Blog inicial carregado: ${articles.length} artigos.`);
        } else {
            console.log("Blog preservado: o banco já possui artigos.");
        }
    } finally {
        await repository.close();
    }
}

seed().catch((error) => {
    console.error(`Falha ao carregar dados iniciais: ${error.message}`);
    process.exitCode = 1;
});
