# Correspondência das telas recebidas

A implementação usa telas compartilhadas quando o desenho representa estados do mesmo fluxo. Por isso, 41 arquivos de referência não significam 41 componentes separados. Os arquivos de origem foram inspecionados a partir do ZIP enviado, sem depender de acesso ao Figma.

| Referência | Tela/estado no código |
| --- | --- |
| VIS-01 Boas-vindas | Welcome, região e entrada sem conta |
| VIS-02 Home | Home |
| VIS-03 Busca | Search |
| VIS-04 Resultados-Lista | Results |
| VIS-05 Filtros | Filters / FilterForm |
| VIS-06 Resultados-Mapa | Map |
| VIS-07 Estabelecimento-Restaurante | Business, variante restaurante |
| VIS-08 Cardápio | Menu |
| VIS-09 Produto-Adicionais | Product |
| VIS-10 Carrinho | Cart |
| VIS-11 Revisar-WhatsApp | OrderReview |
| VIS-12 Pedido-Enviado | OrderSent, orienta concluir no WhatsApp |
| VIS-13 Hospedagem | Business, variante hospedagem |
| VIS-14 Reserva | Booking, hospedagem e mesa |
| VIS-15 Solicitação-Enviada | BookingDetail, Pendente |
| VIS-16 Reserva-Confirmada | BookingDetail, Confirmada |
| VIS-17 Minhas-Reservas | Reservations |
| VIS-18 Busca-Sem-Resultados | Results, estado vazio |
| ANU-00A Perfil-Visitante-Anunciar | Profile |
| ANU-00B Anuncie-no-Guia | Advertise |
| ANU-00C Ativar-Área-Anunciante | Activate |
| ANU-01 Criar-Conta-Sem-Login | Auth, cadastro/login via API |
| ANU-02 Boas-vindas | BusinessWelcome |
| ANU-03 Dados-Estabelecimento | BusinessWizard, etapa dados |
| ANU-04 Localização-Contatos | BusinessWizard, etapa localização |
| ANU-05 Funcionamento | BusinessWizard, etapa horários |
| ANU-06 Fotos | BusinessWizard, etapa fotos |
| ANU-07A Config-Cardápio-Restaurante | BusinessWizard e ManageMenu |
| ANU-07B Config-Hospedagem | BusinessWizard e ManageRooms |
| ANU-08 Prévia-Anúncio | BusinessWizard, prévia e Business preview |
| ANU-09 Aguardando-Aprovação | ReviewStatus, Em análise |
| ANU-10 Correções-Solicitadas | ReviewStatus, Correções solicitadas |
| ANU-11A Dashboard-Restaurante | Dashboard, restaurante |
| ANU-11B Dashboard-Hospedagem | Dashboard, hospedagem |
| ANU-12 Editar-Estabelecimento | EditBusiness |
| ANU-13 Gerenciar-Cardápio | ManageMenu |
| ANU-14 Editar-Produto | EditProduct |
| ANU-15 Gerenciar-Hospedagem | ManageRooms e EditRoom |
| ANU-16 Responder-Reserva | ManageReservations e RespondReservation |
| ANU-17 Indicadores | Indicators |
| ANU-18 Conta-Alternar-Modo | Account |

Complementos: Preferences (região/interesses), Favorites, Gallery, Help e Subscription. Nenhuma tela de administração web foi criada.

## Comportamento da versão 0.2.0

As telas consultam a API. Não há conteúdo comercial fictício nem ferramenta de aprovação no aplicativo. Sem API, o visitante navega pelos estados vazios e a conta do anunciante só pode ser criada quando o servidor estiver conectado. Reservas são atualizadas após resposta remota. Indicadores e assinatura vêm do backend.

O banner da Home preenche a largura, o mapa rola acima da barra inferior e a logo retorna à Home. Interações têm animações curtas, feedback tátil e indicadores de espera. Rascunhos de cadastro são mantidos apenas durante a sessão.
