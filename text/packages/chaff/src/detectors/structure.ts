import { charLength, lengthOf } from "../measure.ts";
import type { BulletList, Detector, Finding, Paragraph, ProseDocument, Section } from "../plugin.ts";

/**
 * ばらつきは変動係数（標準偏差 ÷ 平均）で測る。
 *
 * 標準偏差そのものを見ると、長い文書ほど大きくなって閾値が効かない。
 * 平均で割ると長さに依らなくなり、「揃いすぎ」と「ばらつきすぎ」を同じ尺度で言える。
 */
export const coefficientOfVariation = (values: readonly number[]): number | undefined => {
  if (values.length < 2) return undefined;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return undefined;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
};

/** 変動係数は 0..1 では読めないので、パーセントの整数にして閾値と突き合わせる。 */
const PERCENT = 100;

const asPercent = (value: number): number => Math.round(value * PERCENT);

const uniformity = (doc: ProseDocument, values: readonly number[], span: { start: number }, limit: number, rule: string): Finding[] => {
  const cv = coefficientOfVariation(values);
  if (cv === undefined || asPercent(cv) >= limit) return [];
  return [
    {
      rule,
      severity: "info",
      line: 0,
      column: 0,
      quote: doc.source.slice(span.start, span.start + 80).trim(),
      values: { count: values.length, variance: asPercent(cv), limit, offset: span.start },
    },
  ];
};

/** 1 段落に文を詰めすぎると、読み手はどこで息継ぎしていいか分からなくなる。 */
export const paragraphLength: Detector = (doc, options): Finding[] =>
  doc.paragraphs
    .filter((paragraph) => paragraph.sentences.length > options.limit)
    .map((paragraph) => ({
      rule: "max-paragraph-length",
      severity: "warning",
      line: 0,
      column: 0,
      quote: doc.source.slice(paragraph.span.start, paragraph.span.start + 80).trim(),
      values: { count: paragraph.sentences.length, limit: options.limit, offset: paragraph.span.start },
    }));

const charsOf = (paragraph: Paragraph): number => paragraph.sentences.reduce((sum, sentence) => sum + charLength(sentence), 0);

/** 段落の長さが揃いすぎている。人が書くと、言いたいことの重さで段落の長さは揺れる。 */
export const paragraphVariance: Detector = (doc, options): Finding[] => {
  const lengths = doc.paragraphs.map(charsOf).filter((length) => length > 0);
  const first = doc.paragraphs[0];
  return first === undefined ? [] : uniformity(doc, lengths, first.span, options.limit, "paragraph-length-variance");
};

const sectionChars = (section: Section): number => section.sentences.reduce((sum, sentence) => sum + charLength(sentence), 0);

/** 節の長さが揃いすぎている。見出しごとに機械的に埋めた文書で起きる。 */
export const sectionUniformity: Detector = (doc, options): Finding[] => {
  const lengths = doc.sections.map(sectionChars).filter((length) => length > 0);
  const first = doc.sections[0];
  return first === undefined ? [] : uniformity(doc, lengths, first.span, options.limit, "section-length-uniformity");
};

/**
 * 3 項目の箇条書きばかりになっている。
 * 3 つ並べると収まりがよいので、言いたいことが 2 つでも 4 つでも 3 つにされる。
 */
const isThree = (list: BulletList): boolean => list.items.length === 3;

export const ruleOfThree: Detector = (doc, options): Finding[] => {
  const lists = doc.lists;
  const threes = lists.filter(isThree);
  const share = lists.length === 0 ? 0 : Math.round((threes.length / lists.length) * PERCENT);
  const first = threes[0];
  if (lists.length < 3 || first === undefined || share <= options.limit) return [];
  return [
    {
      rule: "rule-of-three",
      severity: "info",
      line: 0,
      column: 0,
      quote: doc.source.slice(first.span.start, first.span.start + 80).trim(),
      values: { count: threes.length, total: lists.length, share, limit: options.limit, offset: first.span.start },
    },
  ];
};

/**
 * 本題に入るまでが長い。業務文書では、読み手は結論を探しに来ている。
 *
 * 「本題」は最初の中見出し（深さ 2 以上）とする。表題（深さ 1）の直後から数えると、
 * 表題しか無い文書で全文が前置きになる。中見出しが無い文書では何も言わない。
 */
export const preambleLength: Detector = (doc, options): Finding[] => {
  const body = doc.sections.find((section) => section.depth >= 2);
  if (body === undefined) return [];
  const before = doc.paragraphs.filter((paragraph) => paragraph.span.start < body.span.start);
  if (before.length <= options.limit) return [];
  const first = before[0];
  return first === undefined
    ? []
    : [
        {
          rule: "preamble-length",
          severity: "info",
          line: 0,
          column: 0,
          quote: doc.source.slice(first.span.start, first.span.start + 80).trim(),
          values: { count: before.length, limit: options.limit, offset: first.span.start },
        },
      ];
};

export const wordsOf = (doc: ProseDocument): number => doc.sentences.reduce((sum, sentence) => sum + lengthOf(sentence, doc.lengthUnit), 0);
