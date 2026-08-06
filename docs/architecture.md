# Arquitetura

## Visão geral

A Amigo do Lar API adota um monólito modular. A aplicação é implantada como uma
única unidade, enquanto seus recursos são organizados em módulos de negócio com
limites explícitos.

Essa abordagem mantém a operação simples e permite que cada módulo evolua com
baixo acoplamento. A separação em serviços distribuídos só deverá ser considerada
diante de um problema concreto de escala, autonomia ou implantação.

## Fluxo de uma requisição

```text
HTTP -> Controller -> Service/Use Case -> Repository -> Database
```

1. A camada HTTP recebe e valida a requisição.
2. O controller converte dados HTTP em uma chamada de aplicação.
3. O service ou use case executa as regras de negócio.
4. O repository traduz as necessidades da aplicação em operações de persistência.
5. A implementação de infraestrutura acessa o banco de dados.
6. O resultado retorna pelas camadas e é convertido em resposta HTTP.

No módulo de usuários administrativos, respostas são construídas a partir de uma
projeção pública explícita no repository. Alterações capazes de remover o último
administrador ativo são verificadas e persistidas na mesma transação serializável.
No módulo financeiro, a soma paga e a gravação compartilham uma transação
serializável. A aprovação do orçamento e a sincronização válida da solicitação
também são atômicas.
O módulo de timeline usa as mesmas camadas. Eventos automáticos reutilizam uma função compatível com `Prisma.TransactionClient` nos repositories operacionais, garantindo a mesma transação sem acoplar services nem introduzir event bus.
O centro de notificações segue o mesmo padrão: endpoints usam controller, service e repository; a geração automática usa um helper transacional explícito nos comandos operacionais. Timeline e notificações permanecem tabelas independentes.

## Responsabilidades

### Controller

- Receber requisições e extrair parâmetros, corpo e identidade autenticada.
- Acionar um service ou use case.
- Converter o resultado em uma resposta HTTP.
- Não implementar regras de negócio.
- Não acessar Prisma ou banco de dados diretamente.

### Service ou use case

- Representar uma ação ou capacidade da aplicação.
- Coordenar regras de negócio e dependências.
- Consultar ou persistir dados por meio de repositories.
- Produzir resultados independentes de Fastify e do protocolo HTTP.
- Definir os limites de transação quando o caso de uso exigir atomicidade.

### Repository

- Abstrair as operações de persistência necessárias aos casos de uso.
- Expor contratos orientados ao domínio, evitando detalhes de Prisma.
- Encapsular consultas, mapeamentos e operações de banco.
- Não conter regras de negócio que pertençam ao caso de uso ou domínio.

### Domain

- Expressar conceitos, estados, invariantes e comportamentos essenciais.
- Permanecer independente de Fastify, Prisma, HTTP e mecanismos externos.
- Introduzir entidades ou value objects somente quando houver comportamento ou
  invariantes que justifiquem a abstração.

### Infrastructure

- Implementar repositories e integrações externas.
- Conter Prisma, acesso ao PostgreSQL, provedores de segurança e observabilidade.
- Traduzir falhas técnicas para erros que a aplicação consiga tratar.

### Shared

- Hospedar somente recursos genuinamente compartilhados entre módulos.
- Não servir como depósito para código sem domínio ou proprietário definido.

## Dependências permitidas

- Controllers podem depender de schemas HTTP e services/use cases.
- Services/use cases podem depender do domínio e de contratos de repositories.
- O domínio pode depender apenas de código do próprio domínio ou de utilitários
  sem vínculo com infraestrutura.
- Implementações de repositories podem depender de Prisma e PostgreSQL.
- O bootstrap da aplicação pode conhecer módulos, plugins e implementações
  concretas para realizar a composição das dependências.
- Um módulo pode consumir uma interface pública de outro módulo quando essa
  colaboração for necessária e explícita.

## Dependências proibidas

- Controllers não podem depender de Prisma ou de implementações de repositories.
- Services/use cases não podem depender de Fastify, objetos HTTP ou schemas de
  transporte.
- O domínio não pode depender de Fastify, Prisma, Zod, JWT ou banco de dados.
- Contratos de repositories não devem expor tipos gerados pelo Prisma.
- Módulos não devem acessar detalhes internos ou tabelas pertencentes a outro
  módulo sem um contrato explícito.
- Camadas internas não devem importar a camada de apresentação.

## Princípios arquiteturais

- Modularidade orientada às capacidades de negócio.
- Regras de negócio independentes do framework HTTP.
- Dependências apontando para regras e contratos, não para infraestrutura.
- Validação nas fronteiras da aplicação.
- Tratamento centralizado e consistente de erros.
- Segurança e observabilidade incorporadas desde a fundação.
- Testes unitários para regras e testes de integração para fronteiras reais.
- Interfaces criadas apenas em fronteiras relevantes ou quando existe necessidade
  concreta de substituição.
- Ausência de abstrações especulativas e de funcionalidades fora do escopo.
- Mudanças pequenas, rastreáveis e restritas aos arquivos relacionados à tarefa.
