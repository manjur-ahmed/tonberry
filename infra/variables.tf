variable "aws_region" {
  default = "us-east-1"
}

variable "environment" {
  default = "prod"
}

variable "database_url" {
  description = "Neon pooled connection string for this app's database (a second database on the same Neon project 101ai uses — see 101ai/infra/variables.tf's database_url)"
  type        = string
  sensitive   = true
}

variable "alert_email" {
  description = "Email address CloudWatch alarms notify via SNS (see observability.tf)"
  type        = string
}
