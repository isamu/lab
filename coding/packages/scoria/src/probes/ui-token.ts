import type { Finding, Probe, ProbeContext, ProbeResult, SourceFile } from "../plugin.ts";
import { perKiloLines } from "../stats.ts";
import { rankByFile } from "./shared.ts";

/**
 * Whether the look of the thing comes from decisions taken once (spec §14.1).
 *
 * The point is **cardinality, not count**. A design system that works converges spacing on a few
 * values — 4, 8, 12, 16 — and a codebase written a component at a time accumulates 5, 7, 13, 17,
 * 23. Counting occurrences would just measure how much UI there is; counting *distinct* values
 * separates growth from disorder, which is the one thing size-dependent metrics could not do
 * (docs/calibration.md).
 *
 * Read from the raw lines rather than the code view, because a colour lives in a template, a class
 * string or a `<style>` block — none of which survive being treated as JavaScript.
 */

const UI_EXTENSIONS = [".vue", ".tsx", ".jsx"];

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const FUNCTIONAL_COLOR = /\b(?:rgba?|hsla?|oklch|color-mix)\([^)]{0,80}\)/g;
const SPACING = /(?<![\w.-])\d{1,4}(?:\.\d{1,2})?(?:px|rem|em)\b/g;
const INLINE_STYLE = /(?:style=\{\{|:style=|\bstyle="|\bstyle=')/g;
const STYLE_BLOCK = /<style[\s>]/g;

const MAX_FINDINGS = 12;

/** A colour written twice in two notations is two decisions, so they are not normalised together. */
const matchesIn = (file: SourceFile, patterns: readonly RegExp[]): readonly string[] =>
  patterns.flatMap((pattern) => [...file.lines.join("\n").matchAll(pattern)].map((match) => match[0].toLowerCase()));

const countIn = (file: SourceFile, pattern: RegExp): number => [...file.lines.join("\n").matchAll(pattern)].length;

const isUiFile = (file: SourceFile): boolean => file.kind === "source" && UI_EXTENSIONS.some((extension) => file.path.endsWith(extension));

const contributorsFor = (files: readonly SourceFile[], patterns: readonly RegExp[]): readonly { file: string; weight: number }[] =>
  files.map((file) => ({ file: file.path, weight: new Set(matchesIn(file, patterns)).size }));

const styleBlockFinding = (file: SourceFile): Finding => ({
  rule: "style-block",
  severity: "warning",
  file: file.path,
  line: 1,
  message: "a style block, where a utility class or a token would be shared",
  probe: "ui-token",
  dimension: "ui-consistency",
  tier: 0,
});

const assess = (ctx: ProbeContext): ProbeResult => {
  const started = Date.now();
  const files = ctx.files.filter(isUiFile);
  const sloc = files.reduce((sum, file) => sum + file.lines.filter((line) => line.trim() !== "").length, 0);
  const colors = new Set(files.flatMap((file) => matchesIn(file, [HEX, FUNCTIONAL_COLOR])));
  const spacings = new Set(files.flatMap((file) => matchesIn(file, [SPACING])));
  const inline = files.reduce((sum, file) => sum + countIn(file, INLINE_STYLE), 0);
  const withStyleBlock = files.filter((file) => countIn(file, STYLE_BLOCK) > 0);
  return {
    probe: "ui-token",
    status: { kind: "ok" },
    metrics: [
      { id: "ui-token.color_cardinality", value: colors.size, unit: "count", topContributors: rankByFile(contributorsFor(files, [HEX, FUNCTIONAL_COLOR])) },
      { id: "ui-token.spacing_cardinality", value: spacings.size, unit: "count", topContributors: rankByFile(contributorsFor(files, [SPACING])) },
      { id: "ui-token.inline_style_per_kloc", value: perKiloLines(inline, sloc), unit: "per_kloc" },
      { id: "ui-token.style_block_ratio", value: files.length === 0 ? 0 : Number((withStyleBlock.length / files.length).toFixed(4)), unit: "ratio" },
      { id: "ui-token.ui_file_count", value: files.length, unit: "count" },
    ],
    findings: withStyleBlock.slice(0, MAX_FINDINGS).map(styleBlockFinding),
    toolVersions: {},
    durationMs: Date.now() - started,
  };
};

export const uiToken: Probe = {
  kind: "probe",
  id: "ui-token",
  apiVersion: 1,
  tier: 0,
  declares: [
    "ui-token.color_cardinality",
    "ui-token.spacing_cardinality",
    "ui-token.inline_style_per_kloc",
    "ui-token.style_block_ratio",
    "ui-token.ui_file_count",
  ],
  // A repository with no components has no UI to be consistent about, and the dimension says `—`
  // rather than scoring it (spec §18.1).
  detect: (ctx) => Promise.resolve(ctx.files.some(isUiFile) ? { kind: "ok" } : { kind: "skipped", reason: "no .vue, .tsx or .jsx files" }),
  run: (ctx) => Promise.resolve(assess(ctx)),
};
