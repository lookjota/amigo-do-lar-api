export interface AttachmentUploadInput {
  storageKey: string;
  contentType: string;
  content: Uint8Array;
}

export interface AttachmentStorage {
  upload(input: AttachmentUploadInput): Promise<void>;
  delete(storageKey: string): Promise<void>;
  getSignedDownloadUrl(storageKey: string, expiresInSeconds: number): Promise<string>;
}
