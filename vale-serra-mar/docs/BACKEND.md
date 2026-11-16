# Integração com o backend

A camada cliente está em `src/api`. O contrato de rotas, formatos e autorização está em `API.md`. Para integrar, implemente os endpoints e configure EXPO_PUBLIC_API_URL. Não existe servidor embutido neste ZIP e a VPS não foi acessada.

O aplicativo não carrega negócios fictícios, não aprova anúncios e não autentica offline. A resposta do servidor é a fonte dos dados publicados, sessões, reservas, indicadores e assinaturas. Há rascunhos de formulários em memória, e preferências/favoritos no aparelho.

A entrega posterior do backend precisa incluir banco, validação/autorizações, mídia, geocodificação, integração Asaas, webhooks idempotentes e painel administrativo separado. Definir com o contratante planos, valores, periodicidade e regras de inadimplência. Preparar rotinas de backup, privacidade e recuperação/exclusão de conta para o lançamento.
