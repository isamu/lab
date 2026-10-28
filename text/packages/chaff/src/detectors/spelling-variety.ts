import type { Detector, Finding, Lexicon, ProseDocument, Sentence, Span } from "../plugin.ts";
import { minorityWithin } from "../orthography.ts";
import { QUOTATION_MARKS, isWithinAny, quotedSpans } from "../quoted-span.ts";
import { referenceListSpans } from "../reference-lists.ts";

/**
 * 綴りの組の語彙表の名前の頭。組（spelling-variant、spelling-ize）ごとに比べる。組を分けるのは、両方の書き方が一つの
 * 書き方の決まりの中にあるから（Oxford の綴りは colour と organize を一緒に使う）。
 */
const SPELLING_LISTS = "spelling-";

export type Spelling = { readonly family: string; readonly pattern: boolean; readonly other: string };

/** 語（小文字）から、その語がどの組のどちらの綴りか。 */
export const spellingsOf = (lexicons: ProseDocument["lexicons"]): ReadonlyMap<string, Spelling> =>
  new Map(
    Object.entries(lexicons)
      .filter(([id]) => id.startsWith(SPELLING_LISTS))
      .flatMap(([family, entries]: [string, Lexicon]) =>
        entries.flatMap((entry): [string, Spelling][] =>
          entry.instead_of === undefined
            ? []
            : [
                [entry.pattern.toLowerCase(), { family, pattern: true, other: entry.instead_of }],
                [entry.instead_of.toLowerCase(), { family, pattern: false, other: entry.pattern }],
              ],
        ),
      ),
  );

const WORD = /\p{L}+/gu;

/** 語の直前の開きの引用符。引いた語（use ‘organise’ not ‘organize’）は書き手の綴りではなく、話題にした語。 */
const OPENING_QUOTE = /[‘'"“]/u;
const CAPITAL = /^\p{Lu}/u;

/** 大文字で始まる次の語。文の頭でも、大文字の語が続けば名前（Labor Day、Centre Court）。 */
const CAPITALISED_NEXT = /^[ \t]+\p{Lu}/u;

/** 斜線でつないだ組（analyse/analyze）。両方の綴りを並べて名指ししているので、書き手の綴りではない。 */
const SLASH = "/";

const pairedBySlash = (text: string, at: number, word: string, other: string): boolean => {
  const before = text.slice(Math.max(0, at - other.length - SLASH.length), at).toLowerCase();
  const after = text.slice(at + word.length, at + word.length + SLASH.length + other.length).toLowerCase();
  return before === `${other.toLowerCase()}${SLASH}` || after === `${SLASH}${other.toLowerCase()}`;
};

export type SpelledWord = { readonly written: string; readonly offset: number; readonly spelling: Spelling };

/**
 * 文の中の、組に載った綴りの語。文の頭でないのに大文字で始まる語と、大文字の語が続く語（Labor Day、World Health Organization）は名前で、名前の綴りは
 * 変えられないので数えない。引用符で引いたものの中も、引いた元の綴りなので数えない。offset は文書の中の位置。
 */
export const spelledWordsIn = (sentence: Sentence, spellings: ReadonlyMap<string, Spelling>): SpelledWord[] => {
  const quoted: readonly Span[] = quotedSpans(sentence.text, QUOTATION_MARKS);
  const first = sentence.text.search(/\p{L}/u);
  return [...sentence.text.matchAll(WORD)].flatMap((match) => {
    const spelling = spellings.get(match[0].toLowerCase());
    const named = CAPITAL.test(match[0]) && (match.index !== first || CAPITALISED_NEXT.test(sentence.text.slice(match.index + match[0].length)));
    const inQuote =
      isWithinAny(quoted, { start: match.index, end: match.index + match[0].length }) || OPENING_QUOTE.test(sentence.text.charAt(match.index - 1));
    if (spelling === undefined || named || inQuote) return [];
    return pairedBySlash(sentence.text, match.index, match[0], spelling.other)
      ? []
      : [{ written: match[0], offset: sentence.span.start + match.index, spelling }];
  });
};

type Located = { readonly sentence: Sentence; readonly word: SpelledWord };

const findingOf = ({ sentence, word }: Located, count: number, of: number): Finding => ({
  rule: "",
  severity: "info",
  line: 0,
  column: 0,
  quote: sentence.text.trim(),
  values: { matched: word.written, other: word.spelling.other, count, of, offset: word.offset },
});

const REFERENCE_LIST_HEADING = "reference-list-heading";

/** 文献一覧の外の文。文献一覧の題や出版者の名前は、引いた文献の綴りのまま書く。 */
const outsideReferenceLists = (doc: ProseDocument): Sentence[] => {
  const lists = referenceListSpans(
    doc.source,
    (doc.lexicons[REFERENCE_LIST_HEADING] ?? []).map((entry) => entry.pattern),
  );
  return doc.sentences.filter((sentence) => !lists.some((list) => list.start <= sentence.span.start && sentence.span.start < list.end));
};

/**
 * イギリスとアメリカの綴り（colour と color、centre と center）が一つの文書で混ざっているか。組ごとに、文書の中で少ないほうを
 * 指摘する。どちらが正しいかは決めない。少ないほうが組の limit パーセントを超えるなら、使い分けと見て言わない。
 */
export const spellingVariety: Detector = (doc, options): Finding[] => {
  const spellings = spellingsOf(doc.lexicons);
  const located: Located[] = outsideReferenceLists(doc).flatMap((sentence) => spelledWordsIn(sentence, spellings).map((word) => ({ sentence, word })));
  const families = [...new Set(located.map(({ word }) => word.spelling.family))];
  return families.flatMap((family) => {
    const ofFamily = located.filter(({ word }) => word.spelling.family === family);
    const odd = minorityWithin(ofFamily, ({ word }) => word.spelling.pattern, options.limit);
    return odd.map((entry) => findingOf(entry, odd.length, ofFamily.length));
  });
};
