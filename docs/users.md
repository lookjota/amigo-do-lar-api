# Usuários administrativos

Todas as rotas deste módulo exigem `Authorization: Bearer <access-token>` e papel
`ADMIN`. Contas `OPERATOR` recebem `403`; requisições sem autenticação recebem
`401`. O usuário indicado por `sub` no JWT é revalidado no banco como
administrador ativo em cada operação do módulo.

## Contrato público

Itens de lista, detalhes e respostas de mutação contêm somente `id`, `name`,
`email`, `role`, `isActive`, `createdAt` e `updatedAt`. Senha, `passwordHash`,
token e dados internos de autenticação nunca fazem parte dessas respostas.

## Endpoints

### `GET /users`

Aceita `page` (padrão `1`), `limit` (padrão `20`, máximo `100`), `search`
(nome ou email), `role` (`ADMIN` ou `OPERATOR`), `isActive`, `orderBy` (`name`,
`email`, `role`, `isActive`, `createdAt` ou `updatedAt`) e `sortOrder` (`asc` ou
`desc`). Retorna:

```json
{
  "data": [{
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Administrative User",
    "email": "admin@example.com",
    "role": "ADMIN",
    "isActive": true,
    "createdAt": "2026-08-05T12:00:00.000Z",
    "updatedAt": "2026-08-05T12:00:00.000Z"
  }],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### `GET /users/:id`

Retorna o contrato público ou `404 USER_NOT_FOUND`.

### `POST /users`

```json
{
  "name": "Operations User",
  "email": "operator@example.com",
  "password": "example-only-password",
  "role": "OPERATOR",
  "isActive": true
}
```

`isActive` é opcional e assume `true`. O nome é aparado e espaços repetidos são
reduzidos; o email é aparado e convertido para lowercase. A senha deve ter no
mínimo 12 caracteres e é persistida somente como hash Argon2id. Email duplicado
retorna `409 USER_EMAIL_ALREADY_EXISTS`. A resposta é `201` com o contrato
público.

### `PATCH /users/:id`

Aceita um objeto não vazio contendo apenas `name`, `email` e/ou `role`. Estado e
senha possuem endpoints próprios. Rebaixar o último `ADMIN` ativo retorna
`409 LAST_ACTIVE_ADMIN`.

### `PATCH /users/:id/status`

Aceita exatamente `{ "isActive": boolean }`. Autodesativação retorna
`409 SELF_DEACTIVATION_FORBIDDEN`; desativar o último administrador ativo retorna
`409 LAST_ACTIVE_ADMIN`. A resposta contém o usuário atualizado.

### `PATCH /users/:id/password`

Aceita exatamente `{ "password": "example-only-password" }`, aplica a mesma
regra mínima de 12 caracteres e retorna `204` sem corpo. O payload não deve ser
incluído em logs. Não há confirmação no backend; a confirmação pertence ao
frontend.

## Consistência e sessões

Desativação e rebaixamento do último administrador usam transação com isolamento
`Serializable`. O JWT atual contém o papel emitido no login, mas as rotas deste
módulo consultam novamente o ator, bloqueando imediatamente claims desatualizadas
de administradores rebaixados ou desativados. A aplicação ainda não possui
refresh tokens, denylist ou versão de sessão; portanto, invalidação global de
access tokens após mudança de papel, status ou senha permanece uma limitação.

## Erros

Além dos códigos específicos acima, aplicam-se `400 VALIDATION_ERROR` ou
`INVALID_USER_DATA`, `401 UNAUTHORIZED`, `403 FORBIDDEN` ou
`ADMIN_ACCESS_REQUIRED` e `500 INTERNAL_SERVER_ERROR`, sempre no envelope de erro
padronizado da API.
