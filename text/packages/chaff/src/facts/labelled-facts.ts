import type { FactValue } from "./fact-values.ts";
import { EDGE_MARKS, trimEndOf, withoutEdgeMarks } from "./trim-marks.ts";

/**
 * 名前の付いた値（「締切：10月5日」「参加費は3,000円です」"Fee: $300" "The deadline is May 3."）と、
 * 属性の言い回しに続く値（"headquartered in Austin"、「東京に本社を置く」）。
 * 名前は文の頭から区切り（：、は、is）までで、値は区切りのすぐ後ろから文の切れ目まで。値の後ろに語が続けば（「3,000円から」
 * 「$300 per person」）、条件の付いた値なので読まない。読点のあとから始まる名前（「大人は、」「For adults, the fee」）も、
 * 前に条件があるので読まない。言語の知識（区切り、値の終わり、落とす冠詞）は言語パッケージの語彙表から取る。
 */
export type AttributePhrase = { readonly pattern: string; readonly position: "before" | "after" };

export type FactWords = {
  /** 名前と値の区切り（：、は、is）。英字だけの区切りは、前が空白のときだけ。 */
  readonly separators: readonly string[];
  /** 値のすぐ後ろに来てよいもの（。、です、まで、.）。行の終わりと表の升の終わりはいつでもよい。 */
  readonly valueEnds: readonly string[];
  /** 名前の頭から落とす語（the, our）。 */
  readonly determiners: readonly string[];
  /** 名前にならない語（それ、it）。 */
  readonly vague: readonly string[];
  /** 名前の前に置かれる決定の前置き（協議の結果、, it was decided that）。読点を含んでも条件ではないので、外してから名前を読む。 */
  readonly leads: readonly string[];
  readonly attributes: readonly AttributePhrase[];
};

export type Fact = { readonly label: string; readonly key: string; readonly value: FactValue };

const MAX_LABEL_LENGTH = 24;
const MAX_LABEL_WORDS = 5;

const MARKS_AFTER_VALUE = /^[*_]+/u;

/** 文の切れ目。名前はこの後ろから始まる。表の升の区切りと、空白の前のピリオド（1. や文の終わり）も切れ目。 */
const SENTENCE_BREAK = /[。！？!?|．]|\.(?=\s)/gu;
const CLAUSE_COMMA = /[、，,]/u;
const BLOCK_MARK = /^[ \t]*(?:#{1,6}[ \t]+|>[ \t]?)?/u;
const ITEM_MARK = /^[-*+][ \t]+/u;
const LETTER = /\p{L}/u;
/** 名前に書かない記号。コードや属性（{style="…"}、"key"=）の中の値は、項目の値ではない。 */
const CODE_MARK = /[{}<>=[\]"`]/u;
const LATIN_WORD = /^[a-z ]+$/iu;
const LATIN_LETTER = /^[a-z]$/iu;

const lineStartOf = (source: string, offset: number): number => source.lastIndexOf("\n", offset - 1) + 1;

const lineEndOf = (source: string, offset: number): number => {
  const end = source.indexOf("\n", offset);
  return end === -1 ? source.length : end;
};

/** 区切りの前の名前の部分。英字の区切りは語の頭から（「this」の is は区切りではない）。 */
const beforeSeparator = (head: string, separator: string): string | undefined => {
  if (!head.toLowerCase().endsWith(separator.toLowerCase())) return undefined;
  const rest = head.slice(0, head.length - separator.length);
  if (LATIN_WORD.test(separator) && !/\s$/u.test(rest)) return undefined;
  return rest;
};

/** 英字の前置きが語の途中で切れているか（「we agreed that」は「we agreed thatching」の頭ではない）。 */
const endsInsideWord = (text: string, length: number): boolean => LATIN_LETTER.test(text.charAt(length - 1)) && LATIN_LETTER.test(text.charAt(length));

/** 頭の決定の前置きを外した節。 */
const withoutLead = (clause: string, words: FactWords): string => {
  const lead = words.leads.find((phrase) => clause.toLowerCase().startsWith(phrase.toLowerCase()) && !endsInsideWord(clause, phrase.length));
  return lead === undefined ? clause : clause.slice(lead.length).trimStart();
};

/** 最後の文の切れ目より後ろ。 */
const afterLastBreak = (text: string): string => {
  const breaks = [...text.matchAll(SENTENCE_BREAK)];
  const last = breaks.at(-1);
  return last === undefined ? text : text.slice(last.index + last[0].length);
};

const wordsOf = (text: string): string[] => text.split(/\s+/u).filter((word) => word !== "");

/** 名前を一つの書き方に。全角と半角、大文字と小文字、空白の数を揃え、頭の冠詞を落とす。 */
const keyOf = (label: string, words: FactWords): string => {
  const [first, ...rest] = wordsOf(label.normalize("NFKC").toLowerCase());
  const determiners = new Set(words.determiners.map((word) => word.toLowerCase()));
  return (first !== undefined && determiners.has(first) ? rest : [first ?? "", ...rest]).join(" ");
};

const containsSeparator = (label: string, words: FactWords): boolean =>
  words.separators.some((separator) =>
    LATIN_WORD.test(separator) ? wordsOf(label.toLowerCase()).includes(separator.toLowerCase()) : label.includes(separator),
  );

/** 名前として使える書き方か。短く、字を含み、区切りを含まず、指すだけの語（それ、it）でない。 */
const isLabel = (label: string, key: string, words: FactWords): boolean =>
  label.length > 0 &&
  label.length <= MAX_LABEL_LENGTH &&
  wordsOf(label).length <= MAX_LABEL_WORDS &&
  LETTER.test(key) &&
  !CODE_MARK.test(label) &&
  !containsSeparator(label, words) &&
  !words.vague.some((word) => word.toLowerCase() === key);

/** 値の後ろが文の切れ目か。行の終わり、表の升の終わり、語彙表の終わりの語。 */
const endsAfter = (source: string, value: FactValue, words: FactWords): boolean => {
  const after = source.slice(value.end, lineEndOf(source, value.end)).replace(MARKS_AFTER_VALUE, "");
  if (after.trim() === "" || after.trimStart().startsWith("|")) return true;
  return words.valueEnds.some((end) => after.startsWith(end));
};

const labelledFact = (source: string, value: FactValue, words: FactWords): Fact | undefined => {
  const head = trimEndOf(source.slice(lineStartOf(source, value.start), value.start), EDGE_MARKS);
  for (const separator of words.separators) {
    const before = beforeSeparator(head, separator);
    if (before === undefined) continue;
    const clause = withoutLead(afterLastBreak(before).replace(BLOCK_MARK, "").replace(ITEM_MARK, "").trimStart(), words);
    if (CLAUSE_COMMA.test(clause)) return undefined;
    const label = withoutEdgeMarks(clause);
    const key = keyOf(label, words);
    return isLabel(label, key, words) ? { label, key, value } : undefined;
  }
  return undefined;
};

/** 属性の言い回しのすぐ前か後ろの値。名前は言い回しそのもの。 */
const attributeFact = (source: string, value: FactValue, words: FactWords): Fact | undefined => {
  const head = trimEndOf(source.slice(lineStartOf(source, value.start), value.start), EDGE_MARKS).toLowerCase();
  const tail = source
    .slice(value.end, lineEndOf(source, value.end))
    .replace(/^[ \t]+/u, "")
    .toLowerCase();
  const found = words.attributes.find((phrase) =>
    phrase.position === "before" ? head.endsWith(phrase.pattern.toLowerCase()) : tail.startsWith(phrase.pattern.toLowerCase()),
  );
  if (found === undefined || (found.position === "before" && !endsAfter(source, value, words))) return undefined;
  return { label: found.pattern, key: keyOf(found.pattern, words), value };
};

/** 文に書いた名前付きの値。値ごとに、属性の言い回しか、区切りの前の名前を探す。 */
export const labelledFacts = (source: string, values: readonly FactValue[], words: FactWords): Fact[] =>
  values.flatMap((value) => {
    const attribute = attributeFact(source, value, words);
    if (attribute !== undefined) return [attribute];
    if (!endsAfter(source, value, words)) return [];
    const fact = labelledFact(source, value, words);
    return fact === undefined ? [] : [fact];
  });
