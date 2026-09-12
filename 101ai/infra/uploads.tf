################################################################################
#         Uploads — private S3 bucket for chat/note attachments (images)      #
################################################################################

# Separate from aws_s3_bucket.web (frontend.tf) on purpose — that bucket is
# the public static site behind CloudFront, wrong shape entirely for
# per-user uploads (private, scoped access via presigned urls only). See
# 101ai/api/src/uploads/uploads.service.ts for how this is actually used —
# presigned PUT for the browser's direct upload, presigned GET for message
# thumbnails, and a direct GetObject (not a url) when feeding an image to
# OpenAI's vision input, since OpenAI's own servers have no way to reach a
# bucket URL that isn't itself public.
resource "aws_s3_bucket" "uploads" {
  bucket = "tonberry-101ai-uploads-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

# PUT only — the browser only ever uploads directly (via a presigned PUT
# url from UploadsController); every read goes through the API (a
# presigned GET url it generates, or a direct server-side fetch for
# OpenAI), never a direct browser GET against this bucket.
resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins = ["https://101ai.tonberry.co.uk"]
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}

resource "aws_iam_role_policy" "lambda_uploads" {
  name = "tonberry-101ai-lambda-uploads-${var.environment}"
  role = aws_iam_role.lambda_exec.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:GetObject"]
      Resource = "${aws_s3_bucket.uploads.arn}/*"
    }]
  })
}
