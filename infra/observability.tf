################################################################################
#            Observability — CloudWatch alarms, SNS email alerts             #
#                                                                              #
#   No Grafana Cloud CloudWatch role here (unlike 101ai/infra) — that role's  #
#   policy (tonberry-101ai-grafana-cloudwatch-prod) already grants read       #
#   access to CloudWatch/Logs account-wide (every action there is scoped to   #
#   Resource: "*", not to specific Lambda/API Gateway ARNs), so it already    #
#   covers this app's metrics/logs too. Nothing new to grant.                #
################################################################################

resource "aws_sns_topic" "alerts" {
  name = "tonberry-web-alerts-${var.environment}"
}

# AWS requires the recipient to click a confirmation link SNS emails them
# before this subscription actually starts delivering — it shows as
# PendingConfirmation in the console/state until then.
resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# --- Lambda alarms --------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "tonberry-web-lambda-errors-${var.environment}"
  alarm_description   = "API Lambda (${aws_lambda_function.api.function_name}) returned one or more errors in the last 5 minutes"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = aws_lambda_function.api.function_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  alarm_name          = "tonberry-web-lambda-throttles-${var.environment}"
  alarm_description   = "API Lambda (${aws_lambda_function.api.function_name}) was throttled in the last 5 minutes — concurrency limit reached"
  namespace           = "AWS/Lambda"
  metric_name         = "Throttles"
  dimensions          = { FunctionName = aws_lambda_function.api.function_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  alarm_name         = "tonberry-web-lambda-duration-${var.environment}"
  alarm_description  = "API Lambda (${aws_lambda_function.api.function_name}) p99 duration is approaching its ${aws_lambda_function.api.timeout}s timeout"
  namespace          = "AWS/Lambda"
  metric_name        = "Duration"
  dimensions         = { FunctionName = aws_lambda_function.api.function_name }
  extended_statistic = "p99"
  period             = 300
  evaluation_periods = 2
  # Function timeout is aws_lambda_function.api.timeout (15s) — alarm at
  # ~80% of that (12000ms) so there's real warning before requests actually
  # start timing out, not just after.
  threshold           = 12000
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

# --- API Gateway alarms ----------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "apigw_5xx" {
  alarm_name          = "tonberry-web-apigw-5xx-${var.environment}"
  alarm_description   = "API Gateway (${aws_apigatewayv2_api.api.name}) returned one or more 5xx responses in the last 5 minutes"
  namespace           = "AWS/ApiGateway"
  metric_name         = "5xx"
  dimensions          = { ApiId = aws_apigatewayv2_api.api.id }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "apigw_4xx" {
  alarm_name          = "tonberry-web-apigw-4xx-elevated-${var.environment}"
  alarm_description   = "API Gateway (${aws_apigatewayv2_api.api.name}) 4xx rate is unusually high (20+ in 5 minutes) — may indicate a broken client, a bad deploy, or scraping/abuse."
  namespace           = "AWS/ApiGateway"
  metric_name         = "4xx"
  dimensions          = { ApiId = aws_apigatewayv2_api.api.id }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 20
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}
