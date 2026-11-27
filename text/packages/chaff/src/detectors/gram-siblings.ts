import type { Section, Sentence } from "../plugin.ts";

const DIGITS = new Set("0123456789０１２３４５６７８９");
const NUMBER_CLOSERS = new Set("．.:：");

/** 例に番号を振った節がこれだけ並べば、ひな形に沿って書いた例の並び。 */
const MIN_SIBLINGS = 3;

/** ひな形の語句が一つの節に出る回数の上限。結論の文を言い直すこと（for purchases, the requirement starts …）はある。 */
const PER_SECTION = 2;

type Heading = Pick<Section, "heading" | "sentences">;

type Outlined = Pick<Section, "heading" | "depth" | "sentences">;

/** 番号で終わる見出し（Example 3、事例 2、ケース４）の、番号の前の名前。並んだ節の共通の名前。 */
const stemOf = (heading: string): string | undefined => {
  const chars = [...heading.trim()];
  if (NUMBER_CLOSERS.has(chars.at(-1) ?? "")) chars.pop();
  const digitsAt = chars.findLastIndex((char) => !DIGITS.has(char)) + 1;
  const stem = chars.slice(0, digitsAt).join("").trim().toLowerCase();
  return digitsAt === chars.length || stem === "" ? undefined : stem;
};

/**
 * 例の名前（語彙表 ngram-example-heading: Example、事例）に番号を振った節の並びに入る文と、その文の節。並びに入らない文は持たない。
 * 手順や施策に番号を振った節（手順1、施策2）は書き手が一つずつ書く本文で、ひな形の例ではないので並びにしない。
 */
export const numberedSiblingsOf = (sections: readonly Heading[], exampleNames: readonly string[]): ReadonlyMap<Sentence, Heading> => {
  const names = new Set(exampleNames.map((name) => name.toLowerCase()));
  const byStem = new Map<string, Heading[]>();
  sections.forEach((section) => {
    const stem = stemOf(section.heading);
    if (stem !== undefined && names.has(stem)) byStem.set(stem, [...(byStem.get(stem) ?? []), section]);
  });
  const owners = new Map<Sentence, Heading>();
  [...byStem.values()]
    .filter((siblings) => siblings.length >= MIN_SIBLINGS)
    .forEach((siblings) => siblings.forEach((section) => section.sentences.forEach((sentence) => owners.set(sentence, section))));
  return owners;
};

/** 見出しを比べる形。前後の空白と終わりのコロンを除き、大文字と小文字をそろえる（Description: と description）。 */
const headingKey = (heading: string): string =>
  heading
    .trim()
    .replace(/[:：]$/u, "")
    .replace(/\s+/gu, " ")
    .toLowerCase();

/** 節のすぐ下の小見出しの並び（一段深い節の見出し）。小見出しが無ければ空。 */
const outlineOf = (sections: readonly Outlined[], index: number): string => {
  const depth = sections[index]?.depth ?? 0;
  const after = sections.slice(index + 1);
  const end = after.findIndex((section) => section.depth <= depth);
  return (end === -1 ? after : after.slice(0, end))
    .filter((section) => section.depth === depth + 1)
    .map((section) => headingKey(section.heading))
    .join("\n");
};

/** key ごとに束ねた節のうち、MIN_SIBLINGS 以上並ぶ束。 */
const groupsOf = (sections: readonly Outlined[], keyOf: (section: Outlined, index: number) => string): Outlined[][] => {
  const byKey = new Map<string, Outlined[]>();
  sections.forEach((section, index) => {
    const key = keyOf(section, index);
    if (key !== "") byKey.set(key, [...(byKey.get(key) ?? []), section]);
  });
  return [...byKey.values()].filter((group) => group.length >= MIN_SIBLINGS);
};

/**
 * 同じ形を繰り返す節の文と、その文の節。同じ見出しの節（報告ごとの Description:）と、すぐ下に同じ小見出しを並べた節（名前の見出しの
 * 下に同じ問いを並べた報告）は、項目ごとに一つのひな形を埋めたもの。導入部（見出しの前）は節ではない。
 */
export const repeatedBlocksOf = (sections: readonly Outlined[]): ReadonlyMap<Sentence, Heading> => {
  const headed = (section: Outlined): string => (section.depth >= 1 ? headingKey(section.heading) : "");
  const outlined = (section: Outlined, index: number): string => {
    const outline = section.depth >= 1 ? outlineOf(sections, index) : "";
    return outline === "" ? "" : `${String(section.depth)}\n${outline}`;
  };
  const owners = new Map<Sentence, Heading>();
  [...groupsOf(sections, headed), ...groupsOf(sections, outlined)]
    .flat()
    .forEach((section) => section.sentences.forEach((sentence) => owners.set(sentence, section)));
  return owners;
};

/**
 * ひな形の節（番号を振った例、同じ形を繰り返す節）がそれぞれ一度か二度ずつ持つ語句。例ごとに同じ結び（The digital link requirement
 * starts from …）を置き、報告ごとに同じ書き出し（The mission of … is the creation and maintenance of software related to …）で欄を
 * 埋めるのはひな形で、書き手の言い直しではない。一つの節で何度も繰り返す語句は数え、並びの外の出現が上限を超えれば数える。
 */
export const carriedBySiblings = (sentences: readonly Sentence[], owners: ReadonlyMap<Sentence, Heading>, limit: number): boolean => {
  const sections = sentences.flatMap((sentence) => {
    const owner = owners.get(sentence);
    return owner === undefined ? [] : [owner];
  });
  const counts = new Map<Heading, number>();
  sections.forEach((section) => counts.set(section, (counts.get(section) ?? 0) + 1));
  const outside = sentences.length - sections.length;
  return outside <= limit && counts.size >= MIN_SIBLINGS && [...counts.values()].every((count) => count <= PER_SECTION);
};
