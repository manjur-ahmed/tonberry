################################################################################
#   DNS — references the existing tonberry.co.uk zone (owned by 101ai/infra's #
#   Terraform state, aws_route53_zone.tonberry) rather than creating a        #
#   second one. Nameservers already point at this zone (checked via `dig     #
#   NS tonberry.co.uk` — resolves to awsdns-*), so this is live DNS, not a    #
#   pending cutover.                                                          #
################################################################################

data "aws_route53_zone" "tonberry" {
  name = "tonberry.co.uk"
}

################################################################################
#   ACM certificate for the apex + www — CloudFront requires us-east-1,       #
#   which is already this module's default region (var.aws_region), so no    #
#   provider alias is needed here (unlike 101ai/infra, whose default region   #
#   isn't us-east-1).                                                         #
################################################################################

resource "aws_acm_certificate" "web" {
  domain_name               = "tonberry.co.uk"
  subject_alternative_names = ["www.tonberry.co.uk"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "web_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.web.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
  zone_id = data.aws_route53_zone.tonberry.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 300
  records = [each.value.value]
}

resource "aws_acm_certificate_validation" "web" {
  certificate_arn         = aws_acm_certificate.web.arn
  validation_record_fqdns = [for r in aws_route53_record.web_cert_validation : r.fqdn]
}

################################################################################
#         tonberry.co.uk + www.tonberry.co.uk → CloudFront alias records      #
################################################################################

resource "aws_route53_record" "web_apex" {
  zone_id = data.aws_route53_zone.tonberry.zone_id
  name    = "tonberry.co.uk"
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "web_www" {
  zone_id = data.aws_route53_zone.tonberry.zone_id
  name    = "www.tonberry.co.uk"
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

################################################################################
#   Custom domain for the API — api.tonberry.co.uk instead of the raw        #
#   execute-api.amazonaws.com host (same reasoning as 101ai/infra's          #
#   api.101ai.tonberry.co.uk: a trusted domain matters wherever this API's    #
#   host is user-visible, e.g. CORS/redirect URLs). Regional cert — API      #
#   Gateway custom domains don't need us-east-1, though the default          #
#   provider already is.                                                     #
################################################################################

resource "aws_acm_certificate" "api" {
  domain_name       = "api.tonberry.co.uk"
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
  zone_id = data.aws_route53_zone.tonberry.zone_id
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
  domain_name = "api.tonberry.co.uk"

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
  zone_id = data.aws_route53_zone.tonberry.zone_id
  name    = "api.tonberry.co.uk"
  type    = "A"
  alias {
    name                   = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}
