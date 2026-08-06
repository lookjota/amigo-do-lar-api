import type { AttachmentStorage, AttachmentUploadInput } from './attachment-storage.js';

export class FakeAttachmentStorage implements AttachmentStorage {
  readonly objects = new Map<string, AttachmentUploadInput>();

  upload(input: AttachmentUploadInput): Promise<void> {
    this.objects.set(input.storageKey, input);
    return Promise.resolve();
  }

  delete(storageKey: string): Promise<void> {
    this.objects.delete(storageKey);
    return Promise.resolve();
  }

  getSignedDownloadUrl(storageKey: string, expiresInSeconds: number): Promise<string> {
    return Promise.resolve(`https://storage.test/download/${encodeURIComponent(storageKey)}?expires=${expiresInSeconds}`);
  }
}
