import type { LengthUnit } from "../plugin.ts";
import type { Texts } from "../ui.ts";
import type { AiLevel } from "./score.ts";

/** What the AI-likeness score says, in both languages. `group` is the genre group's name (ブログ / Blog). */
export type AiScoreText = {
  readonly level: Readonly<Record<AiLevel, string>>;
  /** The headline: the level and what it compares with. Never a claim about who wrote the text. */
  readonly headline: (level: AiLevel, group: string) => string;
  readonly tooShort: (length: number, minimum: number, unit: LengthUnit) => string;
  readonly noBaseline: (group: string, compared: number, needed: number) => string;
  readonly disclaimer: string;
  /** How many signs, out of how many compared, and where the levels start. */
  readonly signs: (signs: number, compared: number, medium: number, high: number) => string;
  readonly signalsHeading: string;
  readonly structureHeading: string;
  /** A signal that fired, with the share of human documents of the group that show it. */
  readonly fired: (name: string, count: number, fired: number, documents: number, group: string) => string;
  /** A signal that fired but is common in human documents of the group, so it does not count. */
  readonly common: (name: string, count: number, fired: number, documents: number) => string;
  readonly quiet: (count: number) => string;
  /** The structure measures within what human articles show. */
  readonly usual: (count: number) => string;
  readonly noHumanShare: (names: string) => string;
  readonly notRun: (names: string) => string;
  readonly structureNotCompared: (group: string) => string;
  /** A structure measure past the human limit whose shape a signal above already counts. */
  readonly sameAs: (name: string) => string;
  /** The one line in the lint report. */
  readonly summary: (headline: string, signs: number, path: string) => string;
  readonly summaryNotScored: (reason: string) => string;
  readonly usage: string;
  readonly unknownFormat: (format: string) => string;
  readonly listSeparator: string;
  readonly aside: (main: string, inner: string) => string;
};

const unitJa = (unit: LengthUnit): string => (unit === "char" ? "字" : "語");
const unitEn = (count: number, unit: LengthUnit): string => {
  if (unit === "char") return "characters";
  return count === 1 ? "word" : "words";
};

const HEADLINE_JA: Readonly<Record<AiLevel, string>> = { high: "目印が多い", medium: "目印がやや多い", low: "同じくらい" };
const HEADLINE_EN: Readonly<Record<AiLevel, string>> = { high: "more signs than", medium: "somewhat more signs than", low: "about as many signs as" };

export const AI_SCORE_TEXT: Texts<AiScoreText> = {
  ja: {
    level: { low: "低", medium: "中", high: "高" },
    headline: (level, group) => `AI らしさ: ${AI_SCORE_TEXT.ja.level[level]}（人が書いた文書（${group}）と比べて${HEADLINE_JA[level]}）`,
    tooShort: (length, minimum, unit) => `短すぎます: ${String(length)} ${unitJa(unit)}。${String(minimum)} ${unitJa(unit)}から測ります`,
    noBaseline: (group, compared, needed) => `人が書いた文書（${group}）と比べられる目印は ${String(compared)} 項目です。${String(needed)} 項目から測ります`,
    disclaimer: "※ 書いたのが AI かどうかの判定ではありません。生成文に多い目印が、人の文書と比べてどれだけ出ているかです。",
    signs: (signs, compared, medium, high) =>
      `目印 ${String(signs)} 個（比べた ${String(compared)} 項目のうち、人の文書の 9 割には出ないもの）。中は ${String(medium)} 個から、高は ${String(high)} 個から`,
    signalsHeading: "言い回しと形",
    structureHeading: "構成（人の記事と比べて）",
    fired: (name, count, fired, documents, group) =>
      `✗ ${name}: ${String(count)} 件  人が書いた文書（${group}）${String(documents)} 本のうち ${String(fired)} 本`,
    common: (name, count, fired, documents) =>
      `· ${name}: ${String(count)} 件  人の文書でも出る（${String(documents)} 本のうち ${String(fired)} 本）ので数えません`,
    quiet: (count) => `· ほかの ${String(count)} 項目は出ていません`,
    usual: (count) => `· ほかの ${String(count)} 項目は人の記事でふつうの値です`,
    noHumanShare: (names) => `比べていない（人の文書の基準が無い）: ${names}`,
    notRun: (names) => `動かなかった: ${names}`,
    structureNotCompared: (group) => `構成: 比べていません（基準はブログの記事で、${group}には使いません）`,
    sameAs: (name) => `「${name}」と同じ形なので 1 つに数えます`,
    summary: (headline, signs, path) => `${headline}: 目印 ${String(signs)} 個 ※ 書いたのが AI かどうかの判定ではありません。内訳: chaff ai-score ${path}`,
    summaryNotScored: (reason) => `AI らしさ: 測っていません（${reason}）`,
    usage: "使い方: chaff ai-score <file>... [--genre <ジャンル>] [--format text|json] [--compact]",
    unknownFormat: (format) => `--format は text か json です（${format} は知りません）`,
    listSeparator: "、",
    aside: (main, inner) => `${main}（${inner}）`,
  },
  en: {
    level: { low: "low", medium: "medium", high: "high" },
    headline: (level, group) => `AI-likeness: ${AI_SCORE_TEXT.en.level[level]} (${HEADLINE_EN[level]} human-written documents (${group}))`,
    tooShort: (length, minimum, unit) => `too short: ${String(length)} ${unitEn(length, unit)}; scored from ${String(minimum)}`,
    noBaseline: (group, compared, needed) => `${String(compared)} of the ${String(needed)} comparable signs needed against human-written documents (${group})`,
    disclaimer: "Not a verdict on whether AI wrote it: how many signs common in generated text show, compared with human documents.",
    signs: (signs, compared, medium, high) =>
      `${String(signs)} ${signs === 1 ? "sign" : "signs"} (of ${String(compared)} compared, ones 90% of human documents do not show); medium from ${String(medium)}, high from ${String(high)}`,
    signalsHeading: "Wording and shape",
    structureHeading: "Structure (against human articles)",
    fired: (name, count, fired, documents, group) =>
      `✗ ${name}: ${String(count)}  in ${String(fired)} of ${String(documents)} human-written documents (${group})`,
    common: (name, count, fired, documents) =>
      `· ${name}: ${String(count)}  common in human documents too (${String(fired)} of ${String(documents)}), not counted`,
    quiet: (count) => `· the other ${String(count)} did not show`,
    usual: (count) => `· the other ${String(count)} are usual for human articles`,
    noHumanShare: (names) => `not compared (no human baseline): ${names}`,
    notRun: (names) => `did not run: ${names}`,
    structureNotCompared: (group) => `Structure: not compared (the baseline is blog articles, not used for ${group})`,
    sameAs: (name) => `the same shape as "${name}", counted once`,
    summary: (headline, signs, path) =>
      `${headline}: ${String(signs)} ${signs === 1 ? "sign" : "signs"}. Not a verdict on whether AI wrote it. Breakdown: chaff ai-score ${path}`,
    summaryNotScored: (reason) => `AI-likeness: not scored (${reason})`,
    usage: "usage: chaff ai-score <file>... [--genre <genre>] [--format text|json] [--compact]",
    unknownFormat: (format) => `--format is text or json (not ${format})`,
    listSeparator: ", ",
    aside: (main, inner) => `${main} (${inner})`,
  },
};
