import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/user.entity';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  // Returns a presigned PUT url — the browser uploads the file bytes
  // directly to S3/MinIO from here, never through this API (avoids Lambda's
  // ~6MB synchronous-invoke payload limit). See UploadsService.
  @Post('presign')
  presign(@CurrentUser() user: User, @Body() dto: PresignUploadDto) {
    return this.uploads.createUploadUrl(user.id, dto.filename, dto.contentType, dto.size);
  }
}
