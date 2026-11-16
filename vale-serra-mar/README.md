# Vale, Serra e Mar — React Native 0.2.0

Base de aplicativo Android em React Native, Expo e TypeScript, com interfaces VIS/ANU e uma camada de integração HTTP para o backend. O app inicia sem estabelecimentos, cardápios, reservas ou contas pré-cadastrados. Não existe login local, senha especial ou ferramenta de aprovação dentro do aplicativo.

## Executar no Windows / VS Code

Extraia o ZIP em uma pasta nova e abra `vale-serra-mar` no VS Code. Não misture com a instalação anterior. Abra Terminal → Novo Terminal e execute:

```powershell
npm.cmd ci
npm.cmd start
```

O sufixo `.cmd` evita o bloqueio de scripts PowerShell do seu computador. Abra o QR code no Expo Go compatível com SDK 57 e mantenha o terminal aberto. No Windows, `npm.cmd run web` abre a versão web auxiliar. Android Studio só é necessário se você quiser emulador ou compilação Android local.

## Sem backend configurado

Você consegue escolher região, navegar, abrir as categorias, alterar interesses e acessar os formulários de entrada/cadastro. O catálogo não terá negócios. Operações remotas apresentam indisponibilidade e permitem tentar novamente. Nenhum login, cadastro enviado, pagamento ou reserva é confirmado artificialmente.

Os formulários de gerenciamento são protegidos por sessão real. Eles ficam disponíveis depois que a API autenticar o anunciante. Rascunhos digitados pelo próprio anunciante podem ser preparados em memória antes do envio. Não são anúncios publicados e se perdem ao fechar o app ou sair da conta. Preferências, favoritos e buscas recentes permanecem no aparelho.

## Conectar a API

Copie `.env.example` para `.env` e preencha:

```dotenv
EXPO_PUBLIC_API_URL=https://seu-endereco-da-api
GOOGLE_MAPS_API_KEY=
```

Reinicie o Expo com `npm.cmd start -- --clear` depois de alterar variáveis. O endereço deve incluir o prefixo da API, quando existir (por exemplo `/v1`). Nunca coloque senhas da VPS, banco ou chaves Asaas em variáveis `EXPO_PUBLIC_*`.

A interface HTTP já está implementada no cliente. O servidor deverá cumprir o contrato de `docs/API.md`, incluindo os formatos validados em `src/api/schemas.ts`. Preencher apenas a URL não cria esses serviços. A VPS e o backend não foram alterados nesta entrega.

## Alterações de interface

- Banner da Home ocupa toda a largura disponível, com altura de 210 e imagem em cover.
- Logo do cabeçalho retorna à Home e limpa a pilha de navegação anterior.
- Mapa em área com altura adaptável e conteúdo rolável. Navegação inferior fora da área de rolagem, sem sobreposição dos controles.
- Botões, categorias e cartões com resposta ao toque, escala suave e feedback tátil em dispositivos compatíveis.
- Entrada suave de conteúdo e transições de tela. A preferência de redução de movimento é respeitada.
- Indicador de envio, bloqueio de cliques duplicados, diálogos visíveis também no navegador e estados de carregamento/erro/vazio.
- Atualização por gesto de puxar nas telas com navegação inferior.

## Organização

| Pasta/arquivo | Responsabilidade |
| --- | --- |
| `src/api/client.ts` | HTTP, timeout, tokens, sessão visitante e expiração |
| `src/api/repository.ts` | Endpoints e transformação de dados/uploads |
| `src/api/schemas.ts` | Validação dos dados recebidos |
| `src/store.tsx` | Estado da interface, preferências e ações confirmadas pela API |
| `src/domain` | Tipos, regiões/categorias e regras |
| `src/screens` | Telas de visitante e anunciante |
| `src/components` | Botões, movimento, diálogos, calendário e mapa |
| `assets` | Logo e imagens das regiões |
| `tests` | Testes automatizados isolados, não carregados pelo app |

## Android e publicação

Para um APK próprio, configure a chave Google Maps para o pacote/assinatura corretos e sua conta EAS:

```powershell
npx.cmd eas-cli@latest login
npx.cmd eas-cli@latest build:configure
npm.cmd run build:apk
```

O perfil `preview` gera APK. O perfil `production` gera AAB. O identificador `br.com.valeserramar.guia` deve ser confirmado antes de publicar. SecureStore está configurado para tokens nativos. Na versão web auxiliar, tokens ficam somente em memória e o login não sobrevive ao recarregamento.

Esta entrega é a base frontend para integração. Ainda são necessários o servidor, banco, administração web, Asaas, regras comerciais, links de privacidade/termos, recuperação/exclusão de conta e validação em Android físico antes do lançamento. A configuração iOS foi mantida, mas não houve compilação iOS.

## Verificar

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run export:android
```

A exportação produz bundle e assets, não APK. Leia `docs/VALIDACAO.md` para as verificações realizadas e as limitações.
