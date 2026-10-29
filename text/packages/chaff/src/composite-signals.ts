import type { Finding } from "./plugin.ts";

/** A finding that adds up measures names here the rules that read the same shapes as some of them (ai-structure). */
export const SAME_SHAPE_VALUE = "same_shape_rules";

const sameShapeRules = (finding: Finding): string[] =>
  String(finding.values[SAME_SHAPE_VALUE] ?? "")
    .split(",")
    .filter((id) => id !== "");

/**
 * Whether a finding still reaches its own limit once the measures already counted by their own rule are taken out:
 * section length variation and section-length-uniformity are one sign, and a composite would count it twice.
 */
const countsOnItsOwn = (finding: Finding, fired: readonly string[]): boolean => {
  const shared = sameShapeRules(finding).filter((id) => fired.includes(id)).length;
  const count = finding.values["count"];
  const limit = finding.values["limit"];
  if (shared === 0 || typeof count !== "number" || typeof limit !== "number") return true;
  return count - shared >= limit;
};

/** The signals of `from` a composite counts: each one that fired, and one sign only once. */
export const compositeSignals = (from: readonly string[], found: readonly Finding[]): string[] => {
  const fired = from.filter((id) => found.some((finding) => finding.rule === id));
  return fired.filter((id) => found.some((finding) => finding.rule === id && countsOnItsOwn(finding, fired)));
};
