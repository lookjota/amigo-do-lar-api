import type { AttachmentCategory, UserRole } from '@prisma/client';

export const ATTACHMENT_CATEGORIES = ['BEFORE_SERVICE', 'AFTER_SERVICE', 'RECEIPT', 'DOCUMENT', 'OTHER'] as const satisfies readonly AttachmentCategory[];
export const ATTACHMENT_DEFAULT_LIMIT = 20;
export const ATTACHMENT_MAX_LIMIT = 100;
export const ATTACHMENT_DOWNLOAD_EXPIRY_SECONDS = 180;

export interface AttachmentActor { id: string; name: string; email: string; role: UserRole }
export interface AttachmentEntity {
  id: string;
  serviceRequestId: string;
  category: AttachmentCategory;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  caption: string | null;
  createdAt: Date;
  uploadedBy: AttachmentActor;
}
export interface StoredAttachment extends AttachmentEntity { storageKey: string; isDeleted: boolean }
export interface ListAttachmentsInput { page: number; limit: number; category?: AttachmentCategory; sortOrder: 'asc' | 'desc' }
export interface AttachmentListResult { data: AttachmentEntity[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
export interface UploadAttachmentInput { filename: string; mimeType: string; content: Uint8Array; category: AttachmentCategory; caption?: string }
export interface PersistAttachmentInput {
  id: string; serviceRequestId: string; uploadedByUserId: string; category: AttachmentCategory;
  originalName: string; storageKey: string; mimeType: string; sizeBytes: number; checksum: string;
  caption: string | null;
}
