# tonberry

Portfolio project: production skills via a local-first, scale-to-zero public
demo. See [MILESTONES.md](MILESTONES.md) for the build plan and current
progress, and [portfolio_project_plan_low_cost.docx](portfolio_project_plan_low_cost.docx)
for the full plan.

## Layout

- `web/` — React + TypeScript + Vite frontend
- `api/` — NestJS (Fastify) main API
- `ml/` — FastAPI ML service
- `infra/` — Terraform for AWS deployment

## Local development

```
cp .env.example .env
docker compose up -d
```

Brings up Postgres (with pgvector) on `localhost:5432`. The web/api/ml
services join the compose stack as they're scaffolded (see MILESTONES.md).
