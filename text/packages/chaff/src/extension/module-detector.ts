import type * as Api from "../api.ts";
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
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

/** The first line of what was thrown. What a plugin throws is its own object, so printing it may throw too. */
const messageOf = (error: unknown): string => {
  try {
    const text = error instanceof Error ? error.message : String(error);
    return text.split("\n")[0] ?? text;
  } catch {
    return "an error that cannot be printed";
  }
};

/**
 * What the detector returned, as findings, or how it failed. Reading the return can run the plugin's code too (a getter,
 * a Proxy), so it is checked inside the try. A Promise is a wrong return; its rejection must not end the run later.
 */
const findingsOf = (detect: UntrustedDetector, doc: ProseDocument, options: Api.DetectorOptions): { findings: Finding[] } | { failure: RuleFailure } => {
  const view = ruleDocumentOf(doc);
  try {
    const returned: unknown = detect(view, options);
    if (returned instanceof Promise) returned.catch(() => undefined);
    const result = returnedFindings(returned, doc.source, doc.sentences);
    return "problem" in result ? { failure: { kind: "returned", problem: result.problem } } : { findings: [...result.findings] };
  } catch (error) {
    return { failure: { kind: "threw", message: messageOf(error) } };
  }
};

/** detect as one of chaff's detectors. Throws PluginRuleFailure when it throws or returns anything but findings. */
export const moduleDetector =
  (detect: UntrustedDetector, origin: string): Detector =>
  (doc, options): Finding[] => {
    const lexicon = options.lexicon === undefined ? undefined : frozenLexiconOf(options.lexicon);
    const outcome = findingsOf(detect, doc, Object.freeze({ lexicon }));
    if ("failure" in outcome) throw new PluginRuleFailure(outcome.failure, origin);
    return outcome.findings;
  };
