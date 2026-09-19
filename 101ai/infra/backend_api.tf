################################################################################
#                    Backend — Lambda + HTTP API Gateway                      #
################################################################################

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/tonberry-101ai-api-${var.environment}"
  retention_in_days = 14
}

resource "aws_iam_role" "lambda_exec" {
  name = "tonberry-101ai-lambda-exec-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# node_modules split out of the function's own deployment package and into
# a layer Lambda caches independently — the function zip is now just dist/
# (see deploy-101ai-api.yml), which is the real fix for cold starts here:
# an audit found the function isn't VPC-attached (so networking isn't the
# cause), and the actual contributors were the 25MB monolithic package and
# no provisioned concurrency. This addresses the package-size half:
# provisioned concurrency deliberately NOT added — it has an ongoing
# per-GB-second cost even when idle, a separate decision from just shrinking
# the package.
resource "aws_lambda_layer_version" "dependencies" {
  layer_name          = "tonberry-101ai-api-dependencies-${var.environment}"
  filename            = "${path.module}/layer.zip"
  source_code_hash    = filebase64sha256("${path.module}/layer.zip")
  compatible_runtimes = ["nodejs22.x"]
}

resource "aws_lambda_function" "api" {
  function_name    = "tonberry-101ai-api-${var.environment}"
  filename         = "${path.module}/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda.zip")
  handler          = "dist/lambda.handler"
  runtime          = "nodejs22.x"
  role             = aws_iam_role.lambda_exec.arn
  timeout          = 15
  memory_size      = 512
  layers           = [aws_lambda_layer_version.dependencies.arn]

  # Real code deploys happen via deploy-101ai-api.yml's
  # `aws lambda update-function-code` CLI call, not `terraform apply` — this
  # resource's filename/source_code_hash only matter for the very first
  # apply that creates the function. Without ignoring them, a later
  # `terraform apply` run with a stale or placeholder 101ai/infra/lambda.zip
  # sitting around would silently roll the LIVE function's code back to
  # whatever that file contains, fighting the CLI-deployed reality.
  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  environment {
    variables = {
      DATABASE_URL               = var.database_url
      JWT_SECRET                 = var.jwt_secret
      GOOGLE_OAUTH_CLIENT_ID     = var.google_oauth_client_id
      GOOGLE_OAUTH_CLIENT_SECRET = var.google_oauth_client_secret
      OPENAI_API_KEY             = var.openai_api_key
      GOOGLE_API_KEY             = var.google_api_key
      YOUTUBE_API_KEY            = var.youtube_api_key
      ADMIN_EMAIL                = var.admin_email
      FRONTEND_URL               = "https://101ai.tonberry.co.uk"
      GOOGLE_CALLBACK_URL        = "https://api.101ai.tonberry.co.uk/auth/google/callback"
      # S3_ENDPOINT/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY deliberately unset
      # here — this Lambda talks to real S3 via aws_iam_role.lambda_exec's
      # own permissions (see uploads.tf), not a static key pair the way
      # local dev's MinIO needs.
      S3_BUCKET = aws_s3_bucket.uploads.bucket
      S3_REGION = var.aws_region
    }
  }

  depends_on = [aws_cloudwatch_log_group.api]
}

resource "aws_apigatewayv2_api" "api" {
  name          = "tonberry-101ai-api-${var.environment}"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "api" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}

resource "aws_apigatewayv2_stage" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
