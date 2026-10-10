const LATIN_WORD = /^\p{Script=Latin}+$/u;
const WORD_CHAR = /[\p{L}\p{N}]/u;
/** 単位のすぐ後ろに、数（空白一つまで）か、ハイフンでつながる語が続く。 */
const CONTINUED = /^(?:[ \t]?[0-9０-９]|-[\p{L}\p{N}])/u;

const isLatinWord = (word: string): boolean => LATIN_WORD.test(word);

/** 英字の語が、語として行にあるか（"x" は "box" の中では数えない）。 */
const hasWord = (line: string, word: string): boolean => {
  let from = line.indexOf(word);
  while (from !== -1) {
    const end = from + word.length;
    if (!WORD_CHAR.test(line.charAt(from - 1)) && !WORD_CHAR.test(line.charAt(end))) return true;
    from = line.indexOf(word, from + 1);
  }
  return false;
};

/** 単位に要る文脈の語が、行にどれかあるか。英字の語は語として探し、ほかの字（オーブン、×）は字の並びとして探す。大文字と小文字は区別しない。 */
export const lineHasContext = (line: string, words: readonly string[]): boolean => {
  const lowered = line.toLowerCase();
  return words.some((word) => {
    const target = word.toLowerCase();
    return isLatinWord(target) ? hasWord(lowered, target) : lowered.includes(target);
  });
};

/**
 * 文脈の要る英字の単位（"in"）は、その言語のふつうの語でもある。単位として読むのは、語がそこで終わり（"5 interns" の in ではない）、
 * 後ろに数もハイフンでつながる語も続かない（"1 in 3"、"2-in-1"）ときだけ。文脈の要らない単位と、英字でない単位（度）は、この形を見ない。
 */
export const standsAsUnitWord = (pattern: string, needsContext: boolean, after: string): boolean => {
  if (!needsContext || !isLatinWord(pattern)) return true;
  return !WORD_CHAR.test(after.charAt(0)) && !CONTINUED.test(after);
};
