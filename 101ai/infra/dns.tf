################################################################################
#   DNS — Route53 hosted zone for tonberry.co.uk, migrating off IONOS         #
################################################################################

resource "aws_route53_zone" "tonberry" {
  name = "tonberry.co.uk"
}

# Preserves the existing Google Workspace email — must match IONOS exactly
# before cutover, or mail breaks the moment nameservers switch.
resource "aws_route53_record" "mx" {
  zone_id = aws_route53_zone.tonberry.zone_id
  name    = "tonberry.co.uk"
  type    = "MX"
  ttl     = 3600
  records = ["1 smtp.google.com"]
}

resource "aws_route53_record" "google_site_verification" {
  zone_id = aws_route53_zone.tonberry.zone_id
  name    = "tonberry.co.uk"
  type    = "TXT"
  ttl     = 3600
  records = ["google-site-verification=W39mpXIgmT_M8KBGD2t94L5uLKFT7dS65s0ocv0-R0g"]
}

################################################################################
#           ACM certificate for 101ai.tonberry.co.uk (must be us-east-1       #
#           for CloudFront, regardless of the provider's default region)      #
################################################################################

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

resource "aws_acm_certificate" "ai101" {
  provider          = aws.us_east_1
  domain_name       = "101ai.tonberry.co.uk"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "ai101_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.ai101.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
  zone_id = aws_route53_zone.tonberry.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 300
  records = [each.value.value]
}

resource "aws_acm_certificate_validation" "ai101" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.ai101.arn
  validation_record_fqdns = [for r in aws_route53_record.ai101_cert_validation : r.fqdn]
}

################################################################################
#              101ai.tonberry.co.uk → CloudFront alias record                 #
################################################################################

resource "aws_route53_record" "ai101" {
  zone_id = aws_route53_zone.tonberry.zone_id
  name    = "101ai.tonberry.co.uk"
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

################################################################################
#   Custom domain for the API — api.101ai.tonberry.co.uk instead of the raw   #
#   execute-api.amazonaws.com host. Google can't attribute a shared AWS      #
#   domain to this app, so it shows the raw host on the OAuth consent        #
#   screen instead of a trusted name; a domain on tonberry.co.uk (already   #
#   Google-verified above) fixes that. Regional cert — API Gateway custom    #
#   domains don't need us-east-1, and the default provider already is.       #
################################################################################

resource "aws_acm_certificate" "api" {
  domain_name       = "api.101ai.tonberry.co.uk"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "api_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.api.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
  zone_id = aws_route53_zone.tonberry.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 300
  records = [each.value.value]
}

resource "aws_acm_certificate_validation" "api" {
  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [for r in aws_route53_record.api_cert_validation : r.fqdn]
}

resource "aws_apigatewayv2_domain_name" "api" {
  domain_name = "api.101ai.tonberry.co.uk"

  domain_name_configuration {
    certificate_arn = aws_acm_certificate_validation.api.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  domain_name = aws_apigatewayv2_domain_name.api.id
  stage       = aws_apigatewayv2_stage.api.id
}

resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.tonberry.zone_id
  name    = "api.101ai.tonberry.co.uk"
  type    = "A"
  alias {
    name                   = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}
