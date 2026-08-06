import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { AttachmentStorage, AttachmentUploadInput } from './attachment-storage.js';

export interface S3AttachmentStorageOptions {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export class S3AttachmentStorage implements AttachmentStorage {
  private readonly client: S3Client;

  constructor(private readonly options: S3AttachmentStorageOptions) {
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: options.forcePathStyle,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    });
  }

  async upload(input: AttachmentUploadInput): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.options.bucket, Key: input.storageKey, Body: input.content, ContentType: input.contentType }));
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: storageKey }));
  }

  getSignedDownloadUrl(storageKey: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({
      Bucket: this.options.bucket,
      Key: storageKey,
      ResponseContentDisposition: 'attachment',
      ResponseCacheControl: 'private, no-store',
    }), { expiresIn: expiresInSeconds });
  }
}
