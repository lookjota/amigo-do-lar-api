# Anexos de solicitações

O módulo mantém metadados no PostgreSQL e objetos em storage S3-compatible. Não há
binário no banco nem persistência no filesystem do container. AWS S3, Cloudflare
R2 e MinIO podem ser usados por meio de endpoint, região, bucket e credenciais.
Por padrão o módulo fica desativado e suas rotas não são registradas; nesse
estado elas recebem o `404 RESOURCE_NOT_FOUND` padronizado da aplicação.

## Contrato e acesso

- `POST /service-requests/:id/attachments`: multipart com exatamente um `file`,
  uma `category` e `caption` opcional.
- `GET /service-requests/:id/attachments`: paginação, `category` e `sortOrder`.
- `GET /service-requests/:serviceRequestId/attachments/:attachmentId`: metadados.
- `GET .../:attachmentId/download`: redirect para URL assinada por 180 segundos,
  com disposition `attachment`, `nosniff` e sem cache.
- `DELETE .../:attachmentId`: remoção lógica, exclusiva de `ADMIN`.

Todos os endpoints exigem JWT. `ADMIN` e `OPERATOR` podem enviar e consultar. A
autoria vem exclusivamente de `request.user.sub`. Não existe upload público,
edição, restauração ou compartilhamento permanente.

Categorias: `BEFORE_SERVICE`, `AFTER_SERVICE`, `RECEIPT`, `DOCUMENT` e `OTHER`.
São aceitos JPEG, PNG, WebP e PDF, com MIME, extensão e magic bytes coerentes. O
limite padrão é 10 MiB e pode ser alterado por
`ATTACHMENT_MAX_FILE_SIZE_BYTES`. SVG, HTML, executáveis, ZIP, arquivos vazios e
tipos desconhecidos são rejeitados. O nome é reduzido ao basename, limpo e
limitado a 255 caracteres; caption é texto de até 500 caracteres.

## Storage, consistência e segurança

`AttachmentStorage` abstrai upload, exclusão compensatória e URL assinada. A key
é gerada como `service-requests/{serviceRequestId}/{uuid}.{ext}` e nunca é aceita
do cliente ou retornada nos contratos públicos. Configure:

```text
ATTACHMENT_STORAGE_DRIVER=disabled
S3_ENDPOINT=https://...
S3_REGION=...
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=false
ATTACHMENT_MAX_FILE_SIZE_BYTES=10485760
```

Para ativar anexos, altere o driver para `s3` e configure endpoint, região,
bucket, access key e secret key. Essas variáveis são obrigatórias somente com o
driver `s3`. O driver `fake` é aceito apenas em testes e não faz chamadas
externas. Para MinIO local, use endpoint local e `S3_FORCE_PATH_STYLE=true`;
bucket e credenciais devem ser provisionados fora da aplicação.

O upload ocorre antes da transação. Metadados, timeline e notificações são
confirmados juntos; se a transação falhar, o objeto recém-enviado é removido por
compensação. Falha da compensação gera log apenas com IDs internos seguros. A
remoção é lógica e preserva objeto, uploader e histórico. Uma rotina futura de
retenção deverá eliminar objetos órfãos/removidos após prazo definido.

Uploads e remoções geram `ATTACHMENT_ADDED`/`ATTACHMENT_REMOVED` na timeline e
nas notificações. Recebem notificações usuários ativos `ADMIN`/`OPERATOR`, exceto
o ator. Metadata contém somente IDs, categoria e, na timeline de upload, MIME;
não contém arquivo, key, URL ou dados do cliente.

O Activity Feed representa upload e remoção exclusivamente pelos eventos da timeline. Anexos ativos não são acrescentados como uma segunda atividade, e anexos removidos permanecem no histórico com apenas ID e categoria. Consulte [service-request-activity.md](service-request-activity.md).
