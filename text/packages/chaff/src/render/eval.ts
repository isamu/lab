import { MIN_CORPUS, TARGET_HIT_RATE, type RuleReport } from "../eval.ts";

const pct = (part: number, whole: number): string => `${((part / Math.max(1, whole)) * 100).toFixed(1)}%`;

const mark = (report: RuleReport, limit: number): string => {
  if (limit === report.current && limit === report.recommended) return "  ← 現在 / 推奨";
  if (limit === report.current) return "  ← 現在";
  if (limit === report.recommended) return "  ← 推奨";
  return "";
};

const sweepLines = (report: RuleReport): string[] =>
  report.sweep.map((point) => {
    const limit = String(point.limit).padStart(6);
    const docs = `${String(point.documents).padStart(3)} 文書`;
    const density = `1万字あたり ${point.per10k.toFixed(1)}`;
    return `    ${limit}   ${docs} (${pct(point.documents, report.total).padStart(6)})   指摘 ${String(point.findings).padStart(3)} 件   ${density}${mark(report, point.limit)}`;
  });

const verdict = (report: RuleReport): string[] => {
  const now = report.sweep.find((point) => point.limit === report.current);
  const rate = now === undefined ? 0 : now.documents / Math.max(1, report.total);
  if (rate <= TARGET_HIT_RATE) return [`    いまの閾値で目標（${TARGET_HIT_RATE * 100}% 未満）を満たしています。`];
  if (report.recommended === undefined) {
    return [`    どの閾値でも目標を満たしません。この corpus に対して rule 自体が合っていない可能性があります。`];
  }
  return [
    `    いまの閾値では ${pct(now?.documents ?? 0, report.total)} の文書が該当し、目標（${TARGET_HIT_RATE * 100}% 未満）を超えています。`,
    `    推奨: ${report.recommended}`,
    "",
    `    chaff.yaml に書くなら:  rules:\n                              ${report.rule}: ${report.recommended}`,
  ];
};

const block = (report: RuleReport): string[] => ["", `  ${report.name}   (${report.rule})`, "", ...sweepLines(report), "", ...verdict(report), ""];

/**
 * 閾値は自動で書き換えない。提示して選ばせる。
 * 較正は corpus に対する答えであって、正解ではないため。
 */
export const renderEval = (reports: readonly RuleReport[], total: number, paths: number): string =>
  [
    "",
    `  ${paths} ファイルを corpus として ${reports.length} 本の rule を測りました。`,
    "",
    "  ここにある文書は「人間が書いて公開した良い文書」として扱っています。",
    `  そこで多く発火する rule は、閾値が現実に合っていない疑いがあります（目標: ${TARGET_HIT_RATE * 100}% 未満）。`,
    ...(total < MIN_CORPUS
      ? [
          "",
          `  ※ corpus が ${total} 文書しかありません。${TARGET_HIT_RATE * 100}% を表すには ${MIN_CORPUS} 文書以上が要ります。`,
          "     いまは割合が「0 か全部」に振れるので、右端の密度（1万字あたりの指摘数）のほうを見てください。",
        ]
      : []),
    ...reports.flatMap(block),
    "  " + "─".repeat(58),
    "",
    `  閾値は自動で書き換えていません。corpus が変われば答えも変わるためです。`,
    "",
  ]
    .join("\n")
    .replace(/\{total\}/gu, String(total));
