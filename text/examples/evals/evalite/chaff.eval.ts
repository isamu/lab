// An evalite eval with chaff as one of its scorers. Install: npm i -D evalite vitest chaffjs
// Run: npx evalite
import { createScorer, evalite } from "evalite";
import { grade, toScorer } from "chaffjs/grade";

const chaff = createScorer<string, string, string>({
  name: "chaff",
  description: "Deterministic checks: facts kept against the expected text, error findings, style rates",
  scorer: async ({ output, expected }) => {
    const scored = toScorer(await grade(output, { reference: expected }));
    return { score: scored.score, metadata: { reason: scored.reason, ...scored.metadata } };
  },
});

evalite("Summaries keep their facts", {
  data: [{ input: "The team answered 4,812 tickets this quarter.", expected: "The team answered 4,812 tickets this quarter." }],
  // Replace with your model call, for example generateText() from the Vercel AI SDK.
  task: async (input) => input,
  scorers: [chaff],
});
