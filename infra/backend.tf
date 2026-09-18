terraform {
  # Reuses the same state bucket 101ai/infra already created, under a
  # different key — this app's state is otherwise fully independent (no
  # shared resources, only a data-sourced reference to the existing
  # tonberry.co.uk Route53 zone and GitHub OIDC provider, see dns.tf/cicd.tf).
  backend "s3" {
    bucket       = "tonberry-101ai-tfstate-396608771464"
    key          = "web/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}
