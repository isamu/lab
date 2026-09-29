import type { Section } from "../plugin.ts";

/** 索引の区切りは 1 文字の見出し（A, あ）で、それ自体は本文を持たない。 */
const SINGLE_LETTER = /^\p{L}$/u;

/** 区切りが 1 つだけなら、たまたま 1 文字の見出しかもしれない。並んで初めて索引と読む。 */
const MIN_DIVIDERS = 2;

const isDivider = (section: Section): boolean => SINGLE_LETTER.test(section.heading) && section.sentences.length === 0;

const ascending = (dividers: readonly Section[]): boolean => {
  const letters = dividers.map((divider) => divider.heading.toUpperCase());
  return letters.every((letter, index) => index === 0 || (letters[index - 1] ?? "") < letter);
};

/** 区切りが複数あり、文書の順に文字の順で並ぶ深さ。 */
const indexDepths = (sections: readonly Section[]): ReadonlySet<number> => {
  const dividers = sections.filter(isDivider);
  const depths = [...new Set(dividers.map((divider) => divider.depth))];
  return new Set(
    depths.filter((depth) => {
      const atDepth = dividers.filter((divider) => divider.depth === depth);
      return atDepth.length >= MIN_DIVIDERS && ascending(atDepth);
    }),
  );
};

/**
 * 文字で区切った索引（用語集・A to Z）の項目。区切りの見出しより深い節が、次の同じ深さ以上の見出しまで続く。
 * 項目は語の定義や表記の決まりで、根拠の要る主張ではない。
 */
export const letteredIndexEntries = (sections: readonly Section[]): ReadonlySet<Section> => {
  const depths = indexDepths(sections);
  const entries = new Set<Section>();
  sections.reduce<number | undefined>((openDepth, section) => {
    if (openDepth !== undefined && section.depth > openDepth) {
      entries.add(section);
      return openDepth;
    }
    return depths.has(section.depth) && isDivider(section) ? section.depth : undefined;
  }, undefined);
  return entries;
};
