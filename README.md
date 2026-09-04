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
- `101ai/` — separate product ("101 AI Tools"), a catalog of everyday AI
  tools, each with its own custom UI. Shares this repo's Postgres/Docker
  setup but not the CRM's code or entities — see `101ai/README.md`. Not
  tracked in `MILESTONES.md`, which stays scoped to the CRM project.

## Local development

```
cp .env.example .env
docker compose up -d
```

Brings up Postgres (with pgvector) on `localhost:5432`. The web/api/ml
services join the compose stack as they're scaffolded (see MILESTONES.md).
