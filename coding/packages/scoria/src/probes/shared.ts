import type { Contributor, ProbeResult } from "../plugin.ts";

/**
 * The two shapes every external probe repeats.
 *
 * scoria reported eight duplicated blocks across oxlint, jscpd and knip — the same tally-by-file
 * and the same empty result, written three times. Extracting them is the finding acted on.
 */

const TOP_CONTRIBUTORS = 5;

/** Files ranked by how much they contributed to a metric, for `explain` to name. */
export const rankByFile = (entries: readonly { readonly file: string; readonly weight: number }[]): readonly Contributor[] => {
  const totals = new Map<string, number>();
  entries.forEach((entry) => totals.set(entry.file, (totals.get(entry.file) ?? 0) + entry.weight));
  return [...totals.entries()]
    .map(([file, value]) => ({ file, value }))
    .toSorted((a, b) => b.value - a.value)
    .slice(0, TOP_CONTRIBUTORS);
};

/** A path is only useful relative to the repository being measured. */
export const relativeTo = (root: string, file: string): string => (file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file);

export const skippedResult = (probe: string, reason: string, started: number): ProbeResult => ({
  probe,
  status: { kind: "skipped", reason },
  metrics: [],
  findings: [],
  toolVersions: {},
  durationMs: Date.now() - started,
});
