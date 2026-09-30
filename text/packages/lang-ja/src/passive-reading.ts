import type { Lexicon } from "chaffjs/plugin";
import type { Morpheme } from "./counter-tsu.ts";

/**
 * 「れる/られる」は受動・自発・尊敬・可能のどれにもなる。IPADIC はその区別を付けないので、
 * 形のうえで受動でないと言えるものだけを外す。どれにも当たらなければ受動の形として残す。
 */
export type PassiveVocabulary = {
  /** 自発に読む動詞の原形（考える・思う）。 */
  readonly spontaneous: ReadonlySet<string>;
  /** 状態・決まり・文書の中身を言う動詞の原形とサ変名詞（含む・定める・適用・記載）。 */
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

/** at の「れる/られる」に続く述語の語（ます・ている・た）。述語の外の最初の語は含まない。 */
const predicateAfter = (morphemes: readonly Morpheme[], at: number): readonly Morpheme[] => {
  const rest = morphemes.slice(at + 1, at + 1 + PREDICATE_REACH);
  const end = rest.findIndex((morpheme) => !continuesPredicate(morpheme));
  return rest.slice(0, end === -1 ? rest.length : end);
};

const pastFollows = (morphemes: readonly Morpheme[], at: number): boolean => predicateAfter(morphemes, at).some(isPast);

const isAspect = (morpheme: Morpheme): boolean => morpheme.pos === "動詞" && ASPECT_VERB.has(morpheme.basic_form);

/** 「た」で終わる出来事の述語。「適用された」は誰かが適用した動作、「記載されていた」は過去の状態。 */
const eventPastFollows = (morphemes: readonly Morpheme[], at: number): boolean => {
  const predicate = predicateAfter(morphemes, at);
  return predicate.some(isPast) && !predicate.some(isAspect);
};

/**
 * 自発は書き手がいま思うことを言う。過去の「考えられた」「解された」は、会議や裁判所など誰かの考えた動作の受動になる。
 * 補助動詞（動詞,非自立）の後ろは見ない。「務めてこられた」は尊敬でも、「連れてこられた」「持っていかれた」は受動で、形では分けられない。
 */
const verbReadsOtherwise = (morphemes: readonly Morpheme[], at: number, verb: Morpheme, vocabulary: PassiveVocabulary): boolean =>
  (vocabulary.spontaneous.has(verb.basic_form) && !pastFollows(morphemes, at)) ||
  statesSomething(morphemes, at, vocabulary) ||
  namesSomething(morphemes, at, verb, vocabulary) ||
  withoutRa(verb, morphemes[at]) ||
  cannotBeDone(morphemes, at, verb);

/**
 * 状態・決まり・文書の中身を言う受動（「適用される」「定められている」「記載されている」）。サ変名詞は「する」の前で見る。
 * 「た」で終わる出来事（「適用された」「定められた」）は、誰かがした動作の受動として残す。
 */
const statesSomething = (morphemes: readonly Morpheme[], at: number, vocabulary: PassiveVocabulary): boolean =>
  lemmasBefore(morphemes, at).some((lemma) => vocabulary.stative.has(lemma)) && !eventPastFollows(morphemes, at);

const isSuru = (morpheme: Morpheme | undefined): boolean => morpheme?.pos === "動詞" && morpheme.basic_form === "する";

/** 「れる/られる」の直前の動詞の原形と、それが「する」ならその前のサ変名詞（「適用される」の適用）。 */
const lemmasBefore = (morphemes: readonly Morpheme[], at: number): string[] => {
  const verb = morphemes[at - 1];
  const noun = morphemes[at - 2];
  if (verb === undefined) return [];
  return isSuru(verb) && noun?.pos_detail_1 === "サ変接続" ? [verb.basic_form, noun.basic_form] : [verb.basic_form];
};

/**
 * 一段動詞の受動は「られる」で作る（「変えられる」）。一段動詞に直に付いた「れる」は、ら抜きの可能（「見れる」）か、
 * 「とらえれいただければ」のような誤字を解析器が受動と読んだもの。
 */
const withoutRa = (verb: Morpheme, passive: Morpheme | undefined): boolean => verb.conjugated_type === "一段" && passive?.basic_form === "れる";

const NEGATION = new Set(["ない", "ぬ"]);

const isNegation = (morpheme: Morpheme | undefined): boolean => morpheme?.pos === "助動詞" && NEGATION.has(morpheme.basic_form);

/**
 * 一段動詞の「られる」は受動と可能が同じ形。打ち消しが直に続くと可能に読む（「他人は変えられない」「質問に答えられず」）。
 * 「ている」を挟んだ「変えられていない」は、まだ変えていない状態の受動として残す。
 */
const cannotBeDone = (morphemes: readonly Morpheme[], at: number, verb: Morpheme): boolean => verb.conjugated_type === "一段" && isNegation(morphemes[at + 1]);

/** 「〜と呼ばれる」「〜とも呼ばれています」は名前を言うもので、呼んだ誰かを隠していない。「と」の無い「会議に呼ばれた」は受動。 */
const namesSomething = (morphemes: readonly Morpheme[], at: number, verb: Morpheme, vocabulary: PassiveVocabulary): boolean => {
  if (!vocabulary.naming.has(verb.basic_form)) return false;
  const before = morphemes[at - 2]?.pos_detail_1 === "係助詞" ? morphemes[at - 3] : morphemes[at - 2];
  return before?.pos === "助詞" && before.surface_form === "と";
};

/**
 * 自動詞には、動作を受ける側を主語にする受動が無い。「来られ」「取り組まれ」「辞任され」は尊敬か可能。
 * 本動詞（動詞,自立）だけを見る。補助動詞の「連れてこられた」は「連れてくる」全体の受動。
 */
const intransitiveVerb = (morphemes: readonly Morpheme[], at: number, vocabulary: PassiveVocabulary): boolean => {
  const verb = morphemes[at - 1];
  if (verb?.pos !== "動詞" || verb.pos_detail_1 !== "自立") return false;
  return lemmasBefore(morphemes, at).some((lemma) => vocabulary.intransitive.has(lemma));
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

/**
 * 述語を従える接続助詞のうち、仮定の節を作るもの。逆接の「が」「けど」は入れない。「確認されていないが、」は起きたことを言い切っている。
 */
const CONDITIONAL = new Set(["ば", "と"]);

/** 「見直されなければならない」「図られなければなりません」の「ば」は仮定ではなく義務の言い方の一部。 */
const OBLIGATION = new Set(["なる", "いける"]);

const isObligation = (morpheme: Morpheme | undefined): boolean => morpheme?.pos === "動詞" && OBLIGATION.has(morpheme.basic_form);

/** 受動が仮定の節の述語か。「立証されれば」「整理されていると」は起きたことではなく、その前提。 */
const inConditionalClause = (morphemes: readonly Morpheme[], at: number): boolean => {
  const end = at + 1 + predicateAfter(morphemes, at).length;
  const next = morphemes[end];
  return next?.pos_detail_1 === "接続助詞" && CONDITIONAL.has(next.basic_form) && !isObligation(morphemes[end + 1]);
};

/** 受動の連用形に付いて、起きやすさ・起こりうることを言う語（「理解されやすい」「開催されづらい」「解釈され得る」「放置されがち」）。 */
const TENDENCY = new Set(["やすい", "にくい", "づらい", "得る", "うる", "がち"]);

const isTendency = (morpheme: Morpheme | undefined): boolean => morpheme !== undefined && TENDENCY.has(morpheme.basic_form);

/**
 * 受動の「れる/られる」が、文の報告する動作の外にあるか。仮定の節と、起きやすさを言う形は、誰かが実際にした動作を言っていない。
 * 隠れた動作主を問うのは、文末や「〜され、」で続く述語の受動のほう。
 */
export const outsideTheReport = (morphemes: readonly Morpheme[], at: number): boolean => isTendency(morphemes[at + 1]) || inConditionalClause(morphemes, at);
