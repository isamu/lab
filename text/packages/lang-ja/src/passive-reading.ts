import type { Lexicon } from "chaffjs/plugin";
import type { Morpheme } from "./counter-tsu.ts";

/**
 * 「れる/られる」は受動・自発・尊敬・可能のどれにもなる。IPADIC はその区別を付けないので、
 * 形のうえで受動でないと言えるものだけを外す。どれにも当たらなければ受動の形として残す。
 */
export type PassiveVocabulary = {
  /** 自発に読む動詞の原形（考える・思う）。 */
  readonly spontaneous: ReadonlySet<string>;
  /** 関係を表す動詞の原形（含む・限る）。 */
  readonly stative: ReadonlySet<string>;
  /** 尊敬の決まり文句（におかれましては）。 */
  readonly formulas: readonly string[];
};

const patternsOf = (lexicon: Lexicon | undefined): string[] => (lexicon ?? []).map((entry) => entry.pattern).filter((pattern) => pattern !== "");

export const passiveVocabulary = (lexicons: Readonly<Record<string, Lexicon>>): PassiveVocabulary => ({
  spontaneous: new Set(patternsOf(lexicons["spontaneous-verb"])),
  stative: new Set(patternsOf(lexicons["stative-passive-verb"])),
  formulas: patternsOf(lexicons["honorific-formula"]),
});

const PASSIVE_LEMMA = new Set(["れる", "られる"]);

/** IPADIC では「れる/られる」は動詞の接尾として出る。 */
export const isPassiveForm = (morpheme: Morpheme): boolean =>
  morpheme.pos === "動詞" && morpheme.pos_detail_1 === "接尾" && PASSIVE_LEMMA.has(morpheme.basic_form);

/** 述語の続き（ます・ている・ておる・てはいない・た）。ここに「た」があれば過去。 */
const LINKING_TE = new Set(["て", "で"]);

/** IPADIC は「てもいた」の「い」を自立の動詞と読む。 */
const ASPECT_VERB = new Set(["いる", "おる"]);

/** 「られ・て・おり・まし・た」のように続く語の数の上限。文書全体の残りを毎回切り出さない。 */
const PREDICATE_REACH = 8;

const continuesPredicate = (morpheme: Morpheme): boolean =>
  morpheme.pos === "助動詞" ||
  (morpheme.pos === "動詞" && (morpheme.pos_detail_1 === "非自立" || ASPECT_VERB.has(morpheme.basic_form))) ||
  (morpheme.pos_detail_1 === "接続助詞" && LINKING_TE.has(morpheme.surface_form)) ||
  morpheme.pos_detail_1 === "係助詞";

const isPast = (morpheme: Morpheme): boolean => morpheme.pos === "助動詞" && morpheme.basic_form === "た";

const pastFollows = (morphemes: readonly Morpheme[], at: number): boolean => {
  const rest = morphemes.slice(at + 1, at + 1 + PREDICATE_REACH);
  const end = rest.findIndex((morpheme) => !continuesPredicate(morpheme));
  return rest.slice(0, end === -1 ? rest.length : end).some(isPast);
};

/**
 * 自発は書き手がいま思うことを言う。過去の「考えられた」「解された」は、会議や裁判所など誰かの考えた動作の受動になる。
 * 補助動詞（動詞,非自立）の後ろは見ない。「務めてこられた」は尊敬でも、「連れてこられた」「持っていかれた」は受動で、形では分けられない。
 */
const verbReadsOtherwise = (morphemes: readonly Morpheme[], at: number, verb: Morpheme, vocabulary: PassiveVocabulary): boolean =>
  (vocabulary.spontaneous.has(verb.basic_form) && !pastFollows(morphemes, at)) || vocabulary.stative.has(verb.basic_form);

const textOf = (morphemes: readonly Morpheme[]): string => morphemes.map((morpheme) => morpheme.surface_form).join("");

/**
 * at の語を覆う決まり文句が、語の区切りから始まっているか。語は 1 文字以上あるので、
 * 決まり文句の文字数だけ前の語までさかのぼれば足りる。文書全体を毎回つなげない。
 */
const insideFormula = (morphemes: readonly Morpheme[], at: number, formulas: readonly string[]): boolean => {
  const reach = Math.max(0, ...formulas.map((formula) => formula.length));
  const from = Math.max(0, at - reach + 1);
  return morphemes.slice(from, at + 1).some((_, offset) => {
    const start = from + offset;
    const lead = textOf(morphemes.slice(start, at)).length;
    const text = textOf(morphemes.slice(start, start + reach));
    return formulas.some((formula) => lead < formula.length && text.startsWith(formula));
  });
};

/** morphemes[at] が受動と読める「れる/られる」か。直前の動詞と、囲む決まり文句を見る。 */
export const readsAsPassive = (morphemes: readonly Morpheme[], at: number, vocabulary: PassiveVocabulary): boolean => {
  const morpheme = morphemes[at];
  if (morpheme === undefined || !isPassiveForm(morpheme)) return false;
  const verb = morphemes[at - 1];
  if (verb?.pos === "動詞" && verbReadsOtherwise(morphemes, at, verb, vocabulary)) return false;
  return !insideFormula(morphemes, at, vocabulary.formulas);
};
