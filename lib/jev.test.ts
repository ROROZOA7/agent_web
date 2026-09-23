/**
 * Offline verification of the Jev triage spike against the OpenRouter
 * Decisions API contract: request shape, verdict gating, routing policy.
 * `fetch` is stubbed, so this runs without OPENROUTER_API_KEY or network.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import triageAction from "../actions/triage-message";
import {
  callJev,
  SUGGESTED_ACTION,
  TRIAGE_INTENTS,
  triageVerdict,
  type DecisionChoiceAnswer,
} from "./jev";

const ORIGINAL_ENV = { ...process.env };

function stubFetch(responseBody: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return calls;
}

function decisionsResponse(answer: Partial<DecisionChoiceAnswer> & { choice: string }) {
  return {
    id: "gen-1758625200-abc123",
    model: "typesafe/jev-1.13",
    provider: "TypeSafe",
    answers: { intent: { type: "choice", ...answer } },
    usage: { input_tokens: 42, output_tokens: 1, cost: 0.0000018 },
  };
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("triage-message action", () => {
  it("sends the documented Decisions request and maps a confident verdict", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const calls = stubFetch(
      decisionsResponse({
        choice: "returns_refund",
        confidence: 0.91,
        probabilities: { returns_refund: 0.91, support: 0.09 },
      }),
    );

    const verdict = await triageAction.run({ message: "I want to send this back" });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://openrouter.ai/api/alpha/decisions");
    expect(calls[0].init.method).toBe("POST");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(String(calls[0].init.body));
    expect(body.model).toBe("~typesafe/jev-latest");
    expect(body.state).toEqual({ message: "I want to send this back" });
    expect(body.questions.intent.type).toBe("choice");
    expect(body.questions.intent.instructions).toBe(
      "What does this customer message want to do?",
    );
    expect(body.questions.intent.criteria.returns_refund).toMatch(/return/i);
    expect(Object.keys(body.questions.intent.criteria)).toHaveLength(6);

    expect(verdict).toEqual({
      intent: "returns_refund",
      confidence: 0.91,
      definite: true,
      probabilities: { returns_refund: 0.91, support: 0.09 },
      suggestedAction: "create-return-request",
    });
  });

  it("gates below-threshold confidence to unclear and clarifies instead of acting", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    stubFetch(decisionsResponse({ choice: "support", confidence: 0.4 }));

    const verdict = await triageAction.run({ message: "hmm idk" });

    expect(verdict.intent).toBe("unclear");
    expect(verdict.definite).toBe(false);
    expect(verdict.suggestedAction).toBe("clarify-message");
  });

  it("surfaces a clear failure when the API key is missing", async () => {
    delete process.env.OPENROUTER_API_KEY;
    await expect(callJev({ message: "hi" }, { intent: triageActionQuestions() })).rejects.toThrow(
      /OPENROUTER_API_KEY/,
    );
  });

  it("surfaces OpenRouter error responses with status and body", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: "No endpoints found" } }), {
            status: 404,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    await expect(callJev({ message: "hi" }, { intent: triageActionQuestions() })).rejects.toThrow(
      /404.*No endpoints found/,
    );
  });
});

function triageActionQuestions() {
  return {
    intent: {
      type: "choice" as const,
      instructions: "What does this customer message want to do?",
      criteria: { returns_refund: "Returning an item" },
    },
  };
}

describe("triage verdict gating", () => {
  it("routes every intent and the unclear fallback to an action", () => {
    for (const intent of TRIAGE_INTENTS) {
      expect(SUGGESTED_ACTION[intent]).toBeTruthy();
    }
    expect(SUGGESTED_ACTION.unclear).toBe("clarify-message");
  });

  it("keeps verdicts definite at exactly the threshold and uncertain below it", () => {
    expect(triageVerdict({ type: "choice", choice: "support", confidence: 0.5 }).definite).toBe(
      true,
    );
    expect(triageVerdict({ type: "choice", choice: "support", confidence: 0.499 }).definite).toBe(
      false,
    );
  });

  it("treats a missing confidence or unknown label as unclear", () => {
    const noConfidence = triageVerdict({ type: "choice", choice: "support" });
    expect(noConfidence.definite).toBe(false);
    expect(noConfidence.confidence).toBe(0);

    const unknownLabel = triageVerdict({ type: "choice", choice: "warranty", confidence: 0.99 });
    expect(unknownLabel.intent).toBe("unclear");
    expect(unknownLabel.suggestedAction).toBe("clarify-message");
  });
});