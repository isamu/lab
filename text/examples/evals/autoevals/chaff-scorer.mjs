// A scorer in the shape autoevals and Braintrust use: ({ output, expected, input }) => { name, score, metadata }.
// `expected` is taken as the reference the output's facts must keep. Use it next to model-graded scorers such as Factuality.
import { grade, toScorer } from "chaffjs/grade";

/** @param {{ output: string, expected?: string, input?: string }} args */
export const chaffScorer = async ({ output, expected }) => {
  const scored = toScorer(await grade(output, { reference: expected }));
  return { name: scored.name, score: scored.score, metadata: { reason: scored.reason, ...scored.metadata } };
};
