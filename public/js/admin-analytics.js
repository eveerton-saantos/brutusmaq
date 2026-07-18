(function () {
    "use strict";

    const analytics = window.BrutusmaqAnalytics;
    const ui = window.BrutusmaqAdminUI;
    const api = window.BrutusmaqAdminApi;
    const rangeButtons = Array.from(document.querySelectorAll("[data-analytics-range]"));
    const emptyState = document.getElementById("adminAnalyticsEmpty");
    const content = document.getElementById("adminAnalyticsContent");
    const numberFormatter = new Intl.NumberFormat("pt-BR");
    const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    const dayMs = 86400000;
    const deviceLabels = Object.freeze({
        desktop: "Computador",
        mobile: "Celular",
        tablet: "Tablet",
        unknown: "Não identificado"
    });
    const trafficSourceLabels = Object.freeze({
        direct: "Acesso direto",
        google: "Google",
        bing: "Bing",
        facebook: "Facebook",
        instagram: "Instagram",
        tiktok: "TikTok",
        youtube: "YouTube",
        linkedin: "LinkedIn",
        whatsapp: "WhatsApp",
        email: "E-mail",
        other: "Outro site",
        unknown: "Não identificado"
    });
    const trafficMediumLabels = Object.freeze({
        direct: "Direto",
        organic: "Pesquisa orgânica",
        social: "Rede social",
        paid: "Mídia paga",
        referral: "Referência",
        email: "E-mail",
        unknown: "Canal não identificado"
    });
    let activeRange = "30";

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function isProductEvent(event) {
        return event.entityType === "product" || event.entityType === "used_product";
    }

    function eventTime(event) {
        return new Date(event.timestamp).getTime();
    }

    function getPeriod(range, allEvents) {
        const end = Date.now() + 1000;
        if (range === "all") {
            const firstTime = allEvents.length ? eventTime(allEvents[0]) : Date.now();
            return { start: firstTime, end, previousStart: null, previousEnd: null, comparison: false };
        }

        if (range === "today") {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const elapsed = end - start;
            return {
                start,
                end,
                previousStart: start - dayMs,
                previousEnd: start - dayMs + elapsed,
                comparison: true
            };
        }

        const days = Math.max(1, Number(range) || 30);
        const duration = days * dayMs;
        return {
            start: end - duration,
            end,
            previousStart: end - duration * 2,
            previousEnd: end - duration,
            comparison: true
        };
    }

    function eventsBetween(events, start, end) {
        if (start == null || end == null) return [];
        return events.filter((event) => {
            const time = eventTime(event);
            return time >= start && time < end;
        });
    }

    function metricCounts(events) {
        const productViews = events.filter((event) => event.type === "page_view" && isProductEvent(event)).length;
        const proposalIntents = events.filter((event) => event.type === "proposal_intent").length;
        const whatsappProduct = events.filter((event) => event.type === "whatsapp_click" && isProductEvent(event)).length;
        const formSuccess = events.filter((event) => event.type === "form_submit_success").length;
        const formSuccessProduct = events.filter((event) => event.type === "form_submit_success" && isProductEvent(event)).length;
        const articleViews = events.filter((event) => event.type === "page_view" && event.entityType === "article").length;
        return { productViews, proposalIntents, whatsappProduct, formSuccess, formSuccessProduct, articleViews };
    }

    function formatDelta(current, previous, hasComparison) {
        if (!hasComparison) return { label: "Cobertura total", className: "" };
        if (!previous && !current) return { label: "Sem variação", className: "" };
        if (!previous) return { label: "Novo no período", className: "is-up" };
        const delta = Math.round(((current - previous) / previous) * 100);
        if (!delta) return { label: "Sem variação", className: "" };
        return {
            label: `${delta > 0 ? "+" : ""}${numberFormatter.format(delta)}% vs. período anterior`,
            className: delta > 0 ? "is-up" : "is-down"
        };
    }

    function renderMetric(valueId, deltaId, current, previous, hasComparison) {
        setText(valueId, numberFormatter.format(current));
        const delta = document.getElementById(deltaId);
        if (!delta) return;
        const result = formatDelta(current, previous, hasComparison);
        delta.textContent = result.label;
        delta.classList.remove("is-up", "is-down");
        if (result.className) delta.classList.add(result.className);
    }

    function formatPercent(value) {
        if (!Number.isFinite(value) || value <= 0) return "0%";
        if (value < 1) return "<1%";
        return `${numberFormatter.format(Math.round(value))}%`;
    }

    function attributionSessions(events) {
        const sessions = new Map();
        events.filter((event) => event.type === "page_view").forEach((event) => {
            const key = event.sessionId || event.id;
            if (!key) return;
            const attribution = {
                deviceType: deviceLabels[event.deviceType] ? event.deviceType : "unknown",
                trafficSource: trafficSourceLabels[event.trafficSource] ? event.trafficSource : "unknown",
                trafficMedium: trafficMediumLabels[event.trafficMedium] ? event.trafficMedium : "unknown"
            };
            const saved = sessions.get(key);
            if (!saved) {
                sessions.set(key, attribution);
                return;
            }
            if (saved.deviceType === "unknown" && attribution.deviceType !== "unknown") saved.deviceType = attribution.deviceType;
            if (saved.trafficSource === "unknown" && attribution.trafficSource !== "unknown") saved.trafficSource = attribution.trafficSource;
            if (saved.trafficMedium === "unknown" && attribution.trafficMedium !== "unknown") saved.trafficMedium = attribution.trafficMedium;
        });
        return Array.from(sessions.values());
    }

    function renderBreakdown(containerId, summaryId, rows, total, emptyMessage, tone) {
        const container = document.getElementById(containerId);
        setText(summaryId, `${numberFormatter.format(total)} sess${total === 1 ? "ão" : "ões"}`);
        if (!container) return;
        if (!rows.length) {
            container.innerHTML = `<div class="admin-chart-zero">${escapeHtml(emptyMessage)}</div>`;
            return;
        }
        container.innerHTML = rows.map((item) => {
            const share = (item.count / Math.max(1, total)) * 100;
            const percent = formatPercent(share);
            return `<div class="admin-analytics-breakdown-item">
                <div><span title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span><small>${escapeHtml(item.note || "")}</small></div>
                <progress class="admin-analytics-breakdown-progress is-${tone}" max="100" value="${share}" aria-label="${escapeHtml(item.label)}: ${numberFormatter.format(item.count)} sessões, ${percent}"></progress>
                <strong>${numberFormatter.format(item.count)}<small>${percent}</small></strong>
            </div>`;
        }).join("");
    }

    function renderAcquisition(events) {
        const sessions = attributionSessions(events);
        const deviceCounts = new Map();
        const trafficCounts = new Map();
        sessions.forEach((session) => {
            deviceCounts.set(session.deviceType, (deviceCounts.get(session.deviceType) || 0) + 1);
            const trafficKey = `${session.trafficSource}:${session.trafficMedium}`;
            trafficCounts.set(trafficKey, (trafficCounts.get(trafficKey) || 0) + 1);
        });
        const sortRows = (first, second) => second.count - first.count || first.label.localeCompare(second.label, "pt-BR");
        const deviceRows = Array.from(deviceCounts, ([key, count]) => ({
            key,
            count,
            label: deviceLabels[key] || deviceLabels.unknown,
            note: key === "unknown" ? "Eventos anteriores à nova medição" : "Sessões no período"
        })).sort(sortRows);
        const trafficRows = Array.from(trafficCounts, ([key, count]) => {
            const [source, medium] = key.split(":");
            return {
                key,
                count,
                label: trafficSourceLabels[source] || trafficSourceLabels.unknown,
                note: trafficMediumLabels[medium] || trafficMediumLabels.unknown
            };
        }).sort(sortRows);
        renderBreakdown(
            "adminAnalyticsDevices",
            "analyticsDevicesSummary",
            deviceRows,
            sessions.length,
            "Os dispositivos aparecerão após novas visualizações de página.",
            "device"
        );
        renderBreakdown(
            "adminAnalyticsTraffic",
            "analyticsTrafficSummary",
            trafficRows,
            sessions.length,
            "As origens aparecerão após novas visualizações de página.",
            "traffic"
        );
    }

    function aggregateByEntity(events, entityTypes) {
        const allowedTypes = new Set(entityTypes);
        const groups = new Map();
        events.forEach((event) => {
            if (!allowedTypes.has(event.entityType) || !event.entityId) return;
            const key = `${event.entityType}:${event.entityId}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    id: event.entityId,
                    type: event.entityType,
                    name: event.entityName || event.entityId,
                    views: 0,
                    proposals: 0,
                    whatsapp: 0,
                    forms: 0,
                    shares: 0
                });
            }
            const group = groups.get(key);
            if (event.entityName) group.name = event.entityName;
            if (event.type === "page_view") group.views += 1;
            if (event.type === "proposal_intent") group.proposals += 1;
            if (event.type === "whatsapp_click") group.whatsapp += 1;
            if (event.type === "form_submit_success") group.forms += 1;
            if (event.type === "article_share") group.shares += 1;
        });
        return Array.from(groups.values());
    }

    function renderProductRanking(events) {
        const rows = aggregateByEntity(events, ["product", "used_product"])
            .sort((first, second) => (
                second.views - first.views
                || (second.whatsapp + second.forms) - (first.whatsapp + first.forms)
                || first.name.localeCompare(second.name, "pt-BR")
            ))
            .slice(0, 8);
        const body = document.getElementById("adminAnalyticsProductRows");
        const empty = document.getElementById("adminAnalyticsProductEmpty");
        setText("analyticsProductsSummary", `${rows.length} equipamento${rows.length === 1 ? "" : "s"}`);
        if (body) {
            body.innerHTML = rows.map((item) => {
                const contactRate = ((item.whatsapp + item.forms) / Math.max(1, item.views)) * 100;
                return `<tr>
                    <td title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</td>
                    <td>${numberFormatter.format(item.views)}</td>
                    <td>${numberFormatter.format(item.whatsapp)}</td>
                    <td>${numberFormatter.format(item.forms)}</td>
                    <td><span class="admin-analytics-rate">${formatPercent(contactRate)}</span></td>
                </tr>`;
            }).join("");
        }
        if (empty) empty.hidden = rows.length > 0;
    }

    function renderArticleRanking(events) {
        const articles = aggregateByEntity(events, ["article"])
            .sort((first, second) => second.views - first.views || second.shares - first.shares || first.name.localeCompare(second.name, "pt-BR"));
        const totalViews = articles.reduce((total, item) => total + item.views, 0);
        const rows = articles.slice(0, 8);
        const body = document.getElementById("adminAnalyticsArticleRows");
        const empty = document.getElementById("adminAnalyticsArticleEmpty");
        setText("analyticsArticlesSummary", `${rows.length} artigo${rows.length === 1 ? "" : "s"}`);
        if (body) {
            body.innerHTML = rows.map((item) => `<tr>
                <td title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</td>
                <td>${numberFormatter.format(item.views)}</td>
                <td>${numberFormatter.format(item.shares)}</td>
                <td><span class="admin-analytics-rate">${formatPercent((item.views / Math.max(1, totalViews)) * 100)}</span></td>
            </tr>`).join("");
        }
        if (empty) empty.hidden = rows.length > 0;
    }

    function renderReasons(events) {
        const counts = new Map();
        events.filter((event) => event.type === "form_submit_success").forEach((event) => {
            const reason = event.formType || "Contato geral";
            counts.set(reason, (counts.get(reason) || 0) + 1);
        });
        const reasons = Array.from(counts, ([name, count]) => ({ name, count }))
            .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name, "pt-BR"));
        const total = reasons.reduce((sum, item) => sum + item.count, 0);
        const max = Math.max(1, ...reasons.map((item) => item.count));
        const container = document.getElementById("adminAnalyticsReasons");
        setText("analyticsFormsSummary", `${numberFormatter.format(total)} confirmado${total === 1 ? "" : "s"}`);
        if (!container) return;
        container.innerHTML = reasons.length
            ? reasons.map((item) => `<div class="admin-analytics-bar">
                <span title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
                <progress class="admin-analytics-progress" max="100" value="${Math.max(3, (item.count / max) * 100)}" aria-hidden="true"></progress>
                <strong>${numberFormatter.format(item.count)}</strong>
            </div>`).join("")
            : `<div class="admin-chart-zero">Nenhum formulário confirmado neste período.</div>`;
    }

    function renderFunnel(counts) {
        const container = document.getElementById("adminAnalyticsFunnel");
        const contacts = counts.whatsappProduct + counts.formSuccessProduct;
        const contactRate = (contacts / Math.max(1, counts.productViews)) * 100;
        setText("analyticsContactRate", formatPercent(contactRate));
        if (!container) return;
        const stages = [
            { label: "Fichas visualizadas", value: counts.productViews, tone: "orange", note: "Ponto de entrada da jornada" },
            { label: "Cliques em proposta", value: counts.proposalIntents, tone: "ink", note: "Interesse em preencher o formulário" },
            { label: "Cliques no WhatsApp", value: counts.whatsappProduct, tone: "green", note: "Contato direto sobre produto" },
            { label: "Formulários confirmados", value: counts.formSuccessProduct, tone: "blue", note: "Envio aceito pelo serviço" }
        ];
        const max = Math.max(1, ...stages.map((stage) => stage.value));
        container.innerHTML = stages.map((stage) => `<div class="admin-funnel-row">
            <div><span>${stage.label}</span><strong>${numberFormatter.format(stage.value)}</strong></div>
            <progress class="admin-funnel-progress admin-funnel-progress-${stage.tone}" max="100" value="${stage.value ? Math.max(3, (stage.value / max) * 100) : 0}" aria-hidden="true"></progress>
            <small>${stage.note}</small>
        </div>`).join("");
    }

    function bucketLabel(date, range) {
        if (range === "today") {
            return `${String(date.getHours()).padStart(2, "0")}h`;
        }
        if (range === "365" || range === "all") {
            return new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "");
        }
        return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
    }

    function createBuckets(period, range) {
        const duration = Math.max(1, period.end - period.start);
        let count = 15;
        if (range === "today") count = 6;
        else if (range === "7") count = 7;
        else if (range === "365") count = 12;
        else if (range === "all") count = Math.min(14, Math.max(1, Math.ceil(duration / (30 * dayMs))));
        const step = duration / count;
        return Array.from({ length: count }, (_, index) => {
            const start = period.start + step * index;
            const end = index === count - 1 ? period.end : period.start + step * (index + 1);
            return { start, end, label: bucketLabel(new Date(start), range), equipment: 0, contacts: 0, articles: 0 };
        });
    }

    function seriesPoints(values, width, height, left, top, maxValue) {
        if (!values.length) return "";
        return values.map((value, index) => {
            const x = values.length === 1 ? left + width / 2 : left + (index / (values.length - 1)) * width;
            const y = top + height - (value / maxValue) * height;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(" ");
    }

    function renderTrend(events, period, range) {
        const chart = document.getElementById("adminAnalyticsTrendChart");
        if (!chart) return;
        const buckets = createBuckets(period, range);
        events.forEach((event) => {
            const time = eventTime(event);
            const bucket = buckets.find((item) => time >= item.start && time < item.end);
            if (!bucket) return;
            if (event.type === "page_view" && isProductEvent(event)) bucket.equipment += 1;
            if ((event.type === "whatsapp_click" && isProductEvent(event))
                || (event.type === "form_submit_success" && isProductEvent(event))) bucket.contacts += 1;
            if (event.type === "page_view" && event.entityType === "article") bucket.articles += 1;
        });
        const hasValues = buckets.some((bucket) => bucket.equipment || bucket.contacts || bucket.articles);
        if (!hasValues) {
            chart.innerHTML = `<div class="admin-chart-zero">Ainda não há visualizações ou contatos suficientes para desenhar a tendência.</div>`;
            return;
        }

        const viewWidth = 900;
        const viewHeight = 270;
        const left = 42;
        const right = 16;
        const top = 15;
        const bottom = 36;
        const plotWidth = viewWidth - left - right;
        const plotHeight = viewHeight - top - bottom;
        const maxValue = Math.max(1, ...buckets.flatMap((bucket) => [bucket.equipment, bucket.contacts, bucket.articles]));
        const grid = Array.from({ length: 5 }, (_, index) => {
            const ratio = index / 4;
            const y = top + plotHeight - ratio * plotHeight;
            return `<line class="admin-chart-grid-line" x1="${left}" y1="${y}" x2="${viewWidth - right}" y2="${y}"></line><text class="admin-chart-value-label" x="${left - 8}" y="${y + 3}" text-anchor="end">${Math.round(maxValue * ratio)}</text>`;
        }).join("");
        const labelEvery = Math.max(1, Math.ceil(buckets.length / 7));
        const labels = buckets.map((bucket, index) => {
            if (index % labelEvery !== 0 && index !== buckets.length - 1) return "";
            const x = buckets.length === 1 ? left + plotWidth / 2 : left + (index / (buckets.length - 1)) * plotWidth;
            return `<text class="admin-chart-axis-label" x="${x}" y="${viewHeight - 10}" text-anchor="middle">${escapeHtml(bucket.label)}</text>`;
        }).join("");
        const series = [
            { key: "equipment", className: "is-equipment", label: "Equipamentos" },
            { key: "contacts", className: "is-contact", label: "Contatos" },
            { key: "articles", className: "is-article", label: "Artigos" }
        ];
        const lines = series.map((item) => {
            const values = buckets.map((bucket) => bucket[item.key]);
            const points = seriesPoints(values, plotWidth, plotHeight, left, top, maxValue);
            const circles = buckets.length <= 14 ? values.map((value, index) => {
                const x = values.length === 1 ? left + plotWidth / 2 : left + (index / (values.length - 1)) * plotWidth;
                const y = top + plotHeight - (value / maxValue) * plotHeight;
                return `<circle class="admin-chart-point ${item.className}" cx="${x}" cy="${y}" r="4"><title>${escapeHtml(item.label)}: ${value} · ${escapeHtml(buckets[index].label)}</title></circle>`;
            }).join("") : "";
            return `<polyline class="admin-chart-series ${item.className}" points="${points}"></polyline>${circles}`;
        }).join("");
        chart.innerHTML = `<svg viewBox="0 0 ${viewWidth} ${viewHeight}" role="img" aria-labelledby="analyticsSvgTitle analyticsSvgDescription">
            <title id="analyticsSvgTitle">Procura e conversão no período</title>
            <desc id="analyticsSvgDescription">Comparação entre visualizações de equipamentos, contatos comerciais e leituras de artigos.</desc>
            ${grid}${labels}${lines}
        </svg>`;
    }

    function relativeTime(value) {
        const time = new Date(value || "").getTime();
        if (!Number.isFinite(time)) return "sem atualização";
        const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
        if (minutes < 1) return "agora";
        if (minutes < 60) return `há ${minutes} min`;
        const hours = Math.round(minutes / 60);
        if (hours < 24) return `há ${hours} h`;
        return dateTimeFormatter.format(new Date(time));
    }

    function renderHealth(events) {
        setText("analyticsEventCount", numberFormatter.format(events.length));
        setText("analyticsSessionCount", numberFormatter.format(new Set(events.map((event) => event.sessionId).filter(Boolean)).size));
        setText("analytics404Count", numberFormatter.format(events.filter((event) => event.type === "page_view" && event.page.endsWith("404.html")).length));
        setText("analyticsFormFailures", numberFormatter.format(events.filter((event) => event.type === "form_submit_failure").length));
    }

    function render() {
        if (!analytics) return;
        const state = analytics.getState();
        const allEvents = [...state.events].sort((first, second) => eventTime(first) - eventTime(second));
        const period = getPeriod(activeRange, allEvents);
        const currentEvents = eventsBetween(allEvents, period.start, period.end);
        const previousEvents = eventsBetween(allEvents, period.previousStart, period.previousEnd);
        const current = metricCounts(currentEvents);
        const previous = metricCounts(previousEvents);

        renderMetric("analyticsProductViews", "analyticsProductViewsDelta", current.productViews, previous.productViews, period.comparison);
        renderMetric("analyticsProposalIntents", "analyticsProposalIntentsDelta", current.proposalIntents, previous.proposalIntents, period.comparison);
        renderMetric("analyticsWhatsappClicks", "analyticsWhatsappClicksDelta", current.whatsappProduct, previous.whatsappProduct, period.comparison);
        renderMetric("analyticsFormSuccess", "analyticsFormSuccessDelta", current.formSuccess, previous.formSuccess, period.comparison);
        renderMetric("analyticsArticleViews", "analyticsArticleViewsDelta", current.articleViews, previous.articleViews, period.comparison);

        setText("adminAnalyticsUpdated", relativeTime(state.updatedAt));
        setText("adminAnalyticsCoverage", `Desde ${dateFormatter.format(new Date(state.startedAt))} · ${numberFormatter.format(allEvents.length)} evento${allEvents.length === 1 ? "" : "s"} no histórico`);

        const hasPeriodData = currentEvents.length > 0;
        if (emptyState) {
            emptyState.hidden = hasPeriodData;
            const title = emptyState.querySelector("strong");
            const description = emptyState.querySelector("p");
            if (title) title.textContent = allEvents.length ? "Nenhum evento neste período" : "A coleta está pronta";
            if (description) {
                description.textContent = allEvents.length
                    ? "Escolha outro intervalo para consultar o histórico já registrado."
                    : "Abra páginas públicas, fichas de equipamentos e artigos para começar a formar o histórico deste navegador.";
            }
        }
        if (content) content.hidden = !hasPeriodData;

        renderTrend(currentEvents, period, activeRange);
        renderFunnel(current);
        renderAcquisition(currentEvents);
        renderProductRanking(currentEvents);
        renderArticleRanking(currentEvents);
        renderReasons(currentEvents);
        renderHealth(currentEvents);
    }

    function setRange(value) {
        activeRange = value;
        rangeButtons.forEach((button) => {
            const active = button.dataset.analyticsRange === value;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-pressed", active ? "true" : "false");
        });
        render();
    }

    function exportMetrics() {
        if (!analytics) return;
        const blob = new Blob([JSON.stringify(analytics.exportData(), null, 2)], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `brutusmaq-metricas-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        ui?.showToast(api?.isDatabase?.() ? "Métricas do banco exportadas." : "Métricas locais exportadas.");
    }

    function clearMetrics() {
        if (!analytics) return;
        const action = async () => {
            try {
                if (api?.isDatabase?.()) {
                    await api.clearAnalytics();
                    analytics.setRemoteState({ events: [] });
                } else {
                    analytics.clear();
                }
                render();
                ui?.showToast(api?.isDatabase?.() ? "Histórico central de métricas removido." : "Histórico local de métricas removido.");
            } catch (error) {
                ui?.showToast(error.message || "Não foi possível limpar as métricas.");
            }
        };
        if (ui && typeof ui.openConfirmation === "function") {
            ui.openConfirmation(
                "Limpar histórico de métricas?",
                api?.isDatabase?.()
                    ? "Visualizações, contatos, formulários e leituras do banco serão removidos. Exporte os dados antes se precisar preservá-los."
                    : "Visualizações, contatos, formulários e leituras registrados neste navegador serão removidos. Exporte os dados antes se precisar preservá-los.",
                "Limpar métricas",
                action
            );
            return;
        }
        if (window.confirm("Deseja limpar todo o histórico local de métricas?")) action();
    }

    rangeButtons.forEach((button) => button.addEventListener("click", () => setRange(button.dataset.analyticsRange)));
    document.getElementById("adminAnalyticsExport")?.addEventListener("click", exportMetrics);
    document.getElementById("adminAnalyticsClear")?.addEventListener("click", clearMetrics);
    window.addEventListener("brutusmaq:analytics-updated", render);

    if (!analytics) {
        if (emptyState) {
            emptyState.hidden = false;
            emptyState.querySelector("strong").textContent = "A camada de métricas não foi carregada";
            emptyState.querySelector("p").textContent = "Atualize a página e confira o arquivo js/analytics-store.js.";
        }
        if (content) content.hidden = true;
        return;
    }

    setRange(activeRange);
}());
