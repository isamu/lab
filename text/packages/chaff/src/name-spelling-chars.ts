import type { NameMention } from "./name-variants.ts";

// 一語の名前の中で、同じ音を二通りに書く字（桜ヶ丘・桜ケ丘・桜が丘、霞ヶ関・霞が関）。どの字が同じかは語彙表 name-spelling-char が
// 組（group）ごとに言う。漢字に挟まれた字だけを寄せる。かなの語の中の字は寄せない。名前は解析器が一語と読んだもの
// （霞が関）に限る。桜・が・丘 と読む書き方を本文にそのまま探すと、助詞の が（桜が丘を彩る）を名前と取り違える。

/** 字から、その組の代表の字へ。 */
export type SpellingChars = ReadonlyMap<string, string>;

/**
 * 名前の中の同じ音の字を比べる材料。chars はその字の組。alsoWritten は、この比べ方にだけ加える名前の現れ（表の升の名前）。升の名前をほかの見方に加えると、表の識別子（contentType）を本文の名前（Content-Type）と比べてしまう。人の名前の読みの見方だけは、升の人の名前を本文の同じ書き方の数に足す。
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

/** 比べる形。漢字に挟まれた組の字を含む名前だけが、寄せた形を一つ持つ。含まない名前（Content-Type）はこの比べ方に入らない。 */
export const foldedKeysOf = (surface: string, spelling: SpellingChars): string[] =>
  foldableAt([...surface], spelling).length > 0 ? [foldSpelling(surface, spelling)] : [];
