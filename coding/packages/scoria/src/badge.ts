import { basename } from "node:path";
import type { Report } from "./report.ts";
import type { ReportDiff } from "./diff.ts";

/**
 * The shields.io endpoint schema, so a badge needs no server: CI writes this file somewhere public
 * and shields renders it (https://shields.io/badges/endpoint-badge).
 *
 * The colour is the direction of travel, never the score. A palette keyed to the number would
 * assert that 90 means the same thing in every repository — the claim §3.3 exists to refuse, and
 * the one the report's own `comparable: false` denies. The message carries the caveat for the same
 * reason: a badge travels without the README that would have explained it.
 */

export interface BadgeEndpoint {
  readonly schemaVersion: 1;
  readonly label: string;
  readonly message: string;
  readonly color: string;
}

/** Below this, a dimension moved by rounding rather than by anything anyone did. */
const REGRESSION_POINTS = 1;

const NO_BASELINE = "blue";
const REGRESSED = "orange";
const HELD = "brightgreen";
const NOTHING_MEASURED = "lightgrey";

const regressed = (diff: ReportDiff): boolean => diff.dimensions.some((entry) => entry.delta !== undefined && entry.delta <= -REGRESSION_POINTS);

const colorOf = (diff: ReportDiff | undefined): string => {
  if (diff === undefined) return NO_BASELINE;
  return regressed(diff) ? REGRESSED : HELD;
};

export const badgeEndpoint = (report: Report, diff?: ReportDiff): BadgeEndpoint => {
  // An unmeasured repository means 0 to `mean`, which reads on a badge as a bad score.
  const measured = report.overall.scoredDimensions > 0;
  return {
    schemaVersion: 1,
    label: `scoria · ${basename(report.root)}`,
    message: measured ? `${report.overall.score.toFixed(0)} · this repo only` : "not measured",
    color: measured ? colorOf(diff) : NOTHING_MEASURED,
  };
};
