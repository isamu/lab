import type * as Api from "../api.ts";
import type { Detector, Finding } from "../plugin.ts";
import { frozenLexiconOf, ruleDocumentOf } from "./document-view.ts";
import { returnedFindings, type ShapeProblem } from "./returned-findings.ts";

// A detector a team or a plugin wrote, run as one of chaff's. It reads the document through the plugin API, and what it
// returns is checked before chaff uses it. A throw or a wrong return is that rule's failure only: run.ts lists the rule
// as not run with the reason, and every other rule still runs.

/** A detector from a plugin. It is JavaScript nobody has type-checked against this chaff, so what it returns is unknown. */
export type UntrustedDetector = (doc: Api.RuleDocument, options: Api.DetectorOptions) => unknown;

export type RuleFailure = { readonly kind: "threw"; readonly message: string } | { readonly kind: "returned"; readonly problem: ShapeProblem };

/** A plugin's rule that failed on a document. origin is where the detector came from: its file, or its package. */
export class PluginRuleFailure extends Error {
  readonly failure: RuleFailure;
  readonly origin: string;
  constructor(failure: RuleFailure, origin: string) {
    super(`${origin}: ${failure.kind === "threw" ? failure.message : failure.problem.kind}`);
    this.name = "PluginRuleFailure";
    this.failure = failure;
    this.origin = origin;
  }
}

const messageOf = (error: unknown): string => {
  const text = error instanceof Error ? error.message : String(error);
  return text.split("\n")[0] ?? text;
};

/** What the detector returned, or how it failed. A Promise is a wrong return; its rejection must not end the run later. */
const called = (detect: UntrustedDetector, doc: Api.RuleDocument, options: Api.DetectorOptions): { returned: unknown } | { failure: RuleFailure } => {
  try {
    const returned: unknown = detect(doc, options);
    if (returned instanceof Promise) returned.catch(() => undefined);
    return { returned };
  } catch (error) {
    return { failure: { kind: "threw", message: messageOf(error) } };
  }
};

/** detect as one of chaff's detectors. Throws PluginRuleFailure when it throws or returns anything but findings. */
export const moduleDetector =
  (detect: UntrustedDetector, origin: string): Detector =>
  (doc, options): Finding[] => {
    const lexicon = options.lexicon === undefined ? undefined : frozenLexiconOf(options.lexicon);
    const call = called(detect, ruleDocumentOf(doc), Object.freeze({ lexicon }));
    if ("failure" in call) throw new PluginRuleFailure(call.failure, origin);
    const result = returnedFindings(call.returned, doc.source, doc.sentences);
    if ("problem" in result) throw new PluginRuleFailure({ kind: "returned", problem: result.problem }, origin);
    return [...result.findings];
  };
