import { IsIn, IsString, MinLength } from 'class-validator';
import { ALLOWED_UPLOAD_CONTENT_TYPES } from '../../uploads/dto/presign-upload.dto';

// Shared by CreateChatDto/AddMessageDto — the key a prior POST
// /uploads/presign call returned, plus enough metadata (contentType for the
// vision call, filename for display) to skip a second lookup.
export class AttachmentDto {
  @IsString()
  @MinLength(1)
  key: string;

  @IsIn(ALLOWED_UPLOAD_CONTENT_TYPES)
  contentType: string;

  @IsString()
  @MinLength(1)
  filename: string;
}
