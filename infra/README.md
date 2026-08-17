# infra

Terraform for AWS deployment. Starts in M19 (S3 + CloudFront), extends through
M21 (Lambda + API Gateway), M23 (serverless Postgres), M24 (SQS), M25 (FastAPI
Lambda container / ECS fallback).

Reusable modules sourced from a prior work repo: ecr, iam,
iam_role_policy_attachment, cloudwatch_log_group, plus the ecs_cluster /
ecs_service / ecs_task_definition / alb modules kept in reserve for the M25
ECS fallback path (not used for the primary Lambda deployment — an
always-on ALB conflicts with the scale-to-zero cost goal).
