import { IsIn, IsInt, IsString, Max, Min, MinLength } from 'class-validator';

// Images plus common document/spreadsheet types. Only the image ones ever
// reach OpenAI as vision content (see ChatsService.resolveAttachmentsForVision)
// — there's no document-parsing pipeline here, so a PDF/Word/Excel file is
// stored and shown in the chat like any attachment, and the model is only
// told its filename (see ChatsService.describeNonImageAttachments), not its
// actual contents.
export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

// Comfortably covers a real phone photo (a compressed JPEG straight off a
// camera is typically 2-8MB) with margin under OpenAI's own 20MB-per-image
// vision limit, while keeping upload time reasonable on a slow connection.
// Kept in sync by hand with web/src/lib/uploads.ts's copy of this same
// constant (the client-side check that avoids wasting a request on a file
// that's obviously too big) — this one is the real, enforced limit.
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

export class PresignUploadDto {
  @IsString()
  @MinLength(1)
  filename: string;

  @IsIn(ALLOWED_UPLOAD_CONTENT_TYPES)
  contentType: string;

  // The exact byte size of the file about to be uploaded — validated here
  // (rejects an obviously-too-large request before ever issuing a
  // presigned url) and also passed through as the presigned PUT's
  // ContentLength (see UploadsService.createUploadUrl), which binds the
  // url to exactly this many bytes: a client can't declare a small size to
  // get approved and then upload something bigger, since S3/MinIO would
  // reject a PUT whose actual Content-Length doesn't match what was signed.
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_SIZE_BYTES)
  size: number;
}
