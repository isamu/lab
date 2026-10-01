import type { Detector, Finding, Lexicon, ProseDocument, Sentence, Span } from "../plugin.ts";
import { minorityWithin } from "../orthography.ts";
import { QUOTATION_MARKS, isWithinAny, quotedSpans } from "../quoted-span.ts";

/**
 * 綴りの組の語彙表の名前の頭。組（spelling-variant、spelling-ize）ごとに比べる。組を分けるのは、両方の書き方が一つの
 * 書き方の決まりの中にあるから（Oxford の綴りは colour と organize を一緒に使う）。
 */
const SPELLING_LISTS = "spelling-";

type Spelling = { readonly family: string; readonly pattern: boolean; readonly other: string };

/** 語（小文字）から、その語がどの組のどちらの綴りか。 */
const spellingsOf = (lexicons: ProseDocument["lexicons"]): ReadonlyMap<string, Spelling> =>
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

export type SpelledWord = { readonly written: string; readonly offset: number; readonly spelling: Spelling };

/**
 * 文の中の、組に載った綴りの語。文の頭でないのに大文字で始まる語（Labor Day、World Health Organization）は名前で、名前の綴りは
 * 変えられないので数えない。引用符で引いたものの中も、引いた元の綴りなので数えない。offset は文書の中の位置。
 */
export const spelledWordsIn = (sentence: Sentence, spellings: ReadonlyMap<string, Spelling>): SpelledWord[] => {
  const quoted: readonly Span[] = quotedSpans(sentence.text, QUOTATION_MARKS);
  const first = sentence.text.search(/\p{L}/u);
  return [...sentence.text.matchAll(WORD)].flatMap((match) => {
    const spelling = spellings.get(match[0].toLowerCase());
    const named = CAPITAL.test(match[0]) && match.index !== first;
    const inQuote =
      isWithinAny(quoted, { start: match.index, end: match.index + match[0].length }) || OPENING_QUOTE.test(sentence.text.charAt(match.index - 1));
    return spelling === undefined || named || inQuote ? [] : [{ written: match[0], offset: sentence.span.start + match.index, spelling }];
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

/**
 * イギリスとアメリカの綴り（colour と color、centre と center）が一つの文書で混ざっているか。組ごとに、文書の中で少ないほうを
 * 指摘する。どちらが正しいかは決めない。少ないほうが組の limit パーセントを超えるなら、使い分けと見て言わない。
 */
export const spellingVariety: Detector = (doc, options): Finding[] => {
  const spellings = spellingsOf(doc.lexicons);
  const located: Located[] = doc.sentences.flatMap((sentence) => spelledWordsIn(sentence, spellings).map((word) => ({ sentence, word })));
  const families = [...new Set(located.map(({ word }) => word.spelling.family))];
  return families.flatMap((family) => {
    const ofFamily = located.filter(({ word }) => word.spelling.family === family);
    const odd = minorityWithin(ofFamily, ({ word }) => word.spelling.pattern, options.limit);
    return odd.map((entry) => findingOf(entry, odd.length, ofFamily.length));
  });
};
