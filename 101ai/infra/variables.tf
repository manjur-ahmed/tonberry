variable "aws_region" {
  default = "us-east-1"
}

variable "environment" {
  default = "prod"
}

variable "database_url" {
  description = "Neon pooled connection string"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "google_oauth_client_id" {
  type = string
}

variable "google_oauth_client_secret" {
  type      = string
  sensitive = true
}

variable "openai_api_key" {
  type      = string
  sensitive = true
}

variable "admin_email" {
  description = "The one email allowed to hit /admin/usage/* (see AdminGuard)"
  type        = string
}

variable "youtube_api_key" {
  description = "YouTube Data API v3 key for embedded videos (see YoutubeClient) — separate credential from google_api_key/google_oauth_*, restricted to just the YouTube Data API v3"
  type        = string
  sensitive   = true
}

variable "alert_email" {
  description = "Email address CloudWatch alarms notify via SNS (see observability.tf)"
  type        = string
}

variable "grafana_aws_account_id" {
  description = "AWS account ID Grafana Cloud uses to assume the CloudWatch read role — from Grafana Cloud > Connections > Add new connection > Amazon CloudWatch > the IAM role setup step. Leave empty until that step is done; the role's trust policy is meaningless (and terraform apply on it pointless) until this is real."
  type        = string
  default     = ""
}

variable "grafana_external_id" {
  description = "External ID Grafana Cloud generates for this specific Grafana stack's CloudWatch connection — same source as grafana_aws_account_id. Scopes the trust policy so only Grafana's own CloudWatch integration for THIS stack can assume the role, not anyone else who happens to know Grafana's AWS account ID."
  type        = string
  sensitive   = true
  default     = ""
}
