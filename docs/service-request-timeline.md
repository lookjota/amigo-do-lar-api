# Timeline de solicitações de serviço

A timeline é o histórico operacional interno de uma `ServiceRequest`. Cada evento possui tipo estável, título, descrição opcional, metadata estruturado, autor opcional e data. Eventos não são editados nem excluídos.

## Modelo e visibilidade

`ServiceRequest 1 — N ServiceRequestEvent` e `User 0..1 — N ServiceRequestEvent`. O autor usa `SET NULL` quando um usuário for removido, preservando o histórico; a solicitação usa `RESTRICT`. A visibilidade atualmente aceita apenas `INTERNAL`. Não existe rota pública ou de cliente para estes dados.

Tipos: `REQUEST_CREATED`, `STATUS_CHANGED`, `COMMENT_ADDED`, `APPOINTMENT_CREATED`, `APPOINTMENT_RESCHEDULED`, `APPOINTMENT_STATUS_CHANGED`, `QUOTE_CREATED`, `QUOTE_STATUS_CHANGED`, `PAYMENT_CREATED` e `PAYMENT_STATUS_CHANGED`.

Metadata é construída explicitamente e contém somente identificadores, estados e datas necessários. Não contém valores financeiros, payloads HTTP, senhas, hashes, JWT, dados de cartão, CVV, segredos ou detalhes do Prisma.

## Endpoints e RBAC

`ADMIN` e `OPERATOR` autenticados podem usar:

- `GET /service-requests/:id/timeline?page=1&limit=20&type=COMMENT_ADDED&sortOrder=desc`;
- `POST /service-requests/:id/comments` com `{ "content": "Texto interno" }`.

A listagem aceita limite de 1 a 100, filtro por tipo e ordem `asc` ou `desc`. O ator retorna somente `id`, `name`, `email` e `role`, ou `null`. Comentários são texto puro, passam por `trim`, têm de 1 a 4000 caracteres e não possuem edição ou remoção. HTML é texto não confiável e deve ser escapado na UI.

## Eventos automáticos e atomicidade

A criação pública registra `REQUEST_CREATED` com autor nulo. Mudanças autenticadas em solicitação, agendamento, orçamento e pagamento registram o usuário do JWT. Cada evento é inserido pelo mesmo `Prisma.TransactionClient` da ação principal; falha no histórico reverte toda a ação.

## Implantação e limitações

A timeline começa após esta migration. Registros anteriores não recebem eventos retroativos e o seed não cria histórico falso. Um backfill futuro será separado. Uploads, anexos, fotos, notificações, WebSocket, auditoria global e visibilidade pública estão fora deste escopo.
