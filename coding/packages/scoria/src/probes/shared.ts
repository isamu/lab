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

/**
 * A path is only useful relative to the repository being measured.
 *
 * Separators are normalised first: on Windows an external tool returns `C:\\repo\\src\\a.ts` while
 * `root` came from `path.resolve`, and comparing the two verbatim leaves every finding carrying an
 * absolute path — a location no SARIF upload can match and no reader can open.
 */
const toPosix = (value: string): string => value.split("\\").join("/");

export const relativeTo = (root: string, file: string): string => {
  const base = toPosix(root);
  const path = toPosix(file);
  return path.startsWith(`${base}/`) ? path.slice(base.length + 1) : path;
};

export const skippedResult = (probe: string, reason: string, started: number): ProbeResult => ({
  probe,
  status: { kind: "skipped", reason },
  metrics: [],
  findings: [],
  toolVersions: {},
  durationMs: Date.now() - started,
});
