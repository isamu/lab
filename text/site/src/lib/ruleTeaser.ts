// The one example line the rule list shows under a rule: what chaff printed on the rule's example, or, for a check an AI
// reads (chaff test), which the build does not run, the first line of prose the check would be given.
import type { ExampleFinding, RuleExample } from "../../../packages/chaff/src/rule-guide.ts";

export type RuleTeaser = { readonly kind: "message" | "excerpt"; readonly text: string };

const isProse = (line: string): boolean => line !== "" && !line.startsWith("#");

const firstProseLine = (text: string): string =>
  text
    .split("\n")
    .map((line) => line.trim())
    .find(isProse) ?? "";

export const teaserOf = (output: readonly ExampleFinding[], example: Pick<RuleExample, "before">): RuleTeaser => {
  const first = output[0];
  return first === undefined ? { kind: "excerpt", text: firstProseLine(example.before) } : { kind: "message", text: first.message };
};
