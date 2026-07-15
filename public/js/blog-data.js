/*
    Para publicar um artigo no Blog:
    1. Copie o modelo abaixo.
    2. Cole dentro do array BRUTUS_BLOG_ARTICLES.
    3. Troque os textos pelo artigo pronto.

    Modelo:

    {
        slug: "meu-artigo",
        category: "Guia técnico",
        title: "Título do artigo",
        accentFrom: "parte do título que fica laranja",
        excerpt: "Resumo curto que aparece no card e no topo do artigo.",
        date: "10 de Julho de 2026",
        datetime: "2026-07-10",
        reading: "5 min de leitura",
        author: "Equipe Brutusmaq",
        image: "assets/main/tr-700.png",
        imageAlt: "Descrição da imagem",
        cardClass: "blog-media-machine",
        popular: true,
        sections: [
            {
                title: "1. Primeiro tópico",
                paragraphs: [
                    "Primeiro parágrafo do seu artigo.",
                    "Segundo parágrafo do seu artigo."
                ]
            },
            {
                title: "2. Segundo tópico",
                paragraphs: [
                    "Continue o conteúdo aqui."
                ]
            }
        ],
        benefits: [
            ["▱", "Benefício", "Descrição curta do benefício."]
        ],
        applications: [
            ["▣", "Aplicação", "Descrição curta da aplicação."]
        ],
        checks: [
            "Ponto positivo do artigo"
        ],
        highlight: "Frase final em destaque."
    }
*/

window.BRUTUS_BLOG_ARTICLES = [
    {
        slug: "como-escolher-triturador-industrial",
        category: "Guia técnico",
        title: "Como escolher um triturador industrial para sua operação",
        accentFrom: "triturador industrial",
        excerpt: "Material, granulometria, capacidade e rotina de trabalho: veja os pontos que devem orientar uma escolha técnica mais segura.",
        date: "14 de Julho de 2026",
        datetime: "2026-07-14",
        reading: "6 min de leitura",
        author: "Equipe Brutusmaq",
        image: "assets/main/tr-700.png",
        imageAlt: "Triturador industrial TR-700 Brutusmaq",
        cardClass: "blog-media-machine",
        popular: true,
        intro: [
            "Escolher um triturador industrial exige mais do que comparar potência e dimensões. O equipamento precisa estar alinhado ao material, ao volume processado, ao resultado esperado e à estrutura disponível na operação.",
            "Um levantamento técnico bem feito reduz adaptações futuras, melhora o aproveitamento do equipamento e ajuda a construir um processo mais previsível."
        ],
        sections: [
            {
                title: "1. Comece pelo material",
                paragraphs: [
                    "Composição, densidade, umidade, formato e presença de contaminantes influenciam diretamente o sistema de corte e a alimentação. Amostras e testes ajudam a representar a condição real de trabalho.",
                    "Também é importante definir a granulometria desejada na saída, pois ela orienta a configuração do conjunto e as etapas que virão depois da trituração."
                ]
            },
            {
                title: "2. Dimensione capacidade e alimentação",
                paragraphs: [
                    "A capacidade deve considerar picos, constância do fluxo e tempo efetivo de operação. Avaliar apenas uma média diária pode esconder gargalos na alimentação ou na retirada do material processado.",
                    "Esteiras, silos, separadores e equipamentos posteriores precisam conversar com o triturador para que a linha funcione como um sistema único."
                ]
            },
            {
                title: "3. Considere manutenção e suporte",
                paragraphs: [
                    "Acesso aos componentes, disponibilidade de peças e orientação técnica fazem diferença ao longo da vida útil. Uma boa escolha também considera como serão realizadas inspeções e intervenções preventivas."
                ]
            }
        ],
        benefits: [
            ["01", "Processo adequado", "Equipamento alinhado ao material e ao resultado esperado."],
            ["02", "Fluxo equilibrado", "Capacidade compatível com as etapas anteriores e posteriores."],
            ["03", "Maior previsibilidade", "Planejamento de operação, suporte e manutenção desde o início."]
        ],
        checks: [
            "Caracterize o material e suas variações.",
            "Defina capacidade, regime de trabalho e granulometria de saída.",
            "Avalie alimentação, descarga, segurança e espaço disponível.",
            "Considere assistência técnica e disponibilidade de componentes."
        ],
        highlight: "O melhor equipamento é aquele dimensionado para o processo completo, e não apenas para uma etapa isolada."
    },
    {
        slug: "manutencao-preventiva-equipamentos-industriais",
        category: "Manutenção",
        title: "Manutenção preventiva: como proteger disponibilidade e desempenho",
        accentFrom: "disponibilidade e desempenho",
        excerpt: "Uma rotina organizada de inspeções ajuda a antecipar desgastes, planejar intervenções e reduzir paradas inesperadas.",
        date: "10 de Julho de 2026",
        datetime: "2026-07-10",
        reading: "5 min de leitura",
        author: "Equipe Brutusmaq",
        image: "assets/main/manutencao.svg",
        imageAlt: "Ilustração técnica sobre manutenção industrial",
        cardClass: "blog-media-maintenance",
        popular: true,
        intro: [
            "Manutenção preventiva é uma estratégia de continuidade operacional. Quando inspeções, registros e intervenções seguem uma rotina, a equipe ganha tempo para agir antes que pequenos sinais se transformem em falhas maiores.",
            "O plano deve respeitar o manual do fabricante, a intensidade de uso e as condições reais do ambiente."
        ],
        sections: [
            {
                title: "1. Transforme inspeções em rotina",
                paragraphs: [
                    "Ruídos, vibrações, aquecimento, folgas e mudanças de rendimento podem indicar alterações no funcionamento. Registrar essas observações permite comparar comportamentos ao longo do tempo.",
                    "A periodicidade deve ser ajustada ao regime de trabalho, ao tipo de material e às recomendações técnicas do equipamento."
                ]
            },
            {
                title: "2. Planeje peças e janelas de parada",
                paragraphs: [
                    "Componentes de desgaste e itens críticos precisam de acompanhamento. Um estoque definido com base no histórico da máquina evita tanto a falta de peças quanto compras sem prioridade.",
                    "Intervenções programadas também facilitam a organização de equipe, ferramentas e tempo de produção."
                ]
            },
            {
                title: "3. Segurança vem antes da intervenção",
                paragraphs: [
                    "Toda atividade deve ser executada por profissionais qualificados, com a máquina parada, isolada e seguindo os procedimentos de segurança e as orientações do fabricante."
                ]
            }
        ],
        benefits: [
            ["01", "Antecipação", "Sinais de desgaste identificados antes de uma falha crítica."],
            ["02", "Planejamento", "Paradas organizadas com equipe, peças e tempo definidos."],
            ["03", "Histórico", "Decisões apoiadas por registros reais da operação."]
        ],
        checks: [
            "Crie uma lista de inspeção compatível com o equipamento.",
            "Registre ocorrências, ajustes e substituições.",
            "Siga os intervalos e procedimentos indicados pelo fabricante.",
            "Nunca realize intervenções sem isolamento e qualificação adequados."
        ],
        highlight: "Prevenção não elimina todas as paradas, mas torna a manutenção muito mais previsível e organizada."
    },
    {
        slug: "trituracao-e-economia-circular",
        category: "Sustentabilidade",
        title: "Trituração e economia circular: preparando materiais para um novo ciclo",
        accentFrom: "economia circular",
        excerpt: "Entenda como a redução de tamanho pode apoiar separação, transporte e reaproveitamento de materiais em diferentes cadeias.",
        date: "4 de Julho de 2026",
        datetime: "2026-07-04",
        reading: "6 min de leitura",
        author: "Equipe Brutusmaq",
        image: "assets/main/sustentabilidade.svg",
        imageAlt: "Ilustração sobre sustentabilidade e processamento de materiais",
        cardClass: "blog-media-plastic",
        popular: true,
        intro: [
            "A economia circular busca manter materiais em uso pelo maior tempo possível. Nesse contexto, a trituração pode preparar resíduos e excedentes para etapas como separação, classificação, transporte e transformação.",
            "O resultado depende de uma cadeia bem planejada: reduzir o tamanho é uma etapa importante, mas precisa estar conectada ao destino e aos requisitos do material processado."
        ],
        sections: [
            {
                title: "1. Por que reduzir o tamanho",
                paragraphs: [
                    "Materiais volumosos podem ocupar espaço, dificultar movimentação e limitar processos posteriores. A redução controlada ajuda a padronizar o fluxo e pode facilitar o manuseio.",
                    "A granulometria necessária varia conforme a aplicação, por isso o destino final deve ser conhecido antes de definir o processo."
                ]
            },
            {
                title: "2. Integração com separação e logística",
                paragraphs: [
                    "Separação prévia, controle de contaminantes e transporte adequado influenciam a qualidade do material. Quando essas etapas são integradas, a operação tende a ganhar consistência.",
                    "A análise também deve considerar armazenamento, segurança e capacidade dos equipamentos conectados à linha."
                ]
            },
            {
                title: "3. Planeje a aplicação do material",
                paragraphs: [
                    "Conhecer os requisitos de quem receberá ou reutilizará o material evita produzir uma fração sem destino definido. O processo deve nascer a partir de uma aplicação técnica e economicamente viável."
                ]
            }
        ],
        applications: [
            ["01", "Preparação", "Redução de volume para facilitar etapas posteriores."],
            ["02", "Classificação", "Fluxo mais compatível com sistemas de separação."],
            ["03", "Reaproveitamento", "Material preparado de acordo com uma aplicação definida."]
        ],
        checks: [
            "Mapeie composição, contaminação e variações do material.",
            "Defina o destino e a granulometria antes de dimensionar a linha.",
            "Considere todas as etapas, da recepção à expedição."
        ],
        highlight: "Circularidade começa com um destino claro e um processo capaz de entregar o material nas condições necessárias."
    },
    {
        slug: "como-melhorar-performance-linha-processamento",
        category: "Performance",
        title: "Performance industrial: quatro pontos para observar na linha completa",
        accentFrom: "quatro pontos",
        excerpt: "Produtividade não depende apenas da máquina principal. Alimentação, fluxo, operação e saída precisam trabalhar em equilíbrio.",
        date: "28 de Junho de 2026",
        datetime: "2026-06-28",
        reading: "5 min de leitura",
        author: "Equipe Brutusmaq",
        image: "assets/main/tecnologia.svg",
        imageAlt: "Ilustração sobre tecnologia e desempenho industrial",
        cardClass: "blog-media-conveyor",
        popular: false,
        intro: [
            "Uma linha de processamento entrega resultados quando seus elementos trabalham de forma coordenada. A máquina principal pode ter capacidade disponível e, ainda assim, produzir abaixo do esperado por limitações na alimentação, na descarga ou na rotina operacional.",
            "Observar o processo completo ajuda a localizar o gargalo real antes de investir em mudanças."
        ],
        sections: [
            {
                title: "1. Regularidade da alimentação",
                paragraphs: [
                    "Variações bruscas de volume e material podem reduzir a estabilidade. Sistemas de alimentação e uma preparação adequada ajudam a manter um fluxo mais consistente."
                ]
            },
            {
                title: "2. Capacidade das etapas seguintes",
                paragraphs: [
                    "Esteiras, separadores, moinhos e áreas de armazenamento precisam absorver o material produzido. Uma restrição depois da máquina principal pode limitar toda a linha."
                ]
            },
            {
                title: "3. Parâmetros e rotina operacional",
                paragraphs: [
                    "Procedimentos claros, equipe treinada e parâmetros compatíveis com o material reduzem variações entre turnos. Indicadores simples ajudam a comparar produção, paradas e qualidade de saída."
                ]
            },
            {
                title: "4. Condição do equipamento",
                paragraphs: [
                    "Desgaste, ajustes inadequados e manutenção atrasada podem alterar o rendimento. A avaliação de performance deve sempre considerar o estado técnico do conjunto."
                ]
            }
        ],
        benefits: [
            ["01", "Visão sistêmica", "Gargalos avaliados em toda a linha, e não isoladamente."],
            ["02", "Indicadores úteis", "Dados de produção e parada transformados em referência."],
            ["03", "Ajustes direcionados", "Mudanças priorizadas a partir da causa observada."]
        ],
        checks: [
            "Meça produção, tempo efetivo e motivos de parada.",
            "Observe a constância da alimentação e da descarga.",
            "Compare os resultados por material e condição de operação.",
            "Valide ajustes com a equipe técnica responsável."
        ],
        highlight: "Antes de buscar mais capacidade, descubra qual etapa está definindo o ritmo real da operação."
    }
];
