import type { NameMention } from "./name-variants.ts";
import { escapeRegExp } from "./orthography.ts";

// 一語の名前の中で、同じ音を二通りに書く字（桜ヶ丘・桜ケ丘・桜が丘、霞ヶ関・霞が関）。どの字が同じかは語彙表 name-spelling-char が
// 組（group）ごとに言う。漢字に挟まれた字だけを寄せる。かなの語の中の字は寄せない。

/** 字から、その組の代表の字へ。 */
export type SpellingChars = ReadonlyMap<string, string>;

/**
 * 名前の中の同じ音の字を比べる材料。chars はその字の組。alsoWritten は、この比べ方にだけ加える名前の現れ（表の升の名前、解析器が
 * 一語と読まなかった書き方）。升の名前をほかの見方に加えると、表の識別子（contentType）を本文の名前（Content-Type）と比べてしまう。
 */
export type SpellingInput = { readonly chars: SpellingChars; readonly alsoWritten: readonly NameMention[] };

export const NO_SPELLING: SpellingInput = { chars: new Map(), alsoWritten: [] };

const HAN = /^\p{Script=Han}$/u;

const isBetweenHan = (chars: readonly string[], index: number): boolean => HAN.test(chars[index - 1] ?? "") && HAN.test(chars[index + 1] ?? "");

/** 漢字に挟まれた、組のある字の位置。 */
const foldableAt = (chars: readonly string[], spelling: SpellingChars): number[] =>
  chars.flatMap((char, index) => (spelling.has(char) && isBetweenHan(chars, index) ? [index] : []));

/** 漢字に挟まれた組の字を、組の代表に寄せた形。寄せる字が無ければ書いたまま。 */
export const foldSpelling = (surface: string, spelling: SpellingChars): string => {
  const chars = [...surface];
  const at = new Set(foldableAt(chars, spelling));
  return chars.map((char, index) => (at.has(index) ? (spelling.get(char) ?? char) : char)).join("");
};

const replacedAt = (form: readonly string[], index: number, member: string): string[] => form.map((char, at) => (at === index ? member : char));

/** 一つの名前の、組の字を同じ組のほかの字に替えた書き方（桜ヶ丘 から 桜ケ丘 と 桜が丘）。書いたままの形は含まない。 */
export const otherSpellings = (surface: string, spelling: SpellingChars): string[] => {
  const chars = [...surface];
  const members = (char: string): string[] => [...spelling].flatMap(([member, group]) => (group === spelling.get(char) ? [member] : []));
  const forms = foldableAt(chars, spelling).reduce<string[][]>(
    (partial, index) => partial.flatMap((form) => members(chars[index] ?? "").map((member) => replacedAt(form, index, member))),
    [chars],
  );
  return [...new Set(forms.map((form) => form.join("")))].filter((form) => form !== surface);
};

const isHanAt = (source: string, index: number): boolean => HAN.test(source.charAt(index));

/**
 * 解析器が一語と読まなかった書き方（桜が丘 を 桜・が・丘 と読む）。読めた名前の、組の字を替えた形を、本文にそのまま探す。前後が
 * 漢字の所（夜桜が丘）は長い語の一部なので取らない。ほかの名前の現れと重なる所も取らない。
 */
export const literalSpellingsIn = (source: string, mentions: readonly NameMention[], spelling: SpellingChars): NameMention[] => {
  const taken = (start: number, end: number): boolean => mentions.some((mention) => mention.offset < end && start < mention.offset + mention.surface.length);
  const known = new Map(mentions.map((mention) => [mention.surface, mention]));
  return [...known.values()].flatMap((mention) =>
    otherSpellings(mention.surface, spelling)
      .filter((form) => !known.has(form))
      .flatMap((form) =>
        [...source.matchAll(new RegExp(escapeRegExp(form), "gu"))].flatMap((match): NameMention[] => {
          const end = match.index + form.length;
          if (isHanAt(source, match.index - 1) || isHanAt(source, end) || taken(match.index, end)) return [];
          return [{ surface: form, offset: match.index, reading: mention.reading, words: [form] }];
        }),
      ),
  );
};

/** 比べる形。漢字に挟まれた組の字を含む名前だけが、寄せた形を一つ持つ。含まない名前（Content-Type）はこの比べ方に入らない。 */
export const foldedKeysOf = (surface: string, spelling: SpellingChars): string[] =>
  foldableAt([...surface], spelling).length > 0 ? [foldSpelling(surface, spelling)] : [];
