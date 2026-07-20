"use strict";

const crypto = require("node:crypto");

function cleanDetails(details) {
    if (!details || typeof details !== "object") return {};
    return Object.fromEntries(Object.entries(details).filter(([, value]) => (
        value == null || ["string", "number", "boolean"].includes(typeof value)
    )));
}

function write(level, event, details) {
    const payload = JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        event,
        ...cleanDetails(details)
    });
    const method = level === "error" ? "error" : (level === "warn" ? "warn" : "log");
    console[method](payload);
}

function requestIdMiddleware(req, res, next) {
    const supplied = String(req.get("x-request-id") || "");
    req.id = /^[a-zA-Z0-9_-]{8,80}$/.test(supplied) ? supplied : crypto.randomUUID();
    res.set("X-Request-ID", req.id);
    next();
}

function httpRequestMiddleware(req, res, next) {
    const startedAt = process.hrtime.bigint();
    res.once("finish", () => {
        const pathname = String(req.path || "").slice(0, 240);
        if (!pathname.startsWith("/api/") && pathname !== "/sitemap.xml" && pathname !== "/robots.txt") return;
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        const level = res.statusCode >= 500 ? "error" : (res.statusCode >= 400 ? "warn" : "info");
        write(level, "http_request", {
            requestId: req.id,
            method: req.method,
            path: pathname,
            status: res.statusCode,
            durationMs: Math.round(durationMs * 10) / 10
        });
    });
    next();
}

module.exports = {
    info: (event, details) => write("info", event, details),
    warn: (event, details) => write("warn", event, details),
    error: (event, details) => write("error", event, details),
    requestIdMiddleware,
    httpRequestMiddleware
};
