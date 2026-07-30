# AGENTS.md

Este arquivo orienta qualquer agente que trabalhe neste repositório.

## Projeto e arquitetura

- Este projeto é uma API Node.js desenvolvida com TypeScript e Fastify.
- A arquitetura adotada é um monólito modular.
- Controllers recebem requisições e retornam respostas, mas não contêm regras de negócio.
- Services ou use cases concentram as regras de negócio.
- Repositories abstraem a persistência.
- Controllers não podem acessar o Prisma diretamente.

## Escopo e implementação

- Antes de implementar qualquer mudança, analise os arquivos existentes e o contexto da tarefa.
- Não crie abstrações sem um problema concreto que as justifique.
- Não implemente funcionalidades fora do escopo solicitado.
- Não altere arquivos não relacionados à tarefa.
- Use nomes e código em inglês.
- Documentação explicativa pode ser escrita em português.
- Não adicione dependências sem explicar e justificar sua necessidade.
- Nunca insira segredos, credenciais ou outros dados sensíveis no repositório.

## Qualidade e Git

- Toda implementação deve passar por lint, typecheck, testes e build.
- Não execute `git commit` automaticamente.

## Entrega

Ao terminar uma tarefa, apresente:

- arquivos criados;
- arquivos modificados;
- decisões tomadas;
- comandos executados;
- testes realizados;
- riscos ou pendências.
