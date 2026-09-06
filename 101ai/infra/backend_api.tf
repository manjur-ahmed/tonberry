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

resource "aws_lambda_function" "api" {
  function_name    = "tonberry-101ai-api-${var.environment}"
  filename         = "${path.module}/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda.zip")
  handler          = "dist/lambda.handler"
  runtime          = "nodejs22.x"
  role             = aws_iam_role.lambda_exec.arn
  timeout          = 15
  memory_size      = 512

  environment {
    variables = {
      DATABASE_URL               = var.database_url
      JWT_SECRET                 = var.jwt_secret
      GOOGLE_OAUTH_CLIENT_ID     = var.google_oauth_client_id
      GOOGLE_OAUTH_CLIENT_SECRET = var.google_oauth_client_secret
      OPENAI_API_KEY             = var.openai_api_key
      FRONTEND_URL               = "https://101ai.tonberry.co.uk"
      GOOGLE_CALLBACK_URL        = "https://api.101ai.tonberry.co.uk/auth/google/callback"
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
