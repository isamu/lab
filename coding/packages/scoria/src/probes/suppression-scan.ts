import type { Contributor, Finding, Probe, ProbeContext, ProbeResult, SourceFile } from "../plugin.ts";
import { sourceSloc } from "../files.ts";
import { perKiloLines } from "../stats.ts";
import { viewOf } from "../source-view.ts";
import { rankByFile } from "./shared.ts";

/**
 * Counts suppression debt (spec §15).
 *
 * Source and test are counted separately, and that split is not cosmetic: measured on a real
 * repository, 69 of 94 `as any` occurrences were in test files, where mocking makes them
 * legitimate. A single total buries the 25 that are in source.
 */

const MIN_REASON_CHARS = 8;

const CODE_PATTERNS = [
  { rule: "as-any", pattern: /\bas\s+(any|unknown\s+as)\b/, message: "bypasses the type checker" },
  {
    rule: "test-skip",
    pattern: /\b(it|test|describe)\.(skip|only|todo)\b/,
    message: "test is skipped, focused, or marked todo",
  },
] as const;

/**
 * A directive only takes effect at the start of a comment. Without that anchor, prose that
 * merely discusses a directive is counted as the real thing — this file's own explanatory
 * comments were counted twice before the anchor was added.
 */
const DIRECTIVE_PATTERNS = [
  // TypeScript has no field for rule names, so whatever follows the directive is the reason.
  {
    rule: "ts-directive",
    pattern: /^@ts-(ignore|expect-error|nocheck)\b/,
    reason: "trailing",
    message: "suppresses a TypeScript check",
  },
  // ESLint puts rule names right after the directive and reserves `--` for the description.
  // Counting a rule name as a reason would mean `eslint-disable-next-line no-console`
  // justifies itself, which makes the whole measurement meaningless.
  {
    rule: "eslint-disable",
    pattern: /^eslint-disable(-next-line|-line)?\b/,
    reason: "separator",
    message: "suppresses an ESLint rule",
  },
] as const;

const COMMENT_MARKERS = /^[\s*/]*/;

const commentBody = (line: string): string => line.replace(COMMENT_MARKERS, "");

interface Hit {
  readonly rule: string;
  readonly file: string;
  readonly line: number;
  readonly reasoned: boolean;
  readonly message: string;
}

/** A suppression is not wrong in itself. An unexplained one is (spec §15.3). */
const reasonOf = (comment: string, token: string, style: "trailing" | "separator"): string => {
  const separated = comment.split("--").slice(1).join("--").trim();
  if (separated.length > 0) return separated;
  if (style === "separator") return "";
  const index = comment.indexOf(token);
  return index < 0 ? "" : comment.slice(index + token.length).trim();
};

/**
 * The reason for an `as any` belongs on the same line or on a line comment directly above it.
 * Accepting any preceding line would mark every `as any` inside a documented function as explained.
 */
const reasonComment = (file: SourceFile, comments: readonly string[], index: number): string => {
  const sameLine = commentBody(comments[index] ?? "").trim();
  if (sameLine.length > 0) return sameLine;
  const previousSource = (file.lines[index - 1] ?? "").trim();
  return previousSource.startsWith("//") ? commentBody(comments[index - 1] ?? "").trim() : "";
};

const codeHits = (file: SourceFile, code: readonly string[], comments: readonly string[]): readonly Hit[] =>
  code.flatMap((line, index) =>
    CODE_PATTERNS.filter((pattern) => pattern.pattern.test(line)).map((pattern) => ({
      rule: pattern.rule,
      file: file.path,
      line: index + 1,
      reasoned: pattern.rule === "as-any" && reasonComment(file, comments, index).length >= MIN_REASON_CHARS,
      message: pattern.message,
    })),
  );

const directiveHits = (file: SourceFile, comments: readonly string[]): readonly Hit[] =>
  comments.flatMap((line, index) => {
    const body = commentBody(line);
    return DIRECTIVE_PATTERNS.filter((pattern) => pattern.pattern.test(body)).map((pattern) => ({
      rule: pattern.rule,
      file: file.path,
      line: index + 1,
      reasoned: reasonOf(body, pattern.pattern.exec(body)?.[0] ?? "", pattern.reason).length >= MIN_REASON_CHARS,
      message: pattern.message,
    }));
  });

const scanFile = (file: SourceFile): readonly Hit[] => {
  const { code, comments } = viewOf(file.codeLines);
  return [...codeHits(file, code, comments), ...directiveHits(file, comments)];
};

const contributorsOf = (hits: readonly Hit[]): readonly Contributor[] => {
  return rankByFile(hits.map((hit) => ({ file: hit.file, weight: 1 })));
};

const toFinding = (hit: Hit): Finding => ({
  rule: `${hit.rule}-no-reason`,
  severity: "error",
  file: hit.file,
  line: hit.line,
  message: `${hit.message}, with no reason given`,
  probe: "suppression-scan",
  dimension: "integrity",
  tier: 0,
});

const ratio = (part: number, whole: number): number => (whole === 0 ? 0 : Number((part / whole).toFixed(4)));

const assess = (ctx: ProbeContext): ProbeResult => {
  const started = Date.now();
  const sourceHits = ctx.files.filter((file) => file.kind === "source").flatMap(scanFile);
  const testHits = ctx.files.filter((file) => file.kind === "test").flatMap(scanFile);
  const unreasoned = sourceHits.filter((hit) => !hit.reasoned);
  const contributors = contributorsOf(sourceHits);
  const sloc = sourceSloc(ctx.files);
  return {
    probe: "suppression-scan",
    status: { kind: "ok" },
    metrics: [
      { id: "suppression-scan.source_count", value: sourceHits.length, unit: "count", topContributors: contributors },
      { id: "suppression-scan.test_count", value: testHits.length, unit: "count" },
      {
        id: "suppression-scan.source_per_kloc",
        value: perKiloLines(sourceHits.length, sloc),
        unit: "per_kloc",
        topContributors: contributors,
      },
      { id: "suppression-scan.unreasoned_source_count", value: unreasoned.length, unit: "count" },
      { id: "suppression-scan.unreasoned_ratio", value: ratio(unreasoned.length, sourceHits.length), unit: "ratio" },
    ],
    findings: unreasoned.map(toFinding),
    toolVersions: {},
    durationMs: Date.now() - started,
  };
};

export const suppressionScan: Probe = {
  kind: "probe",
  id: "suppression-scan",
  apiVersion: 1,
  tier: 0,
  declares: [
    "suppression-scan.source_count",
    "suppression-scan.test_count",
    "suppression-scan.source_per_kloc",
    "suppression-scan.unreasoned_source_count",
    "suppression-scan.unreasoned_ratio",
  ],
  detect: (ctx) => Promise.resolve(ctx.files.some((file) => file.kind === "source") ? { kind: "ok" } : { kind: "absent", reason: "no source files" }),
  run: (ctx) => Promise.resolve(assess(ctx)),
};
