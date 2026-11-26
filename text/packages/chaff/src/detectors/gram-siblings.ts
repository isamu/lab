import type { Section, Sentence } from "../plugin.ts";

const DIGITS = new Set("0123456789０１２３４５６７８９");
const NUMBER_CLOSERS = new Set("．.:：");

/** 同じ名前に番号を振った節がこれだけ並べば、ひな形に沿って書いた節の並び（例の並び、事例の並び）。 */
const MIN_SIBLINGS = 3;

/** ひな形の語句が一つの節に出る回数の上限。結論の文を言い直すこと（for purchases, the requirement starts …）はある。 */
const PER_SECTION = 2;

type Heading = Pick<Section, "heading" | "sentences">;

/** 番号で終わる見出し（Example 3、事例 2、ケース４）の、番号の前の名前。並んだ節の共通の名前。 */
const stemOf = (heading: string): string | undefined => {
  const chars = [...heading.trim()];
  if (NUMBER_CLOSERS.has(chars.at(-1) ?? "")) chars.pop();
  const digitsAt = chars.findLastIndex((char) => !DIGITS.has(char)) + 1;
  const stem = chars.slice(0, digitsAt).join("").trim().toLowerCase();
  return digitsAt === chars.length || stem === "" ? undefined : stem;
};

/** 番号を振った節の並びに入る文と、その文の節。並びに入らない文は持たない。 */
export const numberedSiblingsOf = (sections: readonly Heading[]): ReadonlyMap<Sentence, Heading> => {
  const byStem = new Map<string, Heading[]>();
  sections.forEach((section) => {
    const stem = stemOf(section.heading);
    if (stem !== undefined) byStem.set(stem, [...(byStem.get(stem) ?? []), section]);
  });
  const owners = new Map<Sentence, Heading>();
  [...byStem.values()]
    .filter((siblings) => siblings.length >= MIN_SIBLINGS)
    .forEach((siblings) => siblings.forEach((section) => section.sentences.forEach((sentence) => owners.set(sentence, section))));
  return owners;
};

/**
 * 番号を振った節（Example 1、Example 2 …）がそれぞれ一度か二度ずつ持つ語句。例ごとに同じ結び（The digital link requirement
 * starts from …）を置くのはひな形で、書き手の言い直しではない。並びの外にも出る語句と、一つの節で何度も繰り返す語句は数える。
 */
export const carriedBySiblings = (sentences: readonly Sentence[], owners: ReadonlyMap<Sentence, Heading>): boolean => {
  const sections = sentences.map((sentence) => owners.get(sentence));
  if (sections.some((section) => section === undefined)) return false;
  const counts = new Map<Heading | undefined, number>();
  sections.forEach((section) => counts.set(section, (counts.get(section) ?? 0) + 1));
  return counts.size >= MIN_SIBLINGS && [...counts.values()].every((count) => count <= PER_SECTION);
};
