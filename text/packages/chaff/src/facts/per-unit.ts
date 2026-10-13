import type { FactValue } from "./fact-values.ts";

/**
 * 値が何あたりか（1kmあたり15円、毎月5,000円、$0.45 per mile、日額5,000円）。単位が量（時間、日、月、km、mile。語彙表 rate-unit）の
 * 値は、その量を掛けて金額になる単価なので、同じ単位あたりの値とだけ比べる。1kmあたり15円 と 表の 1,650円 は別の量。
 * 件や回ごと（1件につき220円、for each transfer）は量ではない。手数料の表は 1件分 を印なしで書く（| 振込手数料 | 165円 |）ので、
 * 何あたりとは読まず、これまでどおり比べる。決まった印（日額、/km、a day）は語彙表 per-unit-mark が単位まで言う。
 * 型（*あたり、毎*、per *）は * に rate-unit の単位の語（日 は day）を入れた句だけを読む。型の position は値のどちら側に書くか。
 */
export type PerUnitMark = { readonly pattern: string; readonly group: string };

export type PerUnitTemplate = { readonly pattern: string; readonly position: "before" | "after" };

export type PerUnitWords = {
  /** 単位まで決まった印（日額、/km、a day）。group が単位。 */
  readonly marks: readonly PerUnitMark[];
  /** * が単位の語の型（*あたり、毎*、per *）。 */
  readonly templates: readonly PerUnitTemplate[];
  /** 量の単位の語と、それが数える単位（日 は day）。ここに無い語（件、回）は何あたりとは読まない。 */
  readonly units: readonly PerUnitMark[];
  /** 百分率の単位（%）。率の期間（年4.8%）は率の基準（rate-values）が見て、期間を書かない率とも比べるので、ここでは読まない。 */
  readonly percentUnits: readonly string[];
};

const PLACEHOLDER = "*";
/** 印を探す、値の前と後ろの字数。「日額」「1日あたり」が値の前の数字の前に書かれる。 */
const MARK_REACH = 24;
/** 値の前の型と値のあいだに置ける字（空白、読点。畳んだ後の字）。1kmあたり、15円。 */
const GAP_CHARS: ReadonlySet<string> = new Set([" ", "、", ","]);
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const LETTER = /\p{L}/u;

const folded = (text: string): string => text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ");

const withoutGapAtEnd = (text: string): string => (GAP_CHARS.has(text.slice(-1)) ? withoutGapAtEnd(text.slice(0, -1)) : text);

/** 型の * に単位の語を入れた句と、その単位。* の無い型は単位を言わないので、句にならない。 */
type Phrase = { readonly text: string; readonly group: string; readonly unitFirst: boolean };

const phrasesOf = (template: PerUnitTemplate, units: readonly PerUnitMark[]): Phrase[] => {
  const pattern = folded(template.pattern);
  const at = pattern.indexOf(PLACEHOLDER);
  if (at === -1) return [];
  return units.map((unit) => ({ text: `${pattern.slice(0, at)}${folded(unit.pattern)}${pattern.slice(at + 1)}`, group: unit.group, unitFirst: at === 0 }));
};

/** 印がちょうど値の後ろに始まり、語の途中で切れていない（per mile は per milestone の頭ではない）。 */
const startsAfter = (after: string, text: string): boolean => after.startsWith(text) && !LETTER_OR_DIGIT.test(after.charAt(text.length));

/** 印がちょうど値の前で終わる。単位の語で始まる句は、前が字でない（1日につき の 日。利用日につき の 日 ではない）。 */
const endsBefore = (before: string, text: string, unitFirst: boolean): boolean =>
  before.endsWith(text) && !(unitFirst && LETTER.test(before.charAt(before.length - text.length - 1)));

const longest = (groups: readonly { readonly length: number; readonly group: string }[]): string | undefined =>
  groups.reduce<{ readonly length: number; readonly group: string } | undefined>(
    (best, match) => (best === undefined || match.length > best.length ? match : best),
    undefined,
  )?.group;

/** 値のすぐ後ろ（$100 a day、5,000円/日）かすぐ前（日額5,000円）の、決まった印の単位。 */
const markOf = (before: string, after: string, marks: readonly PerUnitMark[]): string | undefined =>
  marks.find((mark) => startsAfter(after, folded(mark.pattern)))?.group ?? marks.find((mark) => before.endsWith(folded(mark.pattern)))?.group;

/** 値の前（1kmあたり15円、毎月5,000円）か後ろ（$0.45 per mile）の型の単位。当たる句が二つあれば長いほう（か月 と 月）。 */
const templateOf = (before: string, after: string, words: PerUnitWords): string | undefined =>
  longest(
    words.templates.flatMap((template) =>
      phrasesOf(template, words.units)
        .filter((phrase) => (template.position === "before" ? endsBefore(before, phrase.text, phrase.unitFirst) : startsAfter(after, phrase.text)))
        .map((phrase) => ({ length: phrase.text.length, group: phrase.group })),
    ),
  );

/** 値が何の量あたりか。量あたりでなければ（件ごと、印なし）undefined。 */
export const perUnitOf = (source: string, value: FactValue, words: PerUnitWords): string | undefined => {
  const after = folded(source.slice(value.end, value.end + MARK_REACH)).trimStart();
  const before = withoutGapAtEnd(folded(source.slice(Math.max(0, value.start - MARK_REACH), value.start)));
  return markOf(before, after, words.marks) ?? templateOf(before, after, words);
};

/** 数量の値に、何あたりかを付ける。 */
export const withPerUnits = <T extends FactValue>(source: string, values: readonly T[], words: PerUnitWords): T[] =>
  values.map((value) => {
    const percent = words.percentUnits.some((unit) => folded(unit) === folded(value.unit));
    const per = value.kind === "quantity" && !percent ? perUnitOf(source, value, words) : undefined;
    return per === undefined ? value : { ...value, per };
  });
