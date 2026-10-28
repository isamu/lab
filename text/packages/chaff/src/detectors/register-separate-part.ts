import type { Section, Sentence } from "../plugin.ts";

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
