"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { projectRoot } = require("../server/config");

function releaseTag() {
    const value = String(process.argv[2] || "").trim();
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(value)) {
        throw new Error("Informe uma versão segura: npm run assets:version -- 20260717");
    }
    return value;
}

async function main() {
    const tag = releaseTag();
    const publicDir = path.join(projectRoot, "public");
    const entries = await fs.readdir(publicDir, { withFileTypes: true });
    let updatedFiles = 0;
    let updatedReferences = 0;

    for (const entry of entries) {
        if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".html") continue;
        const filename = path.join(publicDir, entry.name);
        const source = await fs.readFile(filename, "utf8");
        const versioned = source.replace(
            /(<(?:script|link)\b[^>]*?\b(?:src|href)=["'])([^"']+\.(?:js|css))(?:\?v=[^"'\s>]*)?(["'][^>]*>)/gi,
            (match, prefix, asset, suffix) => {
                if (/^(?:https?:)?\/\//i.test(asset) || /^data:/i.test(asset)) return match;
                updatedReferences += 1;
                return `${prefix}${asset}?v=${tag}${suffix}`;
            }
        );
        if (versioned !== source) {
            await fs.writeFile(filename, versioned, "utf8");
            updatedFiles += 1;
        }
    }

    console.log(`${updatedReferences} referências versionadas em ${updatedFiles} arquivos HTML.`);
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});

