// Keys that make two Japanese spellings of one word meet: the reading of the dictionary form (出来る and できる are both デキル),
// the kanji a spelling keeps (引っ越し and 引越し both keep 引越), and a katakana word with its small kana and ー evened out
// (ウィンドウ and ウインドウ). Pure: the tokens come in from the language adapter.

const HIRAGANA_TO_KATAKANA = 0x60;
const HIRAGANA = /[ぁ-ゖ]/gu;
const KANA_ONLY = /^[ぁ-ゖァ-ヺー]+$/u;
const KANJI = /[\p{Script=Han}々]/gu;

/** Hiragana as katakana, the script the adapter reads in. */
export const toKatakana = (text: string): string => text.replace(HIRAGANA, (char) => String.fromCodePoint((char.codePointAt(0) ?? 0) + HIRAGANA_TO_KATAKANA));

export const isKanaOnly = (text: string): boolean => KANA_ONLY.test(text);

/** The kanji of a spelling, in order: 引越 for both 引っ越し and 引越し, nothing for できる. */
export const kanjiSkeleton = (text: string): string => [...text.matchAll(KANJI)].map((match) => match[0]).join("");

/**
 * Whether a spelling is the kanji alone of a word the others spell with okurigana: 取扱 beside 取扱い, 締切 beside 締切り. Official
 * Japanese drops okurigana at the head of a compound (取扱事業者) and keeps it on the word alone, so the two are one convention.
 */
export const dropsOkurigana = (spelling: string, spellings: readonly string[]): boolean =>
  spelling !== "" && kanjiSkeleton(spelling) === spelling && spellings.some((other) => other !== spelling && kanjiSkeleton(other) === spelling);

const KANJI_OR_KANA_RUN = /[\p{Script=Han}々]|[^\p{Script=Han}々]+/gu;

/**
 * Whether a spelling writes in kana part of the word another spells with more kanji (かたくり粉 beside 片栗粉, とり扱い beside
 * 取り扱い): every kanji it keeps stands where the other has it, each kana run stands for something there, and the other keeps
 * more kanji. Only the letters are compared; the caller has already matched the readings.
 */
export const isKanaForKanji = (partial: string, full: string): boolean => {
  const kept = kanjiSkeleton(partial);
  if (kept === "" || kept === partial || [...kanjiSkeleton(full)].length <= [...kept].length) return false;
  const pattern = [...partial.matchAll(KANJI_OR_KANA_RUN)].map(([part]) => (kanjiSkeleton(part) === part ? part : ".+")).join("");
  return new RegExp(`^${pattern}$`, "u").test(full);
};

/**
 * The kanji a spelling is keyed by among spellings of one reading: its own, or, when it writes part of the word in kana
 * (かたくり粉), the kanji of the spelling with more kanji it stands for (片栗粉). When it could stand for two (two words of one
 * reading), its own.
 */
export const kanjiKeyAmong = (spelling: string, spellings: readonly string[]): string => {
  const fuller = new Set(spellings.filter((other) => isKanaForKanji(spelling, other)).map(kanjiSkeleton));
  const [only] = fuller;
  return fuller.size === 1 && only !== undefined ? only : kanjiSkeleton(spelling);
};

/** The length, in UTF-16 units, of the start both strings share, compared character by character (𠮟 is one character, two units). */
const sharedPrefixLength = (left: string, right: string): number => {
  const [leftChars, rightChars] = [[...left], [...right]];
  const differs = leftChars.findIndex((char, at) => rightChars[at] !== char);
  const shared = differs === -1 ? leftChars.slice(0, rightChars.length) : leftChars.slice(0, differs);
  return shared.join("").length;
};

/**
 * The reading of the dictionary form, from the reading of the written form: 下さい (クダサイ) with lemma 下さる reads クダサル.
 * The written form and the lemma differ only in their kana ending, so that ending is swapped in the reading. When the ending is
 * not kana, or the reading does not end with it (来 read キ for 来る), there is no answer.
 */
export const lemmaReading = (surface: string, lemma: string, reading: string): string | undefined => {
  const shared = sharedPrefixLength(surface, lemma);
  const [writtenEnd, lemmaEnd] = [surface.slice(shared), lemma.slice(shared)];
  if ((writtenEnd !== "" && !isKanaOnly(writtenEnd)) || (lemmaEnd !== "" && !isKanaOnly(lemmaEnd))) return undefined;
  const spoken = toKatakana(writtenEnd);
  if (!reading.endsWith(spoken)) return undefined;
  return reading.slice(0, reading.length - spoken.length) + toKatakana(lemmaEnd);
};

const SMALL_TO_LARGE: Readonly<Record<string, string>> = { ァ: "ア", ィ: "イ", ゥ: "ウ", ェ: "エ", ォ: "オ", ヵ: "カ", ヶ: "ケ", ヮ: "ワ" };
const VU: Readonly<Record<string, string>> = { ヴァ: "バ", ヴィ: "ビ", ヴェ: "ベ", ヴォ: "ボ", ヴ: "ブ" };

/** A katakana word with ー dropped, small vowels made large, ヴ read as バ行 and エイ as エ: インターフェース and インタフェイス meet. */
export const katakanaKey = (surface: string): string =>
  surface
    .replace(/ヴ[ァィェォ]?/gu, (match) => VU[match] ?? match)
    .replace(/[ァィゥェォヵヶヮ]/gu, (char) => SMALL_TO_LARGE[char] ?? char)
    .replace(/ー/gu, "")
    .replace(/エイ/gu, "エ");
