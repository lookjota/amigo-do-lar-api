# Módulo de clientes

O módulo mantém dados de contato usados nas operações internas. Todas as rotas
exigem `Authorization: Bearer <access-token>`.

Uma resposta de cliente contém somente `id`, `name`, `phone`, `email`,
`isActive`, `createdAt` e `updatedAt`.

## Autorização

| Operação | ADMIN | OPERATOR |
| --- | :---: | :---: |
| Listar e consultar, inclusive inativos | Sim | Sim |
| Criar | Sim | Sim |
| Atualizar nome, telefone e email | Sim | Sim |
| Alterar `isActive` | Sim | Não |
| Desativar por `DELETE` | Sim | Não |

## Listar clientes

`GET /customers`

| Parâmetro | Padrão | Regra |
| --- | --- | --- |
| `page` | `1` | inteiro maior ou igual a 1 |
| `limit` | `20` | inteiro entre 1 e 100 |
| `search` | — | busca em nome, telefone ou email |
| `isActive` | — | `true` ou `false`; sem filtro, retorna ambos |
| `sortBy` | `name` | `name`, `createdAt` ou `updatedAt` |
| `sortOrder` | `asc` | `asc` ou `desc` |

```http
GET /customers?page=1&limit=20&search=joao&isActive=true&sortBy=name&sortOrder=asc
Authorization: Bearer <access-token>
```

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

## Consultar cliente

`GET /customers/:id` retorna um cliente ativo ou inativo pelo UUID. Registro
inexistente retorna `404` com `CUSTOMER_NOT_FOUND`.

## Criar cliente

`POST /customers`

```json
{
  "name": "João da Silva",
  "phone": "(61) 99999-9999",
  "email": "joao@example.com"
}
```

Uma criação válida retorna `201`. Email omitido, `null` ou vazio é armazenado
como `null`. O nome perde espaços externos e espaços internos excedentes. O
telefone descarta toda formatação e deve resultar em 10 ou 11 dígitos. Assim,
`(61) 99999-9999`, `61 99999-9999` e `61999999999` são persistidos como
`61999999999`. O email é armazenado em lowercase e sem espaços externos.

## Atualizar cliente

`PATCH /customers/:id` aceita um subconjunto não vazio de `name`, `phone`,
`email` e `isActive`. Campos imutáveis ou desconhecidos são rejeitados. Somente
`ADMIN` pode enviar `isActive`, inclusive para reativar um cliente.

```json
{
  "phone": "61 98888-7777",
  "email": "NOVO@example.com"
}
```

## Desativar cliente

`DELETE /customers/:id` exige `ADMIN`. A operação define `isActive=false`,
retorna o cliente atualizado e nunca remove a linha. O cliente permanece
consultável e pode ser reativado via `PATCH` por um administrador.

## Erros

| Status | Código | Situação |
| ---: | --- | --- |
| 400 | `INVALID_CUSTOMER_DATA` | nome ou email inválido |
| 400 | `INVALID_CUSTOMER_PHONE` | telefone não resulta em 10 ou 11 dígitos |
| 400 | `VALIDATION_ERROR` | contrato HTTP, UUID ou query inválida |
| 401 | `UNAUTHORIZED` | JWT ausente ou inválido |
| 403 | `FORBIDDEN` | papel sem acesso à rota |
| 403 | `CUSTOMER_STATUS_UPDATE_FORBIDDEN` | operador tentou alterar `isActive` |
| 404 | `CUSTOMER_NOT_FOUND` | cliente inexistente |
| 409 | `CUSTOMER_PHONE_ALREADY_EXISTS` | telefone normalizado duplicado |
| 409 | `CUSTOMER_EMAIL_ALREADY_EXISTS` | email normalizado duplicado |

Os erros usam o formato centralizado descrito no README e não expõem detalhes
do Prisma ou do banco de dados.
