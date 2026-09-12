import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Upload URL just needs to outlive the browser's PUT; view URLs get handed
// to OpenAI for vision (see ChatsService) and to the frontend for message
// thumbnails, generated fresh on every read (see ChatsService) — nothing
// durable is ever stored, so an expired one just means "ask again", not a
// broken permanent link.
const UPLOAD_URL_EXPIRY_SECONDS = 5 * 60;
const VIEW_URL_EXPIRY_SECONDS = 15 * 60;

@Injectable()
export class UploadsService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private bucketEnsured = false;

  constructor(private readonly config: ConfigService) {
    // Set only for local dev (see root docker-compose.yml's minio service) —
    // unset in prod, where this talks to real S3 using Lambda's IAM role via
    // the SDK's default credential chain, never a static key pair.
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    this.bucket = this.config.get<string>('S3_BUCKET') ?? 'tonberry-uploads';
    this.client = new S3Client({
      region: this.config.get<string>('S3_REGION') ?? 'us-east-1',
      ...(endpoint
        ? {
            endpoint,
            forcePathStyle: true, // MinIO needs path-style, not virtual-hosted
            credentials: {
              accessKeyId: this.config.get<string>('S3_ACCESS_KEY_ID') ?? 'tonberry',
              secretAccessKey:
                this.config.get<string>('S3_SECRET_ACCESS_KEY') ?? 'tonberry123',
            },
          }
        : {}),
    });
  }

  // MinIO starts empty (no buckets), unlike prod's bucket which Terraform
  // already provisions — lazily creates it on first real use rather than
  // requiring a separate manual `mc` setup step for local dev. Only ever
  // runs locally (S3_ENDPOINT set); a missing bucket in prod is a real
  // config error that should surface as one, not be silently "fixed".
  private async ensureLocalBucket(): Promise<void> {
    if (this.bucketEnsured || !this.config.get<string>('S3_ENDPOINT')) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
    this.bucketEnsured = true;
  }

  async createUploadUrl(
    userId: string,
    filename: string,
    contentType: string,
    size: number,
  ): Promise<{ key: string; uploadUrl: string }> {
    await this.ensureLocalBucket();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
    // 101ai/ prefix — the bucket (and MinIO instance) is shared tonberry
    // infra, not dedicated to this one app, so every key this service writes
    // stays scoped under this project's own folder.
    const key = `101ai/uploads/${userId}/${randomUUID()}-${sanitizedFilename}`;
    // ContentLength binds the presigned url to exactly this many bytes —
    // S3/MinIO rejects a PUT whose actual Content-Length doesn't match what
    // was signed, so this is what actually enforces the size cap (dto.size
    // being ≤ MAX_UPLOAD_SIZE_BYTES, already checked by PresignUploadDto's
    // validation) rather than just trusting the client to behave.
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: size,
      }),
      { expiresIn: UPLOAD_URL_EXPIRY_SECONDS },
    );
    return { key, uploadUrl };
  }

  async getViewUrl(key: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: VIEW_URL_EXPIRY_SECONDS },
    );
  }

  // For OpenAI's vision input specifically (see ChatsService) — a presigned
  // *view* url isn't good enough there, because OpenAI's own servers have to
  // be able to fetch it, and a local MinIO instance behind localhost isn't
  // reachable from anywhere but this machine (confirmed: OpenAI's fetcher
  // gets a stuck-behind-a-proxy 407 trying). Fetching the bytes ourselves
  // and inlining them as a data: URI sidesteps that entirely — the model
  // never has to fetch anything — and it's just as valid in prod, so this
  // is the one path used for vision in both environments, not a local-only
  // workaround.
  async getObjectAsDataUrl(key: string, contentType: string): Promise<string> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await response.Body!.transformToByteArray();
    return `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}`;
  }
}
