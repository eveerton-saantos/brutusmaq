"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const { AppError } = require("./errors");

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function cleanAlt(value) {
    return String(value || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 240);
}

function createMediaService(config) {
    return Object.freeze({
        async saveImage(file, altText) {
            if (!file || !Buffer.isBuffer(file.buffer)) {
                throw new AppError(422, "image_required", "Selecione uma imagem para enviar.");
            }
            if (!allowedMimeTypes.has(file.mimetype)) {
                throw new AppError(415, "unsupported_image", "Use uma imagem JPEG, PNG, WebP ou AVIF.");
            }
            if (file.size > config.maxUploadBytes) {
                throw new AppError(413, "image_too_large", `A imagem deve ter no máximo ${Math.round(config.maxUploadBytes / 1048576)} MB.`);
            }

            let image;
            let metadata;
            try {
                image = sharp(file.buffer, { failOn: "warning", limitInputPixels: 40000000 }).rotate();
                metadata = await image.metadata();
            } catch (error) {
                throw new AppError(422, "invalid_image", "O arquivo enviado não contém uma imagem válida.");
            }
            if (!metadata.width || !metadata.height) {
                throw new AppError(422, "invalid_image", "Não foi possível identificar as dimensões da imagem.");
            }

            const now = new Date();
            const year = String(now.getUTCFullYear());
            const month = String(now.getUTCMonth() + 1).padStart(2, "0");
            const fileName = `${crypto.randomUUID()}.webp`;
            const relativePath = path.posix.join(year, month, fileName);
            const directory = path.join(config.uploadDir, year, month);
            const absolutePath = path.join(directory, fileName);
            await fs.mkdir(directory, { recursive: true });

            const output = await image
                .resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true })
                .webp({ quality: 84, effort: 5 })
                .toBuffer({ resolveWithObject: true });
            await fs.writeFile(absolutePath, output.data, { flag: "wx" });

            return {
                fileName,
                storagePath: relativePath,
                publicUrl: `/uploads/${relativePath}`,
                mimeType: "image/webp",
                sizeBytes: output.info.size,
                width: output.info.width,
                height: output.info.height,
                altText: cleanAlt(altText)
            };
        },
        async removeImage(storagePath) {
            const root = path.resolve(config.uploadDir);
            const target = path.resolve(root, String(storagePath || ""));
            if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
                throw new AppError(400, "invalid_media_path", "O caminho do arquivo é inválido.");
            }
            try {
                await fs.unlink(target);
            } catch (error) {
                if (error.code !== "ENOENT") throw error;
            }
        }
    });
}

module.exports = { createMediaService, allowedMimeTypes };
