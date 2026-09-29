import type { Section } from "../plugin.ts";

/** 索引の区切りは 1 文字の見出し（A, あ）で、それ自体は本文を持たない。 */
const SINGLE_LETTER = /^\p{L}$/u;
const FIRST_LETTER = /\p{L}/u;

/** 区切りが 1 つだけなら、たまたま 1 文字の見出しかもしれない。並んで初めて索引と読む。 */
const MIN_DIVIDERS = 2;

/** カタカナとひらがなは Unicode で同じ並びにあり、この差だけ離れている。 */
const KATAKANA = { first: 0x30a1, last: 0x30f6, toHiragana: 0x60 };

type Group = { readonly letter: string; readonly entries: Section[] };

/** 索引で引くときの文字。最初の文字から濁点やアクセントを外し、カタカナはひらがなに、小文字は大文字にする。 */
export const indexLetterOf = (text: string): string => {
  const letter = FIRST_LETTER.exec(text.normalize("NFD"))?.[0] ?? "";
  const code = letter.codePointAt(0) ?? 0;
  const base = code >= KATAKANA.first && code <= KATAKANA.last ? String.fromCodePoint(code - KATAKANA.toHiragana) : letter;
  return base.toUpperCase();
};

const isDivider = (section: Section): boolean => SINGLE_LETTER.test(section.heading.normalize("NFC")) && section.sentences.length === 0;

/** ある深さの区切りごとに、その下の節を集める。区切りと同じ深さか浅い見出しで閉じる。 */
const groupsAt = (sections: readonly Section[], depth: number): Group[] => {
  const groups: Group[] = [];
  sections.reduce<Group | undefined>((open, section) => {
    if (section.depth === depth && isDivider(section)) {
      const group = { letter: indexLetterOf(section.heading), entries: [] };
      groups.push(group);
      return group;
    }
    if (open === undefined || section.depth <= depth) return undefined;
    open.entries.push(section);
    return open;
  }, undefined);
  return groups;
};

const ascending = (groups: readonly Group[]): boolean => groups.every((group, index) => index === 0 || (groups[index - 1]?.letter ?? "") < group.letter);

/** 区切りのすぐ下の見出し（見出し語）の過半が、区切りの文字で始まる。語りの節を 1 文字の見出しで束ねただけなら、こうはならない。 */
const headwordsFollowLetters = (groups: readonly Group[], depth: number): boolean => {
  const matches = groups.flatMap((group) =>
    group.entries.filter((entry) => entry.depth === depth + 1).map((entry) => indexLetterOf(entry.heading) === group.letter),
  );
  return matches.filter((match) => match).length * 2 > matches.length;
};

const isIndex = (groups: readonly Group[], depth: number): boolean =>
  groups.length >= MIN_DIVIDERS && ascending(groups) && headwordsFollowLetters(groups, depth);

/**
 * 文字で区切った索引（用語集・A to Z）の項目。区切りの見出しより深い節が、次の同じ深さ以上の見出しまで続く。
 * 項目は語の定義や表記の決まりで、根拠の要る主張ではない。
 */
export const letteredIndexEntries = (sections: readonly Section[]): ReadonlySet<Section> => {
  const depths = new Set(sections.filter(isDivider).map((section) => section.depth));
  return new Set(
    [...depths].flatMap((depth) => {
      const groups = groupsAt(sections, depth);
      return isIndex(groups, depth) ? groups.flatMap((group) => group.entries) : [];
    }),
  );
};
