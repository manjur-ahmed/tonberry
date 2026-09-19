# 101 AI Tools — Remaining Work

## Security, Infrastructure & Cost Controls
*Surfaced by a full-app audit (2026-09-08) — treat this section as highest priority, several are live exposures.*

- [ ] Re-enable the auth guard on `GET /admin/usage/summary` — currently commented out with a `// TEMP` note, so revenue/cost/per-user spend data is reachable with zero authentication
- [ ] Re-add the admin auth check for manjurchowdhury1@gmail.com (currently removed/bypassed)
- [ ] Lock down `PATCH /users/plan` — any logged-in user can currently self-upgrade to Plus/Premium with no payment or admin check, bypassing billing and uncapping their item limit
- [ ] Add a per-user/day message cap or throttling on chat endpoints, and a max length on message content — items have a free-plan cap, but chat messages (the actual OpenAI cost driver) are currently unlimited and unbounded in size for every plan
- [ ] Add API Gateway request throttling and a WAF on the public API and CloudFront — neither exists today
- [ ] Add AWS Budget / cost-anomaly alerts at the account level (separate from the in-app recurring-cost tracker at `/admin/costs` — this is a billing guardrail against e.g. a leaked key or a runaway invocation loop)
- [ ] Add a safety net for `MODEL_PRICING` — usage logs silently record $0 cost for any model missing from that table, so wiring up a second tool with a different model could invisibly corrupt the cost dashboard
- [ ] Add a size cap on saved item `data` payloads (currently an unbounded JSON blob per item)
- [ ] Rotate the OpenAI key, Google OAuth client secret, and Neon DB password — confirmed exposed in plaintext (full Terraform state, not just a plan) inside the now-untracked `tfplan_apidomain` file, across ~15 branches on this PUBLIC GitHub repo since 2026-09-06. Untracking/gitignoring the file (done 2026-09-19) doesn't undo the exposure — only rotating these three actually closes it. Deliberately deferred (2026-09-19, user's call) — do this whenever ready, ideally alongside the Secrets Manager migration below
- [ ] Move Lambda secrets (DB URL, JWT secret, Google OAuth secret, OpenAI key) out of plaintext env vars/Terraform state into Secrets Manager or SSM SecureString — deferred alongside credential rotation above (2026-09-19); doing one without the other doesn't close the real exposure
- [ ] Scrub `tfplan_apidomain` from git history (`git filter-repo`/BFG + force-push across main and ~14 other branches) — the file itself is now untracked and gitignored (2026-09-19), but its content, including the still-live secrets above, remains reachable in past commits until history is rewritten. Deliberately not done — high-effort, breaks every existing clone/open PR, and is mostly cosmetic once the credentials above are actually rotated
- [ ] Add provisioned concurrency to the API Lambda — the node_modules-into-a-layer half of the cold-start fix shipped 2026-09-19 (see `backend_api.tf`'s `aws_lambda_layer_version.dependencies`); provisioned concurrency is the other real contributor the original audit found, deliberately deferred since it carries an ongoing AWS cost even when idle
- [ ] Widen (or otherwise mitigate) Neon's restore window — confirmed via the Neon dashboard (Settings > Postgres > History window): currently 6 hours, the max allowed on the Free Plan, with no logical replication or separate export/backup job configured. A bad migration or accidental delete that goes unnoticed for longer than that is unrecoverable through Neon. Paid plans go up to 30 days; not urgent while there's no real production data (see [[101ai no prod data yet]]), but worth revisiting before real users are onboarded

## Core Product — Tools & Chat
- [ ] Set up additional API requirements for supplemental data
- [ ] Improve prompts on all wired-up tools — the earliest ones (Word Helper, Film/Book/Music Recommendations) predate patterns established by later tools: confidence-gating against hallucination (Quote Finder), a stable per-item key so an evolving thing gets amended in place instead of forked or lost (Cooking's `dishKey`/Diet's `planKey`), tool-specific tone, and deliberately minimal instruction where the model handles nuance better on its own (Diet). Revisit each tool's `tool-config.ts` entry against these patterns for consistency, not just the ones that happen to need a new feature

- [ ] Put in place per-plan usage limits (what a user can do based on which package/tier they're on)
- [ ] Enable actually purchasing Plus/Premium — Pricing page has both permanently disabled ("Coming soon"), so every plan-gated feature (Memory, unlimited items) is currently unreachable by any real user
- [ ] Fix the Memory toggle — Settings' toggle is local-only and never saved to the backend, while Chat's "Memory on/off" indicator instead reads off `user.plan`; the two are disconnected and neither can be legitimately exercised until Plus/Premium purchase exists
- [ ] Track real chat usage — the daily-usage ring on Home is hardcoded to 0, so the "N chats remaining today" meter is fake for every user on every plan
- [ ] Add loading state UIs across the site — skeletons/spinners exist on some pages (Home, ToolDashboard, ToolPage, Chat) but others (Recent, Settings) show nothing while fetching, so slow requests look broken instead of loading; make coverage consistent everywhere data is fetched

- [ ] Add free-trial/upgrade prompts around the site — today the only nudge is `ItemLimitBanner`, shown reactively once a free user's item cap is already hit; add proactive messaging elsewhere (Home, dashboard, chat) to drive Plus/Premium upgrades. Depends on enabling actual purchasing (see Pricing "Coming soon" item above) — no point prompting an upgrade that can't be completed

## Tool-Specific Feedback
*User-submitted list (2026-09-15), organized by tool.*

### General
- [ ] Export to app
- [ ] Chat responses are too friendly/opinionated (e.g. "that's a great question!") — tone down
- [ ] Paragraphs in responses are too chunky — break up further
- [ ] When continuing a chat started from an item, sometimes the item itself should be updated instead of creating a new one on the same topic
- [ ] Add a toggle to save/unsave an item directly from the chat
- [ ] Add onboarding tooltips

### Writer
- [ ] Note SDK
- [ ] UX: text area is hidden when the keyboard is up

### Maths Solver
- [ ] Minimise the shown working out
- [ ] Structure responses as: value, formula, then working out

### Gym Planner & Self Care
- [ ] When gathering info about the user, the next question should be on its own bolded line; positive affirmation is good; routines should be iterative — have users try steps and give feedback

### Cooking
- [ ] Cooking guide needs serious work (general quality pass)

## Design & Branding
- [ ] Add pictures and descriptions for all tools on the tool introduction/about page
- [ ] Small UI fixes around the site
- [ ] Reconcile the dark-mode toggle — half-fixed as a side effect of the new onboarding flow: the two competing implementations are now one (a dedicated `/theme` page, reachable both mid-onboarding and from Settings, always saving via the same real `PATCH /users/preferences` + applying `document.documentElement.classList`/localStorage together). Still nothing left: a real dark theme isn't implemented anywhere in the app's CSS — the toggle's effect is currently just that one class on `<html>`, with no styles keyed off it

## Business & Launch
- [ ] Make into app
- [ ] Set up automated emailing (Mailchimp or something else)

---

**38 tasks remaining**

*(Completed items are no longer tracked here — this file only lists what's left. 2026-09-19.)*
