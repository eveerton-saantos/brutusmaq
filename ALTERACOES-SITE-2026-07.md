# Atualizacao do site Brutusmaq - julho de 2026

## Visao geral

Esta atualizacao moderniza a experiencia visual e funcional do site Brutusmaq em desktop, tablet e mobile. O trabalho concentrou-se em padronizar o cabecalho, tornar o catalogo escalavel, melhorar as paginas de equipamentos novos e usados e corrigir o fluxo de solicitacao de propostas.

## Principais alteracoes

### Cabecalho e navegacao

- Cabecalho ampliado e padronizado em todas as paginas do site.
- Tipografia, logotipo, espacamentos e botao de proposta ajustados para melhorar a leitura.
- Novo menu de equipamentos no desktop e tablet, sem imagens pesadas e com organizacao por categoria.
- Limite de modelos exibidos no menu para evitar listas excessivamente longas.
- Links para visualizar a linha completa quando uma categoria possui muitos produtos.
- Menu mobile com controles de expandir e recolher identificados por indicadores visuais.
- Comportamento responsivo revisado para impedir que nomes de categorias sejam cortados ou sobrepostos.

Arquivos principais: `public/css/header.css`, `public/js/header.js` e os arquivos HTML das paginas publicas.

### Botoes e icones do WhatsApp

- Inclusao do icone oficial do WhatsApp nos botoes de contato do site.
- Variantes branca e verde aplicadas de acordo com o contraste de cada secao.
- Textos e alinhamentos dos botoes ajustados para desktop e mobile.

Assets principais: `public/assets/icones-brancos/icone-whatsapp-branco.svg` e `public/assets/icones-verdes/icone-whatsapp-verde.svg`.

### Pagina inicial

- Cabecalho revisado para melhor legibilidade em todas as resolucoes.
- Hero e chamadas de acao reorganizados.
- Aplicacao de nova imagem de fundo e ajustes de contraste.
- Botoes e blocos informativos adaptados para telas menores.
- Menu de equipamentos da pagina inicial transformado no modelo que depois foi compartilhado pelas demais paginas.

Arquivos principais: `public/index.html`, `public/css/home.css` e `public/assets/imagens-fundo/fundo-pagina-index.png`.

### Pagina de equipamentos

- Redesign completo seguindo o padrao visual atual da Brutusmaq.
- Novo hero com chamadas de acao, diferenciais e imagem do equipamento.
- Atalhos de categorias reorganizados para permanecerem em linha e legiveis no desktop e tablet.
- Categorias transformadas em controles interativos que expandem a propria pagina.
- Produtos exibidos inicialmente em quantidade reduzida, com botao para mostrar ou recolher os demais.
- Comportamento aplicado a trituradores, moinhos, picadores, esteiras e equipamentos usados.
- Cards mobile convertidos para um formato horizontal mais compacto.
- Espacamentos e imagem de fundo do mobile ajustados para reduzir areas vazias.

Arquivos principais: `public/equipamentos.html`, `public/css/equipamentos.css` e `public/js/equipamentos.js`.

### Catalogo de produtos

- Dados dos equipamentos centralizados em `public/js/catalogo-produtos.js`.
- Paginas e menus passaram a consumir o mesmo catalogo para reduzir divergencias.
- Estrutura preparada para inclusao de novos modelos por categoria.
- Listagens e menus limitam a quantidade inicial de itens sem exigir novas paginas para cada categoria.

### Pagina de produto

- Botoes de proposta passaram a abrir um modal com o equipamento atual preenchido.
- Inclusao de material do projeto e detalhes tecnicos antes do contato.
- Opcao de continuar pelo WhatsApp sem sair da pagina.
- Opcao de continuar por e-mail levando modelo, categoria, material, detalhes e URL do equipamento.
- Contexto completo armazenado temporariamente durante a navegacao entre produto e contato.
- Icones de fabricacao, assistencia, garantia, desempenho, manutencao, robustez e seguranca padronizados.

Arquivos principais: `public/produto.html`, `public/css/product-page.css` e `public/js/produto.js`.

### Pagina de maquinas usadas

- Redesign completo da pagina em desktop, tablet e mobile.
- Novo hero com imagem real, chamadas de acao e diferenciais comerciais.
- Faixa de beneficios e processo de compra reorganizados.
- Filtros de busca, categoria, modelo, ano e status preservados e modernizados.
- Filtro de ano gerado automaticamente a partir do ano atual.
- Modelos duplicados removidos das opcoes do filtro.
- Contador de resultados adicionado.
- Estado sem estoque transformado em uma chamada util para atendimento comercial.
- Grade com quatro colunas no desktop, duas no tablet e cards horizontais compactos no mobile.

Arquivos principais: `public/usadas.html`, `public/css/usadas.css` e `public/js/usadas.js`.

### Solicitacao de proposta e contato

- Formulario deixou de receber o visitante sem contexto ao sair da pagina de produto.
- Campos ocultos passaram a registrar equipamento, categoria, material, origem e URL da pagina.
- Assunto do e-mail identifica automaticamente o modelo solicitado.
- Envio realizado por AJAX pelo FormSubmit, sem redirecionar o visitante para outra pagina.
- CAPTCHA visual desativado para evitar interrupcoes e expiracao durante o envio.
- Honeypot mantido como protecao complementar contra spam.
- Timeout de 15 segundos impede que o botao permaneca travado indefinidamente.
- Em caso de falha, os dados permanecem preenchidos e sao oferecidos atalhos para WhatsApp e cliente de e-mail.
- Mensagens de envio, sucesso e erro possuem retorno acessivel por `aria-live`.

Arquivos principais: `public/contato.html`, `public/css/contact-page.css` e `public/js/contact-page.js`.

## Identidade visual e assets

Foram adicionadas familias de icones em tres variacoes:

- `public/assets/icones-brancos/`: 18 arquivos.
- `public/assets/icones-laranjas/`: 19 arquivos.
- `public/assets/icones-verdes/`: 6 arquivos.

Os novos assets cobrem categorias de equipamentos, atendimento, proposta, seguranca, garantia, avaliacao, desempenho, sustentabilidade e canais de contato.

## Paginas atualizadas

- `public/index.html`
- `public/equipamentos.html`
- `public/produto.html`
- `public/usadas.html`
- `public/maquina-usada.html`
- `public/contato.html`
- `public/sobre-nos.html`
- `public/blog.html`
- `public/artigo-blog.html`
- `public/politica-de-privacidade.html`
- `public/termos-de-uso.html`

## Privacidade e operacao

- A Politica de Privacidade registra o FormSubmit como operador tecnico do envio por e-mail.
- O formulario envia apenas os dados necessarios ao atendimento solicitado.
- O FormSubmit pode manter uma copia temporaria das submissoes por ate 30 dias.
- A desativacao do CAPTCHA melhora a experiencia, mas torna importante acompanhar o volume de spam recebido.
- Um banco de dados proprio ainda nao foi criado. Essa evolucao exigira backend, autenticacao e definicao de hospedagem.

## Publicacao na Vercel

- Remocao da configuracao legada que encaminhava todas as requisicoes para `public/index.html`.
- Definicao de `public` como diretorio de saida do site estatico.
- CSS, JavaScript, imagens, SVGs e paginas HTML passam a ser entregues com seus caminhos e tipos de conteudo corretos.
- O projeto usa o preset `Other`, sem comando de build e sem framework.

## Validacoes executadas

- Verificacao de sintaxe dos arquivos JavaScript com `node --check`.
- Verificacao de integridade do diff com `git diff --check`.
- Conferencia de IDs usados entre HTML e JavaScript.
- Conferencia de existencia dos novos assets.
- Verificacao de chaves CSS e JavaScript balanceadas.
- Verificacao de codificacao UTF-8 e acentuacao.

Nao foi disparada uma proposta real durante os testes para evitar o envio de uma solicitacao falsa ao e-mail comercial. A visualizacao automatizada de arquivos locais tambem foi limitada pela politica de seguranca do navegador do ambiente.

## Checklist antes da publicacao

- Confirmar visualmente as paginas em um ambiente web ou de homologacao.
- Enviar uma proposta real de teste com dados controlados e confirmar o recebimento em `contato@brutusmaq.com.br`.
- Confirmar que o endereco do FormSubmit esta ativado.
- Verificar a caixa de spam apos o primeiro envio.
- Revisar os produtos cadastrados em `public/js/catalogo-produtos.js`.
- Manter somente a exclusao local de `.gitignore` fora desta entrega.
- Validar o Preview da Vercel antes de promover o pull request para producao.

## Resumo para pull request

**Titulo sugerido:** `Atualiza design responsivo, catalogo e fluxo de propostas`

Esta entrega moderniza as principais paginas do site, unifica o cabecalho e o menu de equipamentos, melhora a navegacao responsiva, reorganiza as listagens de equipamentos e conecta a pagina de produto ao formulario de proposta com envio assincrono e alternativas de contato em caso de falha.
