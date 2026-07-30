# Módulo de serviços

O catálogo de serviços expõe consultas públicas e operações administrativas.
Todas as respostas de serviço contêm somente:

```json
{
  "id": "1ad575e6-0225-45ce-bb18-296407bc558b",
  "name": "Instalação elétrica",
  "slug": "instalacao-eletrica",
  "description": "Instalações e reparos elétricos residenciais.",
  "category": "ELECTRICAL",
  "isActive": true,
  "createdAt": "2026-07-30T12:00:00.000Z",
  "updatedAt": "2026-07-30T12:00:00.000Z"
}
```

## Listar serviços

`GET /services`

A rota é pública e retorna somente serviços ativos por padrão. Os parâmetros de
query disponíveis são:

| Parâmetro | Padrão | Regra |
| --- | --- | --- |
| `page` | `1` | inteiro maior ou igual a 1 |
| `limit` | `20` | inteiro entre 1 e 100 |
| `search` | — | busca case-insensitive no nome |
| `category` | — | correspondência exata da categoria |
| `isActive` | `true` | aceito somente com JWT válido |
| `orderBy` | `name` | `name` ou `createdAt` |
| `sortOrder` | `asc` | `asc` ou `desc` |

Exemplo:

```http
GET /services?page=1&limit=20&search=elétrica&category=ELECTRICAL&orderBy=name&sortOrder=asc
```

```json
{
  "data": [
    {
      "id": "1ad575e6-0225-45ce-bb18-296407bc558b",
      "name": "Instalação elétrica",
      "slug": "instalacao-eletrica",
      "description": "Instalações e reparos elétricos residenciais.",
      "category": "ELECTRICAL",
      "isActive": true,
      "createdAt": "2026-07-30T12:00:00.000Z",
      "updatedAt": "2026-07-30T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

Uma consulta anônima que envie `isActive` recebe `403`. Um JWT inválido enviado
a uma rota pública recebe `401`.

## Consultar serviço pelo slug

`GET /services/:slug`

A rota é pública. Serviços inativos são tratados como inexistentes (`404`) para
clientes anônimos. Qualquer usuário com JWT válido pode consultá-los.

```http
GET /services/instalacao-eletrica
```

A resposta `200` usa o formato de serviço apresentado no início deste documento.

## Criar serviço

`POST /services`

Exige `Authorization: Bearer <access-token>` e papel `ADMIN`.

```json
{
  "name": "Instalação elétrica",
  "slug": "instalacao-eletrica",
  "description": "Instalações e reparos elétricos residenciais.",
  "category": "ELECTRICAL"
}
```

Uma criação válida retorna `201` e o serviço criado. O slug deve estar em
lowercase e kebab-case. Slug duplicado retorna `409` com o código
`SERVICE_SLUG_CONFLICT`.

## Atualizar serviço

`PATCH /services/:id`

Exige JWT e papel `ADMIN`. Aceita qualquer subconjunto não vazio de `name`,
`slug`, `description`, `category` e `isActive`.

```http
PATCH /services/1ad575e6-0225-45ce-bb18-296407bc558b
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "name": "Instalações elétricas",
  "slug": "instalacoes-eletricas"
}
```

Uma atualização válida retorna `200` e o serviço atualizado. `id`, `createdAt`
e `updatedAt` não são aceitos no corpo. Slugs alterados passam novamente pelas
validações de formato e unicidade.

## Desativar serviço

`DELETE /services/:id`

Exige JWT e papel `ADMIN`. A operação não remove o registro: define
`isActive=false`, retorna `200` com o serviço atualizado e o remove das consultas
públicas subsequentes.

```http
DELETE /services/1ad575e6-0225-45ce-bb18-296407bc558b
Authorization: Bearer <access-token>
```

Recursos inexistentes retornam `404` com `SERVICE_NOT_FOUND`. Erros seguem o
formato centralizado descrito no README e não expõem detalhes do Prisma.
