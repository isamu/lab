// Seeded mistakes of single characters for `yarn bench`: katakana pasted in half-width, a zero-width space pasted into a
// sentence, and a space typed before a period. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isProse, rewriteFirst, type Mutation, type Plant } from "./bench-text.ts";

// --- hankaku-kana ---

const HALFWIDTH_KANA = /[ｦ-ﾝ]/u;
const VOICING_MARKS = ["ﾞ", "ﾟ"];

/** 全角の片仮名から半角への表。NFKC が半角を全角にするのを逆に引く。濁点・半濁点の付いた字は二字になる。 */
const TO_HALFWIDTH: ReadonlyMap<string, string> = new Map(
  Array.from({ length: 0xff9d - 0xff66 + 1 }, (_unused, at) => String.fromCodePoint(0xff66 + at)).flatMap((half): [string, string][] => [
    [half.normalize("NFKC"), half],
    ...VOICING_MARKS.map((mark): [string, string] => [`${half}${mark}`.normalize("NFKC"), `${half}${mark}`]).filter(([full]) => full.length === 1),
  ]),
);

const KATAKANA_WORD = /[ァ-ヴー]{3,}/u;

const toHalfwidth = (word: string): string => [...word].map((char) => TO_HALFWIDTH.get(char) ?? char).join("");

/** 最初の三字以上の片仮名の語を半角にする。古いシステムから貼り付けた語。 */
export const halfwidthKatakana = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !line.includes("`") && !line.includes("「") && KATAKANA_WORD.test(line),
    (line) => {
      const rewritten = line.replace(KATAKANA_WORD, toHalfwidth);
      return HALFWIDTH_KANA.test(rewritten) ? rewritten : undefined;
    },
  );

// --- invisible-character ---

const ZERO_WIDTH_SPACE = "\u200B";

/** 日本語の字の並び、または英語の語の真ん中。 */
const JAPANESE_PAIR = /[ぁ-んァ-ヶ一-龠]{2}/u;
const ENGLISH_WORD = /\b[a-z]{6,}\b/u;

/** 最初の文の行の、語の途中にゼロ幅の空白を入れる。Web ページから貼り付けた文。 */
export const zeroWidthSpace = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !line.includes("`") && (isJapanese(line) ? JAPANESE_PAIR.test(line) : ENGLISH_WORD.test(line)),
    (line) => {
      const pattern = isJapanese(line) ? JAPANESE_PAIR : ENGLISH_WORD;
      return line.replace(pattern, (word) => `${word.slice(0, 1)}${ZERO_WIDTH_SPACE}${word.slice(1)}`);
    },
  );

// --- space-before-punctuation ---

const WORD_THEN_PERIOD = /(\p{L})\.(\s|$)/u;

/** 英文の最初の文の終わりの点の前に空白を入れる。 */
export const spaceBeforePeriod = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !isJapanese(line) && !line.includes("`") && !line.includes("http") && WORD_THEN_PERIOD.test(line),
    (line) => line.replace(WORD_THEN_PERIOD, "$1 .$2"),
  );

export const CHARACTER_MUTATIONS: readonly Mutation[] = [
  { id: "kana-halfwidth", rule: "hankaku-kana", languages: ["ja"], plant: halfwidthKatakana },
  { id: "zero-width-pasted", rule: "invisible-character", languages: ["ja", "en"], plant: zeroWidthSpace },
  { id: "period-spaced", rule: "space-before-punctuation", languages: ["en"], plant: spaceBeforePeriod },
];
