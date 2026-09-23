/**
 * Single-authority Jev integration via OpenRouter's Decisions API
 * (`POST https://openrouter.ai/api/alpha/decisions`).
 *
 * Every Jev question schema, decision threshold, and routing policy lives
 * here so the five planned decision services (request triage, policy gates,
 * next-action ranking, model routing, tool-risk gating) share one module
 * instead of drifting apart.
 */

/** Jev alias on OpenRouter; resolves to the latest model in the family. */
export const JEV_MODEL = process.env.JEV_MODEL ?? "~typesafe/jev-latest";

const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai";

/** Minimum choice confidence to act on a triage verdict (configurable). */
export const DEFAULT_TRIAGE_CONFIDENCE = 0.5;

export const TRIAGE_INTENTS = [
  "product_search",
  "order_status",
  "returns_refund",
  "order_modification",
  "support",
  "off_topic",
] as const;
export type TriageIntent = (typeof TRIAGE_INTENTS)[number];

export type TriageIntentOrUnclear = TriageIntent | "unclear";

const TRIAGE_INTENT_LABELS: Readonly<Record<string, true>> = Object.fromEntries(
  TRIAGE_INTENTS.map((intent) => [intent, true]),
);

/** Which future action each triage verdict routes to. */
export const SUGGESTED_ACTION: Record<TriageIntentOrUnclear, string> = {
  product_search: "search-products",
  order_status: "get-order-status",
  returns_refund: "create-return-request",
  order_modification: "modify-order",
  support: "support-handoff",
  off_topic: "off-topic-handoff",
  unclear: "clarify-message",
};

export interface TriageState {
  /** The customer's message, verbatim. */
  message: string;
}

type DecisionQuestion =
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "noul"; instructions: string; criteria?: { true: string; false: string } }
  | { type: "score"; instructions: string; criteria: string[] };

export const triageQuestions = {
  intent: {
    type: "choice",
    instructions: "What does this customer message want to do?",
    criteria: {
      product_search: "Finding, comparing, or learning about products to buy",
      order_status: "Asking about an existing order: tracking, delivery, or status",
      returns_refund: "Returning an item or getting a refund",
      order_modification: "Changing an existing order: cancel, edit items, update address or payment",
      support: "Account, payment, or other help requests not about an order",
      off_topic: "Anything unrelated to shopping on this store",
    },
  },
} as const satisfies Record<string, DecisionQuestion>;
export type TriageQuestions = typeof triageQuestions;

export interface DecisionChoiceAnswer {
  type: "choice";
  choice: string;
  /** Present in practice; the wire schema marks it optional, so gate defensively. */
  confidence?: number;
  probabilities?: Record<string, number>;
}

export type DecisionAnswer =
  | DecisionChoiceAnswer
  | { type: "noul"; noul: number }
  | { type: "score"; score: number; confidence?: number; legend?: Record<string, unknown> };

export interface DecisionResponse<Q extends Record<string, DecisionQuestion>> {
  id: string;
  model: string;
  provider?: string;
  answers: { [K in keyof Q]: DecisionAnswer };
  usage: { input_tokens: number; output_tokens: number; cost?: number };
}

/**
 * Send one Decisions request to Jev via OpenRouter. Fails fast with a clear
 * error when OPENROUTER_API_KEY is missing; OpenRouter errors surface as a
 * single Error carrying status and body.
 */
export async function callJev<Q extends Record<string, DecisionQuestion>>(
  state: unknown,
  questions: Q,
  model = JEV_MODEL,
): Promise<DecisionResponse<Q>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env (or the environment) to call Jev via OpenRouter.",
    );
  }
  const response = await fetch(`${OPENROUTER_BASE_URL}/api/alpha/decisions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, state, questions }),
  });
  if (!response.ok) {
    throw new Error(
      `OpenRouter decisions request failed: ${response.status} ${await response.text()}`,
    );
  }
  return (await response.json()) as DecisionResponse<Q>;
}

export interface TriageVerdict {
  intent: TriageIntentOrUnclear;
  /** Reported confidence in the selected label, 0-1; 0 when absent. */
  confidence: number;
  /** True when confidence clears the threshold. */
  definite: boolean;
  /** Probabilities keyed by intent label. */
  probabilities: Record<string, number>;
  /** Action id to route to, or clarify-message when the verdict is not definite. */
  suggestedAction: string;
}

/**
 * Gate a choice answer with a confidence threshold. Missing confidence or an
 * unknown label yields "unclear", so routing falls back to clarification
 * instead of acting on a decision the model did not stand behind.
 */
export function triageVerdict(
  answer: DecisionChoiceAnswer,
  threshold = DEFAULT_TRIAGE_CONFIDENCE,
): TriageVerdict {
  const confidence = answer.confidence ?? 0;
  const definite =
    confidence >= threshold && TRIAGE_INTENT_LABELS[answer.choice] === true;
  const intent = (definite ? answer.choice : "unclear") as TriageIntentOrUnclear;
  return {
    intent,
    confidence,
    definite,
    probabilities: answer.probabilities ?? {},
    suggestedAction: SUGGESTED_ACTION[intent],
  };
}