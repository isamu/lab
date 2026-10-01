import type { Lexicon, Token } from "chaffjs/plugin";

/**
 * 名詞を重ねて「それぞれの」を言う形（会社会社で、チームチームの）。重ねられるのは、まとまりや場合を指す名詞だけで、
 * 後ろに助詞が続く。二つ目の名詞に UD の Echo=Rdp を付ける。二字以上の和語・漢語の重なりは isWholeWordEcho も拾うので、
 * ここが要るのは外来語（チーム）と一字の語（国）。
 */
export type Distributive = { readonly nouns: ReadonlySet<string>; readonly particles: ReadonlySet<string> };

const patternsOf = (lexicon: Lexicon | undefined): ReadonlySet<string> => new Set((lexicon ?? []).map((entry) => entry.pattern));

export const distributiveVocabulary = (lexicons: Readonly<Record<string, Lexicon>>): Distributive => ({
  nouns: patternsOf(lexicons["distributive-noun"]),
  particles: patternsOf(lexicons["distributive-particle"]),
});

const isSameNoun = (first: Token | undefined, second: Token, nouns: ReadonlySet<string>): boolean =>
  first !== undefined &&
  first.pos === "NOUN" &&
  second.pos === "NOUN" &&
  first.surface === second.surface &&
  first.span.end === second.span.start &&
  nouns.has(second.surface);

const isParticleAfter = (next: Token | undefined, second: Token, particles: ReadonlySet<string>): boolean =>
  next !== undefined && next.pos === "ADP" && next.span.start === second.span.end && particles.has(next.surface);

const echoed = (token: Token): Token => ({ ...token, features: { ...token.features, Echo: "Rdp" } });

const isDistributive = (tokens: readonly Token[], index: number, vocabulary: Distributive): boolean => {
  const token = tokens[index];
  return token !== undefined && isSameNoun(tokens[index - 1], token, vocabulary.nouns) && isParticleAfter(tokens[index + 1], token, vocabulary.particles);
};

/** 文字列を解析器が一語の副詞と読むか。解析器を持つ index.ts が渡す。 */
export type ReadsAsAdverb = (text: string) => boolean;

/** 一字の漢字に 々 を付けて畳語になるか（家 → 家々）。解析器の辞書と語彙表を持つ index.ts が渡す。 */
export type TakesIterationMark = (kanji: string) => boolean;

/**
 * 解析器の辞書が 々 付きの一語として持つ漢字（家々・国々）と、辞書に無い畳語の漢字（朝々・神々）の語彙表。
 * readsAsOneWord は解析器を持つ index.ts が渡す。
 */
export const iterationMarkReading = (lexicons: Readonly<Record<string, Lexicon>>, readsAsOneWord: (text: string) => boolean): TakesIterationMark => {
  const listed = patternsOf(lexicons["iteration-kanji"]);
  return (kanji) => listed.has(kanji) || readsAsOneWord(`${kanji}々`);
};

const CONTENT_WORD = new Set(["NOUN", "VERB", "ADJ"]);

/** 助動詞が付く語。 */
const PREDICATE = new Set(["VERB", "ADJ", "AUX"]);

/**
 * 助動詞の重なりは、前に付く述語が無ければ解析器が仮名の擬音を切った片割れ（たんたらたら → たん・たら・たら）。
 * 述語に付いた重なり（行ったたので・着いたらたら）は書き損じ。
 */
const isStrandedAuxiliary = (before: Token | undefined, first: Token): boolean => first.pos === "AUX" && (before === undefined || !PREDICATE.has(before.pos));

/**
 * 重ね言葉の副詞（がんがん）は、前の語に引かれると同じ名詞二つに切られる（労働者ががんがん → が・がん・がん）。
 * 二語を続けて読み直して一語の副詞なら、重ね言葉。機能語の重なりは、付く先の無い助動詞のほかは読み直さない。
 * 書き損じの「行ったたので」の「たた」も一語の副詞に読める。
 */
const isSplitAdverb = (tokens: readonly Token[], index: number, readsAsAdverb: ReadsAsAdverb): boolean => {
  const [before, first, second] = [tokens[index - 2], tokens[index - 1], tokens[index]];
  return (
    first !== undefined &&
    second !== undefined &&
    first.surface === second.surface &&
    first.pos === second.pos &&
    (CONTENT_WORD.has(second.pos) || isStrandedAuxiliary(before, first)) &&
    first.span.end === second.span.start &&
    readsAsAdverb(`${first.surface}${second.surface}`)
  );
};

const ONE_KANJI = /^\p{Script=Han}$/u;

const isKanjiNoun = (token: Token | undefined): token is Token =>
  token !== undefined && token.pos === "NOUN" && ONE_KANJI.test(token.surface) && token.features?.["NumType"] !== "Card";

/**
 * 一字の漢字の名詞を 々 を使わずに重ねた畳語（家家・朝朝）。々 を付けて畳語になる漢字だけ。
 * 略称を重ねた「法法」は 法々 と書けないので、書き損じのまま。
 */
const isIteratedKanji = (tokens: readonly Token[], index: number, takesIterationMark: TakesIterationMark): boolean => {
  const [first, second] = [tokens[index - 1], tokens[index]];
  return (
    isKanjiNoun(first) && isKanjiNoun(second) && first.surface === second.surface && first.span.end === second.span.start && takesIterationMark(second.surface)
  );
};

export const markReduplication = (
  tokens: readonly Token[],
  vocabulary: Distributive,
  readsAsAdverb: ReadsAsAdverb,
  takesIterationMark: TakesIterationMark,
): Token[] =>
  tokens.map((token, index) =>
    isDistributive(tokens, index, vocabulary) || isSplitAdverb(tokens, index, readsAsAdverb) || isIteratedKanji(tokens, index, takesIterationMark)
      ? echoed(token)
      : token,
  );

/** 解析器が読んだ一語。pos は IPADIC の品詞、detail はその細分類、form は活用形、conjugation は活用型（活用しない語はどちらも *）。 */
export type Inflection = {
  readonly surface: string;
  readonly pos: string;
  readonly detail: string;
  readonly form: string;
  readonly conjugation: string;
  readonly start: number;
};

/** 文を終えずに後ろへ続く形。連用形（連用テ接続・連用タ接続を含む）と命令形。 */
const CONTINUING_FORM = /^(?:連用|命令)/u;

/** 一文字の語（し・い）は重ねて強める形にならない。「確認ししました」は書き損じ。 */
const MIN_ECHO_LENGTH = 2;

/** IPADIC で細分類が「自立」なのは動詞と形容詞だけで、活用形を持つ。 */
const continuesAsWord = (word: Inflection | undefined): word is Inflection =>
  word !== undefined && word.detail === "自立" && word.surface.length >= MIN_ECHO_LENGTH && CONTINUING_FORM.test(word.form);

const GODAN = /^五段/u;

/**
 * 語尾として続く語。助動詞が続く重なり（できできます）は語幹の書き損じ。接続助詞も同じだが、五段動詞の連用形（売り・行き）は
 * 語幹に音を足した形なので、「て」を続けた重ね言葉（売り売りて・行き行きて）になる。一段動詞の連用形（でき）は語幹そのもの。
 */
const isEnding = (next: Inflection | undefined, echo: Inflection): boolean =>
  next !== undefined && (next.pos === "助動詞" || (next.detail === "接続助詞" && !GODAN.test(echo.conjugation)));

const touches = (first: Inflection, second: Inflection): boolean => first.start + first.surface.length === second.start;

/**
 * 自立の動詞・形容詞を、連用形か命令形のまま重ねた形（泣き泣き・売り売り・長く長く・待て待て）は重ね言葉。二つ目に Echo=Rdp。
 * 解析器は一つ目を別の活用に読むことがある（待て待て の一つ目は「待てる」の連用形）ので、形は二つとも続く形であればよい。
 * 終止形の重なり（行く行く）、非自立の語（くださいください）、語尾が続く重なり（できできます）は書き損じのまま。
 */
export const isInflectedEcho = (words: readonly Inflection[], index: number): boolean => {
  const [first, second] = [words[index - 1], words[index]];
  return continuesAsWord(first) && continuesAsWord(second) && first.surface === second.surface && touches(first, second) && !isEnding(words[index + 1], second);
};

/** 片仮名の語はたいてい外来語（ユーザー・データ）で、重ねれば書き損じ。 */
const HIRAGANA = /^[\p{Script=Hiragana}ー]+$/u;

/** 解析器が擬音・擬態語の切れ端に当てる品詞。助詞・助動詞の重なり（のの・ですです）は書き損じ。 */
const FREE_WORD = new Set(["名詞", "動詞", "形容詞"]);

/** 接尾語が付く語。 */
const HOST = new Set(["名詞", "動詞", "形容詞", "助動詞"]);

/** 拍に数えない小さい仮名（ちょ・しゃ・ティ）。 */
const SMALL_KANA = /[ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ]/gu;

/** 擬音・擬態語の根は二拍（すう・きし・ちょん）。動詞に読まれた重なりは二拍までが擬音で、長い動詞の重なり（できるできる）は書き損じ。 */
const MIMETIC_ROOT_MORAE = 2;

const moraeOf = (text: string): number => text.length - (text.match(SMALL_KANA)?.length ?? 0);

const fitsMimeticRoot = (word: Inflection): boolean => word.pos !== "動詞" || moraeOf(word.surface) <= MIMETIC_ROOT_MORAE;

const isKanaWord = (word: Inflection | undefined): word is Inflection =>
  word !== undefined &&
  word.surface.length >= MIN_ECHO_LENGTH &&
  HIRAGANA.test(word.surface) &&
  FREE_WORD.has(word.pos) &&
  word.detail !== "非自立" &&
  fitsMimeticRoot(word);

/** 前の語に付いた接尾語（田中さん・見られ）。読点の後ろの「しだい」は付く先が無く、解析器が擬態語を切った片割れ。 */
const isAttachedSuffix = (before: Inflection | undefined, word: Inflection): boolean =>
  word.detail === "接尾" && before !== undefined && HOST.has(before.pos) && touches(before, word);

/**
 * 擬音・擬態語は副詞として立つ。後ろに「と」「に」が続くか、行が終わる（歌の行末。解析器は改行を「記号,空白」と読む）。
 * 句読点の前は、動詞の書き損じ（できるできる、）と見分けられない。
 */
const ADVERB_MARK = new Set(["と", "に"]);

const endsAsAdverb = (second: Inflection, next: Inflection | undefined): boolean =>
  next === undefined || !touches(second, next) || next.detail === "空白" || (next.pos === "助詞" && ADVERB_MARK.has(next.surface));

/**
 * 平仮名だけの語を丸ごと重ねた形（きしきし・ちょんちょん・すうすう・しだいしだい・あはれあはれ）は擬音・擬態語か感動詞。
 * 解析器は辞書に無い擬音を、表層の合う名詞や動詞に切って読む（すう = 吸う）ので、品詞ではなく平仮名であることと、副詞の位置に立つことで見分ける。
 * 前の語に付いた接尾語（田中さんさん）と、副詞の位置に立たない動詞の重なり（できるできるように）は書き損じのまま。名詞の重なりは isWholeWordEcho が見る。
 */
export const isKanaEcho = (words: readonly Inflection[], index: number): boolean => {
  const [before, first, second] = [words[index - 2], words[index - 1], words[index]];
  return (
    isKanaWord(first) &&
    isKanaWord(second) &&
    first.surface === second.surface &&
    touches(first, second) &&
    !isAttachedSuffix(before, first) &&
    endsAsAdverb(second, words[index + 1])
  );
};

/** 名詞の細分類のうち、それだけでは語にならないもの（こと・の、さん・的、数）。 */
const DEPENDENT_NOUN = new Set(["非自立", "接尾", "数"]);

const isContentNoun = (word: Inflection): boolean => word.pos === "名詞" && !DEPENDENT_NOUN.has(word.detail);

/** 言い切りの形の形容詞（えらい・若い）。続く形（長く長く）は isInflectedEcho が見る。 */
const isPlainAdjective = (word: Inflection): boolean => word.pos === "形容詞" && word.detail === "自立" && word.form === "基本形";

/** 二つ目の名詞は、解析器が前の名詞に付く接尾語と読むことがある（好き好き・嫌い嫌い の二つ目）。 */
const isWholeWordPair = (first: Inflection, second: Inflection): boolean =>
  (isContentNoun(first) && second.pos === "名詞") || (isPlainAdjective(first) && isPlainAdjective(second));

const KATAKANA = /^[\p{Script=Katakana}ー]+$/u;

/** 擬音・擬態語の根の拍の数（ムク・ブイ・ゴロン・ブー）。 */
const MIMETIC_UNIT = { fewest: 2, most: 3 } as const;

/** 伸ばす音が根の途中にある語（データ）は外来語。擬音の伸ばす音は根の終わりに来る（ブーブー）。 */
const INNER_LONG_VOWEL = /ー./u;

const isMimeticUnit = (surface: string): boolean => {
  const morae = moraeOf(surface);
  return morae >= MIMETIC_UNIT.fewest && morae <= MIMETIC_UNIT.most && !INNER_LONG_VOWEL.test(surface);
};

/** 片仮名の語はたいてい外来語（ユーザー・データ）で、重ねれば書き損じ。擬音の形（ムクムク・ブイブイ）だけは重ね言葉。 */
const isLoanword = (surface: string): boolean => KATAKANA.test(surface) && !isMimeticUnit(surface);

const sameAndTouching = (first: Inflection | undefined, second: Inflection | undefined): boolean =>
  first !== undefined && second !== undefined && first.surface === second.surface && touches(first, second);

/**
 * 内容語（名詞・形容詞）を丸ごと重ねた形は畳語か強め（個人個人・一行一行・駄目駄目・えらいえらい・それそれ・もちもち）。
 * 書き損じは付属語の重なり（をを・たた）か語の切れ端なので、語が丸ごと二度なら重ね言葉と読む。
 * 一字の漢字（法法・金金）は isIteratedKanji、外来語（ユーザーユーザー）と三つ続く重なり（早め早め早め）は書き損じのまま。
 */
export const isWholeWordEcho = (words: readonly Inflection[], index: number): boolean => {
  const [before, first, second] = [words[index - 2], words[index - 1], words[index]];
  return (
    first !== undefined &&
    second !== undefined &&
    isWholeWordPair(first, second) &&
    sameAndTouching(first, second) &&
    first.surface.length >= MIN_ECHO_LENGTH &&
    !isLoanword(first.surface) &&
    !sameAndTouching(before, first)
  );
};

const ONE_KANA = /^[\p{Script=Hiragana}\p{Script=Katakana}]$/u;

/**
 * 同じ一字の仮名が三つ以上続く並び（ははは・あははは・ふふふ）は笑い声か擬音。解析器は一字ずつ助詞などに切る。
 * 二つだけの重なり（をを・たた・よよ・かか）は書き損じのまま。
 */
export const isKanaRepeat = (words: readonly Inflection[], index: number): boolean => {
  const [before, first, second, after] = [words[index - 2], words[index - 1], words[index], words[index + 1]];
  return (
    second !== undefined &&
    ONE_KANA.test(second.surface) &&
    sameAndTouching(first, second) &&
    (sameAndTouching(before, first) || sameAndTouching(second, after))
  );
};

/** 活用した語・仮名の語・内容語の重なりか、一字の仮名の三つ以上の並び。pos.ts が二つ目に Echo=Rdp を付ける。 */
export const isEchoAt = (words: readonly Inflection[], index: number): boolean =>
  isInflectedEcho(words, index) || isKanaEcho(words, index) || isWholeWordEcho(words, index) || isKanaRepeat(words, index);
