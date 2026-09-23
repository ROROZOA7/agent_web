# Execution Plan: Agentic Web Framework Research

Date: 2026-09-23

## Status

Active

## Outcome

Evidence-backed comparison of candidate frameworks for an agent-with-web-UI
application (Agent-Native, A2UI, WebMCP, MCP-UI), plus TypeSafe Jev for
performance-sensitive decision/routing paths, plus reusable seeds from prior
art. Output is this memo and a requirements-clarification discussion with the
user. No product code is written in this phase.

## Context

- Repo: `agent_web` harness scaffolding only (docs/, scripts/, .pi/); no product code.
- User's required frameworks: **agent-native, a2ui, webmcp**. Exploration only: A2A, MCP, MCP-UI, "A2S".
- User-requested research: **TypeSafe Jev** ("typesafe jev") for performance issues, via `pydantic_ai` or `langchain_typesafe` integration.
- Prior art: `/home/duclm/Documents/FPT/ONE/ONX/MAS-ECOM-CANON/docs` (historical ON.X e-commerce assistant; see Prior Art section — contract drift documented, treat as conceptual only).

## Scope

In scope:

- Facts, status, limitations, and primary URLs per framework; seam comparison; Jev identity/SDKs/performance claims; prior-art reusable seeds vs drift; open requirement questions.

Out of scope:

- Implementation, architecture decision, dependency selection, benchmarks. All performance claims are vendor claims until measured.

## Approach

1. Fan out read-only scouts to primary sources (6 framework scouts + 3 Jev scouts; all completed).
2. Verify claims against official docs/repos/package metadata; label vendor claims.
3. Write this memo.
4. Discuss open requirement questions with the user (section below).
5. After user answers: produce requirements draft in `docs/product/` for confirmation.

## Risks And Recovery

- Vendors' performance claims are marketing; validate with own benchmarks before adoption.
- A2UI version inconsistency (v0.9.1 prod, v1.0 RC with differing spec): pin exact commit/schema before requirements.
- WebMCP browser support is Origin-Trial only (Chrome 149/Edge 150); a non-WebMCP fallback is mandatory.
- unknown "A2S": unresolved; ask user.
- Recovery: this phase is read-only; no rollback needed beyond deleting/adjusting the memo.

## Progress

- [x] Framework scouts: ResearchAgentNative, ResearchA2UI, ResearchWebMCP, ResearchMCPUI, ResearchPriorInitiative, ResearchFrameworkSynthesis.
- [x] Jev scouts: ResearchPydanticJev, ResearchLangChainJev, ResearchTypeSafeOfficial.
- [x] Write this memo.
- [x] Requirements discussion with user (2026-09-23).
- [x] Requirements draft in `docs/product/overview.md` (draft v0.1, pending confirmation).
- [ ] User confirms requirements draft → move plan to `docs/plans/completed/`.

## Framework Facts

### Agent-Native (BuilderIO/agent-native)

- MIT; TypeScript; `@agent-native/core` v0.183.0; Node >=22.22; ~6.2k stars; actively updated (rapid changelog). Root workspace version 1.0.0 ≠ core 0.183.0 — do not infer stable 1.0 API.
- One `defineAction` in `actions/<name>.ts` = server-side validated/authorized operation surfaced to: in-app agent tool, React hooks (`useActionQuery`/`useActionMutation`), HTTP `/_agent-native/actions/<name>`, CLI, MCP, A2A, automation.
- Shared PostgreSQL/Drizzle data + SQL `application_state` (navigation/selection/`__url__`); SSE + polling live sync; PGlite local-only.
- Agent loop iterative, provider-pluggable (`runAgentLoop`, `AgentEngine`).
- Semantic context over UI click replay: `view-screen` action hydrates semantic UI state; `navigate` writes one-shot tab-scoped command.
- WebMCP support is explicitly experimental and page-local (auto-projection of actions; `client/webmcp.ts`; `@mcp-b/webmcp-polyfill`); requires authorized connected browser.
- Browser-context schema bounded: 96 KiB total, 64 KiB text, 3 projections, 2,000 control nodes, 4 screenshots. Generative inline UI = sandboxed Alpine/Tailwind iframe, browser-local (not agent/backend-visible, not cross-device) — durable workflows must persist via actions/SQL.
- Public Agent Web ≠ public tools: requires `publicMcp:true` + `publicAgent.expose:true`.
- Performance caveats: retained tool results resent per iteration → input-token spend can be ~quadratic in tool-call count; `maxRunInputTokens` stops turn; every mutation triggers DB + SSE invalidation/refetch; external MCP benefits from compact catalogs + tool-search.
- Maturity: no SLA, support policy, or API-compat promise; managed DB planned/not available. Action/data/context primitives = established contract; browser bridges, managed services, host integrations = evolving.
- Primary: https://github.com/BuilderIO/agent-native · https://agent-native.com/docs/actions-overview.md · context-awareness.md · webmcp.md · agent-web-surfaces.md · server-database.md · packages/core/src/action.ts · packages/core/src/agent/production-agent.ts · packages/core/src/browser-context/index.ts · packages/core/src/client/webmcp.ts

### A2UI

- Apache-2.0; early public preview; **v0.9.1 current production**, v1.0 release candidate, v0.8 legacy.
- Declarative JSON streaming protocol: `createSurface`, `updateComponents` (flat/adjacency list, `id:'root'`), `updateDataModel` (JSON-Pointer paths), `deleteSurface`; ordered framing (JSONL/WebSocket/SSE); bidirectional action channel; `application/a2ui+json` MIME for A2A binding.
- Host owns renderer + **trusted component catalog** (JSON Schema contract); agent can only request catalog components. Renderers: Lit/Angular/React (web_core), Flutter (GenUI SDK).
- Security: agent stream is **untrusted** — sanitize text/media, CSP, validate everything; `sendDataModel:true` leaks full surface model (off by default); no built-in auth.
- Status inconsistencies: landing page says v1 adds `actionResponse`/theme→surfaceProperties but v1.0 spec defines `callRendererFunction`/`callAgentFunction` RPC and no surfaceProperties — pin exact commit/schema before requirements. Repo exposes only v0_8/v0_9 renderer dirs — do not assume v1 web package exists.
- Primary: https://github.com/a2ui-project/a2ui · https://a2ui.org

### WebMCP

- W3C Community Group Draft 2026-09-17; **NOT a W3C Standard**.
- Browser-native `document.modelContext.registerTool/getTools/executeTool` (+ events toolchange/toolactivated/toolcancel); page JS or forms expose tools; browser mediates invocation in page context (shared auth/state/UI).
- Status: Chrome 149 Origin Trial + local flag `about:flags#enable-webmcp-testing`, Edge 150 Origin Trial, Brave Leo experimental, ChatGPT Desktop supports; Firefox/Safari standards-position only.
- Declarative form API (`toolname`/`tooldescription`) is experimental proposal with TBDs.
- Permissions Policy `tools` (default self), secure/origin-keyed contexts, `exposedTo` for cross-origin opt-in.
- Non-goals: not fully autonomous/headless, not replacement for backend MCP or human UI. Open questions: multimodal, confirmation API, output schema/streaming, service workers.
- Primary: https://github.com/webmachinelearning/webmcp · W3C CG Draft 2026-09-17

### MCP-UI / MCP Apps

- Apache-2.0; implements **MCP Apps spec 2026-01-26 (stable)**; package versions listed v5.2.0 (2025-07-18).
- Tool declares `_meta.ui.resourceUri` → `ui://` resource, MIME `text/html;profile=mcp-app`; host `resources/read` + `AppRenderer` renders in sandboxed iframe; host↔guest JSON-RPC over postMessage (input/result/context/cancel; tools/call, ui/message, ui/open-link).
- Default = HTML only; legacy paths: embedded resource in tool results, intent/notify/prompt/tool/link messages, adapter to MCP Apps. External URL: TS SDK server-side fetch (SSRF/DNS-rebinding risk, blocks private/localhost).
- Examples use `'*'` postMessage — production must verify source/origin. Host support varies; ext-apps repo has no supported host beyond basic-host example.
- Primary: https://github.com/MCP-UI-Org/mcp-ui · MCP Apps spec ext-apps 2026-01-26

### Seam comparison (what belongs where)

- Authoritative operation/state path: choose ONE (Agent-Native recommended foundation).
- Agent runtime: Agent-Native (TS) or Python (PydanticAI/LangChain) or hybrid split (TS host/actions + Python decision services for Jev).
- UI contract: A2UI (declarative, catalog-constrained, native-rendered, safe-as-data) vs MCP-UI/MCP Apps (sandboxed HTML, richer visual freedom, iframe isolation) vs both per-surface.
- Browser-local tools: WebMCP experimental — needs support matrix + mandatory fallback.

## TypeSafe Jev ("typesafe jev")

### Identity

- **Jev is NOT a language model** — first "System One" model: reads state (text/JSON) and answers typed questions (Choice/Noul/Score) with calibrated probabilities in ONE request. **Cannot generate text.** "JEV" all-caps appears nowhere official (flag: unofficial spelling).
- Company: TypeSafe AI (typesafe.ai; console.typesafe.ai; docs.typesafe.ai; GitHub org `typesafe-ai`). Current model `jev-1.13.0`; aliases `jev-latest`/`jev-preview`; announced Sep 15, 2026 (early access).
- "Zero hallucinations" = structural claim (no text output), not empirical.

### API / SDKs

- `POST https://api.typesafe.ai/v1/systemone`; Bearer key from console.typesafe.ai/keys. Request = state + map of typed questions; all questions evaluated in parallel, one request → one response. Outputs typed; no generation/parsing.
- Primitives: Choice (≤255 options, choice+probabilities+confidence), Score (2–10 levels, score+probabilities+confidence), Noul (yes/no 0–1).
- SDKs: Python `typesafe-sdk` (≥3.10), JS/TS `@typesafe-ai/sdk`; agent skill for Claude Code/Codex.
- Pricing: $42/Btok = $0.042/Mtok input, outputs FREE; 64k tokens/request (state+questions), 32k state + longest question; 250k tok/s; 1,200 req/min (dynamic, 429 + retry-after); text-only; English best, other langs (incl. CJK) weaker — test before relying; no fine-tuning; ZDR for enterprise.

### PydanticAI integration (Python)

- `pip install "pydantic-ai-slim[typesafe]"` → `typesafe-sdk>=0.6.0`; env `TYPESAFE_API_KEY`; base URL https://api.typesafe.ai; endpoint `/v1/systemone`.
- `Agent('typesafe:jev-latest', output_type=...)`; model name swap runs the same agent on an LLM. Prompt = judged text; each output_type field = one question; ALL fields answered in ONE request (independent/parallel). Instructions go in field `description`s (prompts carrying questions are judged as text — common mistake).
- Supported fields: bool / Literal|Enum pick-one / bounded float 0..1 (raw probability) / IntEnum rubric 0..N (2–10 levels) / list of Literal|Enum (yes/no per option) / dict{option:bool} / optional pick-one / nested model (outer.inner). Unsupported → `UserError` BEFORE request: str, unbounded numbers, datetime, field unions, files/media. `supports_text_output=False`.
- Tools/routes: function tools offered as routes; Jev picks and fills typed args in a SECOND request; unsupported args → `ToolCallProposed` → `FallbackModel` hands whole step to an LLM. Union output types = routes (2nd request).
- Streaming: none real — whole answer arrives as one event; `run_stream`/AG-UI/Vercel adapters get single event (compat only).
- Retries: `ModelRetry` usually returns the SAME answer and burns retry budget; SDK retries connection/timeouts twice with backoff (stacks with PydanticAI retry layers); over-length state → `ModelHTTPError` max_tokens_exceeded → fallback handoff.
- Measurable per response (`provider_details`): per-field `confidence` (margin to threshold, not P(accurate)), `probabilities`, `scores` (unrounded), `requests` (real count — 2 for pick+fill), `tool` (route picked). Config: `typesafe_boolean_threshold` (0.5), `typesafe_tool_call_threshold` (0.6); temperature/top_p ignored; timeout/extra_headers/extra_body forwarded.
- URLs: pydantic.dev/docs/ai/models/typesafe/ · pydantic.dev/docs/ai/api/models/typesafe/ · pydantic.dev/docs/ai/core-concepts/output/ · core-concepts/retries/ · pydantic-ai source `pydantic_ai_slim/pydantic_ai/models/typesafe.py` + tests/models/test_typesafe.py + pyproject (`typesafe = ["typesafe-sdk>=0.6.0"]`).

### LangChain integration (Python)

- `langchain-typesafe` v0.0.1a3 (PyPI, uploaded 2026-09-20; alpha/Beta); requires Python >=3.10, langchain-core >=1.6.2, httpx2; MIT; experimental extra. Official LangChain partner package (github.com/langchain-ai/langchain/libs/partners/typesafe).
- `TypeSafeClassifier` = LangChain Runnable (sync `invoke` + async `ainvoke`; batch/composition); input `ClassifierRequest {state, questions}`; state may be string, JSON object/array, or BaseMessage(s). Questions named Noul/Choice/Score primitives; response groups nouls/choices/scores + model/usage/request_id. Noul has no confidence (probability is the answer).
- Env: `TYPESAFE_API_KEY`, `TYPESAFE_BASE_URL` (default https://api.typesafe.ai). LangSmith tracing; message support.
- Experimental middleware (`langchain_typesafe.experimental.middleware`): `ModelRouterMiddleware` (one Choice classification of latest human message selects model for all calls; stores ChoiceAnswer in agent state) + `AutoModeMiddleware` (Noul risk-gate of explicitly configured tools; risk probability >= threshold returns error ToolMessage instead of executing; refuses risky calls without approval → pair with human-in-the-loop; do not put secrets in state/tool args — transmitted to TypeSafe).
- Errors subclass LangChain model-error classes; `TypeSafeAPIError` surfaces status/body/headers/sanitized endpoint/request ID; rate-limit error exposes retry_after_ms/request_id.
- URLs: docs.langchain.com/oss/python/integrations/providers/typesafe · reference.langchain.com/python/langchain-typesafe · pypi.org/pypi/langchain-typesafe/json · github.com/langchain-ai/langchain/tree/master/libs/partners/typesafe.

### Performance claims (vendor; NOT independently verified)

- Homepage/evals (their own evals.typesafe.ai): 193.6x faster, 444.6x cheaper than compared LLMs (reference = avg of GPT-6 Astra + Fable 5.1) on 4 workflow evals; 70–500ms end-to-end vs 3–329s; 238x lower input price than "Claude Fable 5.1". Self-nuanced: numbers likely at high end of real gains; biased toward OpenAI/Anthropic; "can't prove it isn't subsidized".
- Cookbook: parallel_questions batching = 12.2x cheaper, 10.0x faster than per-question calls (all one request); rerank cookbook top-1 5%→18%, top-10 38%→62% (CLERC legal).
- Architecture: RLCD (Reinforcement Learning for Calibrated Decisions), new architecture + parallel sampler.
- Interpretation: N fields ≈ 1 request → routing/triage cheap enough to run on EVERY step; but latency/cost wins are application-specific: avoid unions/tool routes needing 2nd requests on hot path; measure hand-off rate (LLM+Jev can be slower than no Jev). No independent benchmarks exist → benchmark own workload.

### Reliability limits (official jaggedness doc, jev-1.13)

- Literal reading; weak math/counting; weak date/time comparison; struggles with indirection; accuracy drops with large/irrelevant state (context rot); vulnerable to adversarial/injected content (keep deterministic guards); option order matters; calibration is group-level, not per-answer; no guaranteed structural invariants between question phrasings; cannot generate text.
- Maturity: early access (waitlist/contact sales), site v0.01, docs updated through Sep 2026; no SLA; docs admit defaults tuned on "a small internal set of support tickets … too small to separate models with confidence" → tune thresholds on own labelled data; pin version after tuning.
- URLs: docs.typesafe.ai/models · docs.typesafe.ai/model-jaggedness/jev-1.13 · docs.typesafe.ai/confidence · typesafe.ai/blog/introducing-system-one-models-and-jev · typesafe.ai/manifesto

### Jev usage candidates (requirements discussion)

- Request routing/triage (QUA replacement in prior art), policy gates (risk/approval), next-action ranking, model routing middleware, tool-risk gating — decide which are in scope.

## Prior Art (ON.X / Canon NL B2C — historical, NOT authority)

- Facts: ON.X = e-commerce shopper assistant (not a chatbot); LangGraph orchestrator + 5 worker agents (QUA/NAA/CRA/DPA/JEA) + deterministic Policy Engine; pipeline: ShopperEvent → request understanding → entity resolution → response planning → policy gate → CRA/JEA → evidence → next action → final policy → display → DecisionEnvelope; typed Pydantic contracts; JEA sole commerce mutator; SSE stream `metadata → layout → ui_block* → nba → done`; display modes (sidebar_only/hybrid/embedded/minimal); template/frame registry; PCB PDP frames catalog-backed; `AGENT-DISPLAY-TEMPLATES.md` v0.2 2026-06-12 (4 PLP, 5 PDP templates).
- Prior initiative used **Google A2UI** (github.com/google/a2ui) as frontend rendering target with A2A readiness only; also "A2S"-adjacent naming exists in their docs (`A2S` was never resolved — ask user).
- Key caveat: contract drift — SSE event names, template vs layout ids, frame_assignments vs frame_mapping inconsistent across doc sets.
- Reusable only conceptually: journey = interpret → ground entities → plan task → gate mutation → retrieve/execute → evidence → recommend → final policy → render.
- Path: /home/duclm/Documents/FPT/ONE/ONX/MAS-ECOM-CANON/docs (AGENT-DESIGN.md, AGENT-DETAIL.md, AGENT-IMPLEMENTATION.md, DISPLAY-UI-SOLUTION.md, GLOBAL-CHATBOT-CONVERSATION-LAYER.md, a2ui/template-description.md).

## Decisions

- 2026-09-23: Research memo lives in `docs/plans/active/` per WORKFLOW.md; moves to `docs/plans/completed/` after requirements phase completes.
- 2026-09-23: Read-only research phase; the memo is the only file written. No implementation until requirements are confirmed.
- 2026-09-23: Treat all vendor performance claims as marketing until benchmarked.
- 2026-09-23 (user-confirmed requirements): standalone agentic web app; e-commerce assistant domain; **agent runtime = TS only via Agent-Native (confirmed — no Python runtime; hybrid revisited only if Python-only Jev middleware becomes load-bearing)**; Node >=22.22, PostgreSQL; UI = A2UI + MCP Apps per-surface; autonomy = action layer + WebMCP page-local with mandatory fallback; Jev scope = all five targets (routing, policy gates, next-action ranking, model routing, tool-risk gating) via `@typesafe-ai/sdk` with Python middleware patterns replicated in TS; "A2S" = A2A-style agent protocol (optional seam).
- 2026-09-23: Requirements draft written to `docs/product/overview.md` (v0.1) — pending user confirmation.
- 2026-09-23: Hybrid Python-agent spike dropped — user confirmed TS-only runtime (2026-09-23).
- 2026-09-23: Fine tech stack defined (verified against repo trees): Agent-Native core TS-only (mandatory); A2UI agent SDKs official in TS **and** Python (`agent_sdks/python` a2ui_agent/a2ui_core); MCP-UI server official in TS/Python/Ruby (`sdks/python/mcp_ui_server`), client TS-only; WebMCP browser JS + TS polyfill; Jev TS `@typesafe-ai/sdk` and Python `typesafe-sdk` both official. Policy: TS owns actions/loop/state/sync exclusively; Python allowed only at protocol seams (action workers, A2UI emission, MCP Apps serving, Jev services), never direct `application_state` writes or unhosted UI ownership.

## Open Requirement Questions (for user discussion)

1. App surface: standalone agentic web app vs sidecar embedded into existing SaaS/e-commerce storefront (prior art was storefront-embedded)?
2. UI contract: A2UI declarative native catalog vs MCP-UI/MCP Apps sandboxed HTML vs both per-surface?
3. Runtime stack: TypeScript Agent-Native core vs Python agent backend (PydanticAI/LangChain) vs hybrid (Agent-Native host/actions + Python decision services)? Jev SDKs are Python-first — Python decision services matter.
4. Agent autonomy: action layer only (Agent-Native), page-local WebMCP (experimental; browser support matrix needed; non-WebMCP fallback mandatory), or DOM/browser automation as well?
5. Domain: e-commerce assistant vs generic productivity vs other?
6. Jev usage scope: request routing, policy gates, next-action ranking, model routing middleware, tool-risk gating — which?
7. Constraints: Node >=22.22 ok? PostgreSQL available? Python >=3.10? Deployment target? TYPESAFE_API_KEY provisioning?
8. "A2S" meaning: unresolved in research — what did the user mean?

## Validation

- Focused proof: primary-source URLs cited per claim; vendor claims labeled.
- Integration or end-to-end proof: not applicable (read-only phase).
- Repository-required checks: none (no code changed).

## Result

Pending: requirements discussion → requirements draft in `docs/product/`.