(async function () {
await Promise.resolve(window.BrutusmaqCatalogReady);

const contactForm = document.querySelector('.contact-form');
const contactProductLabels = Object.fromEntries(
    [
        ...(window.brutusmaqProdutosNovos || []),
        ...(window.brutusmaqMaquinasUsadas || [])
    ]
        .filter((produto) => produto.id && produto.modelo)
        .map((produto) => [String(produto.id).toLowerCase(), produto.modelo])
);

document.querySelectorAll('a[href*="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
        const url = new URL(link.href, window.location.href);
        const isSamePage = url.pathname === window.location.pathname;
        const target = url.hash ? document.querySelector(url.hash) : null;

        if (!isSamePage || !target) {
            return;
        }

        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.history.pushState(null, '', url.hash);
    });
});

if (contactForm) {
    const reasonOptions = [...contactForm.querySelectorAll('.reason-option')];
    const reasonInputs = [...contactForm.querySelectorAll('input[name="motivo"]')];
    const contextBadge = document.querySelector('#contactContextBadge');
    const contextTitle = document.querySelector('#contactContextTitle');
    const contextText = document.querySelector('#contactContextText');
    const contextList = document.querySelector('#contactContextList');
    const dynamicFields = document.querySelector('#contactDynamicFields');
    const interestSelect = document.querySelector('#contactInterestSelect');
    const message = document.querySelector('#contactMessage');
    const submit = document.querySelector('#contactSubmit');
    const contextInput = document.querySelector('#contactContextInput');
    const emailInput = contactForm.querySelector('input[name="email"]');
    const replyToInput = document.querySelector('#contactReplyTo');
    const formStatus = document.querySelector('#contactFormStatus');
    const productInput = document.querySelector('#contactProductInput');
    const productSlugInput = document.querySelector('#contactProductSlugInput');
    const productCategoryInput = document.querySelector('#contactProductCategoryInput');
    const materialInput = document.querySelector('#contactMaterialInput');
    const productUrlInput = document.querySelector('#contactProductUrlInput');
    const sourceInput = document.querySelector('#contactSourceInput');
    const subjectInput = document.querySelector('#contactSubjectInput');
    const whatsappShortcut = document.querySelector('#contactWhatsAppShortcut');
    const phoneInput = contactForm.querySelector('input[name="telefone"]');
    const cnpjInput = contactForm.querySelector('input[name="cnpj"]');

    const configs = {
        'Solicitar proposta técnica': {
            badge: 'Proposta técnica',
            title: 'Conte-nos sobre sua operação',
            text: 'Informe o material processado, produção desejada e condições de operação para indicarmos o equipamento ideal.',
            tips: ['Tipo e volume do material', 'Capacidade esperada por hora', 'Objetivo: triturar, moer ou transportar'],
            options: ['Trituradores', 'Moinhos', 'Esteiras transportadoras', 'Linha completa de reciclagem', 'Ainda não sei qual equipamento'],
            placeholder: 'Exemplo: preciso triturar bombonas plásticas, cerca de 500 kg/h, com alimentação manual e saída para esteira.',
            submit: 'Enviar pedido de proposta',
            fields: [
                { name: 'material_processado', placeholder: 'Material processado' },
                { name: 'capacidade_desejada', placeholder: 'Capacidade desejada por hora' }
            ]
        },
        'Máquinas usadas': {
            badge: 'Máquinas usadas',
            title: 'Vamos encontrar uma máquina revisada para você',
            text: 'Ajude nossa equipe a entender a aplicação, urgência e condição comercial desejada para apresentar equipamentos disponíveis.',
            tips: ['Tipo de equipamento usado desejado', 'Material que será processado', 'Prazo para compra ou visita técnica'],
            options: ['Triturador usado', 'Moinho usado', 'Esteira usada', 'Equipamento revisado disponível', 'Quero receber opções'],
            placeholder: 'Conte qual equipamento usado procura, material de trabalho, faixa de investimento, prazo e se deseja vídeo de funcionamento.',
            submit: 'Consultar máquinas usadas',
            fields: [
                { name: 'equipamento_usado', placeholder: 'Equipamento usado de interesse' },
                { name: 'prazo_compra', placeholder: 'Prazo para compra' }
            ]
        },
        'Comprar peças': {
            badge: 'Peças e reposição',
            title: 'Identifique a peça ou o conjunto necessário',
            text: 'Quanto mais detalhes você enviar, mais rápido conseguimos direcionar facas, peneiras, rolamentos, redutores e componentes.',
            tips: ['Modelo do equipamento', 'Código, foto ou descrição da peça', 'Urgência da reposição'],
            options: ['Facas e contra-facas', 'Peneiras', 'Rolamentos', 'Redutores', 'Motor elétrico', 'Painel elétrico', 'Outras peças'],
            placeholder: 'Descreva a peça, modelo da máquina, medidas, quantidade e se o equipamento é Brutusmaq ou de outra marca.',
            submit: 'Solicitar cotação de peças',
            fields: [
                { name: 'modelo_equipamento', placeholder: 'Modelo do equipamento' },
                { name: 'peca_necessaria', placeholder: 'Peça necessária' }
            ]
        },
        'Assistência técnica': {
            badge: 'Assistência técnica',
            title: 'Explique o suporte necessário',
            text: 'Nossa equipe pode ajudar com manutenção, revisão, diagnóstico, adequação operacional e acompanhamento técnico.',
            tips: ['Modelo e ano do equipamento', 'Sintoma ou serviço necessário', 'Máquina parada ou em operação'],
            options: ['Manutenção preventiva', 'Manutenção corretiva', 'Revisão completa', 'Instalação e start-up', 'Treinamento operacional', 'Visita técnica'],
            placeholder: 'Informe o modelo, problema observado, há quanto tempo ocorre, se a máquina está parada e onde está instalada.',
            submit: 'Solicitar suporte técnico',
            fields: [
                { name: 'status_equipamento', placeholder: 'Status: operando ou parada?' },
                { name: 'tipo_suporte', placeholder: 'Tipo de suporte necessário' }
            ]
        },
        'Dúvida sobre equipamentos': {
            badge: 'Dúvida técnica',
            title: 'Vamos orientar a escolha correta',
            text: 'Use este caminho se ainda está comparando modelos, materiais, capacidades ou aplicações.',
            tips: ['Material ou resíduo de interesse', 'Dúvida principal', 'Objetivo do processo'],
            options: ['Diferença entre triturador e moinho', 'Aplicação por material', 'Capacidade de produção', 'Consumo de energia', 'Instalação e layout', 'Viabilidade do projeto'],
            placeholder: 'Escreva sua dúvida e conte o contexto da operação para respondermos com orientação técnica.',
            submit: 'Enviar dúvida técnica',
            fields: [
                { name: 'duvida_principal', placeholder: 'Qual é sua principal dúvida?' },
                { name: 'material_ou_aplicacao', placeholder: 'Material ou aplicação' }
            ]
        },
        'Outro assunto': {
            badge: 'Atendimento geral',
            title: 'Direcionamos sua mensagem ao setor certo',
            text: 'Use esta opção para parcerias, fornecedores, financeiro, imprensa ou qualquer solicitação fora dos temas técnicos.',
            tips: ['Assunto principal', 'Pessoa ou área desejada', 'Melhor horário para retorno'],
            options: ['Parcerias', 'Fornecedores', 'Financeiro', 'Institucional', 'Visita à fábrica', 'Outro'],
            placeholder: 'Descreva o assunto e informe como nossa equipe pode ajudar.',
            submit: 'Enviar mensagem',
            fields: [
                { name: 'assunto', placeholder: 'Assunto principal' },
                { name: 'melhor_horario', placeholder: 'Melhor horário para retorno' }
            ]
        }
    };

    const renderFields = (fields) => {
        dynamicFields.innerHTML = '';

        fields.forEach((field) => {
            const label = document.createElement('label');
            label.innerHTML = `
                <span>${field.placeholder}</span>
                <input type="text" name="${field.name}" placeholder="${field.placeholder}">
            `;
            dynamicFields.appendChild(label);
        });
    };

    const renderOptions = (options) => {
        interestSelect.innerHTML = '<option value="">Ainda não sei / quero orientação</option>';

        options.forEach((option) => {
            const item = document.createElement('option');
            item.textContent = option;
            item.value = option;
            interestSelect.appendChild(item);
        });
    };

    const setReason = (value) => {
        const config = configs[value] || configs['Solicitar proposta técnica'];

        reasonOptions.forEach((option) => {
            const input = option.querySelector('input[name="motivo"]');
            const isActive = input.value === value;
            option.classList.toggle('active', isActive);
            input.checked = isActive;
        });

        contextBadge.textContent = config.badge;
        contextTitle.textContent = config.title;
        contextText.textContent = config.text;
        contextList.innerHTML = config.tips.map((tip) => `<li>${tip}</li>`).join('');
        message.placeholder = config.placeholder;
        submit.dataset.label = config.submit;
        submit.innerHTML = `${config.submit} <span aria-hidden="true">→</span>`;
        contextInput.value = value;

        renderOptions(config.options);
        renderFields(config.fields);
    };

    const findReasonByKind = (kind) => {
        const lowerKind = String(kind).toLowerCase();

        return reasonInputs.find((input) => {
            const value = input.value.toLowerCase();

            if (lowerKind.includes('usado')) {
                return value.includes('usada') || value.includes('usado');
            }

            if (lowerKind.includes('assist')) {
                return value.includes('assist');
            }

            if (lowerKind.includes('pe')) {
                return value.includes('pe');
            }

            if (lowerKind.includes('duvida') || lowerKind.includes('dúvida')) {
                return value.includes('d') && value.includes('equip');
            }

            return value.includes('proposta');
        })?.value;
    };

    const setReasonByKind = (kind) => {
        const reasonValue = findReasonByKind(kind);

        if (reasonValue) {
            setReason(reasonValue);
        }
    };

    const setFormStatus = (type, messageText) => {
        formStatus.className = `contact-form-status ${type ? `is-${type}` : ''}`.trim();
        formStatus.replaceChildren();

        if (!messageText) {
            return;
        }
        formStatus.append(document.createTextNode(messageText));
    };

    const setSubmitState = (isSubmitting) => {
        submit.disabled = isSubmitting;
        submit.toggleAttribute('aria-busy', isSubmitting);
        submit.innerHTML = isSubmitting
            ? 'Enviando solicitação...'
            : `${submit.dataset.label || 'Enviar solicitação'} <span aria-hidden="true">→</span>`;
    };

    const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

    const formatPhone = (value) => {
        const digits = onlyDigits(value).slice(0, 13);
        const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;

        if (local.length <= 2) return local;
        if (local.length <= 6) return `(${local.slice(0, 2)}) ${local.slice(2)}`;
        if (local.length <= 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
        return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7, 11)}`;
    };

    const formatCnpj = (value) => {
        const digits = onlyDigits(value).slice(0, 14);

        return digits
            .replace(/^(\d{2})(\d)/, '$1.$2')
            .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d)/, '.$1/$2')
            .replace(/(\d{4})(\d)/, '$1-$2');
    };

    const buildWhatsAppMessage = () => {
        const reason = contactForm.querySelector('input[name="motivo"]:checked')?.value || 'Atendimento';
        const name = contactForm.querySelector('input[name="nome"]')?.value.trim();
        const company = contactForm.querySelector('input[name="empresa"]')?.value.trim();
        const interest = interestSelect.value;
        const details = message.value.trim();

        return [
            `Olá, quero falar com a Brutusmaq sobre: ${reason}.`,
            name ? `Meu nome é ${name}${company ? `, da empresa ${company}` : ''}.` : '',
            interest ? `Interesse: ${interest}.` : '',
            details ? `Detalhes: ${details}` : ''
        ].filter(Boolean).join('\n');
    };

    const updateWhatsAppShortcut = () => {
        if (whatsappShortcut) {
            whatsappShortcut.href = `https://wa.me/5541988754003?text=${encodeURIComponent(buildWhatsAppMessage())}`;
        }
    };

    phoneInput?.addEventListener('input', () => {
        phoneInput.value = formatPhone(phoneInput.value);
        phoneInput.setCustomValidity('');
    });

    phoneInput?.addEventListener('blur', () => {
        if (phoneInput.value && onlyDigits(phoneInput.value).length < 10) {
            phoneInput.setCustomValidity('Informe um telefone com DDD.');
        }
    });

    cnpjInput?.addEventListener('input', () => {
        cnpjInput.value = formatCnpj(cnpjInput.value);
    });

    contactForm.addEventListener('input', updateWhatsAppShortcut);
    contactForm.addEventListener('change', updateWhatsAppShortcut);

    const getStoredProposalContext = () => {
        try {
            const stored = window.sessionStorage.getItem('brutusmaq:proposta-contexto');
            window.sessionStorage.removeItem('brutusmaq:proposta-contexto');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            return {};
        }
    };

    const pendingFormAnalyticsKey = 'brutusmaq:analytics:pending-form:v1';

    const getFormAnalyticsContext = () => {
        const analytics = window.BrutusmaqAnalytics;
        const selected = contactForm.querySelector('input[name="motivo"]:checked');
        const context = analytics && typeof analytics.getPageContext === 'function'
            ? analytics.getPageContext()
            : {};
        return {
            ...context,
            channel: 'form',
            formType: selected?.value || 'Contato geral',
            source: sourceInput.value || 'contato.html'
        };
    };

    const trackFormEvent = (type, storedContext) => {
        const analytics = window.BrutusmaqAnalytics;
        if (!analytics || typeof analytics.track !== 'function') return;
        analytics.track(type, {
            ...getFormAnalyticsContext(),
            ...(storedContext || {})
        });
    };

    const savePendingFormAnalyticsContext = () => {
        try {
            window.sessionStorage.setItem(pendingFormAnalyticsKey, JSON.stringify({
                ...getFormAnalyticsContext(),
                createdAt: Date.now()
            }));
        } catch (error) {
            // O envio do formulário continua normalmente se o armazenamento estiver indisponível.
        }
    };

    const consumePendingFormAnalyticsContext = () => {
        try {
            const stored = window.sessionStorage.getItem(pendingFormAnalyticsKey);
            window.sessionStorage.removeItem(pendingFormAnalyticsKey);
            if (!stored) return {};
            const parsed = JSON.parse(stored);
            if (!parsed.createdAt || Date.now() - parsed.createdAt > 3600000) return {};
            delete parsed.createdAt;
            return parsed;
        } catch (error) {
            return {};
        }
    };

    const selectInterestFromCategory = (category) => {
        const normalized = String(category || '').toLowerCase();
        const categoryNames = {
            triturad: 'Trituradores',
            moinho: 'Moinhos',
            esteira: 'Esteiras transportadoras'
        };
        const targetValue = Object.entries(categoryNames).find(([fragment]) => normalized.includes(fragment))?.[1];
        const option = [...interestSelect.options].find((item) => item.value === targetValue);

        if (option) {
            interestSelect.value = option.value;
        }
    };

    const configureUrlContext = () => {
        const params = new URLSearchParams(window.location.search);
        const tipo = params.get('tipo');
        const storedContext = getStoredProposalContext();
        const produto = params.get('produto') || storedContext.produto || '';
        const modeloParam = params.get('modelo') || storedContext.modelo || '';
        const categoriaParam = params.get('categoria') || storedContext.categoria || '';
        const materialParam = params.get('material') || storedContext.material || '';
        const detalhesParam = storedContext.detalhes || '';
        const paginaParam = params.get('pagina') || storedContext.pagina || '';
        const origemParam = params.get('origem') || storedContext.origem || 'Página de contato';
        const hasProductContext = Boolean(produto || modeloParam || paginaParam);

        if (window.location.hash === '#assistencia-tecnica') {
            setReasonByKind('assistencia');
        }

        if (tipo === 'equipamento-usado') {
            setReasonByKind('usado');
        } else if (tipo === 'proposta-tecnica' || hasProductContext) {
            setReasonByKind('proposta');
        }

        if (hasProductContext && message) {
            const productKey = String(produto).toLowerCase();
            const label = modeloParam || contactProductLabels[productKey] || produto.replace(/-/g, ' ').toUpperCase();
            const messageParts = [`Tenho interesse no equipamento ${label}.`];

            if (materialParam) {
                messageParts.push(`Material do projeto: ${materialParam}.`);
            }

            if (detalhesParam) {
                messageParts.push(`Detalhes informados: ${detalhesParam}`);
            }

            message.value = messageParts.join('\n');
            productInput.value = label;
            if (productSlugInput) productSlugInput.value = productKey;
            productCategoryInput.value = categoriaParam;
            materialInput.value = materialParam;
            productUrlInput.value = paginaParam;
            sourceInput.value = origemParam;
            subjectInput.value = `Solicitação de proposta - ${label}`;

            selectInterestFromCategory(categoriaParam);

            const materialField = contactForm.querySelector('input[name="material_processado"]');
            if (materialField && materialParam) {
                materialField.value = materialParam;
            }
        }

        if (params.get('enviado') === '1') {
            trackFormEvent('form_submit_success', consumePendingFormAnalyticsContext());
            setFormStatus('success', 'Solicitação enviada com sucesso. Nossa equipe recebeu os dados e entrará em contato.');
            params.delete('enviado');

            const cleanQuery = params.toString();
            const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}${window.location.hash}`;
            window.history.replaceState(null, '', cleanUrl);
        }
    };

    document.querySelectorAll('[data-contact-reason]').forEach((trigger) => {
        trigger.addEventListener('click', () => {
            setReasonByKind(trigger.dataset.contactReason);
        });
    });

    reasonInputs.forEach((input) => {
        input.addEventListener('change', () => setReason(input.value));
    });

    reasonOptions.forEach((option) => {
        option.addEventListener('click', () => {
            const input = option.querySelector('input[name="motivo"]');
            setReason(input.value);
        });
    });

    const showSubmissionFallback = (reason) => {
        const product = productInput.value || interestSelect.value || 'equipamento industrial';
        const text = [
            `Olá, quero solicitar uma proposta para ${product}.`,
            message.value.trim(),
            `Nome: ${contactForm.querySelector('input[name="nome"]')?.value || ''}`,
            `Telefone: ${contactForm.querySelector('input[name="telefone"]')?.value || ''}`
        ].filter(Boolean).join('\n');
        const subject = `Solicitação de proposta - ${product}`;
        const actions = document.createElement('span');
        actions.className = 'contact-form-status-actions';

        const whatsappLink = document.createElement('a');
        whatsappLink.href = `https://wa.me/5541988754003?text=${encodeURIComponent(text)}`;
        whatsappLink.target = '_blank';
        whatsappLink.rel = 'noopener';
        whatsappLink.textContent = 'Enviar pelo WhatsApp';

        const emailLink = document.createElement('a');
        emailLink.href = `mailto:contato@brutusmaq.com.br?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
        emailLink.textContent = 'Abrir no e-mail';

        actions.append(whatsappLink, emailLink);
        formStatus.className = 'contact-form-status is-error';
        formStatus.replaceChildren(
            document.createTextNode(reason),
            actions
        );
    };

    contactForm.addEventListener('submit', async (event) => {
        if (phoneInput && onlyDigits(phoneInput.value).length < 10) {
            phoneInput.setCustomValidity('Informe um telefone com DDD.');
        }

        if (!contactForm.checkValidity()) {
            event.preventDefault();
            contactForm.reportValidity();
            return;
        }

        replyToInput.value = emailInput.value.trim();
        trackFormEvent('form_submit_attempt');
        event.preventDefault();

        if (!window.fetch || !window.AbortController) {
            trackFormEvent('form_submit_failure');
            showSubmissionFallback('Este navegador não conseguiu enviar o formulário diretamente. Escolha um canal abaixo para concluir.');
            return;
        }

        setSubmitState(true);
        setFormStatus('sending', 'Enviando sua solicitação com segurança...');

        try {
            const formData = Object.fromEntries(new FormData(contactForm).entries());
            const postJson = async (url, timeoutMs) => {
                const controller = new AbortController();
                const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
                try {
                    return await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        credentials: url.startsWith('/') ? 'same-origin' : 'omit',
                        body: JSON.stringify(formData),
                        signal: controller.signal
                    });
                } finally {
                    window.clearTimeout(timeoutId);
                }
            };

            const apiResponse = await postJson('/api/leads', 9000);
            if (!apiResponse.ok) {
                const payload = await apiResponse.json().catch(() => ({}));
                const apiError = new Error(payload.error?.message || 'Não foi possível registrar a solicitação agora.');
                apiError.userFacing = apiResponse.status >= 400 && apiResponse.status < 500;
                throw apiError;
            }

            setFormStatus('success', 'Solicitação registrada com sucesso. Nossa equipe recebeu os dados e entrará em contato.');
            trackFormEvent('form_submit_success');
        } catch (error) {
            trackFormEvent('form_submit_failure');
            const reason = error.userFacing
                ? error.message
                : error.name === 'AbortError'
                ? 'O serviço de e-mail demorou para confirmar o envio. Seus dados continuam preenchidos; escolha um canal abaixo para concluir sem repetir tudo.'
                : 'Não foi possível confirmar o envio por e-mail agora. Seus dados continuam preenchidos; você pode concluir por outro canal.';
            showSubmissionFallback(reason);
        } finally {
            setSubmitState(false);
        }
    });

    window.addEventListener('pageshow', () => {
        setSubmitState(false);
    });

    const selectedReason = contactForm.querySelector('input[name="motivo"]:checked');
    setReason(selectedReason?.value || 'Solicitar proposta técnica');
    configureUrlContext();
    updateWhatsAppShortcut();
}
}());
