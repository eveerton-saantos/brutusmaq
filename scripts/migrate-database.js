"use strict";

const { runMigrations } = require("./database-tools");

runMigrations()
    .then(() => console.log("Banco de dados atualizado com sucesso."))
    .catch((error) => {
        console.error(`Falha ao atualizar o banco: ${error.message}`);
        process.exitCode = 1;
    });
