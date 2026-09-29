import type { Finding, RuleDefinition } from "../plugin.ts";
import type { UserCheck } from "../checks.ts";
import type { Narrowing } from "../look-at.ts";
import type { Job as Plan, SemanticResult } from "../run-semantic.ts";
import { uiLanguageOf, type Texts, type UiLanguage } from "../ui.ts";
import { MARK, localized } from "./text.ts";

const RULE = 60;

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;

const TEXT: Texts<{
  readonly machineBanner: readonly string[];
  readonly aiTitle: string;
  readonly aiNote: readonly string[];
  readonly read: (asked: number, seen: number) => string;
  readonly wholeRead: (name: string) => readonly string[];
  readonly word: (word: string) => string;
  readonly number: string;
  readonly narrowedRead: (name: string, what: string, kept: number, total: number) => string;
  readonly line: (line: number) => string;
  readonly confidence: (value: string) => string;
  readonly disagree: readonly string[];
  readonly silence: (rule: string) => string;
  readonly relax: (rule: string) => string;
  readonly notRunChecks: (count: number) => string;
  readonly byMachine: string;
  readonly whole: string;
  readonly containing: (parts: string) => string;
  readonly planLine: (count: number, name: string, how: string) => string;
  readonly firstSample: string;
  readonly planHead: (path: string, sentences: number, asked: number) => string;
}> = {
  ja: {
    machineBanner: ["", `═══ 機械による判定 ${"═".repeat(RULE - 18)}`, "    同じ文章なら何度実行しても同じ結果になります", ""],
    aiTitle: `═══ AI による判定 ${"═".repeat(RULE - 17)}`,
    aiNote: ["    文章の意味を読んでいます。実行するたび結果が変わることが", "    あります。おかしいと思ったら、そのまま無視して構いません。"],
    read: (asked, seen) => `    ${seen} 文のうち ${asked} 箇所を読みました（残りは機械が対象外と判断）`,
    wholeRead: (name) => [`    ${name}: 見るところを絞れず、全文を読みました`, `      look_at に「」で語を書くと、その語を含む文だけになります`],
    word: (word) => `「${word}」`,
    number: "数字",
    narrowedRead: (name, what, kept, total) => `    ${name}: ${what} を含む ${kept} 文だけを読みました（全 ${total} 文）`,
    line: (line) => `${line} 行目`,
    confidence: (value) => `確からしさ ${value}`,
    disagree: ["     この指摘が違うと思ったら:"],
    silence: (rule) => `       この箇所だけ黙らせる    <!-- stet: ${rule} — 理由 -->`,
    relax: (rule) => `       ルールごとゆるめる      npx chaff relax ${rule}`,
    notRunChecks: (count) => `  ${count} 件の検査は、見るところが無いため動いていません。`,
    byMachine: "機械で絞り込み済み",
    whole: "絞り込めず全文",
    containing: (parts) => `${parts} を含む文`,
    planLine: (count, name, how) => `    ${String(count).padStart(3)} 箇所  ${name}  （${how}）`,
    firstSample: "  最初の 1 件に送る文章:",
    planHead: (path, sentences, asked) => `${path}   全 ${sentences} 文のうち ${asked} 箇所を送ります（API は呼んでいません）`,
  },
  en: {
    machineBanner: ["", `═══ Judged by machine ${"═".repeat(RULE - 21)}`, "    The same text gives the same result every time", ""],
    aiTitle: `═══ Judged by AI ${"═".repeat(RULE - 16)}`,
    aiNote: ["    These read the meaning of the text. The result can change", "    from run to run. If one looks wrong, feel free to ignore it."],
    read: (asked, seen) => `    Read ${plural(asked, "passage")} out of ${plural(seen, "sentence")} (the machine ruled out the rest)`,
    wholeRead: (name) => [
      `    ${name}: could not narrow what to read, so read the whole text`,
      `      Put words in quotes in look_at ("like this") to read only the sentences that contain them`,
    ],
    word: (word) => `"${word}"`,
    number: "a number",
    narrowedRead: (name, what, kept, total) => `    ${name}: read only the ${plural(kept, "sentence")} containing ${what} (of ${total})`,
    line: (line) => `line ${line}`,
    confidence: (value) => `confidence ${value}`,
    disagree: ["     If you think this finding is wrong:"],
    silence: (rule) => `       Silence this spot only    <!-- stet: ${rule} — reason -->`,
    relax: (rule) => `       Relax the whole rule      npx chaff relax ${rule}`,
    notRunChecks: (count) => `  ${plural(count, "check")} did not run: there was nothing for ${count === 1 ? "it" : "them"} to look at.`,
    byMachine: "narrowed by machine",
    whole: "not narrowed: the whole text",
    containing: (parts) => `sentences containing ${parts}`,
    planLine: (count, name, how) => `    ${String(count).padStart(3)} to send  ${name}  (${how})`,
    firstSample: "  The text sent for the first one:",
    planHead: (path, sentences, asked) => `${path}   sends ${plural(asked, "passage")} out of ${plural(sentences, "sentence")} (the API was not called)`,
  },
};

const indent = (text: string, pad: string): string[] => text.split("\n").map((line) => `${pad}${line}`);

/** The banner over a file's machine findings, in the file's language. */
export const machineBanner = (language: string): readonly string[] => TEXT[uiLanguageOf(language)].machineBanner;

/** The words a narrowing looks for, as the screen names them. */
const lookedFor = (narrowing: Narrowing, language: UiLanguage): string[] => {
  const text = TEXT[language];
  return [...narrowing.words.map((word) => text.word(word)), ...(narrowing.needsNumber ? [text.number] : [])];
};

/**
 * 自分の書いた検査が、どこまで絞り込めたかを見せる。
 * 絞り込めないまま全文を読んでいることに気づけないと、遅さの原因が分からない。
 */
const narrowingLines = (result: SemanticResult, language: UiLanguage): string[] =>
  result.narrowed.flatMap(({ name, narrowing }) => {
    if (narrowing.words.length === 0 && !narrowing.needsNumber) return [...TEXT[language].wholeRead(name)];
    const what = lookedFor(narrowing, language).join(language === "ja" ? " " : ", ");
    return [TEXT[language].narrowedRead(name, what, narrowing.kept, narrowing.total)];
  });

const aiBanner = (result: SemanticResult, language: UiLanguage): string[] => [
  "",
  TEXT[language].aiTitle,
  ...TEXT[language].aiNote,
  "",
  TEXT[language].read(result.asked, result.sentencesSeen),
  ...narrowingLines(result, language),
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
const block = (finding: Finding, named: Named, language: UiLanguage): string[] => {
  const text = TEXT[language];
  const confidence = finding.values["confidence"];
  const reason = String(finding.values["reason"] ?? "");
  const sure = confidence === undefined ? "" : `            ${text.confidence(String(confidence))}`;
  const fix = named.howToFix.length > 0 ? ["", ...indent(`→ ${named.howToFix}`, "     ")] : [];
  return [
    "",
    // "12 行目" and "line 12" take the same width on a terminal, so the rule ends in the same column in both.
    `─── ${text.line(finding.line)} ${"─".repeat(Math.max(0, RULE - String(finding.line).length - 8))}`,
    "",
    `  ${MARK[finding.severity] ?? "·"}  ${named.name}${sure}`,
    "",
    ...indent(reason, "     "),
    ...fix,
    "",
    ...text.disagree,
    text.silence(finding.rule),
    text.relax(finding.rule),
    "",
  ];
};

export const renderSemantic = (result: SemanticResult, rules: readonly RuleDefinition[], checks: readonly UserCheck[], language: string): string[] => {
  const ui = uiLanguageOf(language);
  return [
    ...aiBanner(result, ui),
    ...result.findings.flatMap((finding) => block(finding, nameOf(finding.rule, rules, checks, language), ui)),
    ...(result.skipped.length > 0 ? [TEXT[ui].notRunChecks(result.skipped.length), ""] : []),
  ];
};

/**
 * 何が送られるのかを、API を呼ばずに見せる。`chaff test --dry-run`。
 *
 * 鍵が無い環境でも二段構えの 1 段目まで確かめられる。全文が送られようとしていることに
 * 請求書で気づくのでは遅い。spec §14。
 */
const howNarrowed = (job: Plan, language: UiLanguage): string => {
  const narrowing = job.narrowing;
  if (narrowing === undefined) return TEXT[language].byMachine;
  const parts = lookedFor(narrowing, language);
  if (parts.length === 0) return TEXT[language].whole;
  return TEXT[language].containing(parts.join(language === "ja" ? " " : ", "));
};

export const renderPlan = (path: string, jobs: readonly Plan[], sentences: number, language: string): string[] => {
  const text = TEXT[uiLanguageOf(language)];
  const asked = jobs.reduce((sum, job) => sum + job.candidates.length, 0);
  const lines = jobs.map((job) => text.planLine(job.candidates.length, job.name, howNarrowed(job, uiLanguageOf(language))));
  const first = jobs.find((job) => job.candidates.length > 0);
  const sample = first === undefined ? [] : ["", text.firstSample, "", ...indent(String(first.candidates[0]?.text ?? "").slice(0, 300), "    ")];
  return ["", text.planHead(path, sentences, asked), "", ...lines, ...sample, ""];
};
