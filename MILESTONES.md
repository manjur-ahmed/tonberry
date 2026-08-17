# Portfolio Project Milestones

Walking-skeleton plan: each milestone is a ~1-day slice that ends in something previewable (a page, an endpoint, a running service). Groups 1–17 build a fully deployed but empty skeleton across the whole stack; from Group 18 onward, the real product idea replaces the stubs using the same slice pattern.

## Group 1 — Repo & Local Env
- [x] **M1. Monorepo skeleton** — `/web`, `/api`, `/ml`, `/infra` folders with placeholder READMEs, root README, `.gitignore`. *Preview: repo structure in place.*
- [x] **M2. Docker Compose: Postgres+pgvector** — `docker-compose.yml` + `.env.example`. Deferred the web/api/ml placeholder containers from the original scope — they'll join the compose file as real services in M3/M5/M9 instead of being built twice. *Preview: `docker compose up -d` → postgres healthy, `CREATE EXTENSION vector` succeeds.*

## Group 2 — Frontend Skeleton
- [ ] **M3. Vite + React + TS + router + TanStack Query** — "Hello" landing page. *Preview: app loads at localhost.*
- [ ] **M4. Nav + stub pages** (Home/Login/Dashboard) + Tailwind baseline. *Preview: click between 3 pages.*

## Group 3 — Main API Skeleton
- [ ] **M5. NestJS/Fastify scaffold** — health endpoint, config module, structured logging. *Preview: `curl /health` → 200 JSON.*
- [ ] **M6. Wire frontend → API** — TanStack Query hook hitting `/health`. *Preview: UI shows live "API status: OK".*

## Group 4 — Data Layer
- [ ] **M7. Postgres wired in** via TypeORM/Prisma, one migration, one table. *Preview: `/items` returns `[]`, table visible in `psql`.*
- [ ] **M8. First real CRUD** — create/list an entity end-to-end. *Preview: add item in UI, it persists after refresh.*

## Group 5 — ML Service Skeleton
- [ ] **M9. FastAPI scaffold** — health endpoint. *Preview: `curl /health` → 200 JSON.*
- [ ] **M10. NestJS → FastAPI internal call** — combined `/system-status`. *Preview: both services show green through one endpoint.*
- [ ] **M11. Deterministic "ML" baseline** — rule-based function (no model yet), round-tripped through both services into the UI. *Preview: submit input, see computed result.*

## Group 6 — Auth
- [ ] **M12. JWT auth in NestJS** — signup/login, hashing, guard. *Preview: protected route 401s without a token.*
- [ ] **M13. Frontend auth flow** — forms, token storage, redirects. *Preview: log in, land on dashboard; log out redirects.*

## Group 7 — Async (local)
- [ ] **M14. Local queue stub** (ElasticMQ/localstack or in-process) + one background job. *Preview: item status flips "queued" → "done" via worker.*

## Group 8 — CI
- [ ] **M15. GitHub Actions**: lint/typecheck/unit test on PR for all 3 apps. *Preview: green checks on a PR.*
- [ ] **M16. Playwright smoke test** + per-service unit test wired into CI. *Preview: CI shows real test output passing.*

## Group 9 — Containerize
- [ ] **M17. Dockerfiles** for web/api/ml (multi-stage). *Preview: each builds and runs standalone.*
- [ ] **M18. Full compose stack from built images** — one-command clean-clone setup. *Preview: `docker compose up` on a fresh clone works.*

## Group 10 — IaC Skeleton
> Domain note: `tonberry.co.uk` is owned (registrar: GoDaddy), currently pointed at an old IONOS server. Once CloudFront/API Gateway are live (M20/M21), point DNS at AWS instead and decommission the IONOS hosting — no need to keep paying for both.
- [ ] **M19. Terraform: S3 + CloudFront only**, remote state. *Preview: `terraform apply` outputs a live URL.*
- [ ] **M20. Deploy frontend build to S3/CloudFront via Actions.** *Preview: real React app live on the internet.*

## Group 11 — Cloud API
- [ ] **M21. NestJS on Lambda + API Gateway via Terraform.** *Preview: `curl` the Gateway URL `/health`.*
- [ ] **M22. Point deployed frontend at deployed API, redeploy.** *Preview: live site calls live Lambda successfully.*

## Group 12 — Cloud Data
- [ ] **M23. Serverless Postgres** (Aurora Serverless v2 / Neon) via Terraform, migrations run. *Preview: live CRUD page persists to cloud DB.*

## Group 13 — Cloud Async
- [ ] **M24. Real SQS + Lambda worker**, replacing local stub. *Preview: trigger on live site, watch CloudWatch Logs show processing.*

## Group 14 — Cloud ML
- [ ] **M25. FastAPI baseline as Lambda container**, own route, called from NestJS. *Preview: live "ML" feature works end-to-end in prod.*

## Group 15 — MLOps Foundation
- [ ] **M26. MLflow local**, log one run for the baseline. *Preview: MLflow UI shows a run.*
- [ ] **M27. S3 artefact bucket**, one artefact logged with S3 URI in MLflow. *Preview: run links to an S3 artefact.*

## Group 16 — Observability
- [ ] **M28. Structured logs + correlation IDs** + CloudWatch log group. *Preview: trace one request by ID in Logs Insights.*
- [ ] **M29. Health/readiness + latency/error metric + one alarm.** *Preview: alarm visible in OK state with a real traffic graph.*

## Group 17 — Cost Controls
- [ ] **M30. AWS Budget + billing alarm, S3 lifecycle, log retention, teardown workflow.** *Preview: budget alarm live; `terraform destroy` cleanly tears the stack down.*

**→ At M30 you have a fully deployed, empty walking skeleton: auth, CRUD, async, a fake "ML" feature, CI/CD, IaC, observability, cost controls — all live.**

## Group 18 — Pick the Idea, Replace the Stubs
- [ ] **M31. Choose the product idea**, rename the CRUD entity/UI copy to match it. *Preview: live site now reflects the real domain.*
- [ ] **M32+. Repeat the vertical-slice pattern per real feature** — one page + one endpoint + one test, always deployed.

## Group 19 — Real ML (once the idea is set)
- [ ] Swap the deterministic baseline for a small PyTorch/HF model.
- [ ] Add baseline-vs-model evaluation.
- [ ] Gate registration in MLflow.
- [ ] Wire the real model into the existing Lambda container.

## Group 20 — Productionise & Present
- [ ] Retries/idempotency on the queue.
- [ ] Contract tests, security scanning.
- [ ] Staged rollout + rollback drill.
- [ ] README, architecture diagram, cost notes, 2-minute demo video.
