import type { Finding, RuleDefinition } from "../plugin.ts";
import type { RunResult } from "../run.ts";
import { MARK, filledText, messageOf } from "./text.ts";
import { tally } from "./summary.ts";
import { counted } from "./plural.ts";
import { uiLanguageOf, type Texts } from "../ui.ts";

const RULE = 60;

const TEXT: Texts<{
  readonly line: (n: number) => string;
  readonly relax: string;
  readonly machine: string;
  readonly deterministic: string;
  readonly untouched: string;
  readonly forced: (n: number, ids: string) => string;
  readonly presetOn: (n: number, ids: string) => string;
  readonly notRun: (n: number) => string;
  readonly because: (why: string) => string;
}> = {
  ja: {
    line: (n) => `${n} 行目`,
    relax: "このルールをゆるめる",
    machine: "すべて機械による判定です",
    deterministic: "              （同じ文章なら何度実行しても同じ結果になります）",
    untouched: "文章は書き換えていません。直すのは書いた人です。",
    forced: (n, ids) => `試験中の rule を ${n} 件、設定により有効にしています: ${ids}`,
    presetOn: (n, ids) => `試験中の rule を ${n} 件、ジャンルの既定で有効にしています: ${ids}`,
    notRun: (n) => `${n} 件の rule は動いていません:`,
    because: (why) => `（${why}）`,
  },
  en: {
    line: (n) => `line ${n}`,
    relax: "Relax this rule",
    machine: "All judged by machine",
    deterministic: "              (the same text gives the same result every time)",
    untouched: "The text was not changed. Fixing it is the writer's job.",
    forced: (n, ids) => `${counted(n, "experimental rule")} turned on in the settings: ${ids}`,
    presetOn: (n, ids) => `${counted(n, "experimental rule")} turned on by the genre: ${ids}`,
    notRun: (n) => `${counted(n, "rule")} did not run:`,
    because: (why) => ` (${why})`,
  },
};
const QUOTE_LIMIT = 120;

const indent = (text: string, pad: string): string[] => text.split("\n").map((line) => `${pad}${line}`);

const quoteOf = (quote: string): string[] => {
  const text = quote.replace(/\s+/gu, " ").trim();
  if (text.length === 0) return [];
  return ["", ...indent(text.length > QUOTE_LIMIT ? `${text.slice(0, QUOTE_LIMIT)}…` : text, "    ")];
};

/** 一つの文から出た指摘は同じ文を引く。長い文に指摘が多いとき、指摘ごとに文を整え直さない。 */
const quotesOf = (): ((quote: string) => readonly string[]) => {
  const known = new Map<string, readonly string[]>();
  return (quote) => {
    const lines = known.get(quote) ?? quoteOf(quote);
    known.set(quote, lines);
    return lines;
  };
};

/**
 * 1 件につき 4 つを出す。どれが欠けても、書いた人は動けない。
 *   引用 / 何が起きているか / なぜ問題か / どう直すか
 * rule の id は「ゆるめる」コマンドの中にだけ出す。最初に読むのは name。
 */
const block = (finding: Finding, rule: RuleDefinition, language: string, quoted: readonly string[]): string[] => [
  "",
  // "12 行目" and "line 12" take the same width on a terminal, so the rule ends in the same column in both.
  `─── ${TEXT[uiLanguageOf(language)].line(finding.line)} ${"─".repeat(Math.max(0, RULE - String(finding.line).length - 8))}`,
  ...quoted,
  "",
  `  ${MARK[finding.severity] ?? "·"}  ${filledText(rule.name, finding, language)}`,
  "",
  ...indent(messageOf(rule, finding, language), "     "),
  ...indent(filledText(rule.why, finding, language), "     "),
  "",
  ...indent(`→ ${filledText(rule.how_to_fix, finding, language)}`, "     "),
  "",
  `     ${TEXT[uiLanguageOf(language)].relax}:  npx chaffjs relax ${finding.rule}`,
  "",
];

/** notes: lines after the not-run list (the genre chaff suggests when none is set). */
export const renderFriendly = (
  header: string,
  result: RunResult,
  rules: readonly RuleDefinition[],
  language: string,
  notes: readonly string[] = [],
): string => {
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const quoted = quotesOf();
  const blocks = result.findings.flatMap((finding) => {
    const rule = byId.get(finding.rule);
    return rule === undefined ? [] : block(finding, rule, language, quoted(finding.quote));
  });
  const text = TEXT[uiLanguageOf(language)];
  const closing = [
    "",
    "─".repeat(RULE),
    "",
    `  ${tally(result.findings, uiLanguageOf(language))}   ${text.machine}`,
    text.deterministic,
    "",
    `  ${text.untouched}`,
  ];
  const forced = [
    ...(result.forcedExperimental.length > 0 ? ["", `  ${text.forced(result.forcedExperimental.length, result.forcedExperimental.join(", "))}`] : []),
    ...(result.presetExperimental.length > 0 ? ["", `  ${text.presetOn(result.presetExperimental.length, result.presetExperimental.join(", "))}`] : []),
  ];
  const skipped =
    result.skipped.length > 0
      ? ["", `  ${text.notRun(result.skipped.length)}`, ...result.skipped.map((entry) => `      ${entry.rule}${text.because(entry.why)}`)]
      : [];
  const after = notes.flatMap((note) => ["", note]);
  return ["", header, ...blocks, ...closing, ...forced, ...skipped, ...after, ""].join("\n");
};
