import { describe, expect, it } from 'vitest';

import { validateAttachmentFile } from './attachment-validation.js';

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

describe('attachment validation', () => {
  it.each([
    ['photo.jpg', 'image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff, 1])],
    ['photo.png', 'image/png', png],
    ['photo.webp', 'image/webp', Buffer.from('RIFF1234WEBPdata')],
    ['document.pdf', 'application/pdf', Buffer.from('%PDF-1.7')],
  ])('accepts valid %s content', (filename, mimeType, content) => {
    expect(validateAttachmentFile(filename, mimeType, content, 100).mimeType).toBe(mimeType);
  });

  it.each([
    ['empty.pdf', 'application/pdf', new Uint8Array(), 'ATTACHMENT_EMPTY_FILE'],
    ['unsafe.svg', 'image/svg+xml', Buffer.from('<svg>'), 'ATTACHMENT_UNSUPPORTED_TYPE'],
    ['unsafe.html', 'text/html', Buffer.from('<html>'), 'ATTACHMENT_UNSUPPORTED_TYPE'],
    ['wrong.png', 'image/png', Buffer.from('%PDF-'), 'ATTACHMENT_UNSUPPORTED_TYPE'],
    ['wrong.pdf', 'application/pdf', Buffer.from('%PDF-123456'), 'ATTACHMENT_TOO_LARGE'],
  ])('rejects invalid file %s', (filename, mimeType, content, code) => {
    expect(() => validateAttachmentFile(filename, mimeType, content, 8)).toThrow(expect.objectContaining({ code }));
  });

  it('keeps only a sanitized basename and rejects excessive names', () => {
    expect(validateAttachmentFile('../../photo.png', 'image/png', png, 100).originalName).toBe('photo.png');
    expect(() => validateAttachmentFile(`${'a'.repeat(256)}.png`, 'image/png', png, 100)).toThrow(expect.objectContaining({ code: 'ATTACHMENT_INVALID_FILENAME' }));
  });
});
