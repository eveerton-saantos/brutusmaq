"use strict";

const { loadConfig } = require("./config");
const { MySqlRepository } = require("./database");
const { createMailer } = require("./mailer");
const { createMediaService } = require("./media-service");
const { createApp } = require("./app");

const config = loadConfig();
const repository = MySqlRepository.create(config.database);
const app = createApp({
    config,
    repository,
    mailer: createMailer(config),
    mediaService: createMediaService(config)
});

const server = app.listen(config.port, () => {
    console.log(`Brutusmaq disponível em ${config.baseUrl}`);
});

async function shutdown(signal) {
    console.log(`${signal} recebido. Encerrando o servidor...`);
    server.close(async () => {
        try {
            await repository.close();
            process.exit(0);
        } catch (error) {
            console.error("Não foi possível encerrar o banco corretamente.", error);
            process.exit(1);
        }
    });
    setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

module.exports = { app, server, repository };
