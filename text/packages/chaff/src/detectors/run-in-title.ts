// A link title a converted page runs into the blurb after it on one line (「法令」×「デジタル」ハッカソン 「法令」×「デジタル」の
// 取組を…開催しました。). The title is a name, not part of the sentence, so the title and the blurb are measured apart. Pure.

/** The first run of the line before a space, and what follows the space. */
const HEAD_AND_REST = /^(\S+)\s+(\S.*)$/u;
/** A stop or a comma in the head: the head is already a sentence or a clause, not a title. */
const SENTENCE_MARK = /[。．、，！？!?]/u;
/** A title that opens with a bracket (「法令」×「デジタル」ハッカソン, 『白書』概要). */
const BRACKET_OPEN = /^[「『【〔［]/u;
/** The closed bracketed parts of a title, taken out before its own words are read. */
const BRACKETED = /「[^「」]*」|『[^『』]*』|【[^【】]*】|〔[^〔〕]*〕|［[^［］]*］/gu;
/** A bracket left open once the closed ones are out: the space is inside a bracketed name (「Technovation Girls」は…). */
const LONE_BRACKET = /[「」『』【】〔〕［］]/u;
/** Hiragana outside the brackets: a clause (「はい」と答えた), not the name of a page. */
const HIRAGANA = /\p{Script=Hiragana}/u;
/** A head shorter than this that recurs in the line is a word the sentence repeats (第, 法), not a title. */
const MIN_REPEATED_TITLE_CHARS = 4;

const isBracketedTitle = (head: string): boolean => BRACKET_OPEN.test(head) && !HIRAGANA.test(head.replace(BRACKETED, ""));

const isRepeatedTitle = (head: string, rest: string): boolean => [...head].length >= MIN_REPEATED_TITLE_CHARS && rest.includes(head);

const isWholeHead = (head: string): boolean => !SENTENCE_MARK.test(head) && !LONE_BRACKET.test(head.replace(BRACKETED, ""));

/**
 * The title and the blurb of a line that opens with a title run into a sentence: the head before the first space holds no
 * stop, comma or unclosed bracket, and it opens with a bracket or recurs in the sentence after it. Undefined for any other text.
 */
export const runInTitleParts = (text: string): readonly string[] | undefined => {
  const match = HEAD_AND_REST.exec(text.trim());
  const head = match?.[1];
  const rest = match?.[2];
  if (head === undefined || rest === undefined || !isWholeHead(head)) return undefined;
  return isBracketedTitle(head) || isRepeatedTitle(head, rest) ? [head, rest] : undefined;
};
