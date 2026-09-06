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
    ]
  })
}

output "github_actions_role_arn" {
  value = aws_iam_role.github_actions_deploy.arn
}
