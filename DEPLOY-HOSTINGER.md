# Publicação da Brutusmaq na Hostinger

Este projeto agora é uma aplicação Express com frontend estático, API e MySQL. O painel usa login protegido, e produtos, artigos, solicitações e métricas ficam centralizados no banco.

## 1. Plano necessário

A Hostinger informa que aplicações Node.js/Express são aceitas em Business Web Hosting, planos Cloud e VPS. Nos planos gerenciados, use **Websites > Adicionar site > Deploy Web App** e escolha **Importar repositório Git**. Em VPS, o processo, proxy e SSL precisam ser administrados manualmente.

Referências oficiais:

- [Adicionar uma aplicação Node.js](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)
- [Conectar MySQL a uma aplicação Node.js](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/)
- [Configurar variáveis de ambiente](https://www.hostinger.com/support/how-to-add-environment-variables-during-node-js-application-deployment/)

## 2. Antes de enviar ao GitHub

1. Confirme que `.env`, `node_modules/`, logs, `storage/uploads/` e `storage/backups/` continuam ignorados pelo Git.
2. Nunca publique segredos em commits, arquivos HTML/JS ou capturas de tela.
3. Execute localmente:

```powershell
npm install
npm run assets:version -- AAAAMMDD
npm run check
npm test
npm audit --omit=dev
```

## 3. Criar o MySQL

No hPanel, abra **Databases > MySQL Databases** e crie banco, usuário e senha forte. Guarde exatamente os nomes completos exibidos pela Hostinger. Em hospedagem gerenciada, o host normalmente é `localhost` e a porta é `3306`.

## 4. Criar segredos

Execute o comando abaixo quatro vezes e guarde cada resultado separadamente:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Use um resultado diferente para `SESSION_SECRET`, `ANALYTICS_SECRET`, `MFA_ENCRYPTION_KEY` e `BACKUP_ENCRYPTION_KEY`. Não reutilize a senha do banco e mantenha uma cópia offline da chave de backup: sem ela, o arquivo `.bmaq` não pode ser restaurado.

## 5. Variáveis de produção

Cadastre no hPanel, sem aspas:

```dotenv
NODE_ENV=production
BASE_URL=https://www.brutusmaq.com.br
TRUST_PROXY=1

DB_HOST=localhost
DB_PORT=3306
DB_NAME=NOME_COMPLETO_DO_BANCO
DB_USER=USUARIO_COMPLETO_DO_BANCO
DB_PASSWORD=SENHA_FORTE_DO_BANCO
DB_CONNECTION_LIMIT=10
DB_SSL=false

SESSION_SECRET=SEGREDO_ALEATORIO_1
ANALYTICS_SECRET=SEGREDO_ALEATORIO_2
MFA_ENCRYPTION_KEY=SEGREDO_ALEATORIO_3
BACKUP_ENCRYPTION_KEY=SEGREDO_ALEATORIO_4
REQUIRE_ADMIN_MFA=true
SESSION_HOURS=8

ADMIN_NAME=Administrador Brutusmaq
ADMIN_EMAIL=SEU_EMAIL_ADMINISTRATIVO
ADMIN_PASSWORD=SENHA_ADMINISTRATIVA_COM_12_OU_MAIS_CARACTERES
ADMIN_ROLE=owner

SMTP_HOST=SERVIDOR_SMTP
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=USUARIO_SMTP
SMTP_PASSWORD=SENHA_SMTP
SMTP_FROM=Site Brutusmaq <contato@brutusmaq.com.br>
CONTACT_TO=contato@brutusmaq.com.br

UPLOAD_DIR=/home/USUARIO/domains/DOMINIO/storage/uploads
BACKUP_DIR=/home/USUARIO/domains/DOMINIO/storage/backups
MAX_UPLOAD_MB=8
ALLOWED_ORIGINS=https://brutusmaq.com.br,https://www.brutusmaq.com.br
```

Crie as pastas indicadas em `UPLOAD_DIR` e `BACKUP_DIR` fora da pasta de build `nodejs` e confirme pelo File Manager que a aplicação tem permissão de escrita. Isso evita perder imagens e backups em uma republicação. O caminho exato deve ser adaptado ao usuário e domínio mostrados no hPanel.

## 6. Primeiro deploy

Use estas configurações na aplicação Node.js:

- Framework: **Express.js**
- Versão Node.js: **24.x** ou **22.x**
- Instalação: `npm install`
- Build inicial: `npm run db:setup`
- Start: `npm start`
- Entry file, caso seja solicitado: `server/index.js`
- Output directory: deixe vazio para a aplicação Express

Em hospedagem gerenciada, a Hostinger mantém os arquivos de aplicações Express em `/home/USUARIO/domains/DOMINIO/nodejs` e cria o encaminhamento em `public_html/.htaccess`. Se um redeploy retornar HTTP 403, faça um novo deploy para regenerar esse arquivo antes de alterá-lo manualmente.

### Perfis do painel

- `owner`: administrador principal; gerencia equipe, pedidos de acesso, métricas e aprova publicações. Crie este perfil apenas pelo seed ou pelo comando administrativo.
- `editor`: funcionário editorial; cadastra e altera produtos e artigos, mas tudo segue para aprovação do `owner`.
- `viewer`: acesso somente para consulta, sem permissão para alterar conteúdo ou administrar pessoas.

Na tela de login, uma pessoa pode solicitar acesso, mas a conta só é criada depois que o `owner` aprova o pedido em **Equipe e acessos**. O convite é enviado por e-mail quando o SMTP está configurado; caso contrário, o painel exibe um link de ativação de uso único.

O build inicial cria as tabelas, o primeiro administrador e carrega o catálogo e os artigos-base somente se as tabelas estiverem vazias.

Depois que o primeiro deploy concluir, altere o comando de build para `npm run build`. Ele executa apenas migrações futuras. Nesse momento, `ADMIN_PASSWORD` pode ser removida das variáveis de ambiente.

## 7. Conferência após publicar

1. Abra `/api/health` e confirme `status: "ok"` e `database: true`.
2. Abra `/painel-admin.html` e entre com `ADMIN_EMAIL` e `ADMIN_PASSWORD`.
3. Em **Segurança**, ative o MFA com um aplicativo autenticador e guarde os códigos de recuperação fora do computador.
4. Saia e entre novamente para conferir senha + segundo fator.
5. Em **Equipe e acessos**, convide um e-mail de teste. Confirme o recebimento do convite e crie a senha pelo link temporário.
6. Entre como funcionário, envie um produto ou artigo para análise e confirme que ele ainda não aparece no site público.
7. Volte como proprietário, abra a **Caixa de análise**, aprove o envio e confirme que a publicação passou a aparecer no site.
8. Teste também **Solicitar ajustes** e confira se a observação volta para o rascunho do funcionário.
9. Envie o formulário de contato e confirme a entrada em **Solicitações** e o recebimento por e-mail.
10. Aceite as métricas no aviso de privacidade, abra um produto, clique no WhatsApp e confira o dashboard.
11. Envie uma imagem e confirme que ela continua acessível depois de um redeploy.
12. Abra `/robots.txt`, `/sitemap.xml` e uma URL inexistente.

Se houver conteúdo antigo no `localStorage`, o painel exibirá **Migrar para o banco**. Revise um backup antes de usar essa ação, pois ela substitui o conteúdo central correspondente.

## 8. Backups e teste de restauração

Valide o esquema e gere um backup criptografado:

```powershell
npm run db:verify
npm run db:backup
```

Agende `npm run db:backup` diariamente e copie os arquivos `.bmaq` para um segundo local protegido. O backup da Hostinger deve continuar ativo; ele é uma camada adicional. A pasta `UPLOAD_DIR` precisa de backup separado, pois as imagens não ficam dentro do MySQL.

Teste a restauração primeiro em um banco vazio de homologação:

```powershell
$env:RESTORE_CONFIRM="RESTAURAR-BRUTUSMAQ"
npm run db:restore -- storage/backups/ARQUIVO.bmaq
```

A restauração substitui os dados do banco escolhido e invalida todas as sessões administrativas. As submissões editoriais entram no backup, mas convites pendentes são invalidados por segurança e precisam ser reenviados. Nunca execute a restauração no banco de produção sem conferir `DB_HOST`, `DB_NAME` e a existência de outro backup válido.

## 9. Rotina de segurança e monitoramento

- Ative SSL e redirecionamento HTTPS no domínio.
- Use uma conta administrativa individual, senha exclusiva e MFA sempre ativo.
- Monitore `/api/health` a cada 5 minutos e alerte quando houver HTTP diferente de 200.
- Revise os eventos da aba **Segurança** e os logs JSON do runtime.
- Faça backup diário do MySQL e de `UPLOAD_DIR`, com cópia fora da hospedagem.
- Confira alertas de vulnerabilidade da Hostinger e rode `npm audit` antes de cada publicação.
- Mantenha todos os segredos, banco e SMTP apenas no hPanel.
- Acompanhe envios de formulário, falhas de e-mail, uso de disco e validade do SSL.
- Rode `npm run assets:optimize` quando adicionar imagens pesadas e revise visualmente os arquivos gerados.
- Antes de cada release, atualize a versão dos CSS/JS com `npm run assets:version -- AAAAMMDD` para evitar mistura de arquivos antigos no cache.
