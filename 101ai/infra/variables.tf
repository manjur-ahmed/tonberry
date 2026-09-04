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
