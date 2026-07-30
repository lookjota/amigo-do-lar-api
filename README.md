# Amigo do Lar API

API REST da plataforma Amigo do Lar, responsável por organizar clientes, serviços,
áreas de atendimento, solicitações e agendamentos.

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

Antes de executar o seed, preencha `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL` e
`SEED_ADMIN_PASSWORD_HASH` no arquivo `.env`. O hash deve ser gerado fora do
repositório com o algoritmo que será adotado pelo módulo de autenticação; não
grave a senha em texto puro.

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

## Status

Os marcos de fundação HTTP e banco de dados estão implementados. Endpoints de
negócio, autenticação e regras dos módulos serão adicionados nos próximos marcos.

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
