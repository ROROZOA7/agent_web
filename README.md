# Agent Web (innovation)

E-commerce assistant on the Agent-Native stack (TypeScript core: actions,
agent loop, state/sync; protocol seams in Python for A2UI / MCP-UI / Jev).
Full tech-stack and product context: `docs/product/overview.md`.

## Current slice: Jev request triage (spike, verified)

`POST /_agent-native/actions/triage-message` and the `pnpm action triage-message`
CLI classify any customer message with Jev — called through OpenRouter's
Decisions API (`POST https://openrouter.ai/api/alpha/decisions`, model
`~typesafe/jev-latest`) — into one of six intents, gated by a 0.5 confidence
threshold with an `unclear` fallback that routes to clarification.

- Decision logic (question schema, threshold, routing map): `lib/jev.ts`
- HTTP action: `actions/triage-message.ts`
- Offline contract tests (stubbed transport): `lib/jev.test.ts`

Set `OPENROUTER_API_KEY` in the environment for live calls; a missing key
fails fast with a clear error. Override the model with `JEV_MODEL`.

## Develop locally

```bash
corepack enable        # once — activates pinned pnpm 10.29.1
pnpm install
pnpm dev               # agent-native dev, http://localhost:8080 (AUTH_DISABLED=true for no login wall)
pnpm test              # vitest — spike contract tests
pnpm action triage-message --message "I want to return my order"
```

Docs: `docs/product/overview.md` (stack, Jev decision services, open items),
`docs/plans/completed/2026-09-23-agentic-web-framework-research.md` (framework
research).