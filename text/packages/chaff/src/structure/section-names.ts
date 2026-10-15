import type { StructureNode } from "../plugin.ts";

// 番号で呼ぶ他の法律の手続き。英国の「section 21 notice」は Housing Act 1988 の section 21 の通知で、この文書の section 21 ではない。

/** 参照のすぐ後ろの語。 */
const NEXT_WORD = /^[ \t]+(?<word>\p{L}+)/u;
const LOWER_START = /^\p{Ll}/u;
/** 後ろの語を読む長さ。名前を作る語は短い。 */
const NEXT_WORD_LENGTH = 24;

/**
 * 名前の一部として書かれた番号（「section 21 notice」）の行き先。小文字で書いた参照の後ろに、名前を作る語（語彙表）が続くもの。
 * 大文字の「Section 5 notice」は契約が自分の条を指す書き方なので当たらない。Pure.
 */
export const namedTargets = (references: readonly StructureNode[], source: string, nouns: readonly string[]): ReadonlySet<string> => {
  if (nouns.length === 0) return new Set();
  const names = new Set(nouns);
  return new Set(
    references.flatMap((reference) => {
      const label = String(reference.attrs["label"] ?? "");
      const word = NEXT_WORD.exec(source.slice(reference.span.end, reference.span.end + NEXT_WORD_LENGTH))?.groups?.["word"];
      return LOWER_START.test(label) && word !== undefined && names.has(word) ? [String(reference.attrs["target"] ?? "")] : [];
    }),
  );
};

/**
 * 名前として書かれた番号を指す参照か。小文字で書いた参照（「under section 21」）だけ。同じ文書の大文字の「Section 21」は、
 * 文書が自分の section を指す書き方なので、名前があっても探す。Pure.
 */
export const pointsToNamedSection = (reference: StructureNode, named: ReadonlySet<string>): boolean =>
  LOWER_START.test(String(reference.attrs["label"] ?? "")) && named.has(String(reference.attrs["target"] ?? ""));
