# Módulo de agendamentos

O módulo transforma uma solicitação aprovada em uma reserva operacional e
coordena o ciclo do atendimento com o estado da `ServiceRequest`. Todas as rotas
exigem JWT e aceitam os papéis `ADMIN` e `OPERATOR`.

## Dados e histórico

Cada agendamento registra `scheduledAt`, `durationMinutes`, `status`, notas
opcionais e os timestamps `startedAt`, `completedAt` e `cancelledAt`. O motivo de
cancelamento não foi incluído porque o contrato atual não o recebe nem possui
uma regra de obrigatoriedade.

Uma solicitação pode manter vários agendamentos para preservar o histórico, mas
somente um deles pode estar não cancelado. Ao cancelar, a solicitação volta para
`APPROVED`; um novo `POST /appointments` cria outro registro em vez de reativar
ou sobrescrever o cancelado. Um índice único parcial reforça essa regra no banco.

## Endpoints

- `POST /appointments`: cria um agendamento (`201`);
- `GET /appointments`: lista com paginação e filtros;
- `GET /appointments/:id`: retorna o agendamento, solicitação, cliente e serviço;
- `PATCH /appointments/:id`: altera horário, duração ou notas;
- `PATCH /appointments/:id/status`: executa uma transição de estado.

Não existe exclusão física. O cancelamento é feito pelo endpoint de status.
Campos desconhecidos são rejeitados.

### Criação

A solicitação precisa existir e estar em `APPROVED`, não pode possuir outro
agendamento ativo, o horário precisa ser futuro e o intervalo deve estar livre.
A criação do `Appointment` e a mudança da `ServiceRequest` para `SCHEDULED`
ocorrem na mesma transação serializável.
Essa transação também registra `APPOINTMENT_CREATED`. Reagendamento de horário registra datas anterior e nova, e transições registram estados anterior e novo. O ator vem do JWT.
Cada um desses eventos notifica `ADMIN` e `OPERATOR` ativos, excluindo o ator, dentro da mesma transação.

```bash
curl -X POST http://localhost:3000/appointments \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -d '{"serviceRequestId":"22222222-2222-4222-8222-222222222222","scheduledAt":"2026-08-10T14:00:00.000Z","durationMinutes":120,"notes":"Levar ferramentas."}'
```

### Listagem

`page=1`, `limit=20`, `sortBy=scheduledAt` e `sortOrder=asc` são os padrões;
`limit` fica entre 1 e 100. Os filtros são `status`, `serviceRequestId`,
`customerId`, `serviceId`, `scheduledFrom` e `scheduledTo`. A ordenação aceita
`scheduledAt`, `createdAt`, `updatedAt` e `status`. Relações são carregadas na
consulta paginada, sem N+1.

### Reagendamento

O PATCH comum aceita somente `scheduledAt`, `durationMinutes` e `notes`. Mudança
de horário ou duração recalcula conflitos e ignora o próprio registro. Estados
finais não podem ser reagendados. O endpoint não muda o status implicitamente;
quando for necessária nova confirmação, use a transição explícita
`CONFIRMED -> SCHEDULED`.

## Estados e sincronização

```text
SCHEDULED   -> CONFIRMED | CANCELLED
CONFIRMED   -> IN_PROGRESS | SCHEDULED | CANCELLED
IN_PROGRESS -> COMPLETED | CONFIRMED | CANCELLED
COMPLETED   -> (final)
CANCELLED   -> (final)
```

Transições para o mesmo estado são inválidas. A regra é pura e mudanças
coordenadas são transacionais:

```text
Appointment SCHEDULED ou CONFIRMED -> ServiceRequest SCHEDULED
Appointment IN_PROGRESS            -> ServiceRequest IN_PROGRESS
Appointment COMPLETED              -> ServiceRequest COMPLETED
Appointment CANCELLED              -> ServiceRequest APPROVED
```

`startedAt`, `completedAt` e `cancelledAt` acompanham os respectivos estados.

## Conflitos, datas e limitações

O MVP usa uma agenda operacional única porque ainda não há técnico ou prestador.
Dois intervalos conflitam quando `novoInício < términoExistente` e
`novoTérmino > inícioExistente`; intervalos adjacentes são permitidos e registros
`CANCELLED` são ignorados. `durationMinutes` aceita de 15 a 480 minutos.

As entradas usam ISO 8601, são convertidas e persistidas em UTC. A comparação
usa timestamps absolutos e não depende do timezone do servidor. O frontend é
responsável pela apresentação no timezone local. No futuro, o prestador poderá
ser acrescentado como dimensão da consulta de disponibilidade.

## Erros

| Status | Código | Situação |
| ---: | --- | --- |
| 400 | `VALIDATION_ERROR` | Contrato, UUID, enum ou paginação inválida |
| 400 | `INVALID_APPOINTMENT_DATE` | Data inválida ou passada |
| 401 | `UNAUTHORIZED` | JWT ausente ou inválido |
| 403 | `FORBIDDEN` | Papel não autorizado |
| 404 | `APPOINTMENT_NOT_FOUND` | Agendamento inexistente |
| 404 | `SERVICE_REQUEST_NOT_FOUND` | Solicitação inexistente |
| 409 | `APPOINTMENT_ALREADY_EXISTS` | Solicitação já possui agendamento ativo |
| 409 | `APPOINTMENT_TIME_CONFLICT` | Intervalo ocupado |
| 409 | `SERVICE_REQUEST_NOT_APPROVED` | Solicitação fora de `APPROVED` |
| 409 | `SERVICE_REQUEST_ALREADY_COMPLETED` | Solicitação concluída |
| 409 | `SERVICE_REQUEST_CANCELLED` | Solicitação cancelada |
| 422 | `INVALID_APPOINTMENT_STATUS_TRANSITION` | Transição inválida |

## Exemplos adicionais

```bash
curl 'http://localhost:3000/appointments?status=SCHEDULED&page=1&limit=20' \
  -H 'Authorization: Bearer <access-token>'

curl -X PATCH http://localhost:3000/appointments/11111111-1111-4111-8111-111111111111 \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -d '{"scheduledAt":"2026-08-11T14:00:00.000Z","durationMinutes":90}'

curl -X PATCH http://localhost:3000/appointments/11111111-1111-4111-8111-111111111111/status \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -d '{"status":"CANCELLED"}'
```

Evoluções futuras incluem associação a técnicos/prestadores, proteção de
concorrência por constraint específica de agenda, auditoria, motivo estruturado
de cancelamento e notificações.

Criação, reagendamento e mudança de status também aparecem no [Activity Feed](service-request-activity.md) pela referência já gravada na timeline; a tabela de agendamentos não gera itens paralelos.
