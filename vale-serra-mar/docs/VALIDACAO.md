# Validação — versão 0.2.0

## Verificações executadas

- TypeScript sem erros.
- 4 suítes Jest, 16 testes aprovados.
- Entrada do visitante sem conta, escolha e persistência de região.
- Logo do cabeçalho retorna à Home com limpeza da pilha anterior.
- Estado inicial sem negócios, produtos ou conta pré-criados.
- Falha de autenticação não cria uma sessão.
- Falha de reserva não adiciona uma solicitação ao estado.
- HTTP: token, expiração em 401, falha de rede e resposta 204.
- Regras: totais/adicionais, indisponibilidade/preço alterado, datas, diárias, filtros e funcionamento após meia-noite.
- Bundle Android/Hermes e assets exportados pelo Metro.
- Exportação da versão web auxiliar.

O servidor foi substituído por respostas controladas somente nos testes automatizados. Esses arquivos não são importados pelo aplicativo e não estão acessíveis na interface.

## Limitações da validação

Não houve teste em Android físico, emulador ou compilação de APK/AAB. A tentativa de preparar o navegador automatizado foi impedida por falha de download do executável. Portanto não houve conferência visual automatizada. Os ajustes de largura do banner e de espaço do mapa foram feitos no código e precisam ser conferidos no dispositivo. Feedback tátil depende de suporte do aparelho.

Não houve teste com API real, Asaas, banco ou VPS, que ainda não existem/conectam neste projeto. A base frontend integra o contrato documentado, mas isso não equivale a uma plataforma pronta para publicação.

## Verificação manual após instalar

1. Abrir, escolher uma região e navegar pelas quatro abas.
2. Conferir banner preenchendo a largura e logo retornando à Home.
3. Na aba Mapa, rolar o conteúdo e verificar a barra inferior em telas pequenas e fonte ampliada.
4. Tocar nos botões e conferir animações. Ativar redução de movimento nas configurações do aparelho e repetir.
5. Sem API, confirmar que login, cadastro e dados remotos apresentam indisponibilidade, sem estados falsos de sucesso.
6. Com API implementada, validar criação/login reais, cadastro e upload de negócio, aprovação pelo administrador, gestão de cardápio/acomodações e reservas em dois aparelhos.
7. Testar perda de rede durante envio e retry com Idempotency-Key, sessão expirada, logout e acesso negado a dados de outro anunciante.
8. Conferir mapas com chave de produção restrita, permissões de fotos e desempenho em Android físico antes de publicar.
