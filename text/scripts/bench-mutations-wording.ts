// Seeded mistakes of wording and notation for `yarn bench`: a number typed in full-width, a hedging double negative
// added to a paragraph, and a potential form with its ら dropped. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "./bench-text.ts";

// --- fullwidth-alnum-consistency ---

const NUMBER = /(?<![\d.,:/-])\d{2,}(?![\d.,:/-])/u;
const NUMBERS = /(?<![\d.,:/-])\d{2,}(?![\d.,:/-])/gu;

/** 半角の数字が二桁以上の並びで三つ以上ある文書の、最初の本文の行の数を全角にする。別の文書から貼り付けた数。 */
const FULLWIDTH_OFFSET = 0xfee0;
const MIN_NUMBERS = 3;

const toFullwidth = (digits: string): string => digits.replace(/\d/gu, (digit) => String.fromCodePoint((digit.codePointAt(0) ?? 0) + FULLWIDTH_OFFSET));

export const fullwidthNumber = (source: string): Plant | undefined => {
  if ((source.match(NUMBERS) ?? []).length < MIN_NUMBERS) return undefined;
  return rewriteFirst(
    source,
    (line) => isProse(line) && !isListItem(line) && isJapanese(line) && !line.includes("`") && !line.includes("http") && NUMBER.test(line),
    (line) => line.replace(NUMBER, toFullwidth),
  );
};

// --- double-negative ---

const HEDGES: Readonly<Record<string, string>> = { ja: "反対しないわけではありません。", en: "Delays are not uncommon." };

/** 最初の本文の段落の終わりに、言い切らない一文を足す。 */
const hedgeIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${HEDGES[language] ?? ""}`,
    );

// --- ra-nuki ---

/** 一段動詞の語幹の終わり（い段・え段の仮名）に付いた「られる」「られます」。 */
const RARERU = /([いきぎしじちにひびみりえけげせぜてでねへべめれ見])られ(る|ます)/u;

/** 最初の「見られる」「確かめられる」を、ら抜きの形（見れる、確かめれる）にする。 */
export const dropRa = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !line.includes("「") && RARERU.test(line),
    (line) => line.replace(RARERU, "$1れ$2"),
  );

export const WORDING_MUTATIONS: readonly Mutation[] = [
  { id: "number-fullwidth", rule: "fullwidth-alnum-consistency", languages: ["ja"], plant: fullwidthNumber },
  { id: "hedge-double-negative-ja", rule: "double-negative", languages: ["ja"], plant: hedgeIn("ja") },
  { id: "hedge-double-negative-en", rule: "double-negative", languages: ["en"], plant: hedgeIn("en") },
  { id: "ra-dropped", rule: "ra-nuki", languages: ["ja"], plant: dropRa },
];
