import type { LexiconEntry, Section, Sentence, Token } from "../plugin.ts";

// Sentence shapes whose register is a deliberate voice, not a slip: counted, never pointed at. Pure.

/** Marks after a sentence's last word: its full stop, an exclamation, closing brackets and spaces. */
const TRAILING_MARKS: ReadonlySet<string> = new Set(["。", "．", ".", "！", "!", "」", "』", "）", ")", " ", "\t", "\n", "　"]);

const withoutTrailingMarks = (text: string): string => {
  const chars = [...text];
  return chars.slice(0, chars.findLastIndex((char) => !TRAILING_MARKS.has(char)) + 1).join("");
};

/** A polite sentence that ends in a greeting said only politely (農業まつり、お疲れ様でした。). Plain remarks greet people so too. */
export const endsInSetGreeting = (sentence: Sentence, phrases: readonly LexiconEntry[]): boolean => {
  const text = withoutTrailingMarks(sentence.text);
  return phrases.some((phrase) => text.endsWith(phrase.pattern));
};

const isPagePointer = (sentence: Sentence, words: readonly LexiconEntry[]): boolean => {
  const text = withoutTrailingMarks(sentence.text);
  const of = (group: string): LexiconEntry[] => words.filter((word) => word.group === group);
  return of("ending").some((ending) => text.endsWith(ending.pattern)) && of("word").some((word) => text.includes(word.pattern));
};

/**
 * A polite pointer the page sets for its reader under a heading of its own (## 概要 / 本検討会の概要は、…をご覧ください。): the only
 * sentence of its section, ending in a phrase from the ending group of page-pointer and holding a word from its word group. A plain
 * page points its reader elsewhere so too; the same pointer inside the text's own paragraphs is still a slip.
 */
export const pagePointerSentences = (sections: readonly Section[], words: readonly LexiconEntry[]): Set<Sentence> =>
  new Set(
    sections.flatMap((section) => {
      const [only] = section.sentences;
      return section.sentences.length === 1 && only !== undefined && isPagePointer(only, words) ? [only] : [];
    }),
  );

const PAST = new Set(["た", "だ"]);

const hasParticle = (tokens: readonly Token[], particles: readonly LexiconEntry[]): boolean =>
  tokens.some((token) => token.pos === "ADP" && particles.some((particle) => particle.pattern === token.surface));

/** The sentence ends in a forward-looking form from declaration-ending (…形にしていく。). */
const endsInResolve = (sentence: Sentence, endings: readonly LexiconEntry[]): boolean => {
  const text = withoutTrailingMarks(sentence.text);
  return endings.some((ending) => text.endsWith(ending.pattern));
};

/**
 * A speaker's declaration (負担軽減を、目に見える形で実現する。二度と繰り返さない。): an object particle, no subject particle, and a
 * verb in the present at the end. A sentence ending in a forward-looking form (現場の気づきを、幹部の皆さんが形にしていく。) declares even
 * with its subject said. particles and endings are the declaration-particle and declaration-ending word lists already narrowed to the
 * document's genre; without an object particle for the genre the shape does not hold.
 */
export const isDeclaration = (
  sentence: Sentence,
  ending: readonly Token[],
  particles: readonly LexiconEntry[],
  endings: readonly LexiconEntry[] = [],
): boolean => {
  const objects = particles.filter((particle) => particle.group === "object");
  const subjects = particles.filter((particle) => particle.group === "subject");
  const tokens = sentence.tokens ?? [];
  const last = ending.at(-1);
  if (objects.length === 0 || last === undefined || PAST.has(last.surface)) return false;
  const subjectAllowed = !hasParticle(tokens, subjects) || endsInResolve(sentence, endings);
  return ending.some((token) => token.pos === "VERB") && hasParticle(tokens, objects) && subjectAllowed;
};

/** The most tokens an opener in takeup-opener spans (これ/だけ). */
const OPENER_TOKENS_MAX = 3;

/** The words a sentence opens with, as whole tokens: そんな, then これ, これだけ, これだけで for これ/だけ/で. */
const openingWords = (tokens: readonly Token[]): Set<string> =>
  new Set(
    tokens.map((_, index) =>
      tokens
        .slice(0, index + 1)
        .map((token) => token.surface)
        .join(""),
    ),
  );

/** The next sentence of the same paragraph opens with words that take up the scene or act this one set (…送れない。そんなときの…, …と書いて送る。これだけで…). */
export const isTakenUp = (next: Sentence | undefined, between: string, openers: readonly LexiconEntry[]): boolean => {
  const tokens = next?.tokens ?? [];
  if (tokens.length === 0 || between.trim() !== "" || between.includes("\n")) return false;
  const opening = openingWords(tokens.slice(0, OPENER_TOKENS_MAX));
  return openers.some((opener) => opening.has(opener.pattern));
};

/** The particles a sentence closes with, joined (か/な → かな), after its last word and before its marks. */
const closingParticles = (tokens: readonly Token[]): string => {
  const words = tokens.filter((token) => token.pos !== "PUNCT" && !TRAILING_MARKS.has(token.surface));
  const start = words.findLastIndex((token) => token.pos !== "PART") + 1;
  return words
    .slice(start)
    .map((token) => token.surface)
    .join("");
};

/**
 * A sentence that closes with a particle of address from address-particle (…含まれているよ。…違うんだよ。…のかな？): the writer speaks
 * to the reader on purpose, in a voice a polite page sets among its sentences, not a slip into the plain register.
 */
export const isAddressed = (sentence: Sentence, particles: readonly LexiconEntry[]): boolean => {
  const closing = closingParticles(sentence.tokens ?? []);
  return closing !== "" && particles.some((particle) => closing.endsWith(particle.pattern));
};

/** A joiner from the list followed straight by a comma (止まるし、). */
const joinsWith = (tokens: readonly Token[], joiners: ReadonlySet<string>): boolean =>
  tokens.some((token, index) => token.pos === "SCONJ" && joiners.has(token.surface) && tokens[index + 1]?.surface === "、");

/**
 * A writer's aside of feeling (ここまでは、まだよかった。動画は止まるし、…と言われる。): the sentence ends on a word of a class from the
 * word-class group of feeling-aside (but not a word of the not-feeling group, 制限なし。), or joins its clauses with a joiner from the
 * joiner group. marks is that word list already narrowed to the document's genre; outside its genres nothing holds.
 */
export const isFeelingAside = (sentence: Sentence, ending: readonly Token[], marks: readonly LexiconEntry[]): boolean => {
  const of = (group: string): Set<string> => new Set(marks.filter((mark) => mark.group === group).map((mark) => mark.pattern));
  const head = ending[0];
  const feels = head !== undefined && of("word-class").has(head.pos ?? "") && !of("not-feeling").has(head.surface);
  return feels || joinsWith(sentence.tokens ?? [], of("joiner"));
};

const EXCLAMATION = /[！!][\s」』）)]*$/u;

/** A sentence closed by an exclamation mark (わかるかっ！！！): a cry in the writer's voice, said plainly in either register. */
export const isExclamation = (sentence: Sentence): boolean => EXCLAMATION.test(sentence.text);
