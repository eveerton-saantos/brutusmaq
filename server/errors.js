"use strict";

const logger = require("./logger");

class AppError extends Error {
    constructor(status, code, message, details) {
        super(message);
        this.name = "AppError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

let lastDatabaseWarningAt = 0;

function isDatabaseError(error) {
    const databaseCodes = new Set([
        "ECONNREFUSED",
        "ECONNRESET",
        "ETIMEDOUT",
        "PROTOCOL_CONNECTION_LOST",
        "ER_ACCESS_DENIED_ERROR",
        "ER_BAD_DB_ERROR",
        "ENOTFOUND"
    ]);
    if (databaseCodes.has(error?.code)) return true;
    return Array.isArray(error?.errors) && error.errors.some((item) => databaseCodes.has(item?.code));
}

function asyncRoute(handler) {
    return function asyncRouteHandler(req, res, next) {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}

function apiNotFound(req, res) {
    res.status(404).json({
        error: {
            code: "not_found",
            message: "Recurso não encontrado."
        }
    });
}

function errorHandler(error, req, res, next) {
    if (res.headersSent) {
        next(error);
        return;
    }

    const isUploadLimit = error?.name === "MulterError" && error?.code === "LIMIT_FILE_SIZE";
    const isUploadError = error?.name === "MulterError";
    const databaseError = isDatabaseError(error);
    const isAppError = error instanceof AppError;
    const status = isAppError ? error.status : (isUploadLimit ? 413 : (isUploadError ? 422 : (databaseError ? 503 : 500)));
    const payload = {
        error: {
            code: isAppError ? error.code : (isUploadLimit ? "image_too_large" : (isUploadError ? "invalid_upload" : (databaseError ? "database_unavailable" : "internal_error"))),
            message: isAppError
                ? error.message
                : (isUploadLimit
                    ? "A imagem enviada ultrapassa o limite permitido."
                    : (isUploadError
                        ? "Não foi possível processar o arquivo enviado."
                        : (databaseError ? "O serviço de dados está temporariamente indisponível." : "Não foi possível concluir a solicitação.")))
        }
    };
    if (isAppError && error.details) payload.error.details = error.details;
    if (req.id) payload.error.requestId = req.id;
    if (databaseError && req.app.get("env") !== "test" && Date.now() - lastDatabaseWarningAt > 60000) {
        lastDatabaseWarningAt = Date.now();
        logger.warn("database_unavailable", { requestId: req.id, path: req.path });
    } else if (!isAppError && !isUploadError && !databaseError && req.app.get("env") !== "test") {
        logger.error("unhandled_request_error", {
            requestId: req.id,
            path: req.path,
            method: req.method,
            errorName: error?.name,
            errorCode: error?.code
        });
    }
    res.status(status).json(payload);
}

module.exports = { AppError, asyncRoute, apiNotFound, errorHandler, isDatabaseError };
