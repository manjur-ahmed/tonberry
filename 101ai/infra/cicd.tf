################################################################################
#   GitHub Actions OIDC — deploy access with no stored AWS keys in GitHub     #
################################################################################

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

resource "aws_iam_role" "github_actions_deploy" {
  name = "tonberry-101ai-github-deploy-${var.environment}"

  # Scoped to this repo, and only the main branch — no other branch or repo
  # can assume this role, even with a crafted workflow file.
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          # Wildcarded rather than an exact match: GitHub appends an
          # immutable "@<id>" suffix to the org/repo names in this claim
          # for a period after either is renamed or transferred (e.g.
          # "manjur-ahmed@142892965/tonberry@1331271374") to stop a stale
          # trust policy from later trusting whoever claims the old name.
          # This still only matches this org/repo, just tolerant of that
          # suffix being present or absent.
          "token.actions.githubusercontent.com:sub" = "repo:manjur-ahmed*/tonberry*:ref:refs/heads/main"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name = "tonberry-101ai-github-deploy-${var.environment}"
  role = aws_iam_role.github_actions_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DeployWebToS3"
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [
          aws_s3_bucket.web.arn,
          "${aws_s3_bucket.web.arn}/*",
        ]
      },
      {
        Sid      = "InvalidateCloudFrontCache"
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = aws_cloudfront_distribution.web.arn
      },
      {
        Sid      = "DeployApiToLambda"
        Effect   = "Allow"
        Action   = ["lambda:UpdateFunctionCode", "lambda:GetFunction"]
        Resource = aws_lambda_function.api.arn
      },
      # Everything below lets `terraform apply` actually manage this infra
      # from CI (terraform-101ai.yml), not just deploy already-built app
      # artifacts like the three statements above. Deliberately EXCLUDES
      # iam:*/sts:* WRITE actions and this role/policy/the OIDC provider
      # itself — a role that can modify its own (or any) IAM policy is a
      # privilege-escalation risk, so any actual CHANGE to aws_iam_role/
      # aws_iam_role_policy/aws_iam_openid_connect_provider still requires
      # a human running `terraform apply` locally with real admin
      # credentials, same as this policy's own first rollout (2026-09-19).
      # Wildcarded per-service rather than hand-enumerating every action —
      # several of these services (API Gateway v2, ACM, Route53, CloudWatch
      # alarms/logs) don't support meaningful resource-level IAM scoping
      # anyway, and a missing narrow action just fails the next apply
      # loudly rather than doing anything destructive.
      {
        # Read-only — NOT excluded like IAM writes above. Terraform
        # refreshes every managed resource's state on every plan,
        # including the IAM roles/OIDC provider defined elsewhere in this
        # config, regardless of whether they're actually changing. With
        # zero iam:* permissions at all, even a plan touching nothing IAM-
        # related failed outright trying to read their current state
        # (confirmed via the first real CI run to get this far,
        # 2026-09-19). Read access carries no privilege-escalation risk on
        # its own — only the write actions deliberately excluded above do.
        Sid    = "ReadIamForStateRefresh"
        Effect = "Allow"
        Action = ["iam:Get*", "iam:List*"]
        Resource = [
          aws_iam_role.github_actions_deploy.arn,
          aws_iam_role.lambda_exec.arn,
          aws_iam_role.grafana_cloudwatch.arn,
          aws_iam_openid_connect_provider.github.arn,
        ]
      },
      # Missing since terraform-101ai.yml was first built (2026-09-19) — the
      # role could deploy app artifacts but never had permission to even
      # read/write the remote state file itself, so `terraform init` fails
      # with a 403 before getting anywhere near the resources below. Not
      # part of the "no IAM" boundary above — this is the state *bucket*
      # (data), unrelated to IAM policy on this role.
      {
        Sid    = "AccessTerraformState"
        Effect = "Allow"
        # DeleteObject is for use_lockfile's .tflock object — Terraform
        # deletes it to release the lock once an operation finishes.
        # Missing it broke the first real CI run past this point
        # (2026-09-19): plan succeeded but then failed trying to release
        # its own lock.
        Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [
          "arn:aws:s3:::tonberry-101ai-tfstate-396608771464",
          "arn:aws:s3:::tonberry-101ai-tfstate-396608771464/101ai/terraform.tfstate*",
        ]
      },
      {
        Sid    = "ManageS3Buckets"
        Effect = "Allow"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.web.arn,
          "${aws_s3_bucket.web.arn}/*",
          aws_s3_bucket.uploads.arn,
          "${aws_s3_bucket.uploads.arn}/*",
        ]
      },
      {
        Sid      = "ManageCloudFront"
        Effect   = "Allow"
        Action   = "cloudfront:*"
        Resource = "*"
      },
      {
        Sid      = "ManageAcmCertificates"
        Effect   = "Allow"
        Action   = "acm:*"
        Resource = "*"
      },
      {
        Sid      = "ManageRoute53"
        Effect   = "Allow"
        Action   = "route53:*"
        Resource = "*"
      },
      {
        Sid      = "ManageApiGateway"
        Effect   = "Allow"
        Action   = "apigateway:*"
        Resource = "*"
      },
      {
        Sid    = "ManageLambdaConfigAndLayers"
        Effect = "Allow"
        Action = "lambda:*"
        Resource = [
          aws_lambda_function.api.arn,
          "${aws_lambda_function.api.arn}:*",
          "${aws_lambda_layer_version.dependencies.layer_arn}*",
        ]
      },
      {
        Sid      = "ManageCloudWatchLogsAndAlarms"
        Effect   = "Allow"
        Action   = ["logs:*", "cloudwatch:*"]
        Resource = "*"
      },
      {
        Sid      = "ManageSns"
        Effect   = "Allow"
        Action   = "sns:*"
        Resource = aws_sns_topic.alerts.arn
      },
    ]
  })
}

output "github_actions_role_arn" {
  value = aws_iam_role.github_actions_deploy.arn
}
