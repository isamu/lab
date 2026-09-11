import type { Contributor, Finding, Probe, ProbeContext, ProbeResult, SourceFile } from "../plugin.ts";
import { sourceSloc } from "../files.ts";
import { perKiloLines } from "../stats.ts";
import { viewOf } from "../source-view.ts";

/**
 * 抑制債務を数える（spec §15）。
 *
 * source と test を分けるのは実測に基づく。graphai の `as any` 94 件のうち 69 件が test 配下で、
 * テストの `as any` はモックのために正当なことが多い。総数で数えると source の 25 件が埋もれる。
 */

const MIN_REASON_CHARS = 8;
const TOP_CONTRIBUTORS = 5;

const CODE_PATTERNS = [
  { rule: "as-any", pattern: /\bas\s+(any|unknown\s+as)\b/, message: "型を迂回しています" },
  { rule: "test-skip", pattern: /\b(it|test|describe)\.(skip|only|todo)\b/, message: "テストが skip / only / todo になっています" },
] as const;

/**
 * ディレクティブはコメントの先頭にあるときだけ効く。
 * 先頭を要求しないと、ディレクティブを説明している散文コメントが実物として数えられる。
 * 実際にこのファイル自身の説明コメントが 2 件数えられた。
 */
const DIRECTIVE_PATTERNS = [
  // TypeScript にはルール名を書く欄が無いので、ディレクティブより後ろが理由。
  { rule: "ts-directive", pattern: /^@ts-(ignore|expect-error|nocheck)\b/, reason: "trailing", message: "TypeScript の検査を抑制しています" },
  // eslint はディレクティブの直後にルール名を書く。理由は `--` 以降という規約であり、
  // ルール名を理由と数えると `eslint-disable-next-line no-console` が正当化されてしまう。
  { rule: "eslint-disable", pattern: /^eslint-disable(-next-line|-line)?\b/, reason: "separator", message: "eslint の指摘を抑制しています" },
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

/** 抑制そのものは悪ではない。説明の無い抑制が問題（spec §15.3）。 */
const reasonOf = (comment: string, token: string, style: "trailing" | "separator"): string => {
  const separated = comment.split("--").slice(1).join("--").trim();
  if (separated.length > 0) return separated;
  if (style === "separator") return "";
  const index = comment.indexOf(token);
  return index < 0 ? "" : comment.slice(index + token.length).trim();
};

/**
 * `as any` の理由は、同じ行の末尾コメントか、直前の行コメントに書く。
 * 直前の行を無条件に認めると、JSDoc を持つ関数の `as any` がすべて「理由あり」になる。
 */
const reasonComment = (file: SourceFile, comments: readonly string[], index: number): string => {
  const sameLine = commentBody(comments[index] ?? "").trim();
  if (sameLine.length > 0) return sameLine;
  const previousSource = (file.lines[index - 1] ?? "").trim();
  return previousSource.startsWith("//") ? commentBody(comments[index - 1] ?? "").trim() : "";
};

const codeHits = (file: SourceFile, code: readonly string[], comments: readonly string[]): readonly Hit[] =>
  code.flatMap((line, index) =>
    CODE_PATTERNS.filter((p) => p.pattern.test(line)).map((p) => ({
      rule: p.rule,
      file: file.path,
      line: index + 1,
      reasoned: p.rule === "as-any" && reasonComment(file, comments, index).length >= MIN_REASON_CHARS,
      message: p.message,
    })),
  );

const directiveHits = (file: SourceFile, comments: readonly string[]): readonly Hit[] =>
  comments.flatMap((line, index) => {
    const body = commentBody(line);
    return DIRECTIVE_PATTERNS.filter((p) => p.pattern.test(body)).map((p) => ({
      rule: p.rule,
      file: file.path,
      line: index + 1,
      reasoned: reasonOf(body, p.pattern.exec(body)?.[0] ?? "", p.reason).length >= MIN_REASON_CHARS,
      message: p.message,
    }));
  });

export const scanFile = (file: SourceFile): readonly Hit[] => {
  const { code, comments } = viewOf(file.lines);
  return [...codeHits(file, code, comments), ...directiveHits(file, comments)];
};

const contributorsOf = (hits: readonly Hit[]): readonly Contributor[] => {
  const byFile = new Map<string, number>();
  hits.forEach((hit) => byFile.set(hit.file, (byFile.get(hit.file) ?? 0) + 1));
  return [...byFile.entries()]
    .map(([file, value]) => ({ file, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_CONTRIBUTORS);
};

const toFinding = (hit: Hit): Finding => ({
  rule: `${hit.rule}-no-reason`,
  severity: "error",
  file: hit.file,
  line: hit.line,
  message: `${hit.message}。理由が書かれていません`,
  probe: "suppression-scan",
  dimension: "integrity",
  tier: 0,
});

const ratio = (part: number, whole: number): number => (whole === 0 ? 0 : Number((part / whole).toFixed(4)));

const assess = (ctx: ProbeContext): ProbeResult => {
  const started = Date.now();
  const sourceHits = ctx.files.filter((f) => f.kind === "source").flatMap(scanFile);
  const testHits = ctx.files.filter((f) => f.kind === "test").flatMap(scanFile);
  const unreasoned = sourceHits.filter((hit) => !hit.reasoned);
  const contributors = contributorsOf(sourceHits);
  const sloc = sourceSloc(ctx.files);
  return {
    probe: "suppression-scan",
    status: { kind: "ok" },
    metrics: [
      { id: "suppression-scan.source_count", value: sourceHits.length, unit: "count", topContributors: contributors },
      { id: "suppression-scan.test_count", value: testHits.length, unit: "count" },
      { id: "suppression-scan.source_per_kloc", value: perKiloLines(sourceHits.length, sloc), unit: "per_kloc", topContributors: contributors },
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
  detect: (ctx) => Promise.resolve(ctx.files.some((f) => f.kind === "source") ? { kind: "ok" } : { kind: "absent", reason: "no source files" }),
  run: (ctx) => Promise.resolve(assess(ctx)),
};
