import type { Texts } from "../ui.ts";
import type { LengthUnit } from "../plugin.ts";
import type { FeatureId, NotMeasured } from "../structure-shape/features.ts";

/** How one measure is named and how its value reads. */
export type FeatureText = {
  readonly name: string;
  /** The value with its unit and what was found (the form, the pair), from the measure's number and detail. */
  readonly value: (value: number, detail: string | undefined, unit: LengthUnit) => string;
};

export type StructureText = {
  readonly features: Readonly<Record<FeatureId, FeatureText>>;
  readonly notMeasured: Readonly<Record<NotMeasured, string>>;
  /** The block's first line: the score and what it counts. */
  readonly score: (score: number, compared: number, articles: number) => string;
  readonly noBaseline: (language: string) => string;
  /** Where a value sits: past what share of human articles, in the measure's direction. */
  readonly past: (share: number, low: boolean) => string;
  /** The measures whose values are usual in human articles, on one line. */
  readonly usualAmong: (measures: string) => string;
  /** The human median and the limit past which the measure counts (p90, or p10 for a low measure). */
  readonly human: (median: string, limit: string, low: boolean) => string;
  readonly unmeasured: (reasons: string) => string;
  readonly listSeparator: string;
  /** A remark after a phrase: 本文（注） / text (note). */
  readonly aside: (main: string, inner: string) => string;
  /** The before/after line of the score. */
  readonly scoreChange: string;
};

const BOOKEND_JA: Readonly<Record<string, string>> = { before: "前", after: "後" };
const BOOKEND_EN: Readonly<Record<string, string>> = { before: "opening", after: "closing" };

const sides = (detail: string | undefined, names: Readonly<Record<string, string>>, joiner: string): string =>
  (detail ?? "")
    .split(",")
    .flatMap((side) => names[side] ?? [])
    .join(joiner);

const withDetail = (value: string, detail: string | undefined, wrap: (detail: string) => string): string =>
  detail === undefined ? value : `${value}${wrap(detail)}`;

export const STRUCTURE_TEXT: Texts<StructureText> = {
  ja: {
    features: {
      "heading-density": { name: "見出しの多さ", value: (value, _detail, unit) => `${unit === "char" ? "1000 字" : "1000 語"}あたり ${String(value)}` },
      "short-sections": { name: "1〜2 段落の節", value: (value, detail) => withDetail(`${String(value)}%`, detail, (mean) => `（平均 ${mean} 段落）`) },
      "section-uniformity": { name: "節の長さのばらつき", value: (value) => `${String(value)}%` },
      "heading-forms": { name: "決まった形の見出し", value: (value, detail) => withDetail(`${String(value)}%`, detail, (form) => `（多いのは「${form}」）`) },
      "three-subsections": { name: "3 つの小見出しに分けた見出し", value: (value) => `${String(value)} か所` },
      bookends: {
        name: "はじめに・まとめの見出し",
        value: (value, detail) => withDetail(String(value), detail, () => `（${sides(detail, BOOKEND_JA, "と")}）`),
      },
      "closing-restatement": {
        name: "まとめが本文を言い直す割合",
        value: (value, detail) => withDetail(`${String(value)}%`, detail, (heading) => `（「${heading}」）`),
      },
      "three-item-lists": { name: "3 項目の箇条書き", value: (value, detail) => withDetail(`${String(value)}%`, detail, (counts) => `（${counts}）`) },
      "bold-labels": { name: "太字の見出しで始まる項目", value: (value) => `${String(value)} 項目` },
      "emoji-headings": { name: "絵文字の付いた見出し", value: (value) => `${String(value)} 個` },
      "pro-con": { name: "メリットとデメリットの対", value: (value, detail) => withDetail(`${String(value)} 組`, detail, (pairs) => `（${pairs}）`) },
    },
    notMeasured: {
      "too-short": "文書が短い",
      "too-few-sections": "中身のある節が少ない",
      "too-few-headings": "見出しが少ない",
      "no-closing": "まとめの節が無い",
      "too-few-lists": "箇条書きが 3 つ未満",
    },
    score: (score, compared, articles) =>
      `構成の AI らしさ: ${String(score)}（人の記事の 9 割を超えた項目の数。比べた ${String(compared)} 項目、人の記事 ${String(articles)} 本と比べて）`,
    noBaseline: (language) => `構成の AI らしさ: 比べていません（${language} の人の記事の基準がありません）`,
    past: (share, low) => `人の記事の ${String(share)}% より${low ? "揃っている" : "多い"}`,
    usualAmong: (measures) => `人の記事でふつう: ${measures}`,
    human: (median, limit, low) => `人の中央 ${median}、${low ? "下" : "上"}から 1 割の境 ${limit}`,
    unmeasured: (reasons) => `測っていない: ${reasons}`,
    listSeparator: "、",
    aside: (main, inner) => `${main}（${inner}）`,
    scoreChange: "構成の AI らしさ",
  },
  en: {
    features: {
      "heading-density": { name: "headings", value: (value, _detail, unit) => `${String(value)} per 1000 ${unit === "char" ? "characters" : "words"}` },
      "short-sections": {
        name: "sections of one or two paragraphs",
        value: (value, detail) => withDetail(`${String(value)}%`, detail, (mean) => ` (mean ${mean} paragraphs)`),
      },
      "section-uniformity": { name: "section length variation", value: (value) => `${String(value)}%` },
      "heading-forms": { name: "headings in a stock form", value: (value, detail) => withDetail(`${String(value)}%`, detail, (form) => ` (most: "${form}")`) },
      "three-subsections": { name: "headings split into three", value: (value) => String(value) },
      bookends: {
        name: "introduction / conclusion headings",
        value: (value, detail) => withDetail(String(value), detail, () => ` (${sides(detail, BOOKEND_EN, " and ")})`),
      },
      "closing-restatement": {
        name: "closing that restates the body",
        value: (value, detail) => withDetail(`${String(value)}%`, detail, (heading) => ` ("${heading}")`),
      },
      "three-item-lists": { name: "three-item lists", value: (value, detail) => withDetail(`${String(value)}%`, detail, (counts) => ` (${counts})`) },
      "bold-labels": { name: "list items opening with a bold label", value: (value) => String(value) },
      "emoji-headings": { name: "headings with an emoji", value: (value) => String(value) },
      "pro-con": { name: "pros / cons pairs", value: (value, detail) => withDetail(String(value), detail, (pairs) => ` (${pairs})`) },
    },
    notMeasured: {
      "too-short": "the document is short",
      "too-few-sections": "few sections with text",
      "too-few-headings": "few headings",
      "no-closing": "no closing section",
      "too-few-lists": "fewer than three lists",
    },
    score: (score, compared, articles) =>
      `Structure score: ${String(score)} (measures past 90% of human articles, of ${String(compared)} compared against ${String(articles)} human articles)`,
    noBaseline: (language) => `Structure score: not compared (no baseline of human articles in ${language})`,
    past: (share, low) => `${low ? "more uniform" : "higher"} than ${String(share)}% of human articles`,
    usualAmong: (measures) => `usual in human articles: ${measures}`,
    human: (median, limit, low) => `human median ${median}, ${low ? "10th" : "90th"} percentile ${limit}`,
    unmeasured: (reasons) => `not measured: ${reasons}`,
    listSeparator: ", ",
    aside: (main, inner) => `${main} (${inner})`,
    scoreChange: "structure score",
  },
};
