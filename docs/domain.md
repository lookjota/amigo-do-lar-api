# Domínio

Este documento registra um modelo conceitual inicial. Ele não define ainda o
schema do banco de dados nem todos os atributos e invariantes. Essas decisões
devem ser confirmadas durante a implementação de cada módulo.

## Entidades principais

### User

Representa uma identidade capaz de autenticar-se e executar ações na plataforma.
Contém as informações essenciais de acesso, estado da conta e autorização.
Possui papel `ADMIN` ou `OPERATOR`. Somente administradores ativos gerenciam
usuários; o último administrador ativo não pode ser desativado ou rebaixado e um
administrador não pode desativar a própria conta. Email é normalizado e único, e
senha existe na persistência somente como hash Argon2id.

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
Concentra descrição, endereço e cidade do atendimento, data preferencial
opcional, notas operacionais internas e seu estado atual. A área de atendimento
estruturada permanece futura; nesta etapa a localização é textual.

### Appointment

Representa a reserva de uma data e horário para atender uma `ServiceRequest`.
Registra duração, estado e timestamps operacionais. Agendamentos cancelados são
preservados; uma solicitação pode originar um novo registro após o cancelamento,
mas somente um agendamento não cancelado pode estar ativo por vez. Enquanto não
existirem técnicos ou prestadores, todos compartilham uma agenda operacional.

### Quote e Payment

`Quote` representa o orçamento operacional único de uma `ServiceRequest`, com
valores inteiros em centavos e total derivado. `Payment` registra recebimentos
vinculados ao orçamento, preservando cancelamentos e reembolsos. O saldo e a
situação financeira são derivados da soma dos pagamentos `PAID`.

### ServiceArea

Representa uma região geográfica em que um ou mais serviços podem ser oferecidos.
O formato da cobertura — cidade, bairro, código postal ou geometria — deverá ser
definido a partir dos requisitos operacionais.

## Relacionamentos principais

- Um `Customer` pode criar várias `ServiceRequest`.
- Uma `ServiceRequest` pertence a um `Customer`.
- Uma `ServiceRequest` referencia um `Service`.
- Uma `ServiceRequest` poderá ser associada a uma `ServiceArea` quando as regras
  de cobertura forem implementadas.
- Uma `ServiceRequest` pode originar nenhum, um ou vários `Appointment`; registros
  cancelados são preservados e substituídos por um novo agendamento.
- Uma `ServiceRequest` possui zero ou um `Quote`.
- Um `Quote` possui zero ou vários `Payment`.
- Um `Service` pode estar disponível em várias `ServiceArea`.
- Uma `ServiceArea` pode oferecer vários `Service`.
- Um `User` pode estar associado a um `Customer`, sujeito às regras futuras de
  identidade, perfis e autorização.

## Estados de uma solicitação

Estados implementados de `ServiceRequest`:

- `PENDING`: solicitação criada e aguardando análise.
- `CONTACTED`: equipe realizou o primeiro contato.
- `QUOTED`: orçamento preparado e apresentado.
- `APPROVED`: orçamento aprovado pelo cliente.
- `SCHEDULED`: atendimento agendado.
- `IN_PROGRESS`: atendimento iniciado.
- `COMPLETED`: atendimento concluído.
- `CANCELLED`: solicitação cancelada.

Fluxo principal:

```text
PENDING -> CONTACTED -> QUOTED -> APPROVED -> SCHEDULED -> IN_PROGRESS -> COMPLETED
```

Fluxos alternativos:

```text
PENDING -> CANCELLED
CONTACTED -> CANCELLED
QUOTED -> CONTACTED | CANCELLED
APPROVED -> CANCELLED
SCHEDULED -> APPROVED | CANCELLED
IN_PROGRESS -> SCHEDULED | CANCELLED
```

`COMPLETED` e `CANCELLED` são finais. Transições para o mesmo estado são
inválidas. Consulte [service-requests.md](service-requests.md) para o contrato
completo.

A criação de um orçamento executa atomicamente a transição `CONTACTED -> QUOTED`.
A aprovação do orçamento executa atomicamente `QUOTED -> APPROVED`; escritas
condicionais impedem que concorrência sobrescreva outro estado da solicitação.

## Estados de um agendamento

O fluxo principal é `SCHEDULED -> CONFIRMED -> IN_PROGRESS -> COMPLETED`.
`SCHEDULED`, `CONFIRMED` e `IN_PROGRESS` podem ser cancelados; `CONFIRMED` pode
voltar a `SCHEDULED` e `IN_PROGRESS` pode voltar a `CONFIRMED`. `COMPLETED` e
`CANCELLED` são finais. Consulte [appointments.md](appointments.md).

## Estados financeiros

O orçamento segue `DRAFT -> SENT -> APPROVED | REJECTED | CANCELLED`, também
permitindo `DRAFT -> CANCELLED`. Um aprovado só é cancelado sem pagamento pago.
O pagamento segue `PENDING -> PAID | CANCELLED` e `PAID -> REFUNDED`. Consulte
[finance.md](finance.md).
