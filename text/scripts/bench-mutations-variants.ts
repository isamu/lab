// Seeded mistakes of one word written two ways for `yarn bench`: a word the sample writes in kana, written once in kanji. Pure.
import { linesOf, proseAt, replaceLine, type Mutation, type Plant } from "./bench-text.ts";

/** A kana spelling and the kanji spelling of the same word, with what may follow it (できます, できない; ことが, ことを). */
type Respelling = { readonly kana: RegExp; readonly kanji: string };

const RESPELLINGS: readonly Respelling[] = [
  { kana: /でき(?=[るまなた])/gu, kanji: "出来" },
  { kana: /(?<=[るたいう])こと(?=[がをはもに])/gu, kanji: "事" },
  { kana: /(?<=て)ください/gu, kanji: "下さい" },
];

/** The minority must stay at most a third of the word's uses, so the sample has to write it in kana three times or more. */
const MIN_USES = 3;

const plantFor = (lines: readonly string[], prose: (index: number) => boolean, { kana, kanji }: Respelling): Plant | undefined => {
  const uses = lines.flatMap((line, at) => (prose(at) ? [...line.matchAll(kana)].map(() => at) : []));
  const index = uses.at(-1);
  if (uses.length < MIN_USES || index === undefined || lines.some((line) => line.includes(kanji))) return undefined;
  const line = lines[index] ?? "";
  const last = [...line.matchAll(kana)].at(-1);
  if (last === undefined) return undefined;
  return { source: replaceLine(lines, index, `${line.slice(0, last.index)}${kanji}${line.slice(last.index + last[0].length)}`), line: index + 1 };
};

/** The last kana use of a word the sample writes in kana three times or more, written in kanji (できます becomes 出来ます). */
export const kanjiOnce = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const prose = proseAt(lines);
  return RESPELLINGS.reduce<Plant | undefined>((found, respelling) => found ?? plantFor(lines, prose, respelling), undefined);
};

export const VARIANT_MUTATIONS: readonly Mutation[] = [{ id: "kanji-once", rule: "orthographic-variant", languages: ["ja"], plant: kanjiOnce }];
