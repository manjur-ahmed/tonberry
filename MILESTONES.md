# Portfolio Project Milestones

Walking-skeleton plan: each milestone is a ~1-day slice that ends in something previewable (a page, an endpoint, a running service).

## Product

A marketplace connecting commercial property investors with finance brokers.

- **Public site**: homepage (hero H1 + lead-capture form, About Us, a Guides teaser linking to the blog), plus public blog/guide pages.
- **Financer portal**: login for finance brokers, generic account pages, and a CRM dashboard as the main workspace.
- **Multi-tenant**: brokers belong to a brokerage org; each org only sees its own assigned leads. A `platform_admin` role (the site owner) sits above orgs — distributes incoming leads to the right broker org and manages articles.
- **Articles/guides**: database-backed CRUD (title/slug/body/published), managed through an internal admin screen.
- **Page copy** (hero text, About Us, etc.): lives in structured content files in this repo, not the database or hardcoded JSX. An internal editor UI writes changes as a GitHub branch + PR; merging the PR is what publishes the copy.
- **ML feature**: not chosen yet — candidates are lead-to-broker matching or semantic guide search, to be decided once the leads/articles data actually exists (Group 22).

Since the idea was picked early (right after M3), the remaining local-skeleton milestones below target real entities (leads, orgs, articles) directly instead of generic placeholders that would just get renamed later.

## Group 1 — Repo & Local Env
- [x] **M1. Monorepo skeleton** — `/web`, `/api`, `/ml`, `/infra` folders with placeholder READMEs, root README, `.gitignore`. *Preview: repo structure in place.*
- [x] **M2. Docker Compose: Postgres+pgvector** — `docker-compose.yml` + `.env.example`. Deferred the web/api/ml placeholder containers from the original scope — they'll join the compose file as real services in M3/M5/M9 instead of being built twice. *Preview: `docker compose up -d` → postgres healthy, `CREATE EXTENSION vector` succeeds.*

## Group 2 — Frontend Skeleton
- [x] **M3. Vite + React + TS + router + TanStack Query** — "Hello" landing page, stripped Vite's default demo boilerplate. *Preview: `cd web && npm run dev` → http://localhost:5173*
- [x] **M4. Real homepage + route stubs** — hero (H1 + lead form UI only, not wired to an endpoint yet), About Us, Guides teaser section; nav; `/login`, `/dashboard`, `/guides` as route stubs; Tailwind v4 baseline. *Preview: `cd web && npm run dev` → homepage shows all real sections; all four routes load.*

## Group 3 — Main API Skeleton
- [x] **M5. NestJS/Fastify scaffold** — health endpoint, `ConfigModule`, structured JSON logging via Fastify's built-in pino logger. *Preview: `cd api && npm run start:dev`, then `curl http://localhost:3000/health` → 200 JSON.*
- [ ] **M6. Wire frontend → API** — TanStack Query hook hitting `/health`. *Preview: UI shows live "API status: OK".*

## Group 4 — Data Layer
- [ ] **M7. Multi-tenant schema** — `organizations`, `users` (role: `platform_admin`/`broker`, `org_id`), `leads` (submission fields + status + `assigned_org_id`) — migration only, no endpoints yet. *Preview: migration runs, tables visible in Adminer.*
- [ ] **M8. Public lead-capture endpoint** — unauthenticated `POST /leads`, wired to the homepage hero form. First real end-to-end flow. *Preview: submit the hero form, see the row land in `leads` via Adminer.*

## Group 5 — ML Service Skeleton
- [ ] **M9. FastAPI scaffold** — health endpoint. *Preview: `curl /health` → 200 JSON.*
- [ ] **M10. NestJS → FastAPI internal call** — combined `/system-status`. *Preview: both services show green through one endpoint.*
- [ ] **M11. Deterministic lead-priority score** — rule-based heuristic (e.g. loan size + form completeness), computed in FastAPI, called from NestJS's lead endpoint. *Preview: curl the lead endpoint, see a `priority_score` field in the response.*

## Group 6 — Auth
- [ ] **M12. JWT auth in NestJS** — signup/login for financer users, `org_id` + role embedded in the token, guard enforces org scoping. *Preview: log in as two different org users, confirm each only gets their own org's data from a protected test endpoint.*
- [ ] **M13. Frontend financer login flow** — login form, token storage, `/portal` route protection, redirect to dashboard. *Preview: log in via UI, land on the (still-stub) dashboard; log out redirects to login.*

## Group 7 — Async (local)
- [ ] **M14. Local queue stub** (ElasticMQ/localstack or in-process) — a new lead submission enqueues a "notify broker" job (stub, logs only for now). *Preview: submit a lead, watch the job flip queued → done in logs.*

## Group 8 — CI
- [ ] **M15. GitHub Actions**: lint/typecheck/unit test on PR for all 3 apps. *Preview: green checks on a PR.*
- [ ] **M16. Playwright smoke test** + per-service unit test wired into CI. *Preview: CI shows real test output passing.*

## Group 9 — Containerize
- [ ] **M17. Dockerfiles** for web/api/ml (multi-stage). *Preview: each builds and runs standalone.*
- [ ] **M18. Full compose stack from built images** — one-command clean-clone setup. *Preview: `docker compose up` on a fresh clone works.*

## Group 10 — CRM & Lead Distribution
- [ ] **M19. Platform-admin lead queue** — unassigned leads list + assign-to-org action, restricted to `platform_admin`. *Preview: log in as platform admin, see incoming unassigned leads, assign one to a broker org.*
- [ ] **M20. Org CRM ("My Leads")** — leads list scoped to the logged-in org, replaces the dashboard stub from M4. *Preview: log in as a broker, dashboard shows only that org's assigned leads.*
- [ ] **M21. Lead detail** — status pipeline (new/contacted/qualified/won/lost), notes, and the M11 priority score displayed. *Preview: open a lead, change status, add a note; both persist on refresh.*

## Group 11 — Article / Blog Admin
- [ ] **M22. Articles table + admin list/create** — title, slug, body, published flag; `platform_admin` only. *Preview: create an article as admin, see it in the admin list.*
- [ ] **M23. Edit + publish/unpublish toggle.** *Preview: edit an existing article, toggle published, status persists.*

## Group 12 — Public Blog / Guides Pages
- [ ] **M24. Blog list + article detail page** — published articles only, linked from the homepage Guides teaser. *Preview: click a guide teaser on the homepage, land on the real article.*

## Group 13 — Content System (git-backed page copy)
- [ ] **M25. Content file schema** — YAML/JSON per page (home hero, About Us, guides teaser); homepage/about now render from these files instead of hardcoded JSX. *Preview: hand-edit a YAML value, reload, see the copy change on the live page.*
- [ ] **M26. Internal content-editor UI** — form mapped to the schema, editable in-browser (writes local files for now, no GitHub wiring yet). *Preview: change the H1 in the admin UI, see it reflected on the homepage.*
- [ ] **M27. GitHub integration** — Save opens a branch + commit + PR with the copy diff instead of writing locally. *Preview: click Save, see a real PR appear on GitHub with the exact copy change.*
- [ ] **M28. Merge-to-publish loop** — the live site reads published copy from `main`, so merging the PR is what actually publishes it. *Preview: merge the PR on GitHub, reload the site, see the new copy live.*

## Group 14 — IaC Skeleton
> Domain note: `tonberry.co.uk` is owned (registrar: GoDaddy), currently pointed at an old IONOS server. Once CloudFront (M30) / API Gateway (M31) are live, point DNS at AWS instead and decommission the IONOS hosting — no need to keep paying for both.
- [ ] **M29. Terraform: S3 + CloudFront only**, remote state. *Preview: `terraform apply` outputs a live URL.*
- [ ] **M30. Deploy frontend build to S3/CloudFront via Actions.** *Preview: real React app live on the internet.*

## Group 15 — Cloud API
- [ ] **M31. NestJS on Lambda + API Gateway via Terraform.** *Preview: `curl` the Gateway URL `/health`.*
- [ ] **M32. Point deployed frontend at deployed API, redeploy.** *Preview: live site calls live Lambda successfully.*

## Group 16 — Cloud Data
- [ ] **M33. Serverless Postgres** (Aurora Serverless v2 / Neon) via Terraform, migrations run. *Preview: live lead-capture form persists to cloud DB.*

## Group 17 — Cloud Async
- [ ] **M34. Real SQS + Lambda worker**, replacing the local queue stub. *Preview: submit a lead on the live site, watch CloudWatch Logs show the notify-broker job processing.*

## Group 18 — Cloud ML
- [ ] **M35. FastAPI lead-scoring as a Lambda container**, own route, called from NestJS. *Preview: live lead submissions show a real `priority_score` end-to-end in prod.*

## Group 19 — MLOps Foundation
- [ ] **M36. MLflow local**, log one run for the baseline scoring heuristic. *Preview: MLflow UI shows a run.*
- [ ] **M37. S3 artefact bucket**, one artefact logged with S3 URI in MLflow. *Preview: run links to an S3 artefact.*

## Group 20 — Observability
- [ ] **M38. Structured logs + correlation IDs** + CloudWatch log group. *Preview: trace one request by ID in Logs Insights.*
- [ ] **M39. Health/readiness + latency/error metric + one alarm.** *Preview: alarm visible in OK state with a real traffic graph.*

## Group 21 — Cost Controls
- [ ] **M40. AWS Budget + billing alarm, S3 lifecycle, log retention, teardown workflow.** *Preview: budget alarm live; `terraform destroy` cleanly tears the stack down.*

**→ At M40 you have the full product — public site, multi-tenant CRM, article/content admin, git-backed copy editing — deployed, observable, and cost-guarded.**

## Group 22 — Real ML
Once leads (M8/M11/M21) and articles (M22-M24) have real data behind them, pick one:
- [ ] Lead-to-broker matching — score/route incoming leads to the best-fit org (property type, loan size, region), replacing the M11 rule-based heuristic.
- [ ] Semantic guide search — pgvector-powered search over article content.
- [ ] Add baseline-vs-model evaluation, gate registration in MLflow, wire the real model into the existing Lambda container (M35).

## Group 23 — Productionise & Present
- [ ] Retries/idempotency on the queue (lead notifications).
- [ ] Contract tests, security scanning (multi-tenant data isolation is worth an explicit test here).
- [ ] Staged rollout + rollback drill.
- [ ] README, architecture diagram, cost notes, 2-minute demo video.
