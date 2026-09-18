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
- [x] Restrict CORS to `FRONTEND_URL` instead of allowing any origin
- [x] Redirect unauthenticated users away from `/tools/:slug/dashboard` and `/tools/:slug/chats/:id` instead of showing them empty/broken states — same `useEffect`-once-`isLoading`-settles pattern already used by Settings/ChangePassword/Pricing
- [x] Make "Delete account" actually delete the account server-side (currently just signs out — the account still exists) — new `DELETE /users/me`, one transaction across chats (+messages via the existing cascade), items, suggestions, and usage logs (which carry real prompt/response text, not just metrics) before the user row itself; none of those tables had an enforced FK back to users, so this is explicit, not relied on cascade
- [x] Make "Reset chats" / "Remove items" in Settings actually clear data (currently no-ops that show a fake success) — new `DELETE /chats` and `DELETE /items` (bulk, scoped to the current user), reusing the account-deletion work above's discovery that no FK cascade exists here
- [x] Clear `savedTools`/`savedMessageItems` localStorage on sign-out — added `clearSavedTools()`/`clearSavedMessageItems()`, called from the single real sign-out path (`useAuth.signOut()`), which both the Settings sign-out button and the "Delete account" confirm already route through
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
- [x] Fix Google Maps API (not working) — two independent gaps, both fixed: the web deploy workflow never passed `VITE_GOOGLE_MAPS_BROWSER_API_KEY` at build time (browser-side Maps JS/Static API), and `GOOGLE_API_KEY` was never wired into Terraform at all (server-side Routes/Places API, `GoogleMapsClient`) despite the value already sitting unused in `terraform.tfvars` — both now live in prod
- [x] Change "my location" from lat/lon to a town/city name — reworked rather than just reworded: the "already set" banner is gone entirely from an already-running chat (was clutter there), but kept as a one-time "Near Birmingham — not you?" checkpoint on the new-chat compose sheet only, using a real reverse-geocoded place name instead of raw coordinates, in case the cached location's gone stale (moved since it was last set) before starting something new
- [ ] When continuing a chat started from an item, sometimes the item itself should be updated instead of creating a new one on the same topic
- [ ] Add a toggle to save/unsave an item directly from the chat
- [ ] Add onboarding tooltips
- [x] Add a 3-dot menu on all chats — scoped to ToolDashboard's Chats tab list and the open chat page itself (Delete only, matching the existing Items-tab pattern); Recent's list wasn't included in this pass. Needed a new `DELETE /chats/:chatId` endpoint since one didn't exist at all before. Deleting a chat or item now confirms first via `ConfirmDialog` (same component Settings uses for account-wide deletes), but without that dialog's 5s forced wait — `waitSeconds` is now a prop on it, defaulting to 0, with Settings explicitly opting into 5 for its account-wide actions.

### Writer
- [x] Rename Writer to Notes
- [ ] Note SDK
- [x] Writer didn't show up in Recent
- [x] Hide the send button by default; show it only when the input is focused
- [x] Confirm whether Writer saves in the background if the user clicks back too quickly — it didn't: a debounced save still pending when the component unmounted was silently cancelled by the timeout cleanup instead of being flushed, losing the last edit. Fixed by tracking the pending save in a ref and flushing it on unmount.
- [x] "Copy All" needs feedback (confirmation state)
- [x] Add a confirmation step to Delete — Delete was still a placeholder (`navigate(-1)`, never actually deleted anything), so this needed making it real first: tracks the note's actual saved Item id (distinct from its dedupKey) once either reopened or first autosaved, calls the real `deleteItem` through the same `ConfirmDialog` pattern as ToolDashboard/Chat, and just navigates back with no dialog at all for a note that was never saved (nothing to confirm)
- [ ] Add "Send to" functionality
- [x] BUG: issue switching between saved states — two compounding causes. (1) Saving a note never invalidated the item caches other views read (ToolDashboard, Recent, ItemPickerSheet); fixed via `queryClient.invalidateQueries` in `saveMutation`'s `onSuccess`. (2) Even with that, reopening a note right after a save could still show stale content: the editor's loading gate only checked `isLoading`, which is already false the instant any cached value exists even if a background refetch hasn't landed yet, and the note's local title/body state is seeded once on mount and never re-syncs — so a stale first render locked in for the rest of the session. Fixed by also gating on `isFetching`.
- [ ] UX: text area is hidden when the keyboard is up

### Maths Solver
- [ ] Minimise the shown working out
- [ ] Structure responses as: value, formula, then working out

### Business Planner
- [x] Use the advanced model for maths

### Gym Planner & Self Care
- [ ] When gathering info about the user, the next question should be on its own bolded line; positive affirmation is good; routines should be iterative — have users try steps and give feedback

### Cooking
- [ ] Cooking guide needs serious work (general quality pass)

### New Tools
- [x] Document explainer — new tool, attachment optional (not forced). The real gap this needed: the existing attachment pipeline only ever told the model a non-image file's *filename* (`ChatsService.describeNonImageAttachments`), never its actual contents — useless for a tool whose whole point is reading documents. Added real text extraction (new `pdf-parse` dependency for PDF, `mammoth` for .docx, plain UTF-8 decode for txt/csv; old-format .doc and Excel still filename-only — no good pure-JS parser for legacy binary .doc, and no xlsx parser wired up yet) behind a new `describeDocumentAttachments`, opted into via `DOCUMENT_CONTEXT_TOOL_SLUGS` (just this tool for now) rather than applied to every tool's every message. Every turn gets a persistent state line ("document(s) attached in this chat so far: ..." or "none yet") since document content, unlike text, is never re-sent on a later turn (same reasoning as image attachments) — the model needs to be told what's in play, not just shown it once. A document attached mid-conversation is marked "NEWLY ATTACHED" with full extracted text, with explicit guidance to infer from the user's wording whether it joins the existing discussion or shifts focus to just the new one, rather than assuming either way. Testing this surfaced a real, separate bug affecting every tool, not just this one: sending an attachment with no typed message falls back to a placeholder like "See attached image." regardless of what was actually attached — fixed in both `Chat.tsx` and `ToolDashboard.tsx` to say "file" unless every attachment is genuinely an image.

### Recommendation Tools
- [x] Fix recommendation tools (Film/Book/Music) repeating the same suggestion within one ongoing chat — root cause found: `MAX_HISTORY_MESSAGES` (20) in `openai.service.ts` silently dropped older turns before the model saw them once a "give me more" chat passed ~10 exchanges, so the existing "never repeat" prompt instruction had nothing to check against; widened to 60
- [x] Rename Book Recommendations to Read Recommendations, and broaden scope to comics/manga/manhwa/light novels (not book-only) — rating is now source-aware (`rating`/`ratingSource`, e.g. Goodreads for prose, MyAnimeList/AniList for manga) instead of a fixed Goodreads field, and a new `format` field distinguishes Book/Manga/Manhwa/Comic/Light Novel
- [x] Create Show Recommendations (new standalone tool, mirrors Film Recommendations)
- [x] Add images/video on recommendation tools — real per-source resolution server-side, never a model-guessed URL (same principle as the YouTube embed work). Film/Show → Wikipedia (two-step search-then-summary; switched from TMDb after the user flagged TMDb's commercial-use tier as a real cost risk given 101ai's paid plans — Wikipedia is free for any use, including commercial). Read → Google Books for books/Western comics, AniList for manga/manhwa/light novels, routed by the new `format` field. Music → on reflection a YouTube embed (reusing the existing pipeline wholesale) beats a static album-art image, so `MUSIC_RECOMMENDATIONS_SCHEMA` gained `videoKeywords` instead of a new Cover Art Archive integration. Verified against real live data for every source, not just docs — this caught two real bugs before shipping: an unquoted Wikipedia search query mis-ranking TV show results, and Google Books' "keyless" access actually returning a hard 0-quota error in this environment despite Google's own docs calling a key "optional" (now reuses the existing `GOOGLE_API_KEY`, needs one more Cloud Console step — enable Books API for the project + on that key)

## Design & Branding
- [ ] Improve font and branding
- [ ] Create logo
- [ ] Add pictures and descriptions for all tools on the tool introduction/about page
- [ ] Small UI fixes around the site
  - [x] India's currency — resolved as policy, not a bug: the app only supports `$`/`£`/`€` (see `CurrencySymbol`), and any country outside those three deliberately defaults to `$` rather than gaining a fourth symbol
- [x] Change "saved" tool to "pinned" tool — the tool-level save toggle (ToolDashboard header) and Home's "Saved" section are now "Pin"/"Unpin" and "Pinned"; the underlying `savedTools.ts` module/localStorage key were left as-is (internal, not user-visible)
- [x] Be able to pin items on tools — new `Item.pinned` column + `PATCH /items/:id/pin`; pinning sorts an item to the top wherever it already shows up (`ORDER BY pinned DESC, updatedAt DESC`, no separate section), toggled from the item's existing dropdown menu. The pin badge itself went through a few placement iterations before landing right: not absolutely positioned over the card (covered title text on some tools), not a separate row above the whole card (looked disconnected) — it's a small grey icon rendered by each of the 35 `ItemView.tsx` components as a block-level sibling directly before their own title element. The ~27 single-column ("dense") tools only render it when pinned; the 7 two-column-grid tools (word-helper, music/show-recommendations, bills-utilities, news, shopping, default) always render the line (icon or a blank space) so a pinned and unpinned card sitting side by side in the same grid row stay equal height.

## Infrastructure & DevOps
- [ ] Fix Lambda cold starts — audit found the function isn't VPC-attached at all (so networking config isn't the cause); the real contributors are a 25MB monolithic deployment package and no provisioned concurrency. Split `node_modules` into a Lambda layer and add provisioned concurrency instead of pursuing a networking fix
- [x] Set up observability (Grafana) — Grafana Cloud connected to real CloudWatch (via a dedicated read-only IAM role) and to Grafana Faro (Frontend Observability: JS errors, console, Web Vitals, every fetch/XHR call, React Router route changes — see `web/src/lib/faro.ts`); sessions/requests tagged with the real `userId` on both frontend (Faro + Clarity) and backend (structured JSON logs + `requestId`/`userId` via `RequestLoggingInterceptor`/`StructuredLogger`, `AsyncLocalStorage`-based); an admin-only `/admin/debug` page + `/debug/test-error` endpoint deliberately triggers each failure type to verify the whole pipeline end-to-end
  - [x] Add CloudWatch alarms on Lambda errors/throttles/duration and API Gateway 4xx/5xx — 5 alarms live, SNS email notifications
  - [ ] Log the real error when an OpenAI call fails instead of discarding it — every OpenAI-side failure is currently invisible in production
- [x] Set up MS Clarity — gated to the real prod hostname only (never localhost/preview), sessions tagged with real `userId`
- [ ] Track recurring costs — a running list of everything paid for (domain, hosting, API usage, tools/subscriptions), what it costs, and when it renews, so nothing lapses or surprises unnoticed
- [ ] Add Terraform plan/apply to CI — both GitHub Actions workflows currently only deploy app artifacts (Lambda zip, S3 sync); all infra changes are applied manually from a local machine
- [ ] Set up a proper dev/staging environment — everything today is one flat "prod" environment and state file, no per-environment tfvars
- [x] Clean up stray local Terraform artifacts (`errored.tfstate`, `tfplan`, `rollback.tfplan`, `lambda.zip`) sitting in `101ai/infra`
- [ ] Confirm Neon's own DB backup/retention settings — the database is external to Terraform entirely, so nothing in this repo enforces or documents backups
- [ ] Add real test coverage — only the default health-check spec exists anywhere in the API; zero coverage on auth, chats, items, users, openai, router, or plan logic
- [x] Add `UsageLog` to the TypeORM CLI `DataSource` entity list — it's already used at runtime but missing from the migration-generation config, risking schema drift on the usage-logs table

## Business & Launch
- [x] TOS and Privacy Policy pages — real content at `/terms` and `/privacy`, linked from the bottom of the register screen, Settings, and Pricing (for Google Play review). Written as an individual trading as "Tonberry" (no formal legal entity set up yet — update the operator name/type in both files once one exists), UK-governed, 16+ minimum age, third-party data sharing described in generic categories rather than naming specific vendors, and account/data deletion described as self-service via Settings — at the time this was written, that was aspirational (Settings' Delete/Reset/Remove actions were still no-ops), but the Security section above now shows those were implemented for real later in the same session, so the policy's wording is now actually true, not just intended
- [ ] Set up business account and sign up to Google app publishing
- [ ] Make into app
- [ ] Set up automated emailing (Mailchimp or something else)

---

**Progress: 28/80 tasks complete (35%)**
`███████░░░░░░░░░░░░░` 35%

*(Recount, 2026-09-16 — the previous 46/123 figure was stale relative to the actual checklist (the "Tool-Specific Feedback" section added a batch of new items without the header being updated to match). This is the real current count.)*
