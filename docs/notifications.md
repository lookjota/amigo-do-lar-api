# Centro de notificações

O centro mantém uma caixa de entrada persistente e privada para cada usuário administrativo. `Notification` possui destinatário obrigatório, ator opcional, tipo estável, título, mensagem operacional curta, `resourceType`, `resourceId`, metadata explícita, `readAt` e `createdAt`. URLs não são persistidas; a interface decide a navegação pelo recurso.

## Destinatários e tipos

- `SERVICE_REQUEST_CREATED`: todos os `ADMIN` e `OPERATOR` ativos; ator nulo.
- `SERVICE_REQUEST_STATUS_CHANGED` e `COMMENT_ADDED`: `ADMIN` e `OPERATOR` ativos, exceto o ator.
- `APPOINTMENT_CREATED`, `APPOINTMENT_RESCHEDULED` e `APPOINTMENT_STATUS_CHANGED`: `ADMIN` e `OPERATOR` ativos, exceto o ator.
- `QUOTE_CREATED`, `QUOTE_STATUS_CHANGED`, `PAYMENT_CREATED` e `PAYMENT_STATUS_CHANGED`: somente `ADMIN` ativos, exceto o ator.

Financeiro é direcionado apenas a administradores para reduzir ruído: operadores mantêm as permissões atuais de consulta e edição de rascunhos, mas mutações administrativas e pagamentos são responsabilidade de `ADMIN`. Usuários inativos e o próprio ator nunca recebem. Zero destinatários é um resultado válido.

## Endpoints

Todos exigem JWT e aceitam `ADMIN` e `OPERATOR`, sempre usando o `sub` autenticado:

- `GET /notifications`: `page`, `limit` (máximo 100), `unreadOnly`, `type`, `resourceType` e `sortOrder=asc|desc`;
- `GET /notifications/unread-count`;
- `PATCH /notifications/:id/read`, idempotente e sem payload;
- `PATCH /notifications/read-all`, sem payload, retorna `updatedCount`.

Consultas e alterações combinam `recipientUserId` e `id`. Um id inexistente ou pertencente a outro usuário retorna `NOTIFICATION_NOT_FOUND`, sem revelar sua existência. Não há DELETE, edição ou marcação como não lida.

## Atomicidade, dados e evolução

Operação principal, timeline e notificações usam o mesmo `Prisma.TransactionClient`; uma falha de persistência reverte o comando. Metadata é construída campo a campo e contém apenas ids, estados e datas. Descrições, comentários, observações, referências de pagamento, dados bancários, cartão, credenciais, JWT, payloads e detalhes internos não são copiados.

Notificações começam após a implantação desta migration. A timeline anterior não será convertida e não há backfill nesta sprint. O histórico não tem limpeza automática; uma política de retenção poderá ser definida futuramente. A persistência e os tipos permitem adicionar, em trabalhos separados, SSE/WebSocket, e-mail e WhatsApp, sem que esses canais existam agora.
# Notificações de anexos

`ATTACHMENT_ADDED` e `ATTACHMENT_REMOVED` são enviados a administradores e
operadores ativos, exceto o ator, usando `SERVICE_REQUEST` como resource type.
Mensagens não incluem nome de arquivo, URL ou conteúdo.
