(function () {
    "use strict";

    const storageKey = "brutusmaq:privacy:v1";
    const version = "2026-07-17";
    const adminPage = /(?:^|\/)painel-admin\.html$/i.test(window.location.pathname);
    let state = readState();
    let banner = null;
    let dialog = null;

    function defaultState() {
        return {
            version,
            decided: false,
            necessary: true,
            analytics: false,
            updatedAt: ""
        };
    }

    function readState() {
        if (adminPage) return { ...defaultState(), decided: true };
        try {
            const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "null");
            if (!parsed || parsed.version !== version || typeof parsed.analytics !== "boolean") return defaultState();
            return {
                version,
                decided: true,
                necessary: true,
                analytics: parsed.analytics,
                updatedAt: String(parsed.updatedAt || "")
            };
        } catch (error) {
            return defaultState();
        }
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function setPreferences(preferences) {
        state = {
            version,
            decided: true,
            necessary: true,
            analytics: Boolean(preferences?.analytics),
            updatedAt: new Date().toISOString()
        };
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(state));
        } catch (error) {
            // A preferência continua válida durante esta navegação quando o armazenamento está bloqueado.
        }
        if (banner) banner.hidden = true;
        if (dialog?.open) dialog.close();
        window.dispatchEvent(new CustomEvent("brutusmaq:privacy-change", { detail: clone(state) }));
        return clone(state);
    }

    function allows(category) {
        if (category === "necessary") return true;
        return state.decided && category === "analytics" && state.analytics;
    }

    function injectStylesheet() {
        if (document.querySelector('link[data-privacy-styles]')) return;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "css/privacy-consent.css";
        link.dataset.privacyStyles = "";
        document.head.appendChild(link);
    }

    function openPreferences() {
        if (!dialog) return;
        const checkbox = dialog.querySelector("#privacyAnalyticsToggle");
        if (checkbox) checkbox.checked = state.analytics;
        if (typeof dialog.showModal === "function") dialog.showModal();
    }

    function buildInterface() {
        if (adminPage || document.getElementById("privacyConsentBanner")) return;
        injectStylesheet();

        banner = document.createElement("section");
        banner.className = "privacy-consent";
        banner.id = "privacyConsentBanner";
        banner.setAttribute("role", "dialog");
        banner.setAttribute("aria-labelledby", "privacyConsentTitle");
        banner.hidden = state.decided;
        banner.innerHTML = `<div class="privacy-consent-copy">
                <span>Privacidade</span>
                <strong id="privacyConsentTitle">Você controla as métricas</strong>
                <p>Usamos medição própria e anônima para entender procura, dispositivo e origem dos acessos. Dados do formulário não entram nessas métricas.</p>
                <a href="politica-de-privacidade.html#cookies">Consultar a política</a>
            </div>
            <div class="privacy-consent-actions">
                <button type="button" class="privacy-consent-secondary" data-privacy-essential>Somente essenciais</button>
                <button type="button" class="privacy-consent-primary" data-privacy-accept>Permitir métricas</button>
            </div>`;

        dialog = document.createElement("dialog");
        dialog.className = "privacy-preferences";
        dialog.id = "privacyPreferencesDialog";
        dialog.setAttribute("aria-labelledby", "privacyPreferencesTitle");
        dialog.innerHTML = `<form method="dialog">
                <div class="privacy-preferences-head">
                    <span>Privacidade</span>
                    <h2 id="privacyPreferencesTitle">Preferências do site</h2>
                    <p>Você pode mudar esta escolha a qualquer momento.</p>
                </div>
                <div class="privacy-preference-row is-fixed">
                    <div><strong>Essenciais</strong><small>Necessários para segurança, sessão e preferências.</small></div>
                    <input type="checkbox" checked disabled aria-label="Recursos essenciais sempre ativos">
                </div>
                <label class="privacy-preference-row">
                    <div><strong>Métricas anônimas</strong><small>Mede páginas, equipamentos, artigos, tipo de dispositivo e origem do acesso sem nome, e-mail, telefone ou mensagem.</small></div>
                    <input id="privacyAnalyticsToggle" type="checkbox">
                </label>
                <div class="privacy-preferences-actions">
                    <button type="button" class="privacy-consent-secondary" data-privacy-cancel>Cancelar</button>
                    <button type="button" class="privacy-consent-primary" data-privacy-save>Salvar preferências</button>
                </div>
            </form>`;

        document.body.append(banner, dialog);
        banner.querySelector("[data-privacy-essential]")?.addEventListener("click", () => setPreferences({ analytics: false }));
        banner.querySelector("[data-privacy-accept]")?.addEventListener("click", () => setPreferences({ analytics: true }));
        dialog.querySelector("[data-privacy-cancel]")?.addEventListener("click", () => dialog.close());
        dialog.querySelector("[data-privacy-save]")?.addEventListener("click", () => {
            setPreferences({ analytics: dialog.querySelector("#privacyAnalyticsToggle")?.checked });
        });

        document.querySelectorAll(".site-footer-legal").forEach((container) => {
            if (container.querySelector("[data-open-privacy]")) return;
            const button = document.createElement("button");
            button.type = "button";
            button.className = "privacy-footer-button";
            button.dataset.openPrivacy = "";
            button.textContent = "Preferências de privacidade";
            button.addEventListener("click", openPreferences);
            container.appendChild(button);
        });
    }

    window.BrutusmaqPrivacy = Object.freeze({
        allows,
        getState: () => clone(state),
        setPreferences,
        open: openPreferences,
        storageKey,
        version
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", buildInterface, { once: true });
    } else {
        buildInterface();
    }
}());
