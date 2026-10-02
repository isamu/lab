import { readDocumentFile } from "../files.ts";
import { stampCheck } from "../grade/baseline.ts";
import { BASELINE_TEXT } from "../grade/baseline-text.ts";
import type { GradeResult, Stamp } from "../grade/result.ts";
import { parseResults } from "../grade/results-read.ts";
import { GRADE_TEXT } from "../grade/text.ts";
import type { UiLanguage } from "../ui.ts";

// `chaff grade --baseline <earlier results>` before anything is graded: the earlier results read, and their stamp
// checked against this run's. Either can stop the run with exit 2, so no time is spent grading what cannot be compared.

/** No --baseline; a baseline to compare with; or a reason already said why the run stops. */
export type BaselineChoice =
  { readonly kind: "none" } | { readonly kind: "stop" } | { readonly kind: "compare"; readonly path: string; readonly before: readonly GradeResult[] };

const STOP: BaselineChoice = { kind: "stop" };

const readResults = async (path: string, ui: UiLanguage): Promise<readonly GradeResult[] | undefined> => {
  try {
    const parsed = parseResults(await readDocumentFile(path));
    if ("results" in parsed) return parsed.results;
    console.error(BASELINE_TEXT[ui].unreadable(path, parsed.badLines.join(", ")));
  } catch (error) {
    console.error(GRADE_TEXT[ui].unreadable(path, error instanceof Error ? error.message : String(error)));
  }
  return undefined;
};

/** The earlier results, if they can be compared with a run stamped `stamp`. --allow-stamp-mismatch compares anyway, saying so first. */
export const chooseBaseline = async (path: string | undefined, stamp: Stamp, allowMismatch: boolean, ui: UiLanguage): Promise<BaselineChoice> => {
  if (path === undefined) return { kind: "none" };
  const before = await readResults(path, ui);
  if (before === undefined) return STOP;
  const checked = stampCheck(before, stamp);
  if (checked.comparable) return { kind: "compare", path, before };
  const text = BASELINE_TEXT[ui];
  const differ = checked.differ.map((part) => text.differ[part]).join(", ");
  if (!allowMismatch || checked.differ.includes("mixed")) {
    console.error(text.notComparable(path, differ));
    return STOP;
  }
  console.error(text.mismatchAllowed(path, differ));
  return { kind: "compare", path, before };
};
