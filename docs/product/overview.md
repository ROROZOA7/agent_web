# Product Overview: Agentic E-Commerce Assistant (Web)

Status: **Confirmed v0.2 — v0.1 scope and UI contracts accepted 2026-09-23.**
Date: 2026-09-23 (v0.1 draft → v0.2 confirmed, same day)
Source research: `docs/plans/completed/2026-09-23-agentic-web-framework-research.md`

## 1. Purpose

Standalone agentic web application where an agent assists shoppers in an
e-commerce storefront experience. The agent interprets requests, plans work,
executes validated actions, and renders UI to the user through two declarative
contracts. Derived from the ON.X prior art journey (interpret → ground
entities → plan → gate mutations → retrieve/execute → evidence → recommend →
final policy → render) — conceptual reuse only; the prior docs' contracts are
dated and drifted.

## 2. Runtime Foundation (decision)

- **TypeScript, Agent-Native core** (`@agent-native/core`, Node >=22.22) as the
  app/runtime foundation. **Agent runtime is TS-only (confirmed)** — no Python
  agent runtime; revisit only if the Python-only Jev middleware becomes load-bearing.
- **PostgreSQL + Drizzle** shared application state (`application_state`:
  navigation, selection, `__url__`); SSE + polling live sync.
- One authoritative operation/state path: every state-changing capability is a
  `defineAction` (server-side validated + authorized), surfaced to agent tool,
  React hooks, HTTP, CLI, MCP, and A2A.
- The Agent-Native agent loop (`runAgentLoop`) is the orchestrator; Jev is
  integrated as TS decision services (see §5), not as a separate runtime.

### 2.1 Tech Stack: Language Dependency Map (verified 2026-09-23)

| Component | TypeScript | Python | Notes |
| --- | --- | --- | --- |
| Agent-Native core (actions, loop, state, sync) | **Mandatory** | **Not supported** | `@agent-native/core`; Node >=22.22; PostgreSQL + Drizzle |
| A2UI host renderer | **Mandatory** | — | React/Lit/Angular web_core renderers |
| A2UI agent-side authoring/emission | Yes (host SDKs) | **Yes — official** (`agent_sdks/python`: `a2ui_agent`, `a2ui_core`; incl. A2A/ADK tooling, v0.8/v0.9/v1.0 validators) | Both first-class |
| MCP Apps server | Yes (`@mcp-ui/server`) | **Yes — official** (`sdks/python`: `mcp_ui_server`; docs guide + python-server-demo) | Ruby too |
| MCP Apps client (AppRenderer) | **Mandatory** | — | `@mcp-ui/client` (React) |
| WebMCP | Browser JS + TS polyfill | — | Page-local tools; no server runtime |
| Jev | `@typesafe-ai/sdk` (official) | `typesafe-sdk` (official); PydanticAI + langchain-typesafe (Python-only middleware) | Question schemas must live in one TS module |

**Python policy (confirmed):** Agent-Native core is TS-only, so the action
layer, agent loop, and UI state/sync are TS — never duplicated. Everything
else sits at official protocol seams where Python is a first-class citizen:
(1) Python worker services mounted as actions (called via HTTP/MCP from the
loop); (2) Python A2UI emission via `a2ui_agent`; (3) Python MCP Apps servers
via `mcp_ui_server`; (4) Python Jev decision services via `typesafe-sdk` +
PydanticAI/LangChain when the middleware patterns are wanted. Python
components MUST NOT write `application_state` directly or own UI surfaces
outside the host-routed path — that split-state ownership is what caused the
prior art's contract drift.

## 3. Agent Autonomy Model

- **Action layer is authoritative.** Agents act by invoking defined actions;
  no DOM automation, no click replay, no headless browser.
- **WebMCP page-local tools** (experimental) MAY extend the browser surface:
  page JavaScript/forms expose tools via `document.modelContext`; browser
  mediates invocation in page context.
  - Support matrix required before use: Chrome 149+ Origin Trial or
    `enable-webmcp-testing` flag, Edge 150+ Origin Trial, Brave Leo
    experimental, ChatGPT Desktop. Firefox/Safari: standards-position only.
  - **Mandatory fallback:** every WebMCP tool MUST have a non-WebMCP path
    (action/MCP/HTTP); WebMCP is progressive enhancement, never required.
  - Requires authorized connected browser; page-local only, not network MCP.
  - **Confirmed 2026-09-23 — in v0.1 scope, enabled by default where
    supported.** Support matrix: Chrome 149+ Origin Trial, Edge 150+ Origin
    Trial. Brave Leo experimental and ChatGPT Desktop are best-effort and
    unverified. Firefox/Safari use the fallback path only.
- Agent context: bounded browser projection (96 KiB total / 64 KiB text /
  2,000 control nodes / 4 screenshots); use IDs/handles and incremental reads,
  never whole-page dumps. Generative inline UI if present is browser-local —
  durable workflow state lives in actions/SQL, not iframe storage.

## 4. UI Contracts (both, per-surface)

| Surface | Contract | Notes |
| --- | --- | --- |
| Constrained/interactive panels (forms, lists, pickers, compare) | **A2UI** | Declarative JSON stream; native-rendered; trusted component catalog only; agent stream is untrusted (sanitize, CSP). |
| Rich/free-form views (editorial, detailed product content) | **MCP Apps** | Sandboxed `text/html;profile=mcp-app` iframe; JSON-RPC over postMessage; **origin must be verified — never `'*'` in production**; external URLs fetched server-side (SSRF risk: block private/localhost). |

- **Version pinning (A2UI) — confirmed 2026-09-23: v0.1 targets v0.9.1.**
  v1.0 RC is not tracked in v0.1: its spec differs
  (`callRendererFunction`/`callAgentFunction`, no `surfaceProperties`) and no
  v1 web package exists in-repo. Pin exact commit/schema; do not assume v1.
- Surface ownership: one contract owns each surface; surfaces never mix
  channels mid-session without explicit app-level routing.

## 5. Jev Decision Services (all five targets, scope confirmed)

Jev (`jev-1.13.0`, pinned after tuning) is TypeSafe's System One model —
typed questions in, calibrated typed answers out, **no text generation**.
Used as deterministic-adjacent decision layer, never for content.

In scope:

1. **Request routing/triage** — classify intent pre-LLM; route to worker path.
2. **Policy/approval gates** — risk-gate mutations before execution.
3. **Next-action ranking** — rank candidate actions/responses (e.g. rerank
   top-N).
4. **Model routing** — select model per run from a Choice classification.
5. **Tool-risk gating** — Noul gate on tool calls; risk >= threshold → refuse
   (escalate, never auto-approve silently).

Implementation form (TS runtime, confirmed):

- Via **`@typesafe-ai/sdk`** (JS/TS official SDK) in narrowly-scoped decision
  services. PydanticAI `Agent('typesafe:…')` and
  `langchain_typesafe.TypeSafeClassifier` + experimental middleware
  (`ModelRouterMiddleware`, `AutoModeMiddleware`) are **Python-only** — the
  middleware patterns are replicated in TS against the raw SDK; do not add a
  Python runtime for them.
- Operational rules (from PydanticAI/LangChain integration facts, applied):
  - One request per decision set: all questions parallel; do not fire
    per-question calls.
  - No 2nd-request routes (union/tool-call pick+fill) on hot paths.
  - Confidence thresholds configurable per service
    (`typesafe_boolean_threshold`-style; default 0.5 / tool 0.6, tune on own
    labeled data — vendor defaults are tuned on a tiny internal set).
  - Escalate to human/LLM below threshold; Jev never makes the final call
    alone for irreversible mutations.
  - State hygiene: no secrets in state (transmitted to TypeSafe); strip
    uploads/media from history; compact/trim context (64k cap, accuracy
    degrades with large/irrelevant state; weak math/dates/adversarial
    content — deterministic guards stay in front).
  - Retry semantics: SDK retries limited; `ModelRetry`-style re-asks return
    the same answer — do not budget retries on Jev answers.

Performance acceptance (vendor claims are marketing until measured):

- Benchmark against own workload before adopting on hot paths: latency,
  cost, accuracy on own labeled data, hand-off rate (Jev+LLM paths can be
  slower than LLM-only).
- System budget: agent loop bound by `maxRunInputTokens`/max iterations;
  retained tool results resent per iteration → keep tool results compact;
  every mutation triggers DB + SSE invalidation — avoid chattery updates.

## 6. Agent-to-Agent (A2A)

- A2A-style interop is an **optional seam**: expose Agent-Native's A2A
  surface for future agent-to-agent delegation. Not a core requirement in
  v0.1; no external A2A peers assumed.

## 7. Security Requirements

- Agent-rendered streams (A2UI + MCP Apps) are **untrusted input**: sanitize
  text/media, strict CSP, validate everything against surface schemas.
- postMessage: verify `event.origin` and message schema; never wildcard.
- MCP Apps external `ui://` URLs: server-side fetch only with
  private/localhost blocklist.
- Jev: gate before commerce mutations with policy escalation; secrets never
  in state; API key server-side only (`OPENROUTER_API_KEY` — Jev is called
  through OpenRouter's Decisions API).
- Auth/session model (confirmed 2026-09-23): BETTER_AUTH email/session auth,
  already wired in `server/middleware/auth.ts`. A stable `BETTER_AUTH_SECRET`
  is required in the deploy environment; `AUTH_DISABLED` is local/dev only and
  MUST NOT be set in production. Anonymous shopper sessions are out of v0.1.
- Public Agent Web / public tools: OFF by default (`publicMcp`/`expose`
  opt-in only if a public surface is ever required).

## 8. Non-Goals (v0.1)

- DOM automation / click replay / autonomous headless operation.
- WebMCP as the only browser integration (fallback always).
- Jev for text generation or chat content.
- Pricing/billing, user accounts beyond basic sessions (unless confirmed).

## 9. Confirmed v0.1 Scope (2026-09-23)

The requirements gate is closed. Every decision below is backed by an explicit
user selection on 2026-09-23 in response to the open items previously listed
here; each item names its selection so the provenance is auditable. Nothing in
this section is still open.

1. **Commerce mutations.** Cart adds/updates execute directly. Returns and
   refunds are irreversible and MUST pass a Jev policy gate (decision service
   #2) plus explicit user confirmation before the mutating action runs — per
   §5, Jev never makes the final call alone on irreversible mutations. Order
   modification is out of v0.1 scope.
   *Selection: "Cart + returns, irreversible gated".*
2. **A2UI version.** v0.9.1 pinned (§4); v1.0 RC is not tracked in v0.1.
   *Selection: "Pin v0.9.1".*
3. **WebMCP.** In scope, enabled by default where supported, with the
   mandatory non-WebMCP fallback (§3). Support matrix: Chrome 149+ Origin
   Trial, Edge 150+ Origin Trial.
   *Selection: "Default-on where supported + fallback" — the support matrix is
   part of that option's stated behavior.*
4. **Auth/session.** BETTER_AUTH email/session auth (§7).
   *Selection: "Keep BETTER_AUTH sessions".*
5. **Surface inventory and contract ownership.** One contract owns each
   surface; surfaces never mix channels mid-session (§4).
   *Selection: all four surfaces.*

| Surface | Contract owner | v0.1 |
| --- | --- | --- |
| Assistant panel (chat + agent-rendered panels) | A2UI for constrained panels (forms, lists, pickers, compare); MCP Apps for rich/free-form content | in scope |
| Product list (PLP) | A2UI | in scope |
| Product detail (PDP) | MCP Apps | in scope |
| Cart | A2UI | in scope |

Note on items 2–3: the first attempt to settle them bundled A2UI versioning and
WebMCP into a single question. The user rejected that bundling — "i want both
A2UI and WebMCP, because i think these is separate ability" (correct: one is a
UI rendering contract, the other a page-local browser-tool surface) — and the
two were then confirmed separately, as recorded above.

Resolved earlier: Jev access — via OpenRouter (`OPENROUTER_API_KEY`, model
`~typesafe/jev-latest`, `POST /api/alpha/decisions`); key provisioned and the
live path verified 2026-09-23 (CLI + HTTP, all six intents).

### Implementation-Level Decisions Still Required

Below product-intent level; they do not reopen the gate. v0.1 implementation
MUST settle each explicitly rather than assume an unwritten default:

1. WebMCP behavior when the browser lacks support or is not enrolled in the
   Origin Trial, and how the non-WebMCP fallback is selected.
2. The rule that picks the assistant panel's contract per view between A2UI and
   MCP Apps without mixing channels mid-session.
3. The exact irreversible-action confirmation UX, and Jev failure/timeout
   behavior on a gated return or refund — fail-closed is implied by §5, but the
   user-visible path is unspecified.
4. Session persistence and local database defaults (PGlite is development-only,
   per the doctor check).

### Environment And Repo Debt (outside this gate)

Does not change product intent, and none of it blocks implementation start:
deployment environment values (`BETTER_AUTH_SECRET`, a persistent
`DATABASE_URL`); repo identity (`package.json` still carries the `an-scaffold`
template name, and `netlify.toml` still lists template origins); and broken
documentation-map entries in `docs/README.md` — `ARCHITECTURE.md`, `HARNESS.md`,
and `crates/` do not exist in this repository.