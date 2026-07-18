"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const { projectRoot } = require("../server/config");

const assetsDir = path.join(projectRoot, "public", "assets");
const publicDir = path.join(projectRoot, "public");
const minimumBytes = 150 * 1024;
const textExtensions = new Set([".html", ".css", ".js"]);

async function walk(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(target) : [target];
    }));
    return nested.flat();
}

function isCandidate(filePath, size) {
    const extension = path.extname(filePath).toLowerCase();
    if (size < minimumBytes) return false;
    if ([".png", ".jpg", ".jpeg"].includes(extension)) return true;
    if (extension !== ".svg" || size < 300 * 1024) return false;
    const normalized = filePath.replace(/\\/g, "/").toLowerCase();
    return !normalized.includes("/logo/") && !normalized.includes("favicon");
}

async function convert(filePath) {
    const source = await fs.stat(filePath);
    const outputPath = filePath.replace(/\.[^.]+$/, ".webp");
    const temporaryPath = `${outputPath}.tmp`;
    const metadata = await sharp(filePath, { limitInputPixels: 60000000 }).metadata();
    const pipeline = sharp(filePath, { limitInputPixels: 60000000 }).rotate();
    if (metadata.width > 2200) pipeline.resize({ width: 2200, withoutEnlargement: true });
    await pipeline.webp({ quality: 82, effort: 5, smartSubsample: true }).toFile(temporaryPath);
    const output = await fs.stat(temporaryPath);
    if (output.size >= source.size) {
        await fs.unlink(temporaryPath);
        return null;
    }
    await fs.rm(outputPath, { force: true });
    await fs.rename(temporaryPath, outputPath);
    return {
        sourcePath: filePath,
        outputPath,
        sourceBytes: source.size,
        outputBytes: output.size
    };
}

function publicAssetPath(filePath) {
    return path.relative(publicDir, filePath).replace(/\\/g, "/");
}

async function rewriteReferences(conversions) {
    const files = (await walk(publicDir)).filter((filePath) => textExtensions.has(path.extname(filePath).toLowerCase()));
    let changedFiles = 0;
    for (const filePath of files) {
        let content = await fs.readFile(filePath, "utf8");
        const original = content;
        for (const conversion of conversions) {
            const source = publicAssetPath(conversion.sourcePath);
            const output = publicAssetPath(conversion.outputPath);
            const sourceFromCss = `../${source}`;
            const outputFromCss = `../${output}`;
            content = content
                .replaceAll(`src="${source}"`, `src="${output}"`)
                .replaceAll(`src='${source}'`, `src='${output}'`)
                .replaceAll(`href="${source}"`, `href="${output}"`)
                .replaceAll(`data-fallback-src="${source}"`, `data-fallback-src="${output}"`)
                .replaceAll(`"${source}"`, `"${output}"`)
                .replaceAll(`'${source}'`, `'${output}'`)
                .replaceAll(sourceFromCss, outputFromCss);
        }
        if (content !== original) {
            await fs.writeFile(filePath, content, "utf8");
            changedFiles += 1;
        }
    }
    return changedFiles;
}

async function main() {
    const files = await walk(assetsDir);
    const candidates = [];
    for (const filePath of files) {
        const stat = await fs.stat(filePath);
        if (isCandidate(filePath, stat.size)) candidates.push(filePath);
    }

    const conversions = [];
    for (const filePath of candidates) {
        const converted = await convert(filePath);
        if (converted) conversions.push(converted);
    }
    const changedFiles = await rewriteReferences(conversions);
    const sourceBytes = conversions.reduce((total, item) => total + item.sourceBytes, 0);
    const outputBytes = conversions.reduce((total, item) => total + item.outputBytes, 0);
    console.log(JSON.stringify({
        converted: conversions.length,
        changedFiles,
        sourceMiB: Number((sourceBytes / 1048576).toFixed(2)),
        outputMiB: Number((outputBytes / 1048576).toFixed(2)),
        savedPercent: sourceBytes ? Math.round((1 - outputBytes / sourceBytes) * 100) : 0,
        files: conversions.map((item) => ({
            source: publicAssetPath(item.sourcePath),
            output: publicAssetPath(item.outputPath),
            savedPercent: Math.round((1 - item.outputBytes / item.sourceBytes) * 100)
        }))
    }, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

