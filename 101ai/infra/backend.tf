terraform {
  backend "s3" {
    bucket       = "tonberry-101ai-tfstate-396608771464"
    key          = "101ai/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}
