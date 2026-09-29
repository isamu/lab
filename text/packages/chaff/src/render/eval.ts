import { MIN_CORPUS, TARGET_HIT_RATE, type Point, type RuleReport } from "../eval.ts";
import type { Texts, UiLanguage } from "../ui.ts";

const pct = (part: number, whole: number): string => `${((part / Math.max(1, whole)) * 100).toFixed(1)}%`;

const TARGET = TARGET_HIT_RATE * 100;

/** In the English hint, a rule's line sits one YAML level under `rules:`. */
const EN_CONFIG_LEAD = "    In chaff.yaml:  ";
const YAML_INDENT = 2;

const TEXT: Texts<{
  readonly current: string;
  readonly recommended: string;
  readonly both: string;
  readonly point: (point: Point, share: string) => string;
  readonly fits: string;
  readonly nothingFits: string;
  readonly over: (share: string) => string;
  readonly recommend: (limit: number) => string;
  readonly toConfig: (rule: string, limit: number) => string;
  readonly measured: (paths: number, rules: number) => string;
  readonly premise: readonly string[];
  readonly smallCorpus: (total: number) => readonly string[];
  readonly untouched: string;
}> = {
  ja: {
    current: "  ← 現在",
    recommended: "  ← 推奨",
    both: "  ← 現在 / 推奨",
    point: (point, share) =>
      `${String(point.documents).padStart(3)} 文書 (${share.padStart(6)})   指摘 ${String(point.findings).padStart(3)} 件   1万字あたり ${point.per10k.toFixed(1)}`,
    fits: `    いまの閾値で目標（${TARGET}% 未満）を満たしています。`,
    nothingFits: `    どの閾値でも目標を満たしません。この corpus に対して rule 自体が合っていない可能性があります。`,
    over: (share) => `    いまの閾値では ${share} の文書が該当し、目標（${TARGET}% 未満）を超えています。`,
    recommend: (limit) => `    推奨: ${limit}`,
    toConfig: (rule, limit) => `    chaff.yaml に書くなら:  rules:\n                              ${rule}: ${limit}`,
    measured: (paths, rules) => `  ${paths} ファイルを corpus として ${rules} 本の rule を測りました。`,
    premise: [
      "  ここにある文書は「人間が書いて公開した良い文書」として扱っています。",
      `  そこで多く発火する rule は、閾値が現実に合っていない疑いがあります（目標: ${TARGET}% 未満）。`,
    ],
    smallCorpus: (total) => [
      `  ※ corpus が ${total} 文書しかありません。${TARGET}% を表すには ${MIN_CORPUS} 文書以上が要ります。`,
      "     いまは割合が「0 か全部」に振れるので、右端の密度（1万字あたりの指摘数）のほうを見てください。",
    ],
    untouched: `  閾値は自動で書き換えていません。corpus が変われば答えも変わるためです。`,
  },
  en: {
    current: "  ← current",
    recommended: "  ← recommended",
    both: "  ← current / recommended",
    point: (point, share) =>
      `${String(point.documents).padStart(3)} ${point.documents === 1 ? "doc " : "docs"} (${share.padStart(6)})   ${String(point.findings).padStart(3)} ${point.findings === 1 ? "finding " : "findings"}   ${point.per10k.toFixed(1)} per 10,000 characters`,
    fits: `    The current limit meets the target (under ${TARGET}%).`,
    nothingFits: "    No limit meets the target. The rule itself may not suit this corpus.",
    over: (share) => `    At the current limit ${share} of the documents are hit, over the target (under ${TARGET}%).`,
    recommend: (limit) => `    Recommended: ${limit}`,
    toConfig: (rule, limit) => `${EN_CONFIG_LEAD}rules:\n${" ".repeat(EN_CONFIG_LEAD.length + YAML_INDENT)}${rule}: ${limit}`,
    measured: (paths, rules) => `  Measured ${rules} rule${rules === 1 ? "" : "s"} on ${paths} file${paths === 1 ? "" : "s"} as a corpus.`,
    premise: [
      "  The documents here are taken as good documents that people wrote and published.",
      `  A rule that fires often on them may have a limit that does not fit real writing (target: under ${TARGET}%).`,
    ],
    smallCorpus: (total) => [
      `  Note: the corpus has only ${total} document${total === 1 ? "" : "s"}. Showing ${TARGET}% takes at least ${MIN_CORPUS}.`,
      "     For now each share is either 0 or all, so read the density on the right (findings per 10,000 characters).",
    ],
    untouched: "  No limit was changed. A different corpus gives a different answer.",
  },
};

type EvalText = (typeof TEXT)[UiLanguage];

const mark = (report: RuleReport, limit: number, text: EvalText): string => {
  if (limit === report.current && limit === report.recommended) return text.both;
  if (limit === report.current) return text.current;
  if (limit === report.recommended) return text.recommended;
  return "";
};

const sweepLines = (report: RuleReport, text: EvalText): string[] =>
  report.sweep.map(
    (point) => `    ${String(point.limit).padStart(6)}   ${text.point(point, pct(point.documents, report.total))}${mark(report, point.limit, text)}`,
  );

const verdict = (report: RuleReport, text: EvalText): string[] => {
  const now = report.sweep.find((point) => point.limit === report.current);
  const rate = now === undefined ? 0 : now.documents / Math.max(1, report.total);
  if (rate <= TARGET_HIT_RATE) return [text.fits];
  if (report.recommended === undefined) return [text.nothingFits];
  return [text.over(pct(now?.documents ?? 0, report.total)), text.recommend(report.recommended), "", text.toConfig(report.rule, report.recommended)];
};

const block = (report: RuleReport, text: EvalText): string[] => [
  "",
  `  ${report.name}   (${report.rule})`,
  "",
  ...sweepLines(report, text),
  "",
  ...verdict(report, text),
  "",
];

/**
 * 閾値は自動で書き換えない。提示して選ばせる。
 * 較正は corpus に対する答えであって、正解ではないため。
 */
export const renderEval = (reports: readonly RuleReport[], total: number, paths: number, ui: UiLanguage): string => {
  const text = TEXT[ui];
  return [
    "",
    text.measured(paths, reports.length),
    "",
    ...text.premise,
    ...(total < MIN_CORPUS ? ["", ...text.smallCorpus(total)] : []),
    ...reports.flatMap((report) => block(report, text)),
    "  " + "─".repeat(58),
    "",
    text.untouched,
    "",
  ]
    .join("\n")
    .replace(/\{total\}/gu, String(total));
};
