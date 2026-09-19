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
# no provisioned concurrency. This addresses the package-size half; see
# aws_lambda_provisioned_concurrency_config.api below for the other half
# (added 2026-09-19 once real Logs Insights data showed the two together —
# Init Duration plus lambda.ts's lazy NestJS bootstrap/DB connect — cost
# ~3.5-4.7s billed on a genuine cold start, not just the package-size part).
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
  # Bootstraps aws_lambda_alias.live below onto a real published version —
  # AWS rejects provisioned concurrency on an alias that resolves to
  # $LATEST, so the alias can't just start there. Every apply that changes
  # this resource (even just layers, ignored filename/hash aside) publishes
  # a new version this way; harmless (published versions are cheap/inert),
  # just not the ONLY way versions get published — deploy-101ai-api.yml
  # also publishes one on every code deploy and moves the alias itself from
  # then on (see that alias's own lifecycle.ignore_changes).
  publish = true

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

# The deploy workflow (deploy-101ai-api.yml) moves this to point at each
# newly-published version after every `aws lambda update-function-code` —
# code deploys happen via that CLI-driven path, not `terraform apply` (see
# the lifecycle block above), so this alias's function_version is
# intentionally NOT terraform-managed either, same reasoning as the
# function's own filename/source_code_hash.
resource "aws_lambda_alias" "live" {
  name          = "live"
  function_name = aws_lambda_function.api.function_name
  # Bootstraps onto whatever aws_lambda_function.api.publish just produced
  # (a real published version, never $LATEST — see that argument's own
  # comment for why). ignore_changes hands ownership of this value to
  # deploy-101ai-api.yml's update-alias step immediately after.
  function_version = aws_lambda_function.api.version

  lifecycle {
    ignore_changes = [function_version]
  }
}

# Keeps lambda.ts's lazy bootstrap() (NestJS module compilation + the Neon
# DB connection) permanently done on this one instance, rather than paying
# that cost on whichever request happens to land on a cold container — see
# the comment on aws_lambda_layer_version.dependencies above for the real
# numbers this is based on. Targets the alias, not the bare function, so it
# always tracks whatever the deploy workflow most recently published
# instead of a stale version.
resource "aws_lambda_provisioned_concurrency_config" "api" {
  function_name                     = aws_lambda_function.api.function_name
  qualifier                         = aws_lambda_alias.live.name
  provisioned_concurrent_executions = 1
}

resource "aws_apigatewayv2_api" "api" {
  name          = "tonberry-101ai-api-${var.environment}"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "api" {
  api_id           = aws_apigatewayv2_api.api.id
  integration_type = "AWS_PROXY"
  # Points at the "live" alias, not the bare function — routes real traffic
  # through the provisioned-concurrency-backed alias so it actually
  # benefits from it, rather than hitting $LATEST directly.
  integration_uri        = aws_lambda_alias.live.invoke_arn
  payload_format_version = "2.0"

  depends_on = [aws_lambda_permission.apigw_live]
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

# Separate statement_id (not modifying the one above) — a qualifier change
# on aws_lambda_permission forces replacement, and destroy-then-create in
# the same apply as the integration switch below risks a gap where API
# Gateway briefly can't invoke either ARN. Adding this instead is purely
# additive: the old unqualified permission stays in place (harmless, just
# unused once the integration points at the alias) and this new one grants
# invoke on the "live" alias specifically.
resource "aws_lambda_permission" "apigw_live" {
  statement_id  = "AllowAPIGatewayInvokeLive"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  qualifier     = aws_lambda_alias.live.name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
