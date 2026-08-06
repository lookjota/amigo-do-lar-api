# Amigo do Lar API

API REST da plataforma Amigo do Lar, responsável por organizar clientes, serviços,
áreas de atendimento, solicitações, agendamentos e finanças operacionais.
O backend também oferece um centro interno e persistente de notificações para usuários administrativos; consulte [docs/notifications.md](docs/notifications.md).
Solicitações aceitam fotos e documentos privados em storage S3-compatible;
consulte [docs/service-request-attachments.md](docs/service-request-attachments.md).

## Objetivo

Construir uma API segura, observável, testável e pronta para produção, com regras
de negócio independentes do framework HTTP e uma estrutura que permita evoluir
os módulos sem introduzir a complexidade operacional de serviços distribuídos.

## Stack

- Node.js
- TypeScript
- Fastify
- PostgreSQL
- Prisma ORM
- Zod
- JWT
- Vitest
- Swagger/OpenAPI
- Docker
- GitHub Actions

## Arquitetura

O projeto adota um monólito modular. Cada módulo encapsula seu domínio e segue o
fluxo:

```text
HTTP -> Controller -> Service/Use Case -> Repository -> Database
```

Controllers tratam o protocolo HTTP, services ou use cases executam as regras de
negócio e repositories abstraem a persistência. Controllers nunca acessam o
Prisma diretamente.

Consulte [docs/architecture.md](docs/architecture.md) para as regras de
dependência e responsabilidades das camadas.

## Desenvolvimento local

Copie as variáveis de ambiente e inicie o PostgreSQL:

```bash
cp .env.example .env
docker compose up -d postgres
```

Antes de executar o seed, preencha `ADMIN_NAME`, `ADMIN_EMAIL` e
`ADMIN_PASSWORD` no arquivo `.env`. O seed gera um hash Argon2id e persiste
somente esse hash. A senha em texto puro existe apenas no ambiente do processo e
nunca deve ser versionada.

Prepare o banco e inicie a API:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

### Comandos do banco

- `npm run db:generate`: gera o Prisma Client após mudanças no schema.
- `npm run db:migrate -- --name <nome>`: cria e aplica uma migration em
  desenvolvimento.
- `npm run db:migrate:deploy`: aplica migrations já versionadas em outros
  ambientes.
- `npm run db:seed`: insere os dados iniciais de forma idempotente.
- `npm run db:studio`: abre a interface local de inspeção do Prisma.

Para interromper o banco local, execute `docker compose down`. Os dados ficam no
volume `postgres_data`; `docker compose down -v` também remove esse volume.

### Qualidade e execução

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run start
```

## Health checks

- `GET /health` é o liveness check da aplicação. Retorna `200` com
  `{ "status": "ok" }` enquanto o processo HTTP estiver operacional e não
  depende do banco de dados.
- `GET /ready` é o readiness check. Executa uma consulta leve no PostgreSQL por
  meio do Prisma e retorna `200` com `{ "status": "ready" }` quando o banco
  responde. Se essa dependência estiver indisponível, retorna `503` com
  `{ "status": "not_ready" }`, sem expor detalhes internos da falha.

## Respostas de erro

A API converte erros em um único formato. O `requestId` permite correlacionar a
resposta com os logs da requisição:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Resource not found",
    "statusCode": 404,
    "details": [],
    "requestId": "req-1"
  }
}
```

`details` contém informações seguras e estruturadas quando aplicável, como os
campos inválidos de uma requisição. Stack traces, mensagens internas do banco e
outros detalhes de infraestrutura nunca são enviados ao cliente.

### Códigos iniciais

| Código | Status | Uso |
| --- | ---: | --- |
| `BAD_REQUEST` | 400 | Requisição inválida |
| `VALIDATION_ERROR` | 400 | Falha de validação Fastify ou Zod |
| `UNAUTHORIZED` | 401 | Credenciais ausentes ou inválidas |
| `FORBIDDEN` | 403 | Operação não permitida |
| `RESOURCE_NOT_FOUND` | 404 | Recurso ou rota não encontrado |
| `CONFLICT` | 409 | Conflito genérico de estado |
| `RESOURCE_CONFLICT` | 409 | Conflito de unicidade identificado pelo Prisma |
| `UNPROCESSABLE_ENTITY` | 422 | Requisição válida que não pode ser processada |
| `INTERNAL_SERVER_ERROR` | 500 | Falha interna inesperada |

## Autenticação administrativa

### Login

`POST /auth/login`

```json
{
  "email": "admin@example.com",
  "password": "secure-password"
}
```

Uma autenticação válida retorna um access token JWT, seu tempo de vida em
segundos e os dados públicos do usuário:

```json
{
  "accessToken": "<token>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "b32efc7d-bb72-4d0b-a64b-b34f4fc83bad",
    "name": "Administrator",
    "email": "admin@example.com",
    "role": "ADMIN"
  }
}
```

Credenciais inválidas e contas inativas recebem sempre `401` com o código
`INVALID_CREDENTIALS`, sem indicar se o email está cadastrado.

### Usuário autenticado

`GET /auth/me`

Envie o token no header:

```http
Authorization: Bearer <access-token>
```

A resposta contém apenas `id`, `name`, `email` e `role`. Senha e
`passwordHash` nunca são retornados.

### Variáveis de ambiente

- `CORS_ORIGINS`: lista obrigatória de origens HTTP(S) autorizadas, separadas
  por vírgula. Espaços e entradas vazias são removidos. Cada valor deve conter
  somente a origem (protocolo, host e porta opcional), sem caminho, query ou
  fragmento. Exemplo local com um placeholder reservado para produção:
  `http://localhost:5173,https://frontend.example.com`. Substitua o domínio
  `example.com` pela origem real do frontend em produção. A API compara a origem
  recebida exatamente com essa allowlist; wildcard não é aceito.
- `JWT_SECRET`: segredo de assinatura com no mínimo 32 caracteres, sem valor
  padrão.
- `JWT_EXPIRES_IN`: duração positiva do access token, em segundos.
- `ADMIN_NAME`: nome usado pelo seed idempotente.
- `ADMIN_EMAIL`: email válido usado pelo seed.
- `ADMIN_PASSWORD`: senha com no mínimo 12 caracteres usada pelo seed para
  produzir o hash Argon2id.

O JWT contém somente `sub` (identificador do usuário), `role`, `iat` e `exp`.
Email não é incluído porque `/auth/me` consulta a fonte atual. As rotas
protegidas validam assinatura e expiração; a consulta do usuário também confirma
que a conta continua ativa. Senhas, hashes e tokens não devem ser registrados
em logs.

Este marco implementa somente access tokens. Refresh token, recuperação de senha
e cadastro público não fazem parte desta etapa; refresh token poderá ser
adicionado posteriormente se houver necessidade.

Erros operacionais representam situações esperadas e seguras para apresentação,
como recurso inexistente, conflito e entrada inválida. Eles preservam o status e
o código definidos pela aplicação e são registrados como aviso. Erros
inesperados são registrados como erro com o logger do Fastify e produzem sempre
uma resposta genérica `INTERNAL_SERVER_ERROR`, sem expor a causa interna.

## Catálogo de serviços

O módulo de serviços disponibiliza listagem e consulta pública, com paginação,
busca, filtro por categoria e ordenação. Serviços inativos ficam ocultos
publicamente. Criação, atualização e desativação lógica exigem JWT e papel
`ADMIN`; usuários autenticados também podem consultar registros inativos.

A referência completa, incluindo parâmetros, autorização e exemplos de request
e response, está em [docs/services.md](docs/services.md).

## Gerenciamento de clientes

O módulo de clientes oferece cadastro, consulta, busca, paginação, atualização e
desativação lógica. Todas as rotas exigem JWT; `ADMIN` e `OPERATOR` podem executar
operações de atendimento, enquanto somente `ADMIN` altera o estado ativo.
Telefones e emails são normalizados e únicos.

A referência completa está em [docs/customers.md](docs/customers.md).

## Usuários administrativos

O módulo de usuários permite que somente administradores ativos listem, consultem,
criem e editem contas, alterem estado e redefinam senhas. Emails são normalizados,
senhas usam Argon2id e transações protegem a existência de pelo menos um
administrador ativo. A referência completa está em [docs/users.md](docs/users.md).

## Solicitações de serviço

O módulo de solicitações recebe pedidos públicos de orçamento, cria ou reutiliza
clientes em uma transação, valida a disponibilidade do serviço e oferece à
equipe administrativa uma fila paginada com filtros e transições de estado
controladas. As operações administrativas exigem JWT com papel `ADMIN` ou
`OPERATOR`.

A referência completa está em
[docs/service-requests.md](docs/service-requests.md).

## Agendamentos

O módulo de agendamentos transforma solicitações aprovadas em atendimentos com
duração, prevenção de conflitos, reagendamento e máquina de estados. Mudanças
coordenadas com a solicitação são transacionais; as operações exigem JWT com
papel `ADMIN` ou `OPERATOR`.

A referência completa está em [docs/appointments.md](docs/appointments.md).

## Financeiro operacional

O módulo financeiro mantém um orçamento por solicitação, pagamentos com histórico
e saldo derivado. Valores são inteiros em centavos e o total é calculado pelo
backend. Não há gateway, integração bancária ou exclusão física nesta etapa.

A referência completa está em [docs/finance.md](docs/finance.md).

## Timeline operacional

Solicitações mantêm uma timeline interna, imutável e paginada com eventos automáticos e comentários de `ADMIN` e `OPERATOR`. A ação principal e seu evento são atômicos. Consulte [docs/service-request-timeline.md](docs/service-request-timeline.md).

## Activity Feed

`GET /service-requests/:id/activity` projeta os eventos da timeline em um DTO unificado, sanitizado e paginado por cursor, sem tabela ou eventos duplicados. Consulte [docs/service-request-activity.md](docs/service-request-activity.md).

## Status

Os marcos de fundação HTTP, banco de dados, autenticação administrativa,
catálogo de serviços, gerenciamento de clientes, solicitações de serviço e
agendamentos e usuários administrativos estão implementados. Endpoints e regras dos demais módulos serão
adicionados nos próximos marcos.

## Roadmap resumido

1. Foundation
2. Database
3. Authentication
4. Services
5. Customers
6. Service Requests
7. Appointments
8. Security and Observability
9. Tests and Documentation
10. Deployment

O detalhamento dos marcos está em [docs/roadmap.md](docs/roadmap.md).
