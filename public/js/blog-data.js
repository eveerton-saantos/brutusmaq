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

window.BRUTUS_BLOG_ARTICLES = [];
