/**
 * Classify what a customer message wants to do using Jev (via the OpenRouter
 * Decisions API), gated by a confidence threshold. This is decision target #1
 * (request routing/triage): every inbound customer message runs through this
 * action first, and its `suggestedAction` decides which follow-up action the
 * agent (or an integration) should take.
 *
 * Surfaces: CLI (`pnpm action triage-message`), HTTP
 * (`POST /_agent-native/actions/triage-message`), agent tool.
 */

import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { callJev, triageQuestions, triageVerdict } from "../lib/jev";

export default defineAction({
  description:
    "Classify a customer message as product search, order status, returns/refund, order change, support, or off-topic using the Jev model, and return the action to route to. Call this first whenever a customer message arrives.",
  schema: z.object({
    message: z
      .string()
      .min(1)
      .max(4000)
      .describe("The customer's message, verbatim"),
  }),
  http: { method: "POST" },
  readOnly: true,
  run: async ({ message }) => {
    const { answers } = await callJev({ message }, triageQuestions);
    const answer = answers.intent;
    if (answer.type !== "choice") {
      throw new Error(`Jev returned a ${answer.type} answer for a choice question`);
    }
    return triageVerdict(answer);
  },
});