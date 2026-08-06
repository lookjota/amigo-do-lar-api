# Activity Feed de solicitações

O Activity Feed é uma projeção de leitura unificada sobre `ServiceRequestEvent`. Não existe tabela `Activity`, migration, backfill ou duplicação de eventos. Agendamentos, orçamentos, pagamentos e anexos aparecem pelas referências já registradas atomicamente na timeline; as tabelas de origem não são concatenadas à lista.

## Endpoint e acesso

`GET /service-requests/:id/activity` exige JWT e aceita `ADMIN` e `OPERATOR`. Não há endpoint público nem operação `POST`, `PATCH` ou `DELETE`. Uma solicitação inexistente retorna `SERVICE_REQUEST_NOT_FOUND`.

Query params:

- `cursor`: cursor opaco retornado pela página anterior;
- `limit`: 1 a 100, padrão 20;
- `type`: um `ServiceRequestEventType` exato;
- `category`: `REQUEST`, `STATUS`, `COMMENT`, `APPOINTMENT`, `QUOTE`, `PAYMENT` ou `ATTACHMENT`;
- `sortOrder`: `asc` ou `desc`, padrão `desc`.

A ordenação é estável por `createdAt` e `id`. O cursor contém internamente esses dois valores, mas seu formato é privado e deve ser tratado pelo cliente como opaco. Cursor inválido retorna `VALIDATION_ERROR`. O repository aplica filtros e cursor no PostgreSQL, seleciona `limit + 1` para calcular `hasMore` e não carrega a lista completa.

## DTO e mapeamento

Cada item contém `id`, `eventType`, `activityType`, `title`, `description`, `createdAt`, `actor`, `resource` e `details`. O ator contém apenas `id`, `name`, `email` e `role`, ou `null`.

| Evento | Categoria | Recurso |
| --- | --- | --- |
| `REQUEST_CREATED` | `REQUEST` | `SERVICE_REQUEST` |
| `STATUS_CHANGED` | `STATUS` | `SERVICE_REQUEST` |
| `COMMENT_ADDED` | `COMMENT` | `SERVICE_REQUEST` |
| `APPOINTMENT_*` | `APPOINTMENT` | `APPOINTMENT` |
| `QUOTE_*` | `QUOTE` | `QUOTE` |
| `PAYMENT_*` | `PAYMENT` | `PAYMENT` |
| `ATTACHMENT_*` | `ATTACHMENT` | `ATTACHMENT` |

`details` é montado por allowlist específica: estados `from/to`; IDs de agendamento, orçamento, pagamento e anexo; datas do agendamento; categoria e MIME do anexo adicionado. Metadata ausente ou inválido produz detalhes parciais ou `null`, sem quebrar a página. O metadata original nunca é retornado.

São excluídos `storageKey`, URL assinada, checksum, binário, payload bruto, valores e referências financeiras, credenciais e quaisquer propriedades não previstas. Eventos `ATTACHMENT_REMOVED` continuam visíveis como histórico; o feed não transforma anexos ativos em itens adicionais, evitando duplicar `ATTACHMENT_ADDED`.

## Limitações

O feed mostra somente eventos efetivamente presentes na timeline e não reconstrói operações históricas anteriores à adoção dela. Não agrega dados atuais das entidades, não oferece busca textual, totais, saltos de página ou mutações. Enriquecimento em lote poderá ser adicionado se um evento futuro exigir detalhes que não estejam no metadata seguro; a versão atual não executa consultas relacionadas e, portanto, não possui N+1.
