# Roadmap

Os marcos descrevem uma sequência inicial. O conteúdo de cada entrega poderá ser
refinado conforme requisitos funcionais e operacionais forem validados.

## M1 Foundation

- Inicializar Node.js e TypeScript.
- Configurar Fastify, variáveis de ambiente e logging estruturado.
- Definir lint, typecheck, testes e build.
- Implementar tratamento centralizado de erros e health checks.
- Preparar Swagger/OpenAPI, Docker e integração contínua básica.

## M2 Database

- Configurar PostgreSQL e Prisma.
- Definir convenções de schema, migrations e seed.
- Criar infraestrutura de conexão e repositories.
- Estabelecer estratégia de transações e testes com banco isolado.

## M3 Authentication

- Implementar cadastro e autenticação de usuários.
- Definir access tokens, refresh tokens e política de revogação.
- Implementar hashing seguro de senhas.
- Preparar autorização baseada nos requisitos do produto.

## M4 Services

Status: concluído.

- Catálogo público com paginação, busca, categoria e ordenação.
- Consulta de serviço por slug com visibilidade baseada em autenticação.
- Criação e atualização restritas a administradores.
- Disponibilidade controlada por ativação e desativação lógica.
- Relação entre serviços e áreas atendidas permanece para um marco futuro,
  quando seus requisitos forem definidos.

## M5 Customers

Status: concluído no marco de entrega M6.

- Cadastro e manutenção com telefone e email normalizados e únicos.
- Consultas protegidas com paginação, busca, filtro de estado e ordenação.
- Acesso para administradores e operadores, com mudança de estado restrita a
  administradores.
- Desativação lógica com preservação do histórico.
- Endereços permanecem fora do escopo até existirem requisitos concretos.

## M6 Service Requests

Status: concluído no marco de entrega solicitado como M7.

- Criação pública transacional com criação ou reutilização de cliente.
- Acompanhamento administrativo paginado, com busca, filtros e relacionamentos.
- Máquina de estados explícita, timestamps terminais e cancelamento lógico.
- Endereço e cidade textuais registrados; Service Areas permanece futuro.

## M7 Appointments

Status: concluído no marco de entrega solicitado como M8.

- Agendamento, reagendamento e cancelamento com histórico preservado.
- Disponibilidade por intervalos em uma agenda operacional única.
- Máquina de estados e sincronização transacional com solicitações.

## M8.1 Financeiro operacional

Status: concluído na branch `feature/finance-module`.

- Orçamento único por solicitação e valores inteiros em centavos.
- Pagamentos manuais, histórico e situação financeira derivada.
- Transições explícitas e proteção transacional contra excesso concorrente.
- Relatórios, PDF, conciliação e gateways permanecem futuros.

## M8 Security and Observability

### Timeline operacional de solicitações

Status: concluído na branch `feature/service-request-timeline`.

- Eventos internos automáticos e comentários administrativos imutáveis.
- Persistência atômica com solicitações, agendamentos e financeiro.
- Sem backfill, anexos, notificações, WebSocket ou auditoria global nesta etapa.

Entrega parcial: módulo administrativo de usuários concluído, com RBAC exclusivo
para `ADMIN`, projeções públicas, redefinição segura de senha e proteção
transacional do último administrador ativo. Revogação global de sessões permanece
planejada.

- Reforçar CORS, headers de segurança e rate limiting.
- Aplicar redaction de dados sensíveis nos logs.
- Adicionar métricas, correlação de requisições e sinais operacionais.
- Executar revisão de ameaças e controles de segurança.

## M9 Tests and Documentation

- Ampliar testes unitários e de integração.
- Validar contratos HTTP e cenários críticos.
- Consolidar documentação OpenAPI e guias operacionais.
- Definir critérios de cobertura orientados a risco.

## M10 Deployment

- Produzir imagem Docker otimizada.
- Configurar pipeline de entrega.
- Definir execução segura de migrations.
- Documentar deploy, rollback, backup e recuperação.
- Validar health checks e encerramento gracioso em produção.
