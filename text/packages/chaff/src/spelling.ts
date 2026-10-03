// 辞書に無い語と、一字違いの言い直し。純粋な関数だけを置く。辞書と、語尾・接頭辞の知識は言語パッケージが渡す。

/** 語尾の置き換え 1 つ。suffix を外して replacement を足すと辞書の語（carried → carry）。 */
export type Suffix = { readonly suffix: string; readonly replacement: string };

/**
 * 語を辞書で引くのに要るもの。words は語の集まりの並び（辞書と、語彙表やチームの足した語）で、どれかにあれば載っている語。
 * 大きい辞書を文書ごとに写さないよう、集まりは足し合わせずに並べる。suffixes は語尾、prefixes は接頭辞。
 */
export type Speller = { readonly words: ReadonlyArray<ReadonlySet<string>>; readonly suffixes: readonly Suffix[]; readonly prefixes: readonly string[] };

const inLists = (word: string, speller: Speller): boolean => speller.words.some((list) => list.has(word));

/** 語幹がこれより短くなる外し方はしない。"bed" を "b" + "ed" と読まない。 */
const MIN_STEM = 2;

/** 語尾を外した語幹。外した後ろに同じ子音が二つ並べば一つ減らした形も（stopped → stopp → stop）。 */
const stemsOf = (word: string, suffixes: readonly Suffix[]): string[] =>
  suffixes.flatMap(({ suffix, replacement }) => {
    if (!word.endsWith(suffix) || word.length - suffix.length < MIN_STEM) return [];
    const stem = word.slice(0, word.length - suffix.length);
    const doubled = stem.length > MIN_STEM && stem.at(-1) === stem.at(-2) ? [stem.slice(0, -1)] : [];
    return [`${stem}${replacement}`, ...doubled];
  });

const isListed = (word: string, speller: Speller): boolean => inLists(word, speller) || stemsOf(word, speller.suffixes).some((stem) => inLists(stem, speller));

const isPrefixed = (word: string, speller: Speller): boolean =>
  speller.prefixes.some((prefix) => word.startsWith(prefix) && word.length - prefix.length >= MIN_STEM && isListed(word.slice(prefix.length), speller));

/** 辞書の語か。そのままか、語尾を外すか、接頭辞を一つ外して（語尾も外して）辞書にあれば知っている語。 */
export const isKnownWord = (word: string, speller: Speller): boolean => isListed(word, speller) || isPrefixed(word, speller);

const LETTERS = [..."abcdefghijklmnopqrstuvwxyz"];

/** 一字違いの形。入れ替え（recieve → receive）、置き換え、抜け、余分の順。同じ形は一度だけ。 */
export const editsOf = (word: string): string[] => {
  const at = [...Array(word.length + 1).keys()];
  const swaps = at.slice(0, -2).map((index) => `${word.slice(0, index)}${word.charAt(index + 1)}${word.charAt(index)}${word.slice(index + 2)}`);
  const replaced = at.slice(0, -1).flatMap((index) => LETTERS.map((letter) => `${word.slice(0, index)}${letter}${word.slice(index + 1)}`));
  const dropped = at.slice(0, -1).map((index) => `${word.slice(0, index)}${word.slice(index + 1)}`);
  const inserted = at.flatMap((index) => LETTERS.map((letter) => `${word.slice(0, index)}${letter}${word.slice(index)}`));
  return [...new Set([...swaps, ...replaced, ...dropped, ...inserted])].filter((edit) => edit !== word && edit !== "");
};

/**
 * 辞書に無い語の、一字違いの語。言い直しに出すのは辞書にそのまま載る語だけ（語尾や接頭辞を足して作った語は、辞書が
 * 知っていても言い直しとしては確かでない）。文書がほかで使っている語を先に、次に頭の字を変えない語を（打ち間違いは語の頭に少ない。
 * pipline は hipline でなく pipeline）、その中で編集の順（入れ替えが先）。一字違いの語が無ければ undefined（言い直しを示せない語は、
 * 誤りか新しい語か決められないので言わない）。
 */
export const suggestionFor = (word: string, speller: Speller, used: ReadonlySet<string>): string | undefined => {
  const rankOf = (edit: string): number => (used.has(edit) ? 0 : 1) * 2 + (edit.charAt(0) === word.charAt(0) ? 0 : 1);
  const listed = editsOf(word).filter((edit) => inLists(edit, speller) || used.has(edit));
  return listed.toSorted((left, right) => rankOf(left) - rankOf(right))[0];
};

/** 本文の中の、確かめる英字の語 1 つ。offset は渡した文字列の中の位置。 */
export type CheckedWord = { readonly offset: number; readonly word: string };

/**
 * 確かめる語。小文字だけで書いた英字の語で、ほかの語・番号・記号に続かないもの。大文字を含む語（固有名詞、略語、文頭の語）、
 * 数字や下線を含む語、アポストロフィとハイフンの前後（don't、co-operate）、文字参照（&mdash;）、ファイル名やドメインの一部（index.html の index）、
 * URL とメールの中、maxLength より長い字の並び（符号化したデータ）は見ない。
 */
const WORD = /(?<![\p{L}\p{N}_./@#&'’\\-])[a-z]+(?![\p{L}\p{N}_/@'’-]|\.[\p{L}\p{N}])/gu;
/** 空白で区切った一続きの字。URL（://）、www. で始まるもの、メール（@）は丸ごと語として読まない。 */
const CHUNK = /\S+/gu;
const isAddress = (chunk: string): boolean => chunk.includes("://") || chunk.includes("@") || chunk.startsWith("www.");

const addressSpans = (text: string): Array<readonly [number, number]> =>
  [...text.matchAll(CHUNK)].filter((match) => isAddress(match[0])).map((match) => [match.index, match.index + match[0].length]);

export const wordsToCheck = (text: string, minLength: number, maxLength: number): CheckedWord[] => {
  const addresses = addressSpans(text);
  return [...text.matchAll(WORD)]
    .filter(
      (match) => match[0].length >= minLength && match[0].length <= maxLength && !addresses.some(([start, end]) => match.index >= start && match.index < end),
    )
    .map((match) => ({ offset: match.index, word: match[0] }));
};
