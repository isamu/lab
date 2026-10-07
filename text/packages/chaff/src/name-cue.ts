// 敬称も、解析器の人名の印も無い名前（担当の斎藤です、斉藤までご連絡ください）を、前後の語から人の名前と読む。

/** 人を指す前置き（担当の、私、）、敬称（様、さん）、名前のすぐ後ろに来る語（です、まで）。語彙表から。 */
export type NameCues = { readonly leads: readonly string[]; readonly suffixes: readonly string[]; readonly particles: readonly string[] };

/**
 * person: 人の名前と言える（前に「担当の」、後ろに敬称）。slot: 名前の来る場所（後ろに「です」「まで」）。bare: どちらでもない。
 * 名前の形でないもの（字数が違う、漢字以外を含む、長い漢字の連なりの一部）は undefined。
 */
export type NameCue = "person" | "slot" | "bare";

const MIN_NAME = 2;
const MAX_NAME = 4;
/** 前後の一字を読むのに要る長さ（UTF-16 の単位）。𠮷 は二つ。 */
const SURROGATE_PAIR = 2;
const HAN = /^\p{Script=Han}$/u;

const isHan = (letter: string | undefined): boolean => letter !== undefined && HAN.test(letter);

/**
 * offset から書いた surface を、前後の語で読む。名前は 2〜4 字の漢字で、前後に漢字が続かない（鹿嶋市、株式会社髙橋は地名や会社の名前の
 * 一部）。敬称だけは漢字（様、氏）でも名前のすぐ後ろに続いてよい。
 */
export const nameCueAt = (text: string, offset: number, surface: string, cues: NameCues): NameCue | undefined => {
  const letters = [...surface];
  if (letters.length < MIN_NAME || letters.length > MAX_NAME || !letters.every((letter) => isHan(letter))) return undefined;
  const context = Math.max(SURROGATE_PAIR, ...[...cues.leads, ...cues.suffixes, ...cues.particles].map((word) => word.length));
  const before = text.slice(Math.max(0, offset - context), offset);
  const after = text.slice(offset + surface.length, offset + surface.length + context);
  if (isHan([...before].at(-1))) return undefined;
  if (cues.suffixes.some((suffix) => after.startsWith(suffix))) return "person";
  if (isHan([...after][0])) return undefined;
  if (cues.leads.some((lead) => before.endsWith(lead))) return "person";
  return cues.particles.some((particle) => after.startsWith(particle)) ? "slot" : "bare";
};
