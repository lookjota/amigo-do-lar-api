# Domínio

Este documento registra um modelo conceitual inicial. Ele não define ainda o
schema do banco de dados nem todos os atributos e invariantes. Essas decisões
devem ser confirmadas durante a implementação de cada módulo.

## Entidades principais

### User

Representa uma identidade capaz de autenticar-se e executar ações na plataforma.
Contém as informações essenciais de acesso, estado da conta e autorização.

### Customer

Representa a pessoa ou organização que solicita um serviço. Mantém os dados de
contato e demais informações necessárias para o atendimento. Um `Customer` pode
estar associado a um `User`, sem que essa associação seja obrigatoriamente
presumida nesta fase. Possui nome normalizado, telefone brasileiro normalizado e
único, email opcional normalizado e único quando informado, além de estado ativo.
A remoção é lógica por `isActive=false`; registros inativos permanecem
disponíveis para consultas administrativas e histórico.

### Service

Representa um tipo de serviço oferecido pela plataforma. Define sua identificação,
descrição e disponibilidade. Regras comerciais, preço e duração serão definidos
quando existirem requisitos concretos.

### ServiceRequest

Representa a intenção de um `Customer` de contratar ou receber um `Service`.
Concentra o contexto da solicitação, sua área de atendimento e seu estado atual.

### Appointment

Representa a reserva de uma data e horário para atender uma `ServiceRequest`.
Reagendamento, cancelamento, duração e conflitos de agenda serão tratados como
regras próprias do módulo de agendamentos.

### ServiceArea

Representa uma região geográfica em que um ou mais serviços podem ser oferecidos.
O formato da cobertura — cidade, bairro, código postal ou geometria — deverá ser
definido a partir dos requisitos operacionais.

## Relacionamentos principais

- Um `Customer` pode criar várias `ServiceRequest`.
- Uma `ServiceRequest` pertence a um `Customer`.
- Uma `ServiceRequest` referencia um `Service`.
- Uma `ServiceRequest` ocorre em uma `ServiceArea`.
- Uma `ServiceRequest` pode originar nenhum, um ou vários `Appointment`, conforme
  a política de histórico e reagendamento que vier a ser adotada.
- Um `Service` pode estar disponível em várias `ServiceArea`.
- Uma `ServiceArea` pode oferecer vários `Service`.
- Um `User` pode estar associado a um `Customer`, sujeito às regras futuras de
  identidade, perfis e autorização.

## Estados de uma solicitação

Estados conceituais iniciais de `ServiceRequest`:

- `PENDING`: solicitação criada e aguardando análise.
- `ACCEPTED`: solicitação aceita para atendimento.
- `SCHEDULED`: atendimento agendado.
- `IN_PROGRESS`: atendimento iniciado.
- `COMPLETED`: atendimento concluído.
- `CANCELLED`: solicitação cancelada.
- `REJECTED`: solicitação recusada.

Fluxo principal:

```text
PENDING -> ACCEPTED -> SCHEDULED -> IN_PROGRESS -> COMPLETED
```

Fluxos alternativos:

```text
PENDING -> REJECTED
PENDING | ACCEPTED | SCHEDULED -> CANCELLED
```

As transições finais, permissões, motivos obrigatórios e possibilidade de
cancelamento após o início dependem de validação das regras do produto.
