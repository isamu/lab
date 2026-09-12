import type { Finding, RuleDefinition } from "../plugin.ts";
import type { UserCheck } from "../checks.ts";
import type { SemanticResult } from "../run-semantic.ts";
import { MARK, localized } from "./text.ts";

const RULE = 60;

const indent = (text: string, pad: string): string[] => text.split("\n").map((line) => `${pad}${line}`);

export const MACHINE_BANNER = ["", `═══ 機械による判定 ${"═".repeat(RULE - 18)}`, "    同じ文章なら何度実行しても同じ結果になります", ""];

/**
 * 自分の書いた検査が、どこまで絞り込めたかを見せる。
 * 絞り込めないまま全文を読んでいることに気づけないと、遅さの原因が分からない。
 */
const narrowingLines = (result: SemanticResult): string[] =>
  result.narrowed.flatMap(({ name, narrowing }) => {
    if (narrowing.words.length === 0 && !narrowing.needsNumber) {
      return [`    ${name}: 見るところを絞れず、全文を読みました`, `      look_at に「」で語を書くと、その語を含む文だけになります`];
    }
    const what = [...narrowing.words.map((word) => `「${word}」`), ...(narrowing.needsNumber ? ["数字"] : [])].join(" ");
    return [`    ${name}: ${what} を含む ${narrowing.kept} 文だけを読みました（全 ${narrowing.total} 文）`];
  });

export const aiBanner = (result: SemanticResult): string[] => [
  "",
  `═══ AI による判定 ${"═".repeat(RULE - 17)}`,
  "    文章の意味を読んでいます。実行するたび結果が変わることが",
  "    あります。おかしいと思ったら、そのまま無視して構いません。",
  "",
  `    ${result.sentencesSeen} 文のうち ${result.asked} 箇所を読みました（残りは機械が対象外と判断）`,
  ...narrowingLines(result),
  "",
];

type Named = { readonly name: string; readonly howToFix: string };

const nameOf = (rule: string, rules: readonly RuleDefinition[], checks: readonly UserCheck[], language: string): Named => {
  const built = rules.find((entry) => entry.id === rule);
  if (built !== undefined) return { name: localized(built.name, language), howToFix: localized(built.how_to_fix, language) };
  const user = checks.find((entry) => entry.id === rule);
  return { name: user?.name ?? rule, howToFix: user?.how_to_fix ?? "" };
};

/**
 * AI の指摘にだけ確からしさを出し、納得できないときの逃げ道を 2 つ添える。
 * 揺れる判定だと読む人が知らないと、誤検知に振り回される。
 */
const block = (finding: Finding, named: Named): string[] => {
  const confidence = finding.values["confidence"];
  const reason = String(finding.values["reason"] ?? "");
  const sure = confidence === undefined ? "" : `            確からしさ ${String(confidence)}`;
  const fix = named.howToFix.length > 0 ? ["", ...indent(`→ ${named.howToFix}`, "     ")] : [];
  return [
    "",
    `─── ${finding.line} 行目 ${"─".repeat(Math.max(0, RULE - String(finding.line).length - 8))}`,
    "",
    `  ${MARK[finding.severity] ?? "·"}  ${named.name}${sure}`,
    "",
    ...indent(reason, "     "),
    ...fix,
    "",
    "     この指摘が違うと思ったら:",
    `       この箇所だけ黙らせる    <!-- stet: ${finding.rule} — 理由 -->`,
    `       ルールごとゆるめる      npx chaff relax ${finding.rule}`,
    "",
  ];
};

export const renderSemantic = (result: SemanticResult, rules: readonly RuleDefinition[], checks: readonly UserCheck[], language: string): string[] => [
  ...aiBanner(result),
  ...result.findings.flatMap((finding) => block(finding, nameOf(finding.rule, rules, checks, language))),
  ...(result.skipped.length > 0 ? [`  ${result.skipped.length} 件の検査は、見るところが無いため動いていません。`, ""] : []),
];
