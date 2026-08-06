# Financeiro operacional

O módulo registra um orçamento único por solicitação e seus pagamentos. Valores são inteiros em centavos; `totalCents` é calculado pela API como `subtotalCents - discountCents` e nunca é aceito no payload.

## Modelo, estados e saldo

`ServiceRequest 1 — 0..1 Quote` e `Quote 1 — 0..N Payment`. Não há exclusão física.

Orçamentos seguem `DRAFT -> SENT`, `SENT -> APPROVED | REJECTED | CANCELLED` e `DRAFT -> CANCELLED`. Um `APPROVED` só pode ir para `CANCELLED` sem pagamentos `PAID`. Pagamentos seguem `PENDING -> PAID | CANCELLED` e `PAID -> REFUNDED`. Estados finais preservam o histórico.

A situação não é persistida: `UNPAID` quando a soma `PAID` é zero; `PARTIALLY_PAID` quando está entre zero e o total; `PAID` quando alcança o total. Respostas incluem `paidTotalCents`, `remainingCents` e `paymentStatus`.

## Endpoints e RBAC

Todas as rotas exigem JWT. `ADMIN` acessa todas. `OPERATOR` consulta orçamentos e pagamentos e cria/edita somente orçamentos `DRAFT`; não altera estados nem registra pagamentos.

- `GET /quotes`: filtros `page`, `limit`, `status`, `serviceRequestId`, `customerId`, períodos, `orderBy` e `sortOrder`.
- `GET /quotes/:id`, `POST /quotes`, `PATCH /quotes/:id` e `PATCH /quotes/:id/status`.
- `GET /quotes/:quoteId/payments`, `GET /payments/:id`, `POST /quotes/:quoteId/payments` e `PATCH /payments/:id/status`.

```json
{
  "serviceRequestId": "uuid",
  "subtotalCents": 15000,
  "discountCents": 1000,
  "description": "Material e mão de obra",
  "validUntil": "2026-08-20T23:59:59.000Z"
}
```

```json
{
  "amountCents": 14000,
  "method": "PIX",
  "status": "PAID",
  "paidAt": "2026-08-05T15:00:00.000Z",
  "reference": "comprovante-123"
}
```

Métodos: `PIX`, `CASH`, `CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER` e `OTHER`. São classificações operacionais: cartão, CVV, credenciais, tokens e dados bancários sensíveis não são armazenados.

## Regras, integração e concorrência

Um orçamento só pode ser criado para uma solicitação `CONTACTED`, conforme a máquina de estados de `ServiceRequest`. A criação do `Quote` em `DRAFT` e a transição condicional `CONTACTED -> QUOTED` ocorrem na mesma transação serializável. Se a solicitação mudar concorrentemente, toda a operação é revertida. Ao aprovar, `Quote SENT -> APPROVED` e `ServiceRequest QUOTED -> APPROVED` também são condicionais e atômicos; falha em qualquer lado reverte ambos, sem sobrescrever estados posteriores ou finais.

Edições de orçamento usam escrita condicional por `id` e estado esperado `DRAFT`, impedindo que uma edição baseada em leitura antiga altere um orçamento que já avançou de estado.

Pagamentos exigem orçamento `APPROVED` e `amountCents` inteiro positivo. `PAID` recebe `paidAt`; `PENDING` não aceita a data. A leitura do saldo e a escrita usam transação PostgreSQL `Serializable`. Conflitos `P2034` são repetidos no máximo três vezes; após o limite, a API retorna `FINANCE_CONCURRENT_UPDATE`. `PAYMENT_EXCEEDS_REMAINING_AMOUNT` é reservado à verificação real da soma dentro da transação.

Erros estáveis incluem `QUOTE_NOT_FOUND`, `QUOTE_ALREADY_EXISTS`, `QUOTE_INVALID_STATUS_TRANSITION`, `QUOTE_NOT_EDITABLE`, `QUOTE_DISCOUNT_EXCEEDS_SUBTOTAL`, `QUOTE_HAS_PAID_PAYMENTS`, `SERVICE_REQUEST_INVALID_STATUS_FOR_QUOTE`, `SERVICE_REQUEST_STATUS_CHANGED`, `QUOTE_SERVICE_REQUEST_SYNC_FAILED`, `PAYMENT_NOT_FOUND`, `PAYMENT_INVALID_STATUS_TRANSITION`, `PAYMENT_EXCEEDS_REMAINING_AMOUNT`, `PAYMENT_REQUIRES_APPROVED_QUOTE`, `PAYMENT_ALREADY_FINAL` e `FINANCE_CONCURRENT_UPDATE`.

Criação e mudança de status de orçamento e pagamento escrevem eventos na timeline dentro da mesma transação. Metadata contém somente `quoteId`, `paymentId` e estados; valores e referências financeiras não são duplicados. O ator vem do JWT.
Na mesma transação, esses eventos notificam somente usuários `ADMIN` ativos e excluem o ator. `OPERATOR` não recebe alertas financeiros para evitar ruído e preservar a divisão de responsabilidade atual.

## Limitações

Não há PDF, relatório avançado, conciliação, contabilidade, integração bancária, PIX automático, processamento de cartão ou gateway. Confirmação, cancelamento e reembolso são registros manuais.

O [Activity Feed](service-request-activity.md) projeta eventos de orçamento e pagamento usando somente IDs e transições de estado. Valores, método, referência, notas e demais dados financeiros não são copiados para o feed.
