import { comparable, sameValue, type FactValue } from "./fact-values.ts";
import { withoutEdgeMarks } from "./trim-marks.ts";

/**
 * 表の行の金額と、その行の見出しを主語に書いた文の金額（| 治療・救援費用 | 3,000万円 | と「治療・救援費用は、5,000万円を限度に」）。
 * 文は値の前後に言い回し（入院1日につき、を限度に、is paid at）を書くので、名前付きの値（labelled-facts）としては読めない。
 * 主語が行の見出しとちょうど同じで、同じ範囲にあり、行と文のどちらにも同じ通貨の金額がちょうど一つのときだけ比べる。
 * 二つ以上あれば、どれがどれに当たるか（日額と上限）は読まないと分からないので比べない。期間あたりの印（日額、a day）が両方に
 * あって期間が違えば（日額と月額）、別の値なので比べない。
 */
/** period: 金額の前後に書いた期間あたりの印の期間（日額 の day）。 */
export type Amount = FactValue & { readonly period?: string };

export type AmountRow = { readonly label: string; readonly scope: string; readonly amounts: readonly Amount[] };

export type SubjectSentence = { readonly text: string; readonly scope: string; readonly amounts: readonly Amount[] };

export type PeriodMark = { readonly pattern: string; readonly group: string };

export type SubjectWords = {
  /** 主語と述べる部分の区切り（は、は、、is、are）。英字だけの区切りは、前が空白で後ろが語の切れ目のときだけ。 */
  readonly separators: readonly string[];
  /** 主語の頭から落とす語（the）。 */
  readonly determiners: readonly string[];
  /** 文の金額に条件を付ける語（場合、if）。英字の語は語の切れ目にあるときだけ。 */
  readonly conditions: readonly string[];
};

export type RowSentenceConflict = { readonly label: string; readonly value: FactValue; readonly other: FactValue };

const SPACE = /^[ \t]?/u;
const MARK_REACH = 16;
const STRONG_MARK = /\*\*|__/gu;
const LATIN_WORD = /^[a-z ]+$/iu;
const LATIN_LETTER = /[a-z]/iu;
const BLOCK_MARK = /^[ \t]*(?:#{1,6}[ \t]+|>[ \t]?)?/u;
const ITEM_MARK = /^(?:[-*+]|\d{1,3}[.)])[ \t]+/u;

const folded = (text: string): string => text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ");

const markAt = (text: string, marks: readonly PeriodMark[]): string | undefined => {
  const lowered = folded(text);
  return marks.find((mark) => lowered.startsWith(folded(mark.pattern)))?.group;
};

const markBefore = (text: string, marks: readonly PeriodMark[]): string | undefined => {
  const lowered = folded(text).trimEnd();
  return marks.find((mark) => lowered.endsWith(folded(mark.pattern)))?.group;
};

/** 金額のすぐ前（日額5,000円）かすぐ後ろ（$100 a day、5,000円/日）の期間あたりの印の期間。 */
export const periodOf = (source: string, value: FactValue, marks: readonly PeriodMark[]): string | undefined =>
  markAt(source.slice(value.end).replace(SPACE, ""), marks) ?? markBefore(source.slice(Math.max(0, value.start - MARK_REACH), value.start), marks);

const withoutDeterminer = (text: string, determiners: readonly string[]): string => {
  const word = determiners.map(folded).find((determiner) => LATIN_WORD.test(determiner) && text.startsWith(`${determiner} `));
  return word === undefined ? text : text.slice(word.length + 1);
};

/** 主語のすぐ後ろが区切りか。英字の区切りは、空白一つを挟み、後ろが英字でないときだけ（「is」は「island」の頭ではない）。 */
const startsWithSeparator = (rest: string, separators: readonly string[]): boolean =>
  separators.map(folded).some((separator) => {
    if (!LATIN_WORD.test(separator)) return rest.startsWith(separator);
    return rest.startsWith(` ${separator}`) && !LATIN_LETTER.test(rest.charAt(separator.length + 1));
  });

/** 文の主語が、ちょうどその名前か（「入院給付金は、」"Hospital cash is"）。名前に続く語があれば（入院給付金の、Hospital cash cover）違う。 */
export const namesSubject = (text: string, label: string, words: SubjectWords): boolean => {
  const key = withoutDeterminer(folded(label), words.determiners);
  const head = withoutDeterminer(folded(withoutEdgeMarks(text.replace(BLOCK_MARK, "").replace(ITEM_MARK, "").replace(STRONG_MARK, ""))), words.determiners);
  return head.startsWith(key) && startsWithSeparator(head.slice(key.length), words.separators);
};

/** 文に条件の語があるか（「集中治療室に入院した場合は」"if you are in intensive care"）。 */
export const hasCondition = (text: string, conditions: readonly string[]): boolean => {
  const lowered = folded(text);
  return conditions.map(folded).some((word) => {
    if (!LATIN_WORD.test(word)) return lowered.includes(word);
    return new RegExp(`(?<![a-z])${word}(?![a-z])`, "u").test(lowered);
  });
};

/** 文の金額と比べられる、行の唯一の金額。文にも、比べられる金額がほかに無いときだけ。 */
const onlyPair = (row: AmountRow, sentence: SubjectSentence, value: Amount): Amount | undefined => {
  const inRow = row.amounts.filter((amount) => comparable(amount, value));
  const inSentence = sentence.amounts.filter((amount) => comparable(amount, value));
  return inRow.length === 1 && inSentence.length === 1 ? inRow[0] : undefined;
};

/** 期間の違う金額（日額と月額）は別の値。片方にしか印が無ければ比べる（1日につき は語彙表に無い書き方）。 */
const samePeriod = (left: Amount, right: Amount): boolean => left.period === undefined || right.period === undefined || left.period === right.period;

const conflictsWith = (row: AmountRow, sentence: SubjectSentence): RowSentenceConflict[] =>
  sentence.amounts.flatMap((value) => {
    const other = onlyPair(row, sentence, value);
    return other === undefined || sameValue(other, value) || !samePeriod(other, value) ? [] : [{ label: row.label, value, other }];
  });

const rowsByScope = (rows: readonly AmountRow[]): ReadonlyMap<string, AmountRow[]> =>
  rows.reduce((byScope, row) => byScope.set(row.scope, [...(byScope.get(row.scope) ?? []), row]), new Map<string, AmountRow[]>());

/**
 * 同じ範囲で、主語がその行の見出しの文。同じ見出しの行が範囲に二つあれば、どちらの値か分からないので比べない。
 * 条件の語のある文は、その場合の値なので比べない。
 */
export const rowSentenceConflicts = (rows: readonly AmountRow[], sentences: readonly SubjectSentence[], words: SubjectWords): RowSentenceConflict[] => {
  const byScope = rowsByScope(rows);
  return sentences.flatMap((sentence) => {
    const named = (byScope.get(sentence.scope) ?? []).filter((row) => namesSubject(sentence.text, row.label, words));
    const [row] = named;
    return row === undefined || named.length > 1 || hasCondition(sentence.text, words.conditions) ? [] : conflictsWith(row, sentence);
  });
};
