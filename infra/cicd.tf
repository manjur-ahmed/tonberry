################################################################################
#   GitHub Actions OIDC — deploy access with no stored AWS keys in GitHub.    #
#   References the OIDC provider 101ai/infra already created (an AWS account  #
#   can only have one provider per URL) instead of creating a second one.     #
################################################################################

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_role" "github_actions_deploy" {
  name = "tonberry-web-github-deploy-${var.environment}"

  # Scoped to this repo, and only the main branch. Wildcarded sub claim,
  # not an exact match — see [[project-tonberry-oidc-trust-policy]] /
  # 101ai/infra/cicd.tf's identical comment for why (GitHub appends an
  # immutable "@<id>" suffix to the org/repo names in this claim for a
  # period after either is renamed or transferred).
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = data.aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:manjur-ahmed*/tonberry*:ref:refs/heads/main"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name = "tonberry-web-github-deploy-${var.environment}"
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
