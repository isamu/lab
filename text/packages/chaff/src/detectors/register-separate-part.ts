import type { Paragraph, Section, Sentence } from "../plugin.ts";

// A document that holds two texts under two top-level headings (a directive, then the agency's page about it) may write each in
// its own register. A part whose sentences all share the register the rest of the document does not use is a text of its own,
// not a slip in the other. Pure.

/** The depth of a top-level heading: a part of the document starts at each one. */
const PART_DEPTH = 1;

/** One sentence alone in the other register may still be a slip; a part is read as its own text from two on. */
const MIN_SENTENCES = 2;

/** The sentences of each part opened by a top-level heading, in order, when the document has two such parts or more. */
const partsOf = (sections: readonly Section[]): Sentence[][] => {
  const parts = sections.reduce<Sentence[][]>((found, section) => {
    if (section.depth === PART_DEPTH) return [...found, [...section.sentences]];
    const last = found.at(-1);
    if (section.depth > PART_DEPTH && last !== undefined) last.push(...section.sentences);
    return found;
  }, []);
  return parts.length >= 2 ? parts : [];
};

/**
 * The sentences of every top-level part whose counted sentences (registerOf gives a register) are MIN_SENTENCES or more and all
 * in one register other than majority, the register of the document as a whole.
 */
export const separatePartSentences = <R>(
  sections: readonly Section[],
  registerOf: (sentence: Sentence) => R | undefined,
  majority: R | undefined,
): Set<Sentence> =>
  new Set(
    partsOf(sections).flatMap((sentences) => {
      const registers = sentences.flatMap((sentence) => {
        const register = registerOf(sentence);
        return register === undefined ? [] : [register];
      });
      const own = registers.length >= MIN_SENTENCES && registers.every((register) => register === registers[0] && register !== majority);
      return own ? sentences : [];
    }),
  );

/** A paragraph that holds no sentence with a register: a line of links or labels (第1, 第2), as a page lays out under the text it carries. */
const isRegisterless = <R>(paragraph: Paragraph, registerOf: (sentence: Sentence) => R | undefined): boolean =>
  paragraph.sentences.length > 0 && paragraph.sentences.every((sentence) => registerOf(sentence) === undefined);

/**
 * The page's own note after the text it carries, without a heading of its own (a directive in である, then ※…ご覧ください。, a line of
 * links, and なお、…ありません。): every counted sentence after the last one in the majority register, when they are MIN_SENTENCES or
 * more, all in one other register that no sentence before them uses, and a paragraph between the first and the last of them holds no counted sentence. Without
 * that line the end of the document is the text's own closing; sentences are the document's in order, lists included; with the other register used earlier too, the end is not a part of its
 * own, and setting it apart would leave the earlier sentences a smaller minority to be pointed at.
 */
export const trailingPartSentences = <R>(
  sentences: readonly Sentence[],
  paragraphs: readonly Paragraph[],
  registerOf: (sentence: Sentence) => R | undefined,
  majority: R | undefined,
): Set<Sentence> => {
  const counted = sentences.filter((sentence) => registerOf(sentence) !== undefined);
  const lastMajority = counted.findLastIndex((sentence) => registerOf(sentence) === majority);
  if (majority === undefined || lastMajority < 0) return new Set();
  const tail = counted.slice(lastMajority + 1);
  const registers = tail.map(registerOf);
  const before = counted.slice(0, lastMajority + 1);
  const ownRegister =
    tail.length >= MIN_SENTENCES && registers.every((register) => register === registers[0]) && before.every((sentence) => registerOf(sentence) === majority);
  const from = tail[0]?.span.end ?? 0;
  const to = tail.at(-1)?.span.start ?? 0;
  const setOff = paragraphs.some((paragraph) => paragraph.span.start >= from && paragraph.span.end <= to && isRegisterless(paragraph, registerOf));
  return ownRegister && setOff ? new Set(tail) : new Set();
};
