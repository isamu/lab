/**
 * 物を数える「つ」（3つ、三つ、２つ）。IPADIC は算用数字の後ろの「つ」を完了の助動詞（行きつ戻りつの「つ」）と読み、
 * 「三つ」「２つ」は一語の普通の名詞と読む。どちらも「三人」「３人」と同じ、数と助数詞の二語に直す。
 * 完了の「つ」は動詞の後ろにしか付かないので、数の直後の「つ」は助数詞と決まる。
 * 仮名で書いた「ひとつ」「ふたつ」は副詞のようにも使う（ひとつ試す）ので、そのまま。
 */
export type Morpheme = {
  readonly surface_form: string;
  readonly pos: string;
  readonly pos_detail_1: string;
  readonly pos_detail_2: string;
  readonly basic_form: string;
};

const TSU = "つ";

/** 算用数字で終わる数（3、10、２）。漢数字の後ろの「つ」は一語の「三つ」として出るので、ここでは見ない。 */
const ENDS_WITH_DIGIT = /[0-9０-９]$/u;

/** 一語で出る「三つ」「２つ」。「三つ巴」「一つ目」の目は別の語なので、「つ」で終わる語だけ。 */
const COUNT_WORD = /^(?<number>[一二三四五六七八九]|[0-9０-９]+)つ$/u;

/** IPADIC が一語の名詞（爪）と読む「つめ」。数の後ろでは「3つめ」「三つめ」の順番。 */
const TSUME = "つめ";

/** 「つめ」の前の数。漢数字も入る。「三つめ」は 三 と つめ に分かれて出る。 */
const ENDS_WITH_NUMERAL = /[0-9０-９一二三四五六七八九]$/u;

const counter = (): Morpheme => ({ surface_form: TSU, pos: "名詞", pos_detail_1: "接尾", pos_detail_2: "助数詞", basic_form: TSU });

const numeral = (number: string): Morpheme => ({ surface_form: number, pos: "名詞", pos_detail_1: "数", pos_detail_2: "*", basic_form: number });

const ordinalMe = (): Morpheme => ({ surface_form: "め", pos: "名詞", pos_detail_1: "接尾", pos_detail_2: "一般", basic_form: "め" });

const isTsuAuxiliary = (morpheme: Morpheme): boolean => morpheme.pos === "助動詞" && morpheme.surface_form === TSU;

const isDigitNumeral = (morpheme: Morpheme | undefined): boolean =>
  morpheme !== undefined && morpheme.pos === "名詞" && morpheme.pos_detail_1 === "数" && ENDS_WITH_DIGIT.test(morpheme.surface_form);

const isNumeralBeforeTsume = (morpheme: Morpheme | undefined): boolean =>
  morpheme !== undefined && morpheme.pos === "名詞" && morpheme.pos_detail_1 === "数" && ENDS_WITH_NUMERAL.test(morpheme.surface_form);

const isTsume = (morpheme: Morpheme): boolean => morpheme.pos === "名詞" && morpheme.pos_detail_1 === "一般" && morpheme.surface_form === TSUME;

/** 一語で出た「三つ」の数の部分。そう読めなければ undefined。 */
const numberOfCountWord = (morpheme: Morpheme): string | undefined =>
  morpheme.pos === "名詞" && morpheme.pos_detail_1 === "一般" ? COUNT_WORD.exec(morpheme.surface_form)?.groups?.["number"] : undefined;

/** 形態素の並びを受け取り、数と「つ」を数と助数詞の二語に、数の後ろの「つめ」を助数詞と順番の「め」にした並びを返す。ほかの語はそのまま。 */
export const readCounterTsu = (morphemes: readonly Morpheme[]): Morpheme[] =>
  morphemes.flatMap((morpheme, index) => {
    if (isTsuAuxiliary(morpheme) && isDigitNumeral(morphemes[index - 1])) return [counter()];
    if (isTsume(morpheme) && isNumeralBeforeTsume(morphemes[index - 1])) return [counter(), ordinalMe()];
    const number = numberOfCountWord(morpheme);
    return number === undefined ? [morpheme] : [numeral(number), counter()];
  });
