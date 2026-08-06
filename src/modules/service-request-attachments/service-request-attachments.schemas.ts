import { ATTACHMENT_CATEGORIES, ATTACHMENT_DEFAULT_LIMIT, ATTACHMENT_MAX_LIMIT } from './service-request-attachments.types.js';

const uuid = { type: 'string', format: 'uuid' } as const;
const attachment = {
  type: 'object', additionalProperties: false,
  properties: {
    id: uuid, serviceRequestId: uuid, category: { type: 'string', enum: ATTACHMENT_CATEGORIES },
    originalName: { type: 'string' }, mimeType: { type: 'string' }, sizeBytes: { type: 'integer' },
    checksum: { anyOf: [{ type: 'string' }, { type: 'null' }] }, caption: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    createdAt: { type: 'string', format: 'date-time' },
    uploadedBy: { type: 'object', additionalProperties: false, properties: { id: uuid, name: { type: 'string' }, email: { type: 'string' }, role: { type: 'string', enum: ['ADMIN', 'OPERATOR'] } }, required: ['id', 'name', 'email', 'role'] },
  },
  required: ['id', 'serviceRequestId', 'category', 'originalName', 'mimeType', 'sizeBytes', 'checksum', 'caption', 'createdAt', 'uploadedBy'],
} as const;
const params = { type: 'object', additionalProperties: false, properties: { serviceRequestId: uuid, attachmentId: uuid }, required: ['serviceRequestId', 'attachmentId'] } as const;
export const uploadAttachmentSchema = { params: { type: 'object', additionalProperties: false, properties: { id: uuid }, required: ['id'] }, response: { 201: attachment } } as const;
export const listAttachmentsSchema = {
  params: { type: 'object', additionalProperties: false, properties: { id: uuid }, required: ['id'] },
  querystring: { type: 'object', additionalProperties: false, properties: { page: { type: 'integer', minimum: 1, default: 1 }, limit: { type: 'integer', minimum: 1, maximum: ATTACHMENT_MAX_LIMIT, default: ATTACHMENT_DEFAULT_LIMIT }, category: { type: 'string', enum: ATTACHMENT_CATEGORIES }, sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } } },
} as const;
export const getAttachmentSchema = { params, response: { 200: attachment } } as const;
export const downloadAttachmentSchema = { params } as const;
export const deleteAttachmentSchema = { params } as const;
