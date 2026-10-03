import { readDepth, unknownDepthSentence } from "../rewrite-depth.ts";
import type { UiLanguage } from "../ui.ts";
import type { ChosenDepth } from "./plan.ts";

// The depth a fix plan goes to: --depth, else chaff.yaml's fix_plan.depth, else none (chaff recommends one). Pure.

export type DepthChoice = { readonly chosen: ChosenDepth | undefined } | { readonly problem: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const printed = (value: unknown): string => JSON.stringify(value) ?? String(value);

/** fix_plan as chaff.yaml writes it: nothing, or a map whose depth is a depth. */
const configured = (fixPlan: unknown, ui: UiLanguage): DepthChoice => {
  if (fixPlan === undefined || fixPlan === null) return { chosen: undefined };
  if (!isRecord(fixPlan)) return { problem: unknownDepthSentence("chaff.yaml fix_plan", printed(fixPlan), ui) };
  const read = readDepth(fixPlan["depth"]);
  if ("unknown" in read) return { problem: unknownDepthSentence("chaff.yaml fix_plan.depth", read.unknown, ui) };
  return { chosen: read.depth === undefined ? undefined : { depth: read.depth, from: "config" } };
};

/** flag: --depth's value, or undefined when it is not given. An empty value is a value, and not a depth. */
export const chosenDepthOf = (flag: string | undefined, fixPlan: unknown, ui: UiLanguage): DepthChoice => {
  if (flag === undefined) return configured(fixPlan, ui);
  const read = readDepth(flag);
  if ("depth" in read && read.depth !== undefined) return { chosen: { depth: read.depth, from: "flag" } };
  return { problem: unknownDepthSentence("--depth", flag, ui) };
};
