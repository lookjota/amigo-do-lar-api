# Módulo de solicitações de serviço

O módulo registra a intenção comercial de um cliente, relaciona-a a um serviço do
catálogo e permite que a equipe acompanhe o atendimento até sua conclusão ou
cancelamento. O módulo de Appointments agora é responsável por levar uma
solicitação `APPROVED` a `SCHEDULED` e sincronizar as etapas operacionais.

## Dados persistidos

Além dos relacionamentos com `Customer` e `Service`, a solicitação mantém
descrição, data preferencial opcional, endereço, cidade, notas internas e os
timestamps terminais `completedAt` e `cancelledAt`. As novas colunas são
anuláveis para permitir a migração de registros preexistentes, mas `address` e
`city` são obrigatórios no fluxo público novo.

`postalCode` e `contactPreference` não foram adicionados: ainda não existem
regras de área de cobertura nem integrações de canal que consumam esses dados.

## Criação pública

`POST /service-requests` não exige autenticação.

```json
{
  "customer": {
    "name": "João da Silva",
    "phone": "(61) 99999-9999",
    "email": "joao@example.com"
  },
  "serviceId": "aa9a8c21-32fb-47ba-aef3-03ef668d727b",
  "description": "A tomada da cozinha parou de funcionar.",
  "preferredDate": "2026-08-10T14:00:00.000Z",
  "address": "Taguatinga Norte",
  "city": "Brasília"
}
```

Telefone, email e nome usam os mesmos normalizadores do módulo Customers. O
telefone identifica o cliente: se já existir, ele é reutilizado sem alteração
implícita de nome, email ou estado ativo; se não existir, é criado. Essa política
evita que um formulário anônimo sobrescreva dados administrativos.

O serviço precisa existir e estar ativo. Serviço inexistente retorna `404` e
inativo retorna `409`. A data preferencial, quando informada, deve ser ISO 8601
válida e futura. A resposta `201` não expõe notas internas nem dados relacionais
do cliente.

Serviço, cliente, verificação de duplicidade e solicitação são processados em
uma transação Prisma interativa. Uma falha reverte todas as escritas.

### Duplicidade

Uma solicitação com o mesmo telefone normalizado, serviço e descrição
normalizada criada nos últimos cinco minutos retorna `409` com
`DUPLICATE_SERVICE_REQUEST`. É uma proteção simples para duplo clique no MVP.
Ela não substitui idempotência forte: requisições rigorosamente concorrentes
ainda podem competir antes da confirmação. Uma futura versão deve aceitar
`Idempotency-Key` com constraint persistente.

```bash
curl -X POST http://localhost:3000/service-requests \
  -H 'Content-Type: application/json' \
  -d '{"customer":{"name":"João da Silva","phone":"(61) 99999-9999","email":"joao@example.com"},"serviceId":"aa9a8c21-32fb-47ba-aef3-03ef668d727b","description":"A tomada da cozinha parou de funcionar.","preferredDate":"2026-08-10T14:00:00.000Z","address":"Taguatinga Norte","city":"Brasília"}'
```

## Operações administrativas

Todas exigem JWT com papel `ADMIN` ou `OPERATOR`:

- `GET /service-requests`: listagem paginada;
- `GET /service-requests/:id`: detalhes com resumos de cliente e serviço;
- `PATCH /service-requests/:id`: altera campos operacionais;
- `PATCH /service-requests/:id/status`: executa uma transição de estado.
- `GET /service-requests/:id/timeline`: consulta o histórico interno;
- `POST /service-requests/:id/comments`: adiciona comentário interno imutável.

Não existe DELETE. Cancelamento é uma transição para `CANCELLED`.
Criação e mudança de status inserem `REQUEST_CREATED` e `STATUS_CHANGED` na mesma transação. O histórico inicia após a migration e não é reconstruído retroativamente.

O PATCH operacional aceita somente `description`, `preferredDate`, `address`,
`city` e `internalNotes`. Identificadores, relacionamentos, status e timestamps
são rejeitados como campos desconhecidos.

```bash
curl -X PATCH http://localhost:3000/service-requests/1ad575e6-0225-45ce-bb18-296407bc558b \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -d '{"internalNotes":"Cliente disponível pela manhã."}'

curl -X PATCH http://localhost:3000/service-requests/1ad575e6-0225-45ce-bb18-296407bc558b/status \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -d '{"status":"CONTACTED"}'
```

## Paginação, filtros e ordenação

`GET /service-requests` usa `page=1`, `limit=20`, `sortBy=createdAt` e
`sortOrder=desc` por padrão. `limit` fica entre 1 e 100.

Filtros disponíveis: `search`, `status`, `customerId`, `serviceId`,
`createdFrom`, `createdTo`, `preferredDateFrom` e `preferredDateTo`. As datas são
ISO 8601 inclusivas e o início não pode ser posterior ao fim. `search` consulta
descrição, endereço, cidade, nome/telefone do cliente e nome do serviço.

`sortBy` aceita `createdAt`, `updatedAt`, `preferredDate` ou `status`; a direção
aceita `asc` ou `desc`. Cliente e serviço são carregados na mesma consulta, sem
N+1.

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

## Máquina de estados

Transições válidas:

```text
PENDING     -> CONTACTED | CANCELLED
CONTACTED   -> QUOTED | CANCELLED
QUOTED      -> APPROVED | CONTACTED | CANCELLED
APPROVED    -> SCHEDULED | CANCELLED
SCHEDULED   -> IN_PROGRESS | APPROVED | CANCELLED
IN_PROGRESS -> COMPLETED | SCHEDULED | CANCELLED
COMPLETED   -> (final)
CANCELLED   -> (final)
```

Transição para o mesmo estado também é inválida. Uma transição inválida retorna
`422` com `INVALID_SERVICE_REQUEST_STATUS_TRANSITION`. Ao concluir,
`completedAt` é preenchido; ao cancelar, `cancelledAt` é preenchido. Timestamps
incompatíveis são definidos como `null` em toda transição válida.

## Erros de domínio

| Status | Código | Situação |
| ---: | --- | --- |
| 400 | `VALIDATION_ERROR` | Contrato, UUID, paginação ou data inválida |
| 400 | `INVALID_SERVICE_REQUEST_DATA` | Regra de conteúdo inválida |
| 400 | `INVALID_PREFERRED_DATE` | Data preferencial passada |
| 401 | `UNAUTHORIZED` | JWT ausente ou inválido em rota administrativa |
| 403 | `FORBIDDEN` | Papel não autorizado |
| 404 | `SERVICE_REQUEST_NOT_FOUND` | Solicitação inexistente |
| 404 | `SERVICE_NOT_FOUND` | Serviço inexistente |
| 409 | `SERVICE_INACTIVE` | Serviço indisponível |
| 409 | `DUPLICATE_SERVICE_REQUEST` | Reenvio idêntico recente |
| 409 | `CUSTOMER_PHONE_ALREADY_EXISTS` | Corrida de unicidade do telefone |
| 409 | `CUSTOMER_EMAIL_ALREADY_EXISTS` | Email já pertence a outro cliente |
| 422 | `INVALID_SERVICE_REQUEST_STATUS_TRANSITION` | Transição não permitida |

## Pendências futuras

- idempotência forte por `Idempotency-Key`;
- motivo estruturado de cancelamento;
- integração com Service Areas e validação de CEP;
- anexos, fotos, notificações e auditoria global.
