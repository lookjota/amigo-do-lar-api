import { extname, basename } from 'node:path';

import { BadRequestError } from '../../shared/errors/http-errors.js';

const TYPE_EXTENSIONS = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
} as const;

export type AllowedAttachmentMimeType = keyof typeof TYPE_EXTENSIONS;

function fileError(code: string, message: string): BadRequestError {
  return new BadRequestError({ code, message });
}

export function sanitizeAttachmentFilename(value: string): string {
  const name = basename(value.replace(/\\/g, '/')).split('').filter((character) => {
    const code = character.charCodeAt(0);
    return code > 31 && code !== 127;
  }).join('').trim();
  if (name.length === 0 || name.length > 255 || name === '.' || name === '..') {
    throw fileError('ATTACHMENT_INVALID_FILENAME', 'Attachment filename is invalid');
  }
  return name;
}

export function normalizeCaption(value: string | undefined): string | null {
  if (value === undefined || value.trim() === '') return null;
  const caption = value.trim();
  if (caption.length > 500) throw fileError('VALIDATION_ERROR', 'Caption must have at most 500 characters');
  return caption;
}

function matchesSignature(mimeType: AllowedAttachmentMimeType, bytes: Uint8Array): boolean {
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  if (mimeType === 'image/webp') return bytes.length >= 12 && Buffer.from(bytes.subarray(0, 4)).toString() === 'RIFF' && Buffer.from(bytes.subarray(8, 12)).toString() === 'WEBP';
  return bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString() === '%PDF-';
}

export function validateAttachmentFile(filename: string, mimeType: string, content: Uint8Array, maxSize: number): { originalName: string; extension: string; mimeType: AllowedAttachmentMimeType } {
  if (content.byteLength === 0) throw fileError('ATTACHMENT_EMPTY_FILE', 'Attachment file cannot be empty');
  if (content.byteLength > maxSize) throw fileError('ATTACHMENT_TOO_LARGE', 'Attachment exceeds the configured size limit');
  if (!(mimeType in TYPE_EXTENSIONS)) throw fileError('ATTACHMENT_UNSUPPORTED_TYPE', 'Attachment type is not supported');
  const typedMime = mimeType as AllowedAttachmentMimeType;
  const originalName = sanitizeAttachmentFilename(filename);
  const extension = extname(originalName).toLowerCase();
  if (!(TYPE_EXTENSIONS[typedMime] as readonly string[]).includes(extension) || !matchesSignature(typedMime, content)) {
    throw fileError('ATTACHMENT_UNSUPPORTED_TYPE', 'Attachment extension, MIME type, or content signature is inconsistent');
  }
  return { originalName, extension: typedMime === 'image/jpeg' ? '.jpg' : extension, mimeType: typedMime };
}
