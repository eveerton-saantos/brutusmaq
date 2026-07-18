/*
Ao cadastrar um equipamento novo, use `imagemPrincipal` para definir a imagem
de capa do produto. Ela tambem participa automaticamente do destaque rotativo
da pagina de equipamentos. Prefira PNG ou WebP recortado e otimizado.

Galeria recomendada: 5 imagens (principal, duas vistas externas, um detalhe
tecnico e uma foto real em operacao). O minimo seguro e 3 imagens diferentes.
A pagina aceita menos imagens sem quebrar e nao repete arquivos duplicados.

Campos opcionais da ficha: `sobreTitulo`, `sobre` (lista de paragrafos),
`beneficios` (ate 4 itens), `aplicacoes`, `materiais`, `destaques`,
`notaTecnica`, `youtubeId` e `downloads`.
*/
window.brutusmaqProdutosNovos = [
    {
        id: "tr-700",
        modelo: "TR-700",
        categoriaSlug: "trituradores",
        categoria: "Triturador de Duplo Eixo",
        linha: "Trituradores",
        descricao: "Equipamento robusto e eficiente para trituracao de diversos materiais, com alta produtividade, baixo consumo energetico e manutencao simplificada.",
        resumo: "Triturador compacto para demandas industriais de alta exigencia.",
        aplicacao: "Reducao de volume",
        garantia: "12 meses",
        fabricacao: "100% nacional",
        imagemPrincipal: "assets/main/tr-700.webp",
        imagem: "assets/main/tr-700.webp",
        alt: "Triturador industrial TR-700 Brutusmaq",
        tipoImagem: "ilustrativa",
        // Use tipoImagem: "real", "ilustrativa" ou "mista".
        // Se preferir texto livre, use observacaoImagens: "Texto que aparece abaixo da galeria."
        galeria: [
            { src: "assets/main/tr-700.webp", alt: "Vista principal do triturador TR-700 Brutusmaq" },
            { src: "assets/main/tr-700.webp", alt: "Vista lateral do triturador TR-700 Brutusmaq" },
            { src: "assets/main/tr-700.webp", alt: "Conjunto mecanico do triturador TR-700 Brutusmaq" },
            { src: "assets/main/tr-700.webp", alt: "Detalhe construtivo do triturador TR-700 Brutusmaq" },
            { src: "assets/main/tr-700.webp", alt: "Detalhe das facas do triturador TR-700 Brutusmaq" }
        ],
        youtubeBusca: "Brutusmaq TR-700 funcionando",
        // Quando tiver o vídeo real, use youtubeId: "ID_DO_VIDEO" ou youtubeEmbed: "https://www.youtube-nocookie.com/embed/ID_DO_VIDEO"
        // Downloads aparecem somente quando cadastrados:
        // downloads: {
        //     catalogoTecnico: "assets/downloads/tr-700/catalogo-tecnico.pdf",
        //     manualOperacao: "assets/downloads/tr-700/manual-operacao.pdf",
        //     desenhoTecnico: "assets/downloads/tr-700/desenho-tecnico.pdf",
        //     certificadoNr12: "assets/downloads/tr-700/certificado-nr12.pdf"
        // },
        specs: [
            ["Modelo", "TR-700"],
            ["Tipo", "Triturador de Duplo Eixo"],
            ["Boca de alimentacao", "700 x 600 mm"],
            ["Comprimento da caixa", "700 mm"],
            ["Diametro do rotor", "350 mm"],
            ["Quantidade de facas", "20 unidades"],
            ["Potencia instalada", "2 x 30 CV"],
            ["Rotacao", "24 - 36 RPM"],
            ["Producao aproximada", "1 a 3 t/h*"],
            ["Peso aproximado", "1.800 kg"],
            ["Dimensoes (C x L x A)", "2.000 x 1.450 x 1.750 mm"],
            ["Tensao", "220 / 380 / 440 V"],
            ["Sistema de reversao", "Automatica"]
        ],
        recursos: [
            "Alta resistencia e durabilidade",
            "Facas em aco especial de alta liga",
            "Redutores de alto desempenho",
            "Sistema de reversao automatica",
            "Ideal para materiais industriais e reciclaveis"
        ]
    },
    {
        id: "tr-800",
        modelo: "TR-800",
        categoriaSlug: "trituradores",
        categoria: "Triturador de Duplo Eixo",
        linha: "Trituradores",
        descricao: "Triturador de duplo eixo para operacoes que precisam de maior produtividade com estrutura reforcada e configuracao conforme material.",
        resumo: "Alta produtividade para processamento continuo.",
        aplicacao: "Reducao de volume",
        garantia: "12 meses",
        fabricacao: "100% nacional",
        imagem: "assets/main/tr-700.webp",
        alt: "Triturador industrial TR-800 Brutusmaq",
        specs: [
            ["Modelo", "TR-800"],
            ["Tipo", "Triturador de Duplo Eixo"],
            ["Boca de alimentacao", "800 x 700 mm"],
            ["Potencia instalada", "Conforme projeto"],
            ["Sistema de reversao", "Automatica"]
        ],
        recursos: [
            "Alta produtividade",
            "Eixos macicos usinados",
            "Facas intercambiaveis",
            "Manutencao facilitada"
        ]
    },
    {
        id: "tr-1000",
        modelo: "TR-1000",
        categoriaSlug: "trituradores",
        categoria: "Triturador de Duplo Eixo",
        linha: "Trituradores",
        descricao: "Modelo robusto para grandes volumes de material, indicado para plantas industriais e recicladoras de maior capacidade.",
        resumo: "Robustez para grandes volumes.",
        aplicacao: "Reducao de volume",
        garantia: "12 meses",
        fabricacao: "100% nacional",
        imagem: "assets/main/tr-700.webp",
        alt: "Triturador industrial TR-1000 Brutusmaq",
        specs: [
            ["Modelo", "TR-1000"],
            ["Tipo", "Triturador de Duplo Eixo"],
            ["Boca de alimentacao", "1.000 x 800 mm"],
            ["Potencia instalada", "Conforme projeto"],
            ["Sistema de reversao", "Automatica"]
        ],
        recursos: [
            "Estrutura reforcada",
            "Alto torque",
            "Protecoes integradas",
            "Configuracao sob demanda"
        ]
    },
    {
        id: "tr-1100",
        modelo: "TR-1100",
        categoriaSlug: "trituradores",
        categoria: "Triturador de Duplo Eixo",
        linha: "Trituradores",
        descricao: "Triturador de duplo eixo para operacoes que precisam de maior produtividade com estrutura reforcada e configuracao conforme material.",
        resumo: "Alta produtividade para processamento continuo.",
        aplicacao: "Reducao de volume",
        garantia: "12 meses",
        fabricacao: "100% nacional",
        imagem: "assets/main/tr-700.webp",
        alt: "Triturador industrial TR-1100 Brutusmaq",
        specs: [
            ["Modelo", "TR-1100"],
            ["Tipo", "Triturador de Duplo Eixo"],
            ["Boca de alimentacao", "1.100 x 800 mm"],
            ["Potencia instalada", "Conforme projeto"],
            ["Sistema de reversao", "Automatica"]
        ],
        recursos: [
            "Alta produtividade",
            "Eixos macicos usinados",
            "Facas intercambiaveis",
            "Manutencao facilitada"
        ]
    },{
        id: "tr-1500",
        modelo: "TR-1500",
        categoriaSlug: "trituradores",
        categoria: "Triturador de Duplo Eixo",
        linha: "Trituradores",
        descricao: "Triturador de duplo eixo para operacoes que precisam de maior produtividade com estrutura reforcada e configuracao conforme material.",
        resumo: "Alta produtividade para processamento continuo.",
        aplicacao: "Reducao de volume",
        garantia: "12 meses",
        fabricacao: "100% nacional",
        imagem: "assets/main/tr-700.webp",
        alt: "Triturador industrial TR-1500 Brutusmaq",
        specs: [
            ["Modelo", "TR-1500"],
            ["Tipo", "Triturador de Duplo Eixo"],
            ["Boca de alimentacao", "1.500 x 800 mm"],
            ["Potencia instalada", "Conforme projeto"],
            ["Sistema de reversao", "Automatica"]
        ],
        recursos: [
            "Alta produtividade",
            "Eixos macicos usinados",
            "Facas intercambiaveis",
            "Manutencao facilitada"
        ]
    },{
        id: "tr-2000",
        modelo: "TR-2000",
        categoriaSlug: "trituradores",
        categoria: "Triturador de Duplo Eixo",
        linha: "Trituradores",
        descricao: "Triturador de duplo eixo para operacoes que precisam de maior produtividade com estrutura reforcada e configuracao conforme material.",
        resumo: "Alta produtividade para processamento continuo.",
        aplicacao: "Reducao de volume",
        garantia: "12 meses",
        fabricacao: "100% nacional",
        imagem: "assets/main/tr-700.webp",
        alt: "Triturador industrial TR-2000 Brutusmaq",
        specs: [
            ["Modelo", "TR-2000"],
            ["Tipo", "Triturador de Duplo Eixo"],
            ["Boca de alimentacao", "2.000 x 800 mm"],
            ["Potencia instalada", "Conforme projeto"],
            ["Sistema de reversao", "Automatica"]
        ],
        recursos: [
            "Alta produtividade",
            "Eixos macicos usinados",
            "Facas intercambiaveis",
            "Manutencao facilitada"
        ]
    },
    {
        id: "m-600",
        modelo: "M-600",
        categoriaSlug: "moinhos",
        categoria: "Moinho Martelo",
        linha: "Moinhos",
        descricao: "Moinho industrial para moagem eficiente e granulometria controlada em diferentes materiais.",
        resumo: "Moagem eficiente para uso industrial.",
        aplicacao: "Moagem",
        garantia: "12 meses",
        fabricacao: "100% nacional",
        imagem: "assets/main/tr-700.webp",
        alt: "Moinho industrial M-600 Brutusmaq",
        specs: [
            ["Modelo", "M-600"],
            ["Tipo", "Moinho Martelo"],
            ["Aplicacao", "Moagem industrial"],
            ["Potencia instalada", "Conforme projeto"]
        ],
        recursos: [
            "Granulometria controlada",
            "Baixa manutencao",
            "Estrutura industrial",
            "Projeto conforme aplicacao"
        ]
    }
];

window.brutusmaqMaquinasUsadas = [
    /*
    Cadastre maquinas usadas neste formato:
    {
        id: "slug-da-maquina-usada",
        modelo: "Nome do modelo",
        // A categoria e livre: prensa, enfardadeira, peneira, separador etc.
        // categoriaSlug e opcional; o filtro cria um identificador automaticamente.
        categoriaSlug: "trituradores",
        categoria: "Triturador industrial",
        statusSlug: "disponivel",
        status: "Disponivel",
        statusClasse: "status-disponivel",
        imagem: "assets/main/nome-da-imagem.png",
        alt: "Descricao da imagem da maquina usada",
        ano: "2022",
        condicao: "Revisado e testado",
        garantia: "Garantia Brutusmaq",
        localizacao: "Contenda - PR, Brasil",
        especificacoes: ["Motor: informar", "Boca: informar", "Horas de uso: informar se houver"],
        specs: [
            ["Modelo", "Nome do modelo"],
            ["Condicao", "Revisado e testado"],
            ["Horas de uso", "Informar se houver"]
        ],
        oQueAcompanha: [
            "Item que sera entregue com a maquina",
            "Outro componente ou acessorio incluso"
        ],
        avaliacaoTecnica: [
            "Componente inspecionado e resultado real",
            "Teste realizado ou manutencao ainda necessaria"
        ],
        informacoesComerciais: [
            ["Preco", "Consultar valor"],
            ["Disponibilidade", "Sujeita a confirmacao"],
            ["Prazo de entrega", "A combinar"],
            ["Condicoes de pagamento", "Conforme proposta"],
            ["Transporte", "A combinar"]
        ],
        descricao: "Descricao real da maquina usada.",
        youtubeBusca: "Brutusmaq nome do equipamento usado funcionando",
        url: "maquina-usada.html?id=slug-da-maquina-usada",
        cta: "Ver detalhes"
    }
    */
    // Produtos de demonstracao: substitua pelos dados reais antes da publicacao.
    {
        id: "tr-700-usado-demo",
        modelo: "TR-700",
        categoriaSlug: "trituradores-industriais",
        categoria: "Triturador industrial",
        statusSlug: "disponivel",
        status: "Disponível",
        statusClasse: "status-disponivel",
        imagemPrincipal: "assets/main/tr-700.webp",
        imagem: "assets/main/tr-700.webp",
        alt: "Triturador industrial TR-700 usado - imagem demonstrativa",
        ano: "2021",
        condicao: "Revisado e testado",
        garantia: "Condições sob consulta",
        localizacao: "Contenda - PR, Brasil",
        especificacoes: [
            "Potência: 2 x 30 CV",
            "Boca: 700 x 600 mm",
            "Condição: revisado e testado"
        ],
        oQueAcompanha: [
            "Triturador com base de sustentação",
            "Motores e redutores instalados",
            "Painel elétrico",
            "Conjunto de facas instalado"
        ],
        avaliacaoTecnica: [
            "Estrutura e base avaliadas",
            "Eixos, facas e rolamentos verificados",
            "Motores e redutores testados",
            "Teste operacional realizado"
        ],
        informacoesComerciais: [
            ["Preço", "Consultar valor"],
            ["Disponibilidade", "Sujeita à confirmação"],
            ["Prazo de entrega", "A combinar"],
            ["Condições de pagamento", "Conforme proposta"],
            ["Máquina na troca", "Sob avaliação"],
            ["Transporte", "A combinar"]
        ],
        observacaoImagens: "Imagem demonstrativa. Solicite fotos e vídeo atualizados desta unidade.",
        specs: [
            ["Modelo", "TR-700"],
            ["Categoria", "Triturador industrial"],
            ["Condição", "Revisado e testado"],
            ["Potência instalada", "2 x 30 CV"],
            ["Boca de alimentação", "700 x 600 mm"],
            ["Localização", "Contenda - PR"],
            ["Disponibilidade", "Sujeita à confirmação"]
        ],
        descricao: "Unidade usada de demonstração para visualizar o catálogo, a ficha técnica e o fluxo de contato da página de máquinas usadas.",
        youtubeBusca: "Brutusmaq TR-700 funcionando",
        url: "maquina-usada.html?id=tr-700-usado-demo",
        cta: "Ver detalhes"
    },
    {
        id: "tr-800-usado-demo",
        modelo: "TR-800",
        categoriaSlug: "trituradores-industriais",
        categoria: "Triturador industrial",
        statusSlug: "revisao",
        status: "Em revisão",
        statusClasse: "status-revisao",
        imagemPrincipal: "assets/main/tr-800-disp-mobile.webp",
        imagem: "assets/main/tr-800-disp-mobile.webp",
        alt: "Triturador industrial TR-800 usado - imagem demonstrativa",
        ano: "2020",
        condicao: "Em revisão técnica",
        garantia: "Definida após a revisão",
        localizacao: "Contenda - PR, Brasil",
        especificacoes: [
            "Potência: conforme configuração",
            "Boca: 800 x 700 mm",
            "Condição: em revisão técnica"
        ],
        oQueAcompanha: [
            "Triturador com estrutura principal",
            "Conjunto de acionamento instalado",
            "Componentes confirmados após a revisão"
        ],
        avaliacaoTecnica: [
            "Inspeção estrutural em andamento",
            "Conjunto de corte em avaliação",
            "Acionamento e painel serão testados",
            "Relatório final disponível após a revisão"
        ],
        informacoesComerciais: [
            ["Preço", "Definido após a revisão"],
            ["Disponibilidade", "Após conclusão da revisão"],
            ["Prazo de entrega", "A confirmar"],
            ["Condições de pagamento", "Conforme proposta"],
            ["Máquina na troca", "Sob avaliação"],
            ["Transporte", "A combinar"]
        ],
        observacaoImagens: "Imagem demonstrativa. As fotos reais serão atualizadas após a conclusão da revisão.",
        specs: [
            ["Modelo", "TR-800"],
            ["Categoria", "Triturador industrial"],
            ["Condição", "Em revisão técnica"],
            ["Potência instalada", "Conforme configuração"],
            ["Boca de alimentação", "800 x 700 mm"],
            ["Localização", "Contenda - PR"],
            ["Disponibilidade", "Após conclusão da revisão"]
        ],
        descricao: "Unidade usada de demonstração em processo de revisão, criada para validar estados, filtros e apresentação da página de detalhes.",
        youtubeBusca: "Brutusmaq TR-800 funcionando",
        url: "maquina-usada.html?id=tr-800-usado-demo",
        cta: "Ver detalhes"
    }
];
