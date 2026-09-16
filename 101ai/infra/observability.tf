################################################################################
#            Observability — CloudWatch alarms, SNS email alerts,             #
#                       Grafana Cloud CloudWatch access                       #
################################################################################

# --- Alerting -----------------------------------------------------------

resource "aws_sns_topic" "alerts" {
  name = "tonberry-101ai-alerts-${var.environment}"
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
  alarm_name          = "tonberry-101ai-lambda-errors-${var.environment}"
  alarm_description   = "API Lambda (${aws_lambda_function.api.function_name}) returned one or more errors in the last 5 minutes"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = aws_lambda_function.api.function_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  # Missing data here just means no invocations happened — not an error
  # state, so don't alarm on it (the default INSUFFICIENT_DATA behavior
  # would otherwise flap the alarm on every quiet period).
  treat_missing_data = "notBreaching"
  alarm_actions      = [aws_sns_topic.alerts.arn]
  ok_actions         = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  alarm_name          = "tonberry-101ai-lambda-throttles-${var.environment}"
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
  alarm_name         = "tonberry-101ai-lambda-duration-${var.environment}"
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
# HTTP API (apigatewayv2) publishes 4xx/5xx as their own CloudWatch metrics
# under AWS/ApiGateway, dimensioned by ApiId — no access logging needs to be
# enabled for these to exist (that's a separate, richer per-request log
# stream, not required for alarms/metrics).

resource "aws_cloudwatch_metric_alarm" "apigw_5xx" {
  alarm_name          = "tonberry-101ai-apigw-5xx-${var.environment}"
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
  alarm_name          = "tonberry-101ai-apigw-4xx-elevated-${var.environment}"
  alarm_description   = "API Gateway (${aws_apigatewayv2_api.api.name}) 4xx rate is unusually high (20+ in 5 minutes) — may indicate a broken client, a bad deploy, or scraping/abuse. Threshold is a starting point, not tuned against real traffic yet."
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

# --- Grafana Cloud CloudWatch read access -----------------------------------
# Cross-account role Grafana Cloud's "Amazon CloudWatch" data source assumes
# to read metrics/logs — no static access keys involved. The trust policy's
# principal/external ID come from Grafana Cloud's own UI (Connections > Add
# new connection > Amazon CloudWatch), which generates them per-stack; see
# grafana_aws_account_id/grafana_external_id in variables.tf. Left as empty
# defaults until that step is done — applying with them empty produces a
# syntactically-valid but meaningless trust policy (no real AWS account can
# satisfy an empty principal), so nothing can actually assume this role yet.

resource "aws_iam_role" "grafana_cloudwatch" {
  name = "tonberry-101ai-grafana-cloudwatch-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { AWS = "arn:aws:iam::${var.grafana_aws_account_id}:root" }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = { "sts:ExternalId" = var.grafana_external_id }
      }
    }]
  })
}

# Standard read-only permission set Grafana's own CloudWatch data source
# documentation specifies (metrics + logs + resource tags) — this app has no
# EC2/custom-metric usage, but the EC2 describe permissions are part of
# Grafana's documented minimum set (used for auto-discovery/labeling) so
# they're included as-is rather than guessed down.
resource "aws_iam_role_policy" "grafana_cloudwatch" {
  name = "grafana-cloudwatch-readonly"
  role = aws_iam_role.grafana_cloudwatch.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowReadingMetricsFromCloudWatch"
        Effect = "Allow"
        Action = [
          "cloudwatch:DescribeAlarmsForMetric",
          "cloudwatch:DescribeAlarmHistory",
          "cloudwatch:DescribeAlarms",
          "cloudwatch:ListMetrics",
          "cloudwatch:GetMetricData",
          "cloudwatch:GetInsightRuleReport",
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowReadingLogsFromCloudWatch"
        Effect = "Allow"
        Action = [
          "logs:DescribeLogGroups",
          "logs:GetLogGroupFields",
          "logs:StartQuery",
          "logs:StopQuery",
          "logs:GetQueryResults",
          "logs:GetLogEvents",
          "logs:FilterLogEvents",
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowReadingTagsInstancesRegionsFromEC2"
        Effect = "Allow"
        Action = [
          "ec2:DescribeTags",
          "ec2:DescribeInstances",
          "ec2:DescribeRegions",
        ]
        Resource = "*"
      },
      {
        Sid      = "AllowReadingResourcesForTags"
        Effect   = "Allow"
        Action   = "tag:GetResources"
        Resource = "*"
      },
    ]
  })
}

output "grafana_cloudwatch_role_arn" {
  value       = aws_iam_role.grafana_cloudwatch.arn
  description = "Paste this into Grafana Cloud's CloudWatch data source setup as the IAM role ARN to assume"
}
