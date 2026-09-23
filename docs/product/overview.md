# Product Overview: Agentic E-Commerce Assistant (Web)

Status: **Draft v0.1 — pending user confirmation.**
Date: 2026-09-23
Source research: `docs/plans/active/2026-09-23-agentic-web-framework-research.md`

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
|---|---|---|---|
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
- Agent context: bounded browser projection (96 KiB total / 64 KiB text /
  2,000 control nodes / 4 screenshots); use IDs/handles and incremental reads,
  never whole-page dumps. Generative inline UI if present is browser-local —
  durable workflow state lives in actions/SQL, not iframe storage.

## 4. UI Contracts (both, per-surface)

| Surface | Contract | Notes |
|---|---|---|
| Constrained/interactive panels (forms, lists, pickers, compare) | **A2UI** | Declarative JSON stream; native-rendered; trusted component catalog only; agent stream is untrusted (sanitize, CSP). |
| Rich/free-form views (editorial, detailed product content) | **MCP Apps** | Sandboxed `text/html;profile=mcp-app` iframe; JSON-RPC over postMessage; **origin must be verified — never `'*'` in production**; external URLs fetched server-side (SSRF risk: block private/localhost). |

- **Version pinning (A2UI):** production on **v0.9.1**; v1.0 RC spec differs
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
- Auth/session model: TBD (open item) — app is standalone with sessions.
- Public Agent Web / public tools: OFF by default (`publicMcp`/`expose`
  opt-in only if a public surface is ever required).

## 8. Non-Goals (v0.1)

- DOM automation / click replay / autonomous headless operation.
- WebMCP as the only browser integration (fallback always).
- Jev for text generation or chat content.
- Pricing/billing, user accounts beyond basic sessions (unless confirmed).

## 9. Open Items (for confirmation)

1. Commerce mutation scope: cart / order / returns — which are in v0.1, and
   approval flow for irreversible ones (policy gate + Jev + human escalation).
2. A2UI version decision: pin v0.9.1 vs track v1.0 RC (needs v1 web package
   availability check).
3. Target browsers for WebMCP support matrix (which are the user's real
   customers).
4. Auth/session model.
5. Initial surface inventory: which surfaces exist (PLP, PDP, cart,
   assistant panel) and which contract owns each.

Resolved: Jev access — via OpenRouter (`OPENROUTER_API_KEY`, model
`~typesafe/jev-latest`, `POST /api/alpha/decisions`); key provisioned and the
live path verified 2026-09-23 (CLI + HTTP, all six intents).