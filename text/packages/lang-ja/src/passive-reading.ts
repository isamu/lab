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
  /** 受動を作らない自動詞の原形（来る・取り組む）と、「する」を付けて自動詞になるサ変名詞（参加・辞任）。 */
  readonly intransitive: ReadonlySet<string>;
  /** 「と」を受けて名前を言う動詞の原形（呼ぶ）。 */
  readonly naming: ReadonlySet<string>;
};

const patternsOf = (lexicon: Lexicon | undefined): string[] => (lexicon ?? []).map((entry) => entry.pattern).filter((pattern) => pattern !== "");

export const passiveVocabulary = (lexicons: Readonly<Record<string, Lexicon>>): PassiveVocabulary => ({
  spontaneous: new Set(patternsOf(lexicons["spontaneous-verb"])),
  stative: new Set(patternsOf(lexicons["stative-passive-verb"])),
  formulas: patternsOf(lexicons["honorific-formula"]),
  intransitive: new Set(patternsOf(lexicons["intransitive-verb"])),
  naming: new Set(patternsOf(lexicons["naming-verb"])),
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
  (vocabulary.spontaneous.has(verb.basic_form) && !pastFollows(morphemes, at)) ||
  vocabulary.stative.has(verb.basic_form) ||
  namesSomething(morphemes, at, verb, vocabulary);

/** 「〜と呼ばれる」「〜とも呼ばれています」は名前を言うもので、呼んだ誰かを隠していない。「と」の無い「会議に呼ばれた」は受動。 */
const namesSomething = (morphemes: readonly Morpheme[], at: number, verb: Morpheme, vocabulary: PassiveVocabulary): boolean => {
  if (!vocabulary.naming.has(verb.basic_form)) return false;
  const before = morphemes[at - 2]?.pos_detail_1 === "係助詞" ? morphemes[at - 3] : morphemes[at - 2];
  return before?.pos === "助詞" && before.surface_form === "と";
};

const isSuru = (morpheme: Morpheme | undefined): boolean => morpheme?.pos === "動詞" && morpheme.basic_form === "する";

/**
 * 自動詞には、動作を受ける側を主語にする受動が無い。「来られ」「取り組まれ」「辞任され」は尊敬か可能。
 * 本動詞（動詞,自立）だけを見る。補助動詞の「連れてこられた」は「連れてくる」全体の受動。
 */
const intransitiveVerb = (morphemes: readonly Morpheme[], at: number, vocabulary: PassiveVocabulary): boolean => {
  const verb = morphemes[at - 1];
  if (verb?.pos !== "動詞" || verb.pos_detail_1 !== "自立") return false;
  if (vocabulary.intransitive.has(verb.basic_form)) return true;
  const noun = morphemes[at - 2];
  return isSuru(verb) && noun?.pos_detail_1 === "サ変接続" && vocabulary.intransitive.has(noun.basic_form);
};

/** 「おる」は受動を作らないので、「しておられる」の「れる」は尊敬。 */
const HONORIFIC_BASE = "おる";

/**
 * 形のうえで尊敬と言える「れる/られる」。主語が動作をする人なので、隠れた動作主はいない。
 * 「ご用意された」「お会いされた」の お・ご は見ない。謙譲の「ご用意する」の受動（「資料がご用意されました」）と形が同じ。
 */
const honoursTheDoer = (morphemes: readonly Morpheme[], at: number, vocabulary: PassiveVocabulary): boolean =>
  (morphemes[at - 1]?.pos === "動詞" && morphemes[at - 1]?.basic_form === HONORIFIC_BASE) || intransitiveVerb(morphemes, at, vocabulary);

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

/** morphemes[at] が受動と読める「れる/られる」か。直前の動詞、尊敬の形、囲む決まり文句を見る。 */
export const readsAsPassive = (morphemes: readonly Morpheme[], at: number, vocabulary: PassiveVocabulary): boolean => {
  const morpheme = morphemes[at];
  if (morpheme === undefined || !isPassiveForm(morpheme)) return false;
  const verb = morphemes[at - 1];
  if (verb?.pos === "動詞" && verbReadsOtherwise(morphemes, at, verb, vocabulary)) return false;
  if (honoursTheDoer(morphemes, at, vocabulary)) return false;
  return !insideFormula(morphemes, at, vocabulary.formulas);
};
