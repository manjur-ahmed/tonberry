# 101 AI Tools

A catalog of everyday AI tools. Each tool gets its own route, its own UI
(not just a chat box), and — where accuracy matters — its own external API
integration alongside the LLM call. The tool catalog itself isn't decided
yet; `web/src/tools/registry.ts` has a placeholder list to prove the
pattern.

Deploys to `101ai.tonberry.co.uk` eventually; a native app-store wrapper
(Capacitor/Expo) comes later, once the web product is proven.

## Status

- **Phase 1 (done)**: scaffold, homepage tool grid, `users` table with a
  `plan` field.
- **Phase 2 (built, pending real Google credentials to test live)**: sign-in
  (hand-rolled OAuth2 code exchange, not `@nestjs/passport`'s Google
  strategy — its redirect internals call an Express-only API that doesn't
  exist on Fastify's reply object), and the gating flow — click a tool
  while signed out → sign in → no plan yet → pricing → picking Free sets
  the plan and returns home → tool unlocked.
- **Phase 3 (needs an OpenAI API key)**: the real AI-call backend and the
  first working tool.

## Local development

```
cd 101ai/web && npm run dev   # http://localhost:5174
cd 101ai/api && npm run start:dev   # http://localhost:3001
```

Needs the root `docker compose up -d` running first (shared Postgres). The
`tonberry_101ai` database is separate from the CRM's `tonberry` database,
same container.

Copy `101ai/api/.env.example` to `.env` and fill in `GOOGLE_OAUTH_CLIENT_ID` /
`GOOGLE_OAUTH_CLIENT_SECRET` (Phase 2) and `OPENAI_API_KEY` (Phase 3) when
ready — never commit real values.
