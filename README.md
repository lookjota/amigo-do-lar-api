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

## Comandos futuros

Os comandos abaixo representam a interface planejada para o projeto e ainda não
estão disponíveis nesta etapa:

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run build
npm run start
```

## Status

O projeto está em sua fase inicial de documentação e definição arquitetural.
Node.js ainda não foi inicializado e nenhuma dependência foi instalada.

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
