const LETTER = /\p{L}/u;
const CAPITAL = /\p{Lu}/u;
const SMALL = /\p{Ll}/u;
const DIGIT = /\p{N}/u;
const SYMBOL = /^[\p{Sc}\p{Sm}\p{So}]+$/u;

/** 文字の無い語の品詞。数字があれば数、通貨や数学の記号は記号、ほかは句読点（— や …）。 */
const nonWord = (surface: string): string => {
  if (DIGIT.test(surface)) return "NUM";
  return SYMBOL.test(surface) ? "SYM" : "PUNCT";
};

/**
 * 解析器が固有名詞とした語を、表記で確かめる。wink は知らない語を固有名詞にするが、英語の固有名詞は大文字で書く。
 * 小文字だけで書いた語（linters、json、e.g. の e）は普通名詞、文字の無い語（—、$）は記号。大文字の無い文字（東京）の語は確かめようがないので触れない。
 */
export const properNounChecked = (surface: string, pos: string): string => {
  if (pos !== "PROPN") return pos;
  if (!LETTER.test(surface)) return nonWord(surface);
  return SMALL.test(surface) && !CAPITAL.test(surface) ? "NOUN" : "PROPN";
};

/** 解析器が返す 1 語。pos は Penn Treebank。 */
type TaggedWord = { readonly value: string; readonly pos: string; readonly lemma?: string };

const PROPER_TAG = new Set(["NNP", "NNPS"]);

/** 頭の一字だけが大文字の語（Containers、Such）。文頭の大文字はこの形になる。API や iPhone は名前の書き方なので含めない。 */
const CAPITALISED = /^\p{Lu}\p{Ll}+$/u;

/** 解析器の語彙に、その語が普通の語として載っているか。一度でも固有名詞として載っていれば（may の May）、名前かもしれない。 */
const isCommonWord = (tags: readonly string[] | undefined): boolean => tags !== undefined && tags.length > 0 && !tags.some((tag) => PROPER_TAG.has(tag));

/**
 * 文頭で大文字になっただけの普通の語の位置。無ければ -1。
 * wink は大文字で始まる名詞と形容詞をすべて固有名詞にするので、Containers are … の Containers も Traditional servers … の Traditional も固有名詞になる。
 * 文頭の大文字は英語の書き方で、名前の印ではない。解析器の語彙が小文字の形を普通の語として知っていれば、名前ではなくその語として読む。
 * 語彙に無い語（Kubernetes、Congress）と、文の途中の大文字の語は名前のまま。
 */
export const sentenceInitialCommonWord = (tagged: readonly TaggedWord[], tagsOf: (word: string) => readonly string[] | undefined): number => {
  const at = tagged.findIndex((entry) => LETTER.test(entry.value));
  const first = tagged[at];
  if (first === undefined || !PROPER_TAG.has(first.pos) || !CAPITALISED.test(first.value)) return -1;
  return isCommonWord(tagsOf(first.value.toLowerCase())) ? at : -1;
};

/** 文の中の最初の word を小文字にした文。word が文に無ければ undefined。 */
export const lowercasedAt = (text: string, word: string | undefined): string | undefined => {
  const start = word === undefined ? -1 : text.indexOf(word);
  if (word === undefined || start === -1) return undefined;
  return `${text.slice(0, start)}${word.toLowerCase()}${text.slice(start + word.length)}`;
};

/**
 * at の語の品詞と原形を、小文字にして解析し直した結果（again）から取る。表層は元のまま。
 * 解析し直した文の同じ位置に、同じ語の小文字が無ければ、語の切り方が変わったので元のまま。
 */
export const rereadAt = (entries: readonly TaggedWord[], at: number, again: readonly TaggedWord[]): readonly TaggedWord[] => {
  const entry = entries[at];
  const reread = again[at];
  if (entry === undefined || reread === undefined || reread.value !== entry.value.toLowerCase()) return entries;
  const word: TaggedWord = { value: entry.value, pos: reread.pos, ...(reread.lemma === undefined ? {} : { lemma: reread.lemma }) };
  return entries.map((original, index) => (index === at ? word : original));
};
