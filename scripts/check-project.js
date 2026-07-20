"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { projectRoot } = require("../server/config");

const ignored = new Set([".git", "node_modules", "storage"]);

function collectFiles(directory, files, extensions) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (ignored.has(entry.name)) continue;
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) collectFiles(absolutePath, files, extensions);
        if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) files.push(absolutePath);
    }
}

function localReference(filename, value) {
    const reference = String(value || "").trim();
    if (!reference || reference.startsWith("#") || reference.startsWith("//")
        || /^(?:https?:|data:|mailto:|tel:|javascript:)/i.test(reference)) {
        return "";
    }
    const pathname = reference.split(/[?#]/, 1)[0];
    if (!pathname || /[<>{}$]/.test(pathname)) return "";
    let decoded;
    try {
        decoded = decodeURIComponent(pathname);
    } catch (error) {
        return "";
    }
    return decoded.startsWith("/")
        ? path.join(projectRoot, "public", decoded.replace(/^[/\\]+/, ""))
        : path.resolve(path.dirname(filename), decoded);
}

function addMissingReference(failures, filename, reference) {
    const target = localReference(filename, reference);
    if (!target || fs.existsSync(target)) return;
    failures.push({
        filename,
        output: `Referência local não encontrada: ${reference}`
    });
}

const files = [];
collectFiles(projectRoot, files, new Set([".js"]));
const failures = [];
for (const filename of files) {
    const result = spawnSync(process.execPath, ["--check", filename], { encoding: "utf8" });
    if (result.status !== 0) failures.push({ filename, output: result.stderr || result.stdout });
}

const publicFiles = [];
collectFiles(path.join(projectRoot, "public"), publicFiles, new Set([".html", ".css"]));
for (const filename of publicFiles) {
    const source = fs.readFileSync(filename, "utf8");
    const relative = path.relative(projectRoot, filename);
    if (/fonts\.(?:googleapis|gstatic)\.com|formsubmit\.co/i.test(source)) {
        failures.push({ filename, output: "Dependência externa bloqueada pela política de privacidade." });
    }
    if (path.extname(filename).toLowerCase() === ".html") {
        if (/<style\b/i.test(source) || /\sstyle\s*=/i.test(source)) {
            failures.push({ filename, output: "Estilo inline incompatível com a CSP." });
        }
        const inlineScripts = Array.from(source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))
            .filter((match) => !/\bsrc\s*=/i.test(match[1]) && !/\btype\s*=\s*["']application\/ld\+json["']/i.test(match[1]));
        if (inlineScripts.length) failures.push({ filename, output: "Script inline executável incompatível com a CSP." });
        for (const match of source.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
            addMissingReference(failures, filename, match[1]);
        }
    } else {
        for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
            addMissingReference(failures, filename, match[1]);
        }
    }
    if (!source.trim()) failures.push({ filename, output: `Arquivo vazio: ${relative}` });
}

if (failures.length) {
    failures.forEach((failure) => {
        console.error(`\n${path.relative(projectRoot, failure.filename)}\n${failure.output.trim()}`);
    });
    process.exitCode = 1;
} else {
    console.log(`${files.length} arquivos JavaScript e ${publicFiles.length} arquivos públicos verificados.`);
}
