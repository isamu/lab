import { createContext, Script } from "node:vm";
import { PATTERN_BUDGET_MS, PatternTimeout, type TextMatches } from "./pattern-timeout.ts";

// A team's regular expression, run with a time limit. regex-safety.ts refuses the shapes known to run away before a pattern
// is used; no reading of the pattern can prove every shape safe, so this is the backstop. V8 can interrupt a regular
// expression only through vm's timeout, so the matching runs in a vm context.

const SCRIPT = new Script(
  `texts.map((text) => [...text.matchAll(new RegExp(source, flags))].filter((m) => m[0] !== "").map((m) => ({ index: m.index, text: m[0] })))`,
);

const isTimeout = (error: unknown): boolean => typeof error === "object" && error !== null && "code" in error && error.code === "ERR_SCRIPT_EXECUTION_TIMEOUT";

const isMatches = (value: unknown): value is TextMatches =>
  Array.isArray(value) &&
  value.every(
    (entry: unknown) =>
      Array.isArray(entry) &&
      entry.every(
        (match: unknown) =>
          typeof match === "object" &&
          match !== null &&
          "index" in match &&
          typeof match.index === "number" &&
          "text" in match &&
          typeof match.text === "string",
      ),
  );

/** Every match of the pattern (flags without g) in each text, or PatternTimeout when the whole run takes longer than budgetMs. */
export const boundedMatches = (source: string, flags: string, texts: readonly string[], budgetMs: number = PATTERN_BUDGET_MS): TextMatches => {
  const context = createContext({ texts: [...texts], source, flags: `g${flags}` });
  try {
    const result: unknown = SCRIPT.runInContext(context, { timeout: budgetMs });
    // The result is built in another context; copy it through JSON so it holds plain values of this one.
    const plain: unknown = JSON.parse(JSON.stringify(result));
    if (!isMatches(plain)) throw new Error("chaff: the pattern's matches came back in an unexpected shape");
    return plain;
  } catch (error) {
    if (isTimeout(error)) throw new PatternTimeout(budgetMs);
    throw error;
  }
};
