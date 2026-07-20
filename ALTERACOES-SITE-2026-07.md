# Atualizacao do site Brutusmaq - julho de 2026

## Visao geral

Esta atualizacao moderniza a experiencia visual e funcional do site Brutusmaq em desktop, tablet e mobile. O trabalho concentrou-se em padronizar o cabecalho, tornar o catalogo escalavel, melhorar as paginas de equipamentos novos e usados e corrigir o fluxo de solicitacao de propostas.

## Principais alteracoes

### Painel administrativo e catalogo local

- Painel conectado a uma camada unica de dados compartilhada com as paginas publicas.
- Cadastro, edicao, rascunho, revisao, publicacao e exclusao de produtos funcionando no navegador.
- Exclusao protegida por confirmacao e acompanhada de uma acao persistente para desfazer.
- Produtos em rascunho, revisao ou marcados como ocultos nao aparecem no site publico.
- Imagens locais validadas por formato e tamanho antes do armazenamento.
- Importacao e exportacao de backups em JSON com validacao e limpeza de conteudo inseguro.
- Restauracao do catalogo-base disponivel no proprio painel.
- IDs duplicados bloqueados no salvamento e na importacao.
- Registro incorreto `SHESHE` corrigido para `TR-700` e tres copias duplicadas removidas.

O armazenamento atual utiliza `localStorage`, portanto as alteracoes valem para o navegador e a origem em que foram feitas. Para administrar o catalogo globalmente depois do deploy, ainda sera necessario conectar `public/js/catalogo-store.js` a um banco/API com autenticacao no servidor. Nao deve ser adicionada uma senha diretamente ao JavaScript publico.

Arquivos principais: `public/painel-admin.html`, `public/css/admin.css`, `public/js/admin.js`, `public/js/catalogo-store.js` e `public/js/catalogo-produtos.js`.

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
- Hero principal passou a utilizar `brutusmaq-index-background.png`, com enquadramento responsivo e carregamento prioritario.
- Botoes e blocos informativos adaptados para telas menores.
- Menu de equipamentos da pagina inicial transformado no modelo que depois foi compartilhado pelas demais paginas.
- Footer piloto simplificado exclusivamente na home, priorizando marca, navegacao essencial e contato.
- Telefone, e-mail, mapa, WhatsApp, redes sociais e links legais foram mantidos com menor densidade visual.
- Horarios e opcoes secundarias foram direcionados para a pagina de contato, reduzindo a carga de leitura no rodape.
- O modelo enxuto foi compartilhado entre todas as paginas publicas por meio da classe `site-footer`.
- O CTA do WhatsApp foi retirado do rodape; o numero foi mantido ao lado do telefone fixo como opcao natural de contato.
- Header institucional aplicado em todas as paginas, com altura reduzida, navegacao mais limpa, CTA solido e menu mobile em painel independente.
- Mega menu recebeu acabamento mais sobrio e alinhado as faixas escuras do site, sem alterar seu conteudo dinamico.

Arquivos principais: `public/index.html`, `public/css/home.css`, `public/assets/imagens-fundo/brutusmaq-index-background.png` e `public/assets/imagens-fundo/fundo-pagina-index.png`.

### Pagina de equipamentos

- Redesign completo seguindo o padrao visual atual da Brutusmaq.
- Novo hero com chamadas de acao, diferenciais e imagem do equipamento.
- Atalhos de categorias reorganizados para permanecerem em linha e legiveis no desktop e tablet.
- Categorias transformadas em controles interativos que expandem a propria pagina.
- Produtos exibidos inicialmente em quantidade reduzida, com botao para mostrar ou recolher os demais.
- Comportamento aplicado a trituradores, moinhos, esteiras e equipamentos usados.
- Cards mobile convertidos para um formato horizontal mais compacto.
- Espacamentos e imagem de fundo do mobile ajustados para reduzir areas vazias.
- Altura fixa residual do hero mobile removida para aproximar os diferenciais da barra de categorias.

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
- Hero passou a utilizar `maquinas-usadas-brutusmaq-background.png`, com enquadramento responsivo e sem duplicar a antiga imagem demonstrativa do equipamento.

Arquivos principais: `public/usadas.html`, `public/css/usadas.css` e `public/js/usadas.js`.

### Pagina do blog

- Hero passou a utilizar `blog-brutusmaq-background.png`, substituindo a imagem generica de equipamento.
- Enquadramento foi ajustado para desktop, tablet e celular, mantendo o texto sobre a area escura da composicao.
- Imagem recebeu carregamento prioritario e passou a representar a pagina nos metadados de compartilhamento.
- Artigos, categorias, sidebar, newsletter e demais estruturas da pagina foram preservados.

Arquivos principais: `public/blog.html` e `public/css/blog.css`.

### Pagina individual de artigo

- Redesign completo alinhado a pagina Sobre Nos e as demais fichas atuais do site.
- Hero escuro passou a exibir a capa real do artigo, titulo, categoria, resumo, autoria, data e tempo de leitura.
- Conteudo recebeu faixa clara com largura confortavel, hierarquia editorial e blocos dinamicos para beneficios, aplicacoes e pontos importantes.
- Indice lateral e automatico permite navegar entre os topicos do artigo e destaca a secao atual durante a leitura.
- Barra fixa indica o progresso da leitura.
- Compartilhamento real por WhatsApp, LinkedIn e e-mail, alem de copia do link e impressao do artigo.
- Navegacao para artigos anterior e seguinte, relacionados por categoria e CTA tecnico ao final da pagina.
- Metadados sociais, canonical e JSON-LD Article sao atualizados conforme o artigo carregado.
- Slugs inexistentes agora encaminham o visitante para a pagina 404 personalizada.
- Layout foi validado em desktop e mobile sem rolagem horizontal.

Arquivos principais: `public/artigo-blog.html`, `public/css/blog-article.css` e `public/js/blog-article.js`.

### Pagina de erro 404

- Criacao de uma pagina de recuperacao no padrao visual Brutusmaq, com hero fotografico da fabrica e contraste responsivo.
- Acoes para voltar ao inicio, retornar a pagina anterior e pesquisar diretamente no conteudo tecnico.
- Atalhos para equipamentos, maquinas usadas, blog e contato reduzem becos sem saida na navegacao.
- Erros originados por um artigo exibem mensagem contextual e botao direto para voltar ao Blog.
- Uso de `base href="/"` mantem imagens, estilos e links funcionando quando o endereco invalido esta em uma rota aninhada.
- Pagina marcada com `noindex, follow`, preservando a navegacao sem indexar o erro.

Arquivos principais: `public/404.html`, `public/css/error-page.css` e `public/js/error-page.js`.

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
- Hero passou a utilizar `contato-brutusmaq-background.png`, com enquadramento responsivo e carregamento prioritario.
- A area da imagem com telefones desatualizados recebeu uma camada escura; a imagem social anterior foi mantida para nao divulgar contatos incorretos.

Arquivos principais: `public/contato.html`, `public/css/contact-page.css` e `public/js/contact-page.js`.

## Identidade visual e assets

Foram adicionadas familias de icones em tres variacoes:

- `public/assets/icones-brancos/`: 18 arquivos.
- `public/assets/icones-laranjas/`: 19 arquivos.
- `public/assets/icones-verdes/`: 6 arquivos.

Os novos assets cobrem categorias de equipamentos, atendimento, proposta, seguranca, garantia, avaliacao, desempenho, sustentabilidade e canais de contato.

## Destaque dinamico de equipamentos novos

- O cadastro de produtos novos aceita `imagemPrincipal` como imagem de capa.
- Imagens principais distintas participam automaticamente do hero da pagina de equipamentos.
- A selecao evita repetir o mesmo produto em duas visitas consecutivas.
- Apenas a imagem escolhida para o hero e carregada com prioridade; imagens dos cards usam carregamento tardio.
- `imagem` continua funcionando como compatibilidade para cadastros existentes.
- A TR-700 permanece como fallback caso nenhuma imagem principal valida esteja cadastrada.
- Equipamentos usados continuam acessiveis, mas nao participam do destaque rotativo.

Arquivos principais: `public/equipamentos.html`, `public/css/equipamentos.css`, `public/js/equipamentos.js`, `public/js/catalogo-produtos.js` e `public/js/produto.js`.

## Catalogo de equipamentos usados

- Pagina redesenhada com hero institucional, catalogo claro e leitura mais objetiva.
- Filtro de ano removido para simplificar a pesquisa.
- Categorias, modelos e condicoes sao criados automaticamente a partir do estoque cadastrado.
- O filtro de modelos se adapta a categoria selecionada.
- O cadastro aceita categorias de usados que nao existem nas linhas de equipamentos novos.
- Busca ampliada para modelo, categoria, aplicacao, ano, condicao, localizacao e especificacoes.
- Equipamentos disponiveis aparecem antes de itens em revisao ou vendidos.
- Cards usam carregamento tardio de imagens e mostram ate tres informacoes principais.
- Dados estruturados do catalogo sao sincronizados com os equipamentos cadastrados.
- Textos comerciais passaram a distinguir avaliacao, revisao, garantia e entrega conforme cada negociacao.
- Duas fichas demonstrativas foram cadastradas para validar cards e paginas individuais: TR-700 disponivel e TR-800 em revisao.
- Botao do hero recebeu rolagem suave ate o estoque, com compensacao do cabecalho fixo.
- Diferenciais do hero receberam contraste reforcado para leitura sobre o fundo escuro.
- Cards de equipamentos usados foram reduzidos para quatro colunas no desktop, com adaptacao responsiva.

Arquivos principais: `public/usadas.html`, `public/css/usadas.css`, `public/js/usadas.js` e `public/js/catalogo-produtos.js`.

## Pagina individual de maquina usada

- Ficha redesenhada com a mesma alternancia de faixas escuras e claras do institucional.
- Hero passou a exibir condicao real, imagem do cadastro, resumo tecnico e chamadas para proposta e video.
- Breadcrumb deixou de depender de uma categoria fixa de equipamentos novos.
- Itens inclusos, avaliacao tecnica e informacoes comerciais agora sao dinamicos por maquina.
- Galeria aceita imagens diferentes e esconde miniaturas vazias, sem repetir a mesma foto quatro vezes.
- Imagem principal e carregada diretamente do produto, sem baixar primeiro um placeholder incorreto.
- Ausencia de video real gera um estado honesto de video sob solicitacao.
- Proposta leva o contexto completo do equipamento para o formulario de contato.
- Metadados sociais, canonical e JSON-LD Product sao atualizados conforme a maquina acessada.
- Promessas fixas de revisao, disponibilidade e garantia foram substituidas pelas condicoes do cadastro.
- Botoes diretos de WhatsApp passaram a informar equipamento, categoria, condicao e link da ficha consultada.
- Solicitacoes de video pelo WhatsApp tambem incluem o link da maquina usada.
- Resumo de ano, condicao, garantia e localizacao foi removido do hero em telas mobile.
- Imagem principal da galeria foi mantida ampla no mobile; somente as miniaturas selecionaveis foram reduzidas e organizadas em faixa horizontal.
- Ano deixou de aparecer nas especificacoes tecnicas, mesmo quando for incluido por engano em `specs`.
- Cadastro passou a documentar `oQueAcompanha`, `avaliacaoTecnica` e `informacoesComerciais`, mantendo compatibilidade com os campos anteriores.
- Acoes de proposta e video foram movidas para baixo da imagem do equipamento no mobile, permanecendo junto ao resumo no desktop.

Arquivos principais: `public/maquina-usada.html`, `public/css/maquina-usada.css`, `public/js/maquina-usada.js` e `public/js/catalogo-produtos.js`.

## Pagina individual de equipamento novo

- Ficha redesenhada com hero escuro, leitura tecnica clara, area operacional escura e CTA final em laranja.
- Largura principal padronizada em 1240 px, seguindo a pagina institucional.
- Galeria passou a aceitar de uma a cinco imagens sem repetir o mesmo arquivo para preencher espaco.
- Recomendacao de cadastro definida em cinco imagens, com minimo seguro de tres imagens diferentes.
- Conteudo sobre o equipamento, beneficios, aplicacoes, materiais, destaques e nota tecnica aceita campos dinamicos por produto.
- Textos fixos de triturador foram removidos das areas compartilhadas por moinhos e esteiras.
- Ausencia de video real agora exibe um estado de video sob solicitacao, sem incorporar resultados externos do YouTube.
- Metadados sociais, canonical e JSON-LD Product sao atualizados conforme o produto acessado.
- Produtos relacionados duplicados sao eliminados antes da exibicao.
- Fluxos de proposta, WhatsApp, downloads e navegacao da galeria foram preservados.
- Selecao de materiais ampliada com familias industriais e opcao de orientacao para quem ainda nao sabe classificar o material.
- Botoes diretos de WhatsApp agora enviam modelo, categoria e link do equipamento novo consultado.
- Solicitacoes de proposta pelo WhatsApp incluem o contexto e a pagina de origem.
- Diferenciais tecnicos reorganizados em grade 2 x 2 no mobile, com tipografia e divisorias adaptadas para telas estreitas.
- Espacamentos verticais da ficha de produto novo foram reduzidos no mobile sem remover o respiro entre secoes.

Arquivos principais: `public/produto.html`, `public/css/product-page.css`, `public/js/produto.js` e `public/js/catalogo-produtos.js`.

## Politica de Privacidade

- Pagina redesenhada com a mesma linguagem institucional da pagina Sobre Nos: hero fotografico, alternancia entre blocos escuros e claros e destaque em laranja.
- Quatro compromissos de privacidade passaram a resumir os pontos essenciais antes do texto completo.
- Indice lateral com ancoras permite acessar rapidamente coleta, uso, compartilhamento, cookies, seguranca, direitos e contato.
- Conteudo juridico deixou o grande card escuro e passou a usar largura de leitura confortavel, divisorias discretas e contraste alto.
- Encerramento comercial foi substituido por acoes coerentes com a pagina: solicitar atendimento sobre dados ou consultar os Termos de Uso.
- Data de atualizacao visual e metadado estruturado foram alinhados para 14 de julho de 2026.
- Layout responsivo reorganiza compromissos, indice, texto e acoes sem ocultar informacoes legais.
- Hero passou a utilizar `lgpd-brutusmaq-background.png`, com enquadramento especifico para desktop, tablet e celular e carregamento prioritario.

Arquivos principais: `public/politica-de-privacidade.html` e `public/css/politica.css`.

## Termos e Condicoes de Uso

- Pagina alinhada ao redesign institucional da Politica de Privacidade e da pagina Sobre Nos.
- Quatro condicoes essenciais resumem o carater informativo do site, a necessidade de validacao tecnica, a formalizacao de propostas e o uso responsavel.
- Indice lateral com ancoras facilita o acesso a informacoes tecnicas, propostas, usados, uso permitido, propriedade intelectual, responsabilidades, privacidade e contato.
- Os 13 topicos juridicos foram preservados em uma composicao clara, sem o antigo card escuro e com largura confortavel de leitura.
- CTA final passou a oferecer contato para esclarecimentos e acesso direto a Politica de Privacidade.
- Data de atualizacao visual e metadado estruturado foram alinhados para 15 de julho de 2026.
- Layout responsivo segue o mesmo comportamento da pagina de privacidade em desktop, tablet e mobile.
- Hero passou a utilizar `tcu-brutusmaq-background.png`, com enquadramento especifico para desktop, tablet e celular e carregamento prioritario.

Arquivos principais: `public/termos-de-uso.html` e `public/css/termos.css`.

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
- `public/404.html`
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

## Painel administrativo interno

- Criacao de `public/painel-admin.html` como base visual da futura administracao em nuvem.
- Dashboard com indicadores de catalogo, pendencias de cadastro, atividade recente e checklist de publicacao.
- Area de produtos com busca, filtros por tipo e status, listagem de equipamentos novos e usados e acesso ao fluxo de edicao.
- Formulario de produto com identificacao, categoria, imagem principal, galeria, conteudo comercial, ficha tecnica, disponibilidade e dados especificos para maquinas usadas.
- Area editorial do blog com busca, filtros por categoria e status, resumo no dashboard e controle dos artigos existentes.
- Editor de artigos com titulo, slug automatico, categoria, autor, resumo, capa, texto alternativo, introducao, secoes dinamicas, beneficios, aplicacoes, destaques e tempo de leitura automatico.
- Fluxo editorial com rascunho, revisao, publicacao, visibilidade publica, destaque entre populares e acesso direto ao artigo publicado.
- Acoes de duplicacao, exclusao com confirmacao, desfazer exclusao, importacao, exportacao e restauracao dos artigos-base.
- Artigos publicados e visiveis sao carregados pela listagem e pela pagina individual; rascunhos, itens em revisao e artigos ocultos permanecem fora do site publico.
- Produtos e artigos agora possuem persistencia local compartilhada por `localStorage`, com validacao e normalizacao dos dados antes de salvar.
- Navegacao responsiva e interacoes locais para avaliar o fluxo antes da integracao com API e banco de dados.
- Pagina mantida fora da navegacao publica e marcada com `noindex`, `nofollow` e `noarchive`.
- Nesta etapa nao existe autenticacao, autorizacao, banco compartilhado ou upload de midia no servidor. Os dados ficam restritos ao navegador atual; a protecao e a publicacao global deverao ser implementadas no backend antes de expor o painel em producao.

Arquivos principais: `public/painel-admin.html`, `public/css/admin.css`, `public/js/admin.js`, `public/js/admin-blog.js`, `public/js/catalogo-store.js`, `public/js/blog-store.js`, `public/blog.html` e `public/artigo-blog.html`.

## Dashboard de desempenho

- Criacao da area `Desempenho` como primeira visao do painel, antes de `Visao geral`.
- Indicadores para visualizacoes de equipamentos, cliques em proposta, contatos por WhatsApp atribuidos a produtos, formularios confirmados e leituras de artigos.
- Filtros para hoje, 7 dias, 30 dias, 12 meses e todo o historico, com comparacao ao periodo anterior quando aplicavel.
- Grafico de tendencia para procura, contatos e artigos, funil comercial e rankings de equipamentos e artigos.
- Motivos dos formularios confirmados e saude da coleta com eventos, sessoes anonimas, acessos 404 e falhas de envio.
- Coleta anonima adicionada aos 12 arquivos publicos e carregada tambem pelo painel interno, totalizando 13 HTML. Nenhum nome, e-mail, telefone, mensagem ou endereco IP e salvo nas metricas.
- Eventos mantidos por ate 400 dias, com limite de 15.000 registros locais e identificador de sessao anonimo.
- O formulario registra tentativa, sucesso somente apos confirmacao do servico e falha de envio. O fallback tradicional preserva apenas o contexto tecnico do produto por ate uma hora.
- Exportacao em JSON e limpeza completa do historico com confirmacao.
- Atualizacao automatica do painel quando outra aba da mesma origem registra uma interacao.
- A coleta atual usa `localStorage` e, portanto, mostra somente as interacoes feitas nesta origem e neste navegador. Para reunir visitantes reais em producao sera necessario enviar os eventos para uma API protegida, com autenticacao do painel e armazenamento central.

Arquivos principais: `public/painel-admin.html`, `public/css/admin-analytics.css`, `public/js/analytics-store.js`, `public/js/admin-analytics.js`, `public/js/admin.js` e `public/js/contact-page.js`.

## Validacoes executadas

- Verificacao de sintaxe dos arquivos JavaScript com `node --check`.
- Verificacao de integridade do diff com `git diff --check`.
- Conferencia de IDs usados entre HTML e JavaScript.
- Conferencia de existencia dos novos assets.
- Verificacao de chaves CSS e JavaScript balanceadas.
- Verificacao de codificacao UTF-8 e acentuacao.
- Teste do fluxo editorial no navegador: cadastro, publicacao, pagina individual, retorno a rascunho, duplicacao, exclusao, desfazer e restauracao dos artigos-base.
- Teste da busca de artigos, contadores do dashboard e ausencia de erros no console das paginas administrativa e publica.
- Teste das metricas com equipamento novo e usado, proposta, WhatsApp, leitura e compartilhamento de artigo e acesso 404.
- Teste da atualizacao automatica entre abas, filtros de periodo, ranking, funil, grafico e limpeza confirmada do historico.
- Inspecao responsiva do dashboard em desktop e 375 px, incluindo menu lateral e ausencia de estouro horizontal.
- Inspecao visual da pagina individual de artigo e da pagina 404 em desktop e mobile.
- Teste do indice, progresso de leitura, compartilhamento, artigos relacionados, CTA final e redirecionamento de artigo inexistente.
- Conferencia dos metadados sociais, canonical e JSON-LD Article preenchidos dinamicamente.

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
