import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// What one rule reports when the whole pipeline runs, for the tests that check a detector's edge through the rule.

/** The words undefined-acronym reports in a Markdown source, with the rule at strict and experimental rules on. */
export const reportedAcronyms = (adapter: LanguageAdapter, source: string, genre = "business/report"): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { "undefined-acronym": "strict" }, true, genre)
    .findings.filter((finding) => finding.rule === "undefined-acronym")
    .map((finding) => String(finding.values["word"]));

const SUPERLATIVE = "unqualified-superlative";

/** Whether unqualified-superlative reports a sentence, at strict and with a limit of one. */
export const superlativeReported = (adapter: LanguageAdapter, sentence: string): boolean =>
  runRules(buildDocument("t.md", `# T\n\n${sentence}\n`, adapter), loadRules(adapter.id), { [SUPERLATIVE]: "strict" }, true, "business/report", {
    [SUPERLATIVE]: 1,
  }).findings.some((finding) => finding.rule === SUPERLATIVE);
