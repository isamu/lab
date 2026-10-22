import type { Detector, Finding, Paragraph, ProseDocument, Sentence, Token } from "../plugin.ts";

/** 答えが断片と言える語の数の上限（No. / Not accounts. / Not really.）。 */
const MAX_FRAGMENT_WORDS = 4;
/** 名詞だけの問い（The result? / The catch?）の語の数の上限。 */
const MAX_NOUN_QUESTION_WORDS = 3;

/** 語のすぐ後ろの疑問符。コードを覆った空白や記号の後ろの「?」は問いではない。 */
const QUESTION_END = /[\p{L}\p{N}"”'’)]\s*[?？]\s*$/u;
const WORD = /^\p{L}/u;
/** 括弧や引用符で始まる答え（(Grades K-4)）は、問いへの答えではなく注記か引用。 */
const ASIDE_OPEN = /^\s*[([{"“'‘]/u;
/** 品詞の読みが短縮形を一語にしたとき（You're / That's）にも、動詞を持つ文と見る。 */
const CONTRACTED_VERB = /['’](re|s|m|ve|ll|d)$/iu;

/** 記号でない語。括弧と引用符は解析器が X（その他）に読むので、それも外す。 */
const NOT_WORDS = new Set(["PUNCT", "SYM", "X"]);
const wordsOf = (sentence: Sentence): readonly Token[] => (sentence.tokens ?? []).filter((token) => !NOT_WORDS.has(token.pos));

const hasVerb = (words: readonly Token[]): boolean => words.some((token) => token.pos === "VERB" || token.pos === "AUX" || CONTRACTED_VERB.test(token.surface));

const isQuestion = (sentence: Sentence): boolean => QUESTION_END.test(sentence.text);

/** 動詞の無い、数語の答え（No. / Fair. / Not accounts.）。 */
export const isFragment = (sentence: Sentence): boolean => {
  const words = wordsOf(sentence);
  const fragmentSized = words.length > 0 && words.length <= MAX_FRAGMENT_WORDS && words.every((token) => WORD.test(token.surface));
  return fragmentSized && !hasVerb(words) && !isQuestion(sentence) && !ASIDE_OPEN.test(sentence.text);
};

/** 限定詞で始まる、動詞の無い短い問い（The result? / Our fix?）。 */
export const isNounQuestion = (sentence: Sentence): boolean => {
  const words = wordsOf(sentence);
  return isQuestion(sentence) && words.length <= MAX_NOUN_QUESTION_WORDS && words[0]?.pos === "DET" && !hasVerb(words);
};

/** 問いと、すぐ後ろでそれに答える断片。 */
export type AnsweredQuestion = { readonly question: Sentence; readonly answer: Sentence };

const answeredIn = (paragraph: Paragraph): AnsweredQuestion[] =>
  paragraph.sentences.flatMap((question, index) => {
    const answer = paragraph.sentences[index + 1];
    if (answer === undefined || !isQuestion(question)) return [];
    if (question.embeddedLanguage !== undefined || answer.embeddedLanguage !== undefined) return [];
    return isFragment(answer) || (isNounQuestion(question) && !isQuestion(answer)) ? [{ question, answer }] : [];
  });

/** 書き手が自分で問い、同じ段落のすぐ後ろで断片で答えた所（Is it perfect? No.）。 */
export const answeredQuestions = (doc: ProseDocument): AnsweredQuestion[] => doc.paragraphs.flatMap(answeredIn);

const findingOf = (found: AnsweredQuestion, count: number, limit: number): Finding => ({
  rule: "",
  severity: "info",
  line: 0,
  column: 0,
  quote: `${found.question.text.trim()} ${found.answer.text.trim()}`,
  values: { matched: found.answer.text.trim(), count, limit, offset: found.question.span.start },
});

/** 自問して断片で答える所の数。一つは語り口で、limit 個から言う。 */
export const qFragmentAnswer: Detector = (doc, options): Finding[] => {
  const found = answeredQuestions(doc);
  return found.length < options.limit ? [] : found.map((entry) => findingOf(entry, found.length, options.limit));
};
