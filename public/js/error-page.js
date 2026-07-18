(function () {
    "use strict";

    const backButton = document.getElementById("error-go-back");
    const searchForm = document.querySelector(".error-search");
    const searchInput = document.getElementById("error-search-input");
    const description = document.getElementById("error-description");
    const requestedPath = document.getElementById("error-request-path");
    const primaryLink = document.getElementById("error-primary-link");
    const params = new URLSearchParams(window.location.search);

    if (params.get("origem") === "artigo" && description) {
        description.textContent = "Este artigo não está publicado ou o endereço informado não existe. Volte ao Blog para escolher outro conteúdo técnico.";
        if (primaryLink) {
            primaryLink.href = "/blog.html";
            primaryLink.textContent = "Voltar ao Blog";
        }
    }

    if (requestedPath && window.location.pathname && !window.location.pathname.endsWith("/404.html")) {
        requestedPath.textContent = `Endereço solicitado: ${window.location.pathname.slice(0, 120)}`;
        requestedPath.hidden = false;
    }

    if (backButton) {
        backButton.addEventListener("click", () => {
            if (window.history.length > 1) window.history.back();
            else window.location.href = "/index.html";
        });
    }

    if (searchForm && searchInput) {
        searchForm.addEventListener("submit", (event) => {
            if (searchInput.value.trim()) return;
            event.preventDefault();
            searchInput.focus();
        });
    }
}());
