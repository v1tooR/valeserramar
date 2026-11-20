# Contrato HTTP do aplicativo 0.2.0

Este é o contrato efetivamente usado por `src/api/repository.ts`. O backend ainda precisa ser implementado. Respostas JSON diretas, sem envelope `data`. IDs são strings opacas. Datas civis usam YYYY-MM-DD, horários HH:MM e instantes ISO 8601. Valores monetários são números em reais. Produção exige HTTPS.

## Sessões

`Authorization: Bearer <token>` identifica o anunciante. `X-Guest-Token` identifica o histórico de reservas do visitante sem exigir login. O backend precisa autorizar cada operação e nunca confiar nos campos `owner`, status ou preços recebidos do cliente.

| Método e rota | Corpo / resposta |
| --- | --- |
| POST /auth/register | `{name,email,phone,password}` → `{token,profile}` |
| POST /auth/login | `{email,password}` → `{token,profile}` |
| POST /auth/logout | Sem corpo → 204, revogar token no servidor |
| GET /me | → Profile |
| PATCH /me | `{name,email,phone}` → Profile atualizado |
| POST /guest-sessions | Sem corpo → `{token}` opaco e imprevisível |

Profile contém name, email e phone. Tokens são guardados no SecureStore do Android/iOS. Em web, somente memória. Em 401, o cliente encerra a sessão autenticada. Não há renovação automática de token neste contrato. Logout limpa a sessão local mesmo se o servidor estiver indisponível. Defina expiração e revogação no servidor.

## Catálogo e área autenticada

| Método e rota | Resposta |
| --- | --- |
| GET /catalog | `{businesses: Business[], products: Product[]}` somente dados públicos de aprovados |
| GET /me/workspace | `{businesses,products,reservations}` somente negócios e dados autorizados do anunciante |
| GET /reservations | Reservation[] vinculadas ao X-Guest-Token, nunca lista pública |

O cliente faz filtros por texto/categoria/região/cidade e aberto agora nos dados carregados. O contrato atual retorna listas completas. Para grandes catálogos, evoluir este endpoint para busca e paginação no servidor antes de escalar. O retorno do workspace pode incluir negócios em análise e rascunhos, que não aparecem na busca pública.

Os campos exatos estão em `src/api/schemas.ts` e `src/domain/models.ts`. Business exige 7 entradas em hours, de domingo a sábado. Fotos usam URL HTTPS, ou string vazia quando ausentes. Latitude/longitude podem ser null quando não geocodificadas. O backend valida o endereço e gera coordenadas reais. O cliente nunca cria marcador fictício.

## Negócios, mídia e produtos

| Método e rota | Corpo / resposta |
| --- | --- |
| POST /media | multipart/form-data campo file → `{url}` HTTPS |
| POST /businesses | Campos editáveis de Business → Business persistido |
| PATCH /businesses/:id | Campos editáveis de Business → Business persistido |
| PATCH /businesses/:id/table-reservations | `{acceptsReservations: boolean}` → Business com a preferência atualizada |
| POST /businesses/:id/submit | `{}` → Business com status atribuído pelo servidor |
| POST /businesses/:id/products | Campos de Product exceto id → Product persistido |
| PATCH /businesses/:id/products/:productId | Campos editáveis → Product persistido |
| DELETE /businesses/:id/products/:productId | → 204 |

Campos id, owner, status e correction são removidos do corpo de edição de negócio. Acomodações são editadas como a lista rooms do negócio, com IDs de acomodação estáveis. Produtos e acomodações novos recebem identificadores temporários com prefixo draft-. O servidor pode substituir IDs temporários ao persistir e deve preservar os definitivos nas atualizações. O cadastro do negócio pode ocorrer antes de enviar produtos e antes da submissão final. Falha parcial conserva o cadastro retornado para permitir retomada na mesma sessão.

`subcategory` é opcional e mantém `segment` compatível com cadastros existentes. Envie `null` para remover uma subcategoria. O proprietário de um anúncio de alimentação publicado pode alterar a disponibilidade de mesas pela rota `table-reservations`. A alteração preserva a publicação e as solicitações já recebidas.

`lodgingType` é opcional para anúncios do segmento `Hospedagem` e aceita `Hotéis`, `Pousadas` ou `Airbnb`. Edições que omitem o campo mantêm o subtipo do anúncio no mesmo segmento. Envie `null` para limpar o subtipo.

O cliente envia Idempotency-Key nas criações de negócio/produto e de reserva. O servidor deve vincular a chave à identidade + operação, armazenar a resposta e evitar duplicidade no retry. Mesma chave com corpo diferente deve retornar 409. A submissão para análise deve ser naturalmente idempotente no estado Em análise, sem impedir um reenvio posterior após correções.

Uploads devem validar tipo real, tamanho, propriedade e URLs. O limite da seleção de imagem no cliente é 8 MB. O servidor precisa aplicar seus próprios limites e remover uploads órfãos. Não aceitar URL arbitrária como permissão para manipular mídia de outro usuário.

## Reservas manuais

| Método e rota | Corpo / resposta |
| --- | --- |
| POST /reservations | `{businessId,kind,name,phone,start,end,time,adults,children,roomId,notes}` → Reservation |
| POST /reservations/:id/respond | `{status: Confirmada ou Recusada,reply}` → Reservation atualizada |
| POST /reservations/:id/cancel | `{}` → Reservation atualizada |

O servidor atribui ID, createdAt, estimate, roomName, status e reply. Só proprietários autorizados podem responder. Só o visitante vinculado ou outro papel explicitamente autorizado pode cancelar. Transições devem ser atômicas. Solicitações novas começam Pendentes, sem bloquear estoque de quartos ou mesas. Revalidar datas, capacidade, segmento, aprovação do anúncio e preço no servidor.

A identidade anônima permanece no aparelho nativo. Recuperação após troca/perda de aparelho ainda precisa de uma política definida, sem expor reservas por simples nome ou telefone. O app não implementa envio de SMS.

## Indicadores e assinatura

| Método e rota | Resposta |
| --- | --- |
| GET /businesses/:id/metrics?days=7,30 ou 90 | `{views,contacts,requests,confirmed}` números não negativos |
| GET /businesses/:id/subscription | `{status,plan,amount,dueDate}` (plan,amount,dueDate aceitam null) |

A API deve calcular métricas a partir de eventos reais. Instrumentação e deduplicação de eventos de visualização/contato ainda precisam ser fechadas com o backend. Nenhum número é inventado pelo frontend.

Cadastro de pagadores, assinaturas, cobranças Asaas e webhooks são responsabilidade do backend. Não há checkout ativo no app. Planos e política de inadimplência devem ser definidos pelo contratante. Não cobrar reservas pelo Asaas.

## Erros e integração

200/201 para JSON bem-sucedido, 204 sem corpo. 401 encerra sessão, 409 informa conflito e 422 solicita revisão de dados. Outros erros/rede/timeout de 15 segundos mostram mensagem com possibilidade de tentar novamente. Não há repetição automática de mutações.

Para a versão web, habilite CORS para a origem autorizada e para Authorization, X-Guest-Token, Idempotency-Key, Content-Type e Accept. Não colocar credenciais de servidor no aplicativo. As validações Zod verificam estrutura das respostas, mas não substituem autorização ou regras de negócio no servidor.
