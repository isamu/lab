const LETTER = /\p{L}/u;
const CAPITAL = /\p{Lu}/u;
const DIGIT = /\p{N}/u;
const SYMBOL = /^[\p{Sc}\p{Sm}\p{So}]+$/u;

/** 文字の無い語の品詞。数字があれば数、通貨や数学の記号は記号、ほかは句読点（— や …）。 */
const nonWord = (surface: string): string => {
  if (DIGIT.test(surface)) return "NUM";
  return SYMBOL.test(surface) ? "SYM" : "PUNCT";
};

/**
 * 解析器が固有名詞とした語を、表記で確かめる。wink は知らない語を固有名詞にするが、英語の固有名詞は大文字で書く。
 * 大文字の無い語（linters、json、e.g. の e）は普通名詞、文字の無い語（—、$）は記号。
 */
export const properNounChecked = (surface: string, pos: string): string => {
  if (pos !== "PROPN") return pos;
  if (!LETTER.test(surface)) return nonWord(surface);
  return CAPITAL.test(surface) ? "PROPN" : "NOUN";
};
