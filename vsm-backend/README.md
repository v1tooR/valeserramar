# API do Vila Serra e Mar

A API usa Node.js e PostgreSQL. O aplicativo chama a API por HTTPS. A senha do
banco fica na configuração do serviço. As tabelas estão no schema privado
`vsm`, no PostgreSQL apontado por `DATABASE_URL`. A API gerencia a autenticação.

## Instalação na VPS

1. Use uma VPS com Docker Engine e Docker Compose v2. Confira com `docker version`
   e `docker compose version`. Se a VPS já hospeda outro serviço nas portas 80/443,
   use o proxy existente para encaminhar para a API em vez de iniciar outro Caddy.
   Guia de instalação para Ubuntu: https://docs.docker.com/engine/install/ubuntu/
2. Configure um registro DNS A do subdomínio da API com o IPv4 da VPS. Permita
   TCP 80 e 443 no firewall para o Caddy obter o certificado HTTPS. A porta da API
   fica interna ao Docker nesta configuração.
3. Copie esta pasta para a VPS. Crie o arquivo de configuração na VPS com
   `umask 077` e `cp .env.example .env`. Preencha `PUBLIC_URL` e `API_DOMAIN`
   com o mesmo host. Use `WEB_ORIGINS` somente se usar a versão web e informe as
   origens permitidas separadas por vírgula.
4. Se você usa Supabase, abra **Connect** e copie a string **Session pooler**
   para `DATABASE_URL` quando a conexão da VPS exigir IPv4. Substitua a senha no
   painel/arquivo da VPS. Codifique caracteres especiais no trecho da senha
   da URL. Use um projeto dedicado e confira a conta do banco que será usada para
   criar o schema. O backend exige TLS verificado em produção. Se a conexão
   exigir a CA fornecida pelo Supabase, faça o download no painel e preencha
   `DATABASE_CA_BASE64` com o conteúdo de `base64 -w0 certificado.crt`.
   Documentação: https://supabase.com/docs/guides/database/connecting-to-postgres
5. Execute na pasta do projeto:

   ```bash
   docker compose build
   docker compose run --rm --no-deps api node src/migrate.js
   docker compose up -d
   docker compose logs --tail=60 api proxy
   curl --fail https://api.seudominio.com.br/health
   ```

   O último comando deve responder `{"status":"ok"}`. Troque o domínio pelo real.
   Faça backup do PostgreSQL e do volume de mídia. O volume é necessário para
   preservar fotos. Não execute `docker compose down -v` para atualizar.

## Conectar o aplicativo

Defina apenas `EXPO_PUBLIC_API_URL=https://api.seudominio.com.br` no ambiente do
app. Reinicie o Expo e gere um novo build para distribuir a URL nos aparelhos.
O catálogo começa vazio. Cadastre um negócio real, envie para análise e aprove.

## Painel administrativo web

O painel fica em `/admin`. Na produção do Vila Serra e Mar, acesse
[api.valeserraemar.com.br/admin](https://api.valeserraemar.com.br/admin) após
habilitar o painel no serviço.

- **Visão geral** mostra os totais e a fila de estabelecimentos em análise.
- **Estabelecimentos** permite buscar, filtrar e conferir cadastros, fotos e
  produtos. A revisão permite aprovar, solicitar correções, recusar e desativar.
  **Cadastrar estabelecimento** vincula um novo anúncio ao e-mail de uma
  conta de anunciante do app. O cadastro entra na fila de análise com os dados
  informados no formulário. A seção **Fotos** aceita capa, logotipo e uma galeria
  opcional de até 20 imagens de 8 MB cada. O servidor redimensiona fotos maiores
  que 1.600 pixels no lado mais longo.
  **Editar** altera dados, localização, horários e imagens. A galeria permite
  adicionar fotos e marcar as que devem ser removidas. As alterações de
  um anúncio já aprovado ficam disponíveis no catálogo ao salvar. **Excluir**
  move o cadastro para a lixeira e o retira do catálogo e da área do anunciante.
  A lixeira guarda os registros vinculados e permite restaurar o cadastro para
  análise. A revisão também permite reativar um estabelecimento desativado.
- **Anunciantes**, **Reservas** e **Assinaturas** oferecem consultas para suporte.
- **Atividade** permite buscar cadastros, edições, exclusões, restaurações e
  decisões de revisão pelo estabelecimento, pelo administrador ou pela ação.

O painel usa uma conta administrativa inicial configurada no servidor. Cada
administrador tem sua própria sessão web de 8 horas. A aprovação publica o
cadastro no mesmo catálogo que o aplicativo consulta. O motivo da correção
aparece na área do anunciante.

### Habilitar o acesso administrativo

1. Na pasta `vsm-backend` da versão atualizada, gere o hash da sua senha em Bash.

   ```bash
   read -rsp 'Senha do painel: ' senha_painel
   printf '\n'
   printf '%s' "$senha_painel" | npm run --silent admin:hash
   unset senha_painel
   ```

2. Adicione estas variáveis de ambiente ao serviço da API e substitua os valores
   pelo e-mail do administrador e pela saída do comando anterior.

   ```dotenv
   ADMIN_EMAIL=seu-email@exemplo.com
   ADMIN_PASSWORD_HASH=cole_o_hash_gerado
   ```

   Para o serviço `valeserraemar-api.service` da Hostinger, consulte
   `systemctl show valeserraemar-api.service -p EnvironmentFiles -p WorkingDirectory -p User`
   para localizar o arquivo de configuração e o diretório de trabalho.
   Use a URL pública HTTPS da API em `PUBLIC_URL`. Para validar localmente,
   você pode usar `http://localhost:3000` com um banco de teste.

3. Aplique `npm run migrate` com a configuração de banco e TLS do serviço.
   A migração cria as tabelas de sessão e histórico do painel. Em Docker Compose,
   use `docker compose run --rm --no-deps api node src/migrate.js` após o build.
4. Inicie a API com `npm start` no ambiente local ou reinicie o serviço
   atualizado na VPS. Abra `/admin` no navegador e entre com o e-mail e a senha
   escolhidos.

Na Hostinger, a atualização de contas instala `vsm-admin-criar`. Rode esse
comando como root para cadastrar um administrador adicional com e-mail e senha
próprios. A API lê essas contas do arquivo privado definido por
`ADMIN_ACCOUNTS_FILE` e registra o e-mail de quem fez cada revisão.

### Revisar pelo terminal

Em uma sessão autorizada de administração, use os comandos abaixo.

```bash
docker compose exec api node src/review.js listar
docker compose exec api node src/review.js aprovar ID
docker compose exec api node src/review.js corrigir ID "Informe o ajuste necessário"
docker compose exec api node src/review.js recusar ID
docker compose exec api node src/review.js desativar ID
```

Quando um anúncio aprovado é editado, ele sai do catálogo e volta a Rascunho
até a nova revisão. Produtos do cardápio podem ser mantidos separadamente.
Reservas são solicitadas pelo visitante e decididas manualmente pelo anunciante.

## Limites desta entrega

- Assinatura consulta o registro no banco. Não há plano, checkout, cobrança
  Asaas ou webhook ativo. Indicadores de reserva são reais e as contagens de
  visualização e contato ainda não coletam eventos.
- O mapa só marca locais com coordenadas preenchidas. A API valida os limites
  das coordenadas e não geocodifica endereços automaticamente.
- O login atual não tem verificação de e-mail, recuperação de senha nem renovação
  automática. O histórico de visitante depende do token salvo no aparelho.
- Fotos enviadas são convertidas para WebP. A URL de cada foto é pública e
  imprevisível, inclusive para rascunhos. Ainda não há limpeza de arquivos
  órfãos, política de retenção automática ou Storage externo.
- O catálogo retorna as listas completas, conforme o contrato do app atual.
  Para grandes volumes será preciso acrescentar paginação e busca no servidor.

## Validar localmente

Com Node.js 24, rode `npm ci` e `npm test` em Linux sem root, como WSL no
Windows. O teste sobe PostgreSQL descartável e exercita as rotas HTTP sem usar o
Supabase de produção. `TEST_PG_PORT` permite trocar a porta local de teste.
Os dados de teste são descartados e nenhuma conta ou anúncio é criado em produção.
