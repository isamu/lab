import { createRequire } from "node:module";
import type { Token } from "chaffjs/plugin";
import { straightApostrophes } from "./apostrophe.ts";
import { loadLexicons } from "./lexicons.ts";
import { blankLongRuns } from "./long-runs.ts";
import { lowercasedAt, properNounChecked, rereadAt, sentenceInitialCommonWord } from "./proper-noun.ts";
import { isStativeParticiple, stativeVocabulary } from "./stative-participle.ts";
import { isEmphasisedAdverb } from "./emphasis.ts";

const require = createRequire(import.meta.url);

/** wink は CommonJS で、辞書を同期に持つ。初期化は 130 ms ほど。 */
type Tagged = { readonly value: string; readonly pos: string; readonly lemma?: string };

type Tagger = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isCallable = (value: unknown): value is (...args: readonly unknown[]) => unknown => typeof value === "function";

const isTagged = (value: unknown): value is Tagged => isRecord(value) && typeof value["value"] === "string" && typeof value["pos"] === "string";

const toArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

/** 取り出した関数をそのまま呼ぶと receiver が外れる。wink の tagSentence は自分の状態を読む。 */
const callMethod = (owner: Record<string, unknown>, name: string, args: readonly unknown[]): unknown => {
  const method: unknown = owner[name];
  if (!isCallable(method)) throw new Error(`wink-pos-tagger が ${name} を持っていません`);
  return Reflect.apply(method, owner, args);
};

const build = (): Tagger => {
  const factory: unknown = require("wink-pos-tagger");
  if (!isCallable(factory)) throw new Error("wink-pos-tagger が関数を export していません");
  const tagger: unknown = factory();
  if (!isRecord(tagger)) throw new Error("wink-pos-tagger が object を返しませんでした");
  return tagger;
};

/**
 * Penn Treebank を UPOS に寄せる。detector にアダプタ固有の体系を見せない。spec §6。
 * 引けなかったものは X。誤った品詞を当てるより、分からないと言うほうがまし。
 */
const BY_TAG: Readonly<Record<string, string>> = {
  CC: "CCONJ",
  CD: "NUM",
  DT: "DET",
  EX: "PRON",
  FW: "X",
  IN: "ADP",
  JJ: "ADJ",
  JJR: "ADJ",
  JJS: "ADJ",
  MD: "AUX",
  NN: "NOUN",
  NNS: "NOUN",
  NNP: "PROPN",
  NNPS: "PROPN",
  PDT: "DET",
  POS: "PART",
  PRP: "PRON",
  PRP$: "PRON",
  RB: "ADV",
  RBR: "ADV",
  RBS: "ADV",
  RP: "ADP",
  SYM: "SYM",
  TO: "PART",
  UH: "INTJ",
  VB: "VERB",
  VBD: "VERB",
  VBG: "VERB",
  VBN: "VERB",
  VBP: "VERB",
  VBZ: "VERB",
  WDT: "DET",
  WP: "PRON",
  WP$: "PRON",
  WRB: "ADV",
};

const PUNCTUATION = new Set([".", ",", ":", "(", ")", "``", "''", "#", "$"]);

export const upos = (tag: string): string => (PUNCTUATION.has(tag) ? "PUNCT" : (BY_TAG[tag] ?? "X"));

/**
 * 受動は be + 過去分詞。過去分詞だけでは完了形（has reviewed）と見分けられないので、
 * 直前の be を見る。間に副詞が挟まる（was quickly approved）ぶんだけ遡る。
 */
/**
 * be と過去分詞の間に立てるもの。副詞と、副詞をつなぐ接続詞（was fully and carefully reviewed）。
 *
 * これでも拾えない形がある。`was fully and finally approved` では wink が `approved` を
 * VBN ではなく **VBD** と付けるため、そもそも過去分詞として見えない。解析器の限界で、
 * VBD も受動と見なすと `The team was here and approved it` まで受動になる。直さない。
 */
const SKIPPABLE = new Set(["RB", "RBR", "RBS", "CC", ","]);

const BE = new Set(["be", "am", "is", "are", "was", "were", "been", "being"]);

const isBe = (entry: Tagged): boolean => BE.has(entry.lemma ?? entry.value.toLowerCase()) || BE.has(entry.value.toLowerCase());

/** 過去分詞の前の be の位置。無ければ -1。 */
const beBefore = (tagged: readonly Tagged[], at: number): number => {
  const head = tagged.slice(0, at).findLastIndex((entry) => !SKIPPABLE.has(entry.pos));
  const entry = tagged[head];
  return entry !== undefined && isBe(entry) ? head : -1;
};

/**
 * 関係節の中で名詞を修飾しているだけの受動。日本語の predicateOnly と同じ判断で、英語は修飾が名詞の後ろに来る。
 * 「the report that was published」は動作主を隠しているのではなく名詞の説明なので、書き手に直す余地がない。
 * 文の述語の受動（The decision was made.）は残す。名詞の後ろの being（the request being closed）は
 * 動名詞の主語であることも多く、関係節と見分けられないので残す。
 */
const AUXILIARY_CHAIN = new Set(["RB", "RBR", "RBS", "MD"]);

const HAVE = new Set(["have", "has", "had", "having"]);

const isAuxiliary = (entry: Tagged): boolean => AUXILIARY_CHAIN.has(entry.pos) || isBe(entry) || HAVE.has(entry.value.toLowerCase());

/** 関係代名詞の前に立って、それが指す語。the report / those / anything。 */
const NOMINAL_TAG = new Set(["NN", "NNS", "NNP", "NNPS", "PRP", "CD", "DT"]);

const RELATIVE_TAG = new Set(["WDT", "WP"]);

const inRelativeClause = (tagged: readonly Tagged[], be: number): boolean => {
  const lead = tagged.slice(0, be).findLastIndex((entry) => !isAuxiliary(entry));
  const relative = tagged[lead];
  if (relative === undefined || !RELATIVE_TAG.has(relative.pos)) return false;
  // 文頭の That was decided. / Which was chosen? は、前に指す名詞が無いので述語。
  const antecedent = tagged.slice(0, lead).findLast((entry) => entry.pos !== ",");
  return antecedent !== undefined && NOMINAL_TAG.has(antecedent.pos);
};

const LEXICONS = loadLexicons();

const STATIVE = stativeVocabulary(LEXICONS);

const isPassive = (tagged: readonly Tagged[], at: number): boolean => {
  if (tagged[at]?.pos !== "VBN") return false;
  const be = beBefore(tagged, at);
  return be !== -1 && !inRelativeClause(tagged, be) && !isStativeParticiple(tagged, at, STATIVE);
};

const wordsOf = (name: string): ReadonlySet<string> => new Set((LEXICONS[name] ?? []).map((entry) => entry.pattern.toLowerCase()));

const ARTICLES = wordsOf("article");

/** 目的語にも所有にもなる語（give her the book / her book）。解析器はいつも PRP$ と付けるので、所有とは言えない。 */
const OBJECT_OR_POSSESSIVE = wordsOf("object-or-possessive");

const POSSESSIVE_TAG = new Set(["PRP$", "WP$"]);

type Features = { features?: Readonly<Record<string, string>> };

/** 冠詞（PronType=Art）と所有の語（Poss=Yes）は、名詞の前に一つしか立たない。二つ並ぶ our the platform は書き損じ。 */
const determinerFeatures = (entry: Tagged): Features => {
  if (POSSESSIVE_TAG.has(entry.pos)) return OBJECT_OR_POSSESSIVE.has(entry.value.toLowerCase()) ? {} : { features: { Poss: "Yes" } };
  return entry.pos === "DT" && ARTICLES.has(entry.value.toLowerCase()) ? { features: { PronType: "Art" } } : {};
};

/** 複数形の名詞は UD の Number=Plur。数の語がそれを数えていれば（five minutes）、one of のような言い回しではなく量。 */
const PLURAL_TAG = new Set(["NNS", "NNPS"]);

const nounOrDeterminerFeatures = (entry: Tagged): Features => (PLURAL_TAG.has(entry.pos) ? { features: { Number: "Plur" } } : determinerFeatures(entry));

const COMMON_NOUN_TAG = new Set(["NN", "NNS"]);
const NOUN_TAG = new Set(["NN", "NNS", "NNP", "NNPS"]);
const ADJECTIVE_TAG = new Set(["JJ", "JJR", "JJS"]);

/**
 * 解析器が一つに決めた読みの、ほかの読み。名詞と付けた語が動詞にもなる（works / report）なら AlsoVerb=Yes、
 * 形容詞と付けた語が名詞にもなる（individual / key）なら AlsoNoun=Yes。an individual works は名詞と動詞とも読める。
 * 語彙に無い名詞・形容詞（tribunal / stimuli）は、品詞も単数・複数も解析器が形から当てたものなので Guess=Yes。
 */
const otherReading = (entry: Tagged): Readonly<Record<string, string>> => {
  const tags = state.vocabulary(entry.value.toLowerCase());
  if (tags === undefined) return NOUN_TAG.has(entry.pos) || ADJECTIVE_TAG.has(entry.pos) ? { Guess: "Yes" } : {};
  if (COMMON_NOUN_TAG.has(entry.pos) && tags.some((tag) => tag.startsWith("VB"))) return { AlsoVerb: "Yes" };
  return ADJECTIVE_TAG.has(entry.pos) && tags.some((tag) => COMMON_NOUN_TAG.has(tag)) ? { AlsoNoun: "Yes" } : {};
};

const withOtherReading = (entry: Tagged, found: Features): Features => {
  const other = otherReading(entry);
  return Object.keys(other).length === 0 ? found : { features: { ...found.features, ...other } };
};

/**
 * 過去分詞は VerbForm=Part。Based on the review, のような分詞の導入句を、命令形の並び（fix the parser, ship it）と見分ける。
 * -ing 形は VerbForm=Ger。解析器は動名詞と現在分詞を分けないので、過去分詞を見る判断（Part）には混ぜない。
 */
const featuresOf = (tagged: readonly Tagged[], at: number): Features => {
  const entry = tagged[at];
  if (entry === undefined) return {};
  if (entry.pos === "VBG") return { features: { VerbForm: "Ger" } };
  if (entry.pos !== "VBN") return withOtherReading(entry, nounOrDeterminerFeatures(entry));
  return { features: isPassive(tagged, at) ? { VerbForm: "Part", Voice: "Pass" } : { VerbForm: "Part" } };
};

/** 解析器が引く語彙（語 → Penn Treebank の品詞の並び）。wink-pos-tagger が自分の依存から読むものと同じ一つを、同じ場所から読む。 */
type Vocabulary = (word: string) => readonly string[] | undefined;

const isTags = (value: unknown): value is readonly string[] => Array.isArray(value) && value.every((tag) => typeof tag === "string");

const buildVocabulary = (): Vocabulary => {
  const words: unknown = createRequire(require.resolve("wink-pos-tagger"))("wink-lexicon/src/lexicon.js");
  if (!isRecord(words)) throw new Error("wink-lexicon の語彙が object ではありません");
  return (word) => {
    const tags = Object.hasOwn(words, word) ? words[word] : undefined;
    return isTags(tags) ? tags : undefined;
  };
};

const state: { ready: Tagger | undefined; vocabulary: Vocabulary } = { ready: undefined, vocabulary: () => undefined };

export const prepare = (): void => {
  if (state.ready !== undefined) return;
  state.ready = build();
  state.vocabulary = buildVocabulary();
};

export const isReady = (): boolean => state.ready !== undefined;

/** 大文字で強調した副詞（NEVER）は、解析器が名前と付けても副詞。Emph=Yes は、略語ではないと detector に伝える。 */
const withEmphasis = (token: Token): Token =>
  isEmphasisedAdverb(token.surface, state.vocabulary) ? { ...token, pos: "ADV", lemma: token.surface.toLowerCase(), features: { Emph: "Yes" } } : token;

/**
 * wink は位置を返さないので、表層を順に照合して復元する。
 * 見つからないものは飛ばし、カーソルは進めない。位置の当てずっぽうを下流に流さない。
 */
const locate = (text: string, tagged: readonly Tagged[]): Token[] => {
  // 語を足すたびに並びを作り直すと、長い文で語数の二乗になる。一つの並びに足していく。
  const tokens: Token[] = [];
  let cursor = 0;
  tagged.forEach((entry, at) => {
    const start = text.indexOf(entry.value, cursor);
    if (start === -1) return;
    const end = start + entry.value.length;
    const token = {
      span: { start, end },
      surface: entry.value,
      pos: properNounChecked(entry.value, upos(entry.pos)),
      ...(entry.lemma === undefined ? {} : { lemma: entry.lemma }),
      ...featuresOf(tagged, at),
    };
    tokens.push(withEmphasis(token));
    cursor = end;
  });
  return tokens;
};

/** 英語の語はこれより長くならない。超える並びは語として読まない。 */
const RUN_LIMIT = 1000;

const tagged = (tagger: Tagger, text: string): readonly Tagged[] => toArray(callMethod(tagger, "tagSentence", [text])).filter(isTagged);

/** 文頭で大文字になっただけの普通の語を、小文字で書いたときの品詞に戻す。前後の語による判断も効くよう、文ごと解析し直す。 */
const withSentenceInitialCase = (tagger: Tagger, text: string, entries: readonly Tagged[]): readonly Tagged[] => {
  const at = sentenceInitialCommonWord(entries, state.vocabulary);
  const lowered = lowercasedAt(text, entries[at]?.value);
  return lowered === undefined ? entries : rereadAt(entries, at, tagged(tagger, lowered));
};

export const tokenize = (text: string): Token[] | undefined => {
  const tagger = state.ready;
  if (tagger === undefined) return undefined;
  // 語は解析させた字（don't）で返す。語彙表の語と同じ字で比べられる。span は本文を指したまま。
  const words = straightApostrophes(blankLongRuns(text, RUN_LIMIT));
  return locate(words, withSentenceInitialCase(tagger, words, tagged(tagger, words)));
};
