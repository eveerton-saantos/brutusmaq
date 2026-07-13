const contactForm = document.querySelector('.contact-form');
const contactWhatsappNumber = '5541988754003';
const contactProductLabels = {};

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

    const configs = {
        'Solicitar proposta técnica': {
            badge: 'Proposta técnica',
            title: 'Conte-nos sobre sua operação',
            text: 'Informe o material processado, produção desejada e condições de operação para indicarmos o equipamento ideal.',
            tips: ['Tipo e volume do material', 'Capacidade esperada por hora', 'Objetivo: triturar, moer, picar ou transportar'],
            options: ['Trituradores', 'Moinhos', 'Picadores', 'Esteiras transportadoras', 'Linha completa de reciclagem', 'Ainda não sei qual equipamento'],
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
            options: ['Triturador usado', 'Moinho usado', 'Picador usado', 'Esteira usada', 'Equipamento revisado disponível', 'Quero receber opções'],
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
        interestSelect.innerHTML = '<option value="">Selecione uma opção</option>';

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

    const getFormLines = () => {
        const formData = new FormData(contactForm);
        const labels = {
            motivo: 'Motivo',
            nome: 'Nome',
            email: 'E-mail',
            telefone: 'Telefone/WhatsApp',
            empresa: 'Empresa',
            cnpj: 'CNPJ',
            cidade_estado: 'Cidade/Estado',
            interesse: 'Interesse',
            mensagem: 'Mensagem',
            contexto_do_atendimento: 'Contexto',
            material_processado: 'Material processado',
            capacidade_desejada: 'Capacidade desejada',
            equipamento_usado: 'Equipamento usado',
            prazo_compra: 'Prazo para compra',
            modelo_equipamento: 'Modelo do equipamento',
            peca_necessaria: 'Peça necessária',
            status_equipamento: 'Status do equipamento',
            tipo_suporte: 'Tipo de suporte',
            duvida_principal: 'Dúvida principal',
            material_ou_aplicacao: 'Material ou aplicação',
            assunto: 'Assunto',
            melhor_horario: 'Melhor horário'
        };

        return [...formData.entries()]
            .filter(([, value]) => String(value).trim())
            .map(([key, value]) => `${labels[key] || key}: ${String(value).trim()}`);
    };

    const configureUrlContext = () => {
        const params = new URLSearchParams(window.location.search);
        const tipo = params.get('tipo');
        const produto = params.get('produto');

        if (window.location.hash === '#assistencia-tecnica') {
            setReasonByKind('assistencia');
        }

        if (tipo === 'equipamento-usado' || produto) {
            setReasonByKind('usado');
        }

        if (produto && message) {
            const label = contactProductLabels[produto] || produto.replace(/-/g, ' ').toUpperCase();
            message.value = `Tenho interesse no ${label}.`;
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

    contactForm.addEventListener('submit', (event) => {
        event.preventDefault();

        if (!contactForm.checkValidity()) {
            contactForm.reportValidity();
            return;
        }

        const text = [
            'Olá, gostaria de atendimento da Brutusmaq.',
            '',
            ...getFormLines()
        ].join('\n');
        const url = `https://wa.me/${contactWhatsappNumber}?text=${encodeURIComponent(text)}`;

        window.open(url, '_blank', 'noopener');
    });

    const selectedReason = contactForm.querySelector('input[name="motivo"]:checked');
    setReason(selectedReason?.value || 'Solicitar proposta técnica');
    configureUrlContext();
}
