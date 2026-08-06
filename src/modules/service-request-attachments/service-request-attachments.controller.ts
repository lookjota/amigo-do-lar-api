import type { AttachmentCategory } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { BadRequestError } from '../../shared/errors/http-errors.js';
import type { ServiceRequestAttachmentsService } from './service-request-attachments.service.js';
import type { ListAttachmentsInput } from './service-request-attachments.types.js';

interface RequestParams { id: string }
interface AttachmentParams { serviceRequestId: string; attachmentId: string }

function multipartError(code: string, message: string, statusCode = 400): BadRequestError {
  const error = new BadRequestError({ code, message });
  if (statusCode === 413) Object.defineProperty(error, 'statusCode', { value: 413 });
  return error;
}

export class ServiceRequestAttachmentsController {
  constructor(private readonly service: ServiceRequestAttachmentsService, private readonly maxSize: number) {}

  upload = async (request: FastifyRequest<{ Params: RequestParams }>, reply: FastifyReply): Promise<void> => {
    if (!request.isMultipart()) throw multipartError('ATTACHMENT_FILE_REQUIRED', 'A multipart file is required');
    let file: { filename: string; mimeType: string; content: Uint8Array } | undefined;
    let category: AttachmentCategory | undefined;
    let caption: string | undefined;
    const seen = new Set<string>();
    try {
      for await (const part of request.parts({ limits: { fileSize: this.maxSize, files: 2, fields: 3, parts: 5 } })) {
        if (seen.has(part.fieldname)) throw multipartError('VALIDATION_ERROR', `Duplicate multipart field: ${part.fieldname}`);
        seen.add(part.fieldname);
        if (part.type === 'file') {
          if (part.fieldname !== 'file' || file !== undefined) throw multipartError('VALIDATION_ERROR', 'Only one file field is allowed');
          const content = await part.toBuffer();
          file = { filename: part.filename, mimeType: part.mimetype, content };
        } else if (part.fieldname === 'category') category = String(part.value) as AttachmentCategory;
        else if (part.fieldname === 'caption') caption = String(part.value);
        else throw multipartError('VALIDATION_ERROR', `Unexpected multipart field: ${part.fieldname}`);
      }
    } catch (error) {
      if (error instanceof BadRequestError) throw error;
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'FST_REQ_FILE_TOO_LARGE') throw multipartError('ATTACHMENT_TOO_LARGE', 'Attachment exceeds the configured size limit', 413);
      if (typeof error === 'object' && error !== null && 'code' in error && ['FST_FILES_LIMIT', 'FST_FIELDS_LIMIT', 'FST_PARTS_LIMIT'].includes(String(error.code))) throw multipartError('VALIDATION_ERROR', 'Multipart limits were exceeded');
      throw error;
    }
    if (file === undefined) throw multipartError('ATTACHMENT_FILE_REQUIRED', 'A multipart file is required');
    if (category === undefined || !['BEFORE_SERVICE', 'AFTER_SERVICE', 'RECEIPT', 'DOCUMENT', 'OTHER'].includes(category)) throw multipartError('VALIDATION_ERROR', 'A valid attachment category is required');
    await reply.status(201).send(await this.service.upload(request.params.id, request.user.sub, { ...file, category, ...(caption === undefined ? {} : { caption }) }));
  };

  list = async (request: FastifyRequest<{ Params: RequestParams; Querystring: ListAttachmentsInput }>, reply: FastifyReply): Promise<void> => { await reply.send(await this.service.list(request.params.id, request.query)); };
  get = async (request: FastifyRequest<{ Params: AttachmentParams }>, reply: FastifyReply): Promise<void> => { await reply.send(await this.service.get(request.params.serviceRequestId, request.params.attachmentId)); };
  download = async (request: FastifyRequest<{ Params: AttachmentParams }>, reply: FastifyReply): Promise<void> => {
    const result = await this.service.download(request.params.serviceRequestId, request.params.attachmentId);
    await reply.header('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`).header('x-content-type-options', 'nosniff').header('cache-control', 'private, no-store').redirect(result.url);
  };
  remove = async (request: FastifyRequest<{ Params: AttachmentParams }>, reply: FastifyReply): Promise<void> => { await this.service.remove(request.params.serviceRequestId, request.params.attachmentId, request.user.sub, request.user.role); await reply.status(204).send(); };
}
