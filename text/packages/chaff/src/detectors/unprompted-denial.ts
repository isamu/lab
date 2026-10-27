import type { Detector, Finding, Lexicon, LexiconEntry, ProseDocument, Sentence } from "../plugin.ts";
import { wordsOf } from "./structure.ts";
import { MIN_DOCUMENT_LENGTH } from "./signals.ts";
import { comparableText, comparableWords, entryCloses, entryIn, entryOpens, entryRanges } from "./lexicon-match.ts";
import { contrastSentences, type ContrastWords } from "./contrast-frame.ts";
import { contrastShare } from "./ai-phrasing.ts";

// 誰も言っていない前提を打ち消して終わる文（〜の話ではありません、This isn't about tooling.）。語はどれも語彙表が持ち、
// ここは組み方だけを知る。語彙表の group:
//   end       文がこの語で閉じれば打ち消し（日本語）。直前に exempt の語があれば数えない（だけではない、べきではない）
//   open      文がこの語で始まり、次の語が follow の語なら打ち消し（英語の This isn't about）
//   basis     同じ文にあれば数えない（理由を添えた打ち消しは事実を言っている）
//   reason    文がこの語で閉じれば basis を見ない（〜だから並ぶのではありません は理由を打ち消している）
//   premise   前の文にあれば数えない（打ち消す相手が文書の中にある）
//   question  前の文がこの語で閉じれば数えない（問いへの答え）
// 対比の枠（contrast-framing が数える文）は、言い直しが隣にあるので数えない。

export type DenialWords = {
  readonly ends: Lexicon;
  readonly exempts: Lexicon;
  readonly opens: Lexicon;
  readonly follows: Lexicon;
  readonly bases: Lexicon;
  readonly reasons: Lexicon;
  readonly premises: Lexicon;
  readonly questions: Lexicon;
};

const groupOf = (lexicon: Lexicon, group: string): Lexicon => lexicon.filter((entry) => entry.group === group);

export const denialWords = (lexicon: Lexicon): DenialWords => ({
  ends: groupOf(lexicon, "end"),
  exempts: groupOf(lexicon, "exempt"),
  opens: groupOf(lexicon, "open"),
  follows: groupOf(lexicon, "follow"),
  bases: groupOf(lexicon, "basis"),
  reasons: groupOf(lexicon, "reason"),
  premises: groupOf(lexicon, "premise"),
  questions: groupOf(lexicon, "question"),
});

/** 文が end の語で閉じ、その直前が exempt の語でないなら、その end の語。 */
const closingDenial = (sentence: Sentence, words: DenialWords): LexiconEntry | undefined => {
  const end = words.ends.find((entry) => entryCloses(sentence, entry));
  if (end === undefined) return undefined;
  const exempt = words.exempts.some((entry) => words.ends.some((other) => entryCloses(sentence, { pattern: `${entry.pattern}${other.pattern}` })));
  return exempt ? undefined : end;
};

const LETTER = /\p{L}/u;

/** 品詞が無いときは文字列で、open の語の直後の語を見る。 */
const textFollows = (sentence: Sentence, open: LexiconEntry, follows: Lexicon): boolean => {
  const text = comparableText(sentence);
  const head = comparableWords(open.pattern);
  if (!text.startsWith(head)) return false;
  const rest = text.slice(head.length).trimStart();
  return follows.some((entry) => {
    const word = comparableWords(entry.pattern);
    return rest.startsWith(word) && !LETTER.test(rest.charAt(word.length));
  });
};

/** 文が open の語で始まり、次の語が follow の語か。 */
const opensWithFollow = (sentence: Sentence, open: LexiconEntry, follows: Lexicon): boolean => {
  if (!entryOpens(sentence, open)) return false;
  const tokens = sentence.tokens;
  if (tokens === undefined || open.tokens === undefined) return textFollows(sentence, open, follows);
  const range = entryRanges(sentence, open)[0];
  const next = range === undefined ? undefined : tokens[range.end]?.surface.toLowerCase();
  return next !== undefined && follows.some((entry) => comparableWords(entry.pattern) === next);
};

/** A comma or semicolon carries a second clause: the denial does not end the sentence. */
const CLAUSE_BREAK = /[,;:、，；]/u;

const openingDenial = (sentence: Sentence, words: DenialWords): LexiconEntry | undefined =>
  CLAUSE_BREAK.test(sentence.text) ? undefined : words.opens.find((entry) => opensWithFollow(sentence, entry, words.follows));

/** 理由を添えた打ち消しか。理由そのものを打ち消す文（〜だから並ぶのではありません）は除く。 */
const givesBasis = (sentence: Sentence, words: DenialWords): boolean =>
  !words.reasons.some((entry) => entryCloses(sentence, entry)) && words.bases.some((entry) => entryIn(sentence, entry));

const QUESTION_MARK = /[?？]["'”’」』)）\s]*$/u;

/** 前の文が打ち消す相手を言っているか（問い、〜と思うかもしれません）。 */
const answersPrevious = (previous: Sentence | undefined, words: DenialWords): boolean =>
  previous !== undefined &&
  (QUESTION_MARK.test(previous.text) ||
    words.questions.some((entry) => entryCloses(previous, entry)) ||
    words.premises.some((entry) => entryIn(previous, entry)));

export type Denial = { readonly sentence: Sentence; readonly matched: string };

/**
 * 前提を打ち消して終わる文。理由を添えた文、前の文に答える文、対比の枠の文は除く。
 * contrast は contrast-framing が数える文で、打ち消しの隣に言い直しがある。
 */
export const unpromptedDenials = (sentences: readonly Sentence[], words: DenialWords, contrast: ContrastWords): Denial[] => {
  const framed = new Set(contrastSentences(sentences, contrast));
  return sentences.flatMap((sentence, index) => {
    const denial = closingDenial(sentence, words) ?? openingDenial(sentence, words);
    if (denial === undefined || framed.has(sentence)) return [];
    if (givesBasis(sentence, words) || answersPrevious(sentences[index - 1], words)) return [];
    return [{ sentence, matched: denial.pattern }];
  });
};

/** 一つ二つの打ち消しは論の運び。三つ目から数える。 */
const MIN_DENIALS = 3;

const contrastWordsOf = (doc: ProseDocument): ContrastWords => ({
  frames: doc.lexicons["contrast-frame"] ?? [],
  leads: doc.lexicons["contrast-lead"] ?? [],
  turns: doc.lexicons["contrast-turn"] ?? [],
});

/** 前提を打ち消して終わる文の、文書の言語の文に占める割合（%）が上限を超えたら、その文をすべて言う。 */
export const unpromptedDenial: Detector = (doc, options): Finding[] => {
  const own = doc.sentences.filter((sentence) => sentence.embeddedLanguage === undefined);
  const hits = unpromptedDenials(own, denialWords(options.lexicon ?? []), contrastWordsOf(doc));
  if (hits.length < MIN_DENIALS || wordsOf(doc) < MIN_DOCUMENT_LENGTH[doc.lengthUnit]) return [];
  const share = contrastShare(doc, hits.length);
  if (share <= options.limit) return [];
  return hits.map((hit) => ({
    rule: "",
    severity: "info",
    line: 0,
    column: 0,
    quote: hit.sentence.text.trim(),
    values: { matched: hit.matched, count: hits.length, share, limit: options.limit, offset: hit.sentence.span.start },
  }));
};
