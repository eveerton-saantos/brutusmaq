(function () {
    "use strict";

    function permittedUrl(value) {
        try {
            const url = new URL(String(value || ""), window.location.href);
            const youtube = url.hostname === "www.youtube-nocookie.com"
                && (url.pathname === "/embed" || url.pathname.startsWith("/embed/"));
            const maps = url.hostname === "www.google.com" && url.pathname === "/maps/embed";
            return youtube || maps ? url.href : "";
        } catch (error) {
            return "";
        }
    }

    document.addEventListener("click", (event) => {
        const button = event.target.closest("[data-load-external-media]");
        if (!button) return;
        const iframe = document.getElementById(button.dataset.loadExternalMedia || "");
        const source = permittedUrl(iframe?.dataset.externalSrc);
        if (!iframe || !source) return;

        button.disabled = true;
        iframe.src = source;
        iframe.hidden = false;
        const gate = button.closest(".external-media-gate");
        if (gate) gate.hidden = true;
    });
}());
