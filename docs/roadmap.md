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

- Implementar cadastro e manutenção de clientes.
- Definir dados de contato e endereços necessários.
- Aplicar regras de acesso e proteção de dados pessoais.

## M6 Service Requests

- Implementar criação e acompanhamento de solicitações.
- Definir transições de estado e regras de cancelamento.
- Registrar serviço, cliente, área e informações necessárias ao atendimento.

## M7 Appointments

- Implementar agendamento e reagendamento.
- Validar disponibilidade e conflitos de horário.
- Relacionar agendamentos às solicitações.

## M8 Security and Observability

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
