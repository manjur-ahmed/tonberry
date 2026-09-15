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
