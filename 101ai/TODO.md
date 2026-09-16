# 101 AI Tools — Remaining Work

## Security, Access & Cost Controls
*Surfaced by a full-app audit (2026-09-08) — treat this section as highest priority, several are live exposures.*
- [ ] Re-enable the auth guard on `GET /admin/usage/summary` — currently commented out with a `// TEMP` note, so revenue/cost/per-user spend data is reachable with zero authentication
- [ ] Lock down `PATCH /users/plan` — any logged-in user can currently self-upgrade to Plus/Premium with no payment or admin check, bypassing billing and uncapping their item limit
- [ ] Re-add the admin auth check for manjurchowdhury1@gmail.com (currently removed/bypassed)
- [ ] Stop committing Terraform plan files — `tfplan_apidomain` made it into git history because `.gitignore` only excludes `*.tfplan`/`tfplan`, not that filename; fix the pattern (`tfplan*`) and scrub it from history (plan files can embed secret values even when marked `sensitive`)
- [ ] Move Lambda secrets (DB URL, JWT secret, Google OAuth secret, OpenAI key) out of plaintext env vars/Terraform state into Secrets Manager or SSM SecureString
- [ ] Add a `state` param to the Google OAuth flow — currently missing, which is a login-CSRF exposure
- [ ] Add rate limiting/lockout on `POST /auth/login` and other public endpoints — there's no throttler module anywhere in the app
- [ ] Fail startup instead of silently defaulting `JWT_SECRET` to `'dev-only-change-me'` and the Google OAuth client id/secret to `'not-configured'` when env vars are unset
- [ ] Enable TLS certificate verification on the Postgres connection (currently `rejectUnauthorized: false`)
- [ ] Restrict CORS to `FRONTEND_URL` instead of allowing any origin
- [ ] Redirect unauthenticated users away from `/tools/:slug/dashboard` and `/tools/:slug/chats/:id` instead of showing them empty/broken states
- [ ] Make "Delete account" actually delete the account server-side (currently just signs out — the account still exists)
- [ ] Make "Reset chats" / "Remove items" in Settings actually clear data (currently no-ops that show a fake success)
- [ ] Clear `savedTools`/`savedMessageItems` localStorage on sign-out — currently leaks one user's starred tools and saved-item markers to the next person who signs in on the same browser
- [ ] Add a per-user/day message cap or throttling on chat endpoints, and a max length on message content — items have a free-plan cap, but chat messages (the actual OpenAI cost driver) are currently unlimited and unbounded in size for every plan
- [ ] Add API Gateway request throttling and a WAF on the public API and CloudFront — neither exists today
- [ ] Add AWS Budget / cost-anomaly alerts at the account level (separate from the in-app recurring-cost tracker below — this is a billing guardrail against e.g. a leaked key or a runaway invocation loop)
- [ ] Add a safety net for `MODEL_PRICING` — usage logs silently record $0 cost for any model missing from that table, so wiring up a second tool with a different model could invisibly corrupt the cost dashboard
- [ ] Add a size cap on saved item `data` payloads (currently an unbounded JSON blob per item)

## Core Product — Tools & Chat
- [ ] Set up additional API requirements for supplemental data
- [ ] Improve prompts on all wired-up tools — the earliest ones (Word Helper, Film/Book/Music Recommendations) predate patterns established by later tools: confidence-gating against hallucination (Quote Finder), a stable per-item key so an evolving thing gets amended in place instead of forked or lost (Cooking's `dishKey`/Diet's `planKey`), tool-specific tone, and deliberately minimal instruction where the model handles nuance better on its own (Diet). Revisit each tool's `tool-config.ts` entry against these patterns for consistency, not just the ones that happen to need a new feature
- [ ] Put in place per-plan usage limits (what a user can do based on which package/tier they're on)
- [ ] Enable actually purchasing Plus/Premium — Pricing page has both permanently disabled ("Coming soon"), so every plan-gated feature (Memory, unlimited items) is currently unreachable by any real user
- [ ] Fix the Memory toggle — Settings' toggle is local-only and never saved to the backend, while Chat's "Memory on/off" indicator instead reads off `user.plan`; the two are disconnected and neither can be legitimately exercised until Plus/Premium purchase exists
- [ ] Track real chat usage — the daily-usage ring on Home is hardcoded to 0, so the "N chats remaining today" meter is fake for every user on every plan
- [ ] Add loading state UIs across the site — skeletons/spinners exist on some pages (Home, ToolDashboard, ToolPage, Chat) but others (Recent, Settings) show nothing while fetching, so slow requests look broken instead of loading; make coverage consistent everywhere data is fetched
- [ ] Reconcile the dark-mode toggle — implemented two different, both non-functional ways (onboarding saves it to the backend, Settings only touches localStorage), and nothing in the app actually applies a dark theme anywhere yet
- [ ] Improve the homepage search bar — currently a plain substring match on tool name/description with no clear ("x") button, no match highlighting, and no tolerance for typos or partial/out-of-order words
- [ ] Add free-trial/upgrade prompts around the site — today the only nudge is `ItemLimitBanner`, shown reactively once a free user's item cap is already hit; add proactive messaging elsewhere (Home, dashboard, chat) to drive Plus/Premium upgrades. Depends on enabling actual purchasing (see Pricing "Coming soon" item above) — no point prompting an upgrade that can't be completed

## Tool-Specific Feedback
*User-submitted list (2026-09-15), organized by tool.*

### General
- [ ] Move to a monotone theme
- [ ] Onboarding can stay colourful (exception to the monotone theme)
- [ ] Export to app
- [ ] Chat responses are too friendly/opinionated (e.g. "that's a great question!") — tone down
- [ ] Paragraphs in responses are too chunky — break up further
- [ ] Fix Google Maps API (not working)
- [ ] Change "my location" from lat/lon to a town/city name
- [ ] When continuing a chat started from an item, sometimes the item itself should be updated instead of creating a new one on the same topic
- [ ] Add a toggle to save/unsave an item directly from the chat
- [ ] Add onboarding tooltips
- [ ] Add a 3-dot menu on all chats

### Writer
- [ ] Note SDK
- [ ] Writer didn't show up in Recent
- [ ] Hide the send button by default; show it only when the input is focused
- [ ] Confirm whether Writer saves in the background if the user clicks back too quickly
- [ ] "Copy All" needs feedback (confirmation state)
- [ ] Add a confirmation step to Delete
- [ ] Add "Send to" functionality
- [ ] BUG: issue switching between saved states
- [ ] UX: text area is hidden when the keyboard is up

### Maths Solver
- [ ] Minimise the shown working out
- [ ] Structure responses as: value, formula, then working out

### Business Planner
- [ ] Use the advanced model for maths

### Gym Planner & Skin Care
- [ ] When gathering info about the user, the next question should be on its own bolded line; positive affirmation is good; routines should be iterative — have users try steps and give feedback

### Cooking
- [ ] Cooking guide needs serious work (general quality pass)

### New Tools
- [ ] Document explainer

## Design & Branding
- [ ] Improve font and branding
- [ ] Create logo
- [ ] Add pictures and descriptions for all tools on the tool introduction/about page
- [ ] Small UI fixes around the site (includes a data bug found in audit: India is listed with `$` instead of `₹` in the country/currency list)
- [ ] Change "saved" tool to "pinned" tool
- [ ] Be able to pin items on tools

## Infrastructure & DevOps
- [ ] Fix Lambda cold starts — audit found the function isn't VPC-attached at all (so networking config isn't the cause); the real contributors are a 25MB monolithic deployment package and no provisioned concurrency. Split `node_modules` into a Lambda layer and add provisioned concurrency instead of pursuing a networking fix
- [ ] Set up observability (Grafana)
  - [ ] Add CloudWatch alarms on Lambda errors/throttles/duration and API Gateway 4xx/5xx — none exist today
  - [ ] Log the real error when an OpenAI call fails instead of discarding it — every OpenAI-side failure is currently invisible in production
- [ ] Set up MS Clarity
- [ ] Track recurring costs — a running list of everything paid for (domain, hosting, API usage, tools/subscriptions), what it costs, and when it renews, so nothing lapses or surprises unnoticed
- [ ] Add Terraform plan/apply to CI — both GitHub Actions workflows currently only deploy app artifacts (Lambda zip, S3 sync); all infra changes are applied manually from a local machine
- [ ] Set up a proper dev/staging environment — everything today is one flat "prod" environment and state file, no per-environment tfvars
- [ ] Clean up stray local Terraform artifacts (`errored.tfstate`, `tfplan`, `rollback.tfplan`, `lambda.zip`) sitting in `101ai/infra`
- [ ] Confirm Neon's own DB backup/retention settings — the database is external to Terraform entirely, so nothing in this repo enforces or documents backups
- [ ] Add real test coverage — only the default health-check spec exists anywhere in the API; zero coverage on auth, chats, items, users, openai, router, or plan logic
- [ ] Add `UsageLog` to the TypeORM CLI `DataSource` entity list — it's already used at runtime but missing from the migration-generation config, risking schema drift on the usage-logs table

## Business & Launch
- [ ] TOS and Privacy Policy pages
- [ ] Set up business account and sign up to Google app publishing
- [ ] Make into app
- [ ] Set up automated emailing (Mailchimp or something else)

---

**Progress: 46/123 tasks complete (37%)**
`███████░░░░░░░░░░░░░` 37%
