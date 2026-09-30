import { surfaceStarts } from "./surface-starts.ts";
import { wellFormed } from "./well-formed.ts";
import { analyserPieces } from "./analyser-pieces.ts";
import { readCounterTsu, type Morpheme } from "./counter-tsu.ts";
import { outsideTheReport, isPassiveForm, passiveVocabulary, readsAsPassive } from "./passive-reading.ts";
import { loadLexicons } from "./lexicons.ts";
import { isInflectedEcho, type Inflection } from "./reduplication.ts";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Token } from "chaffjs/plugin";

const require = createRequire(import.meta.url);

/**
 * kuromoji は CommonJS で、辞書を非同期に読む。ESM からは createRequire で取る。
 * 辞書の初期化に 1.5 秒かかるので、prepare が呼ばれるまで触らない。
 */
type Tokenizer = Record<string, unknown>;

type BuildDone = (error: Error | null, tokenizer: unknown) => void;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const toArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

const isCallable = (value: unknown): value is (...args: readonly unknown[]) => unknown => typeof value === "function";

const isTokenizer = (value: unknown): value is Tokenizer => isRecord(value) && isCallable(value["tokenize"]);

/** kuromoji の形態素。形の違うものは落とす。二段目の細分類（助数詞・地域）は無ければ *。三段目（人名の姓・名）は無ければ持たない。 */
const toMorpheme = (value: unknown): Morpheme[] => {
  if (!isRecord(value)) return [];
  const [surface, pos, detail1, detail2, detail3, basic, reading, form, conjugation] = [
    value["surface_form"],
    value["pos"],
    value["pos_detail_1"],
    value["pos_detail_2"],
    value["pos_detail_3"],
    value["basic_form"],
    value["reading"],
    value["conjugated_form"],
    value["conjugated_type"],
  ];
  if (typeof surface !== "string" || typeof pos !== "string" || typeof detail1 !== "string" || typeof basic !== "string") return [];
  const detail = typeof detail2 === "string" ? detail2 : "*";
  return [
    {
      surface_form: surface,
      pos,
      pos_detail_1: detail1,
      pos_detail_2: detail,
      ...(typeof detail3 === "string" ? { pos_detail_3: detail3 } : {}),
      basic_form: basic,
      ...(typeof reading === "string" ? { reading } : {}),
      ...(typeof form === "string" && form !== "*" ? { conjugated_form: form } : {}),
      ...(typeof conjugation === "string" && conjugation !== "*" ? { conjugated_type: conjugation } : {}),
    },
  ];
};

const dictionaryPath = (): string => join(dirname(require.resolve("@sglkc/kuromoji/package.json")), "dict");

/** 取り出した関数をそのまま呼ぶと receiver が外れる。kuromoji の build は this.dic_path を読む。 */
const callMethod = (owner: Record<string, unknown>, name: string, args: readonly unknown[]): unknown => {
  const method: unknown = owner[name];
  if (!isCallable(method)) throw new Error(`@sglkc/kuromoji が ${name} を持っていません`);
  return Reflect.apply(method, owner, args);
};

const buildWith = (done: BuildDone): void => {
  const module: unknown = require("@sglkc/kuromoji");
  if (!isRecord(module)) throw new Error("@sglkc/kuromoji が object を export していません");
  const builder: unknown = callMethod(module, "builder", [{ dicPath: dictionaryPath() }]);
  if (!isRecord(builder)) throw new Error("@sglkc/kuromoji の builder が object を返しませんでした");
  callMethod(builder, "build", [done]);
};

/**
 * IPADIC の品詞を UPOS に寄せる。detector にアダプタ固有の体系を見せない。spec §6。
 * 引けなかったものは X。誤った品詞を当てるより、分からないと言うほうがまし。
 */
const BY_DETAIL: Readonly<Record<string, string>> = {
  代名詞: "PRON",
  固有名詞: "PROPN",
  格助詞: "ADP",
  係助詞: "ADP",
  副助詞: "ADP",
  連体化: "ADP",
  接続助詞: "SCONJ",
  終助詞: "PART",
  並立助詞: "CCONJ",
};

const BY_POS: Readonly<Record<string, string>> = {
  名詞: "NOUN",
  動詞: "VERB",
  形容詞: "ADJ",
  副詞: "ADV",
  助動詞: "AUX",
  助詞: "PART",
  接続詞: "CCONJ",
  連体詞: "DET",
  感動詞: "INTJ",
  記号: "PUNCT",
  接頭詞: "ADJ",
  フィラー: "INTJ",
};

export const upos = (pos: string, detail: string): string => BY_DETAIL[detail] ?? BY_POS[pos] ?? "X";

/**
 * 受動の「れる/られる」。この語は可能・尊敬・自発も表す。形のうえで受動でないと言えるもの
 * （自発や状態を言う動詞、名付けの「と呼ばれる」、尊敬の形と決まり文句、ら抜きと可能）と、文が報告する動作の外にあるもの
 * （仮定の節、「〜されやすい」）は passive-reading.ts が外す。残りは「受動の形」として印を付ける。
 */
const PASSIVE_VOCABULARY = passiveVocabulary(loadLexicons());

/**
 * 非自立名詞（の・こと・もの・ため・はず）。品詞は名詞だが、単独では何も指さない。
 * 「回るのか。」の「の」を体言止めと読むと、疑問文が全部ひっかかる。
 *
 * UD の FEATS は言語ごとの拡張を認めているので、そこに畳む。UPOS は NOUN のまま。
 */
const isDependentNoun = (morpheme: Morpheme): boolean => morpheme.pos === "名詞" && morpheme.pos_detail_1 === "非自立";

const state: { pending: Promise<Tokenizer> | undefined; ready: Tokenizer | undefined } = { pending: undefined, ready: undefined };

const build = async (): Promise<Tokenizer> =>
  new Promise((resolve, reject) => {
    buildWith((error, tokenizer) => {
      if (error !== null) reject(new Error(`日本語辞書を読めませんでした: ${error.message}`));
      else if (!isTokenizer(tokenizer)) reject(new Error("日本語辞書が tokenizer を返しませんでした"));
      else resolve(tokenizer);
    });
  });

/** 二度目以降は同じ約束を待つ。並行して呼ばれても辞書を二度読まない。 */
export const prepare = async (): Promise<void> => {
  state.pending ??= build();
  state.ready = await state.pending;
};

export const isReady = (): boolean => state.ready !== undefined;

/**
 * span は渡した文字列の先頭を 0 とする。位置は kuromoji の word_position ではなく、語の文字を本文と照らして決める（surface-starts.ts）。
 * 形の違うものが混ざったら、その 1 つを落とす。位置が NaN の token を下流に流さない。
 */
const toToken = (morpheme: Morpheme, start: number, passive: boolean, echo: boolean): Token => ({
  span: { start, end: start + morpheme.surface_form.length },
  surface: morpheme.surface_form,
  // UD の日本語では「れる/られる」は AUX。IPADIC の「動詞,接尾」をそこへ寄せる。
  pos: isPassiveForm(morpheme) ? "AUX" : upos(morpheme.pos, morpheme.pos_detail_1),
  ...(morpheme.basic_form === "*" ? {} : { lemma: morpheme.basic_form }),
  ...(typeof morpheme.reading !== "string" || morpheme.reading === "*" ? {} : { reading: morpheme.reading }),
  ...withEcho(featuresOf(morpheme, passive), echo),
});

/** 重ね言葉の二つ目（UD の Echo=Rdp）。ほかの印は残す。 */
const withEcho = (found: { features?: Readonly<Record<string, string>> }, echo: boolean): { features?: Readonly<Record<string, string>> } =>
  echo ? { features: { ...found.features, Echo: "Rdp" } } : found;

/**
 * 数（名詞,数）。UPOS では名詞に寄せるので、数であることは UD の NumType=Card で渡す。
 * 決まった言い回し（二人三脚、三日坊主、一人ひとり、十分）は辞書が一語として持つので、数にはならない。
 */
const NUMERAL_TEXT = /^[〇一二三四五六七八九十百千万億兆0-9０-９.,．，]+$/u;

/** 「数年」「何人」の「数」「何」も名詞,数だが、決まった数ではない。数字の文字でできたものだけ。 */
const isNumeral = (morpheme: Morpheme): boolean => morpheme.pos === "名詞" && morpheme.pos_detail_1 === "数" && NUMERAL_TEXT.test(morpheme.surface_form);

/**
 * 地名（IPADIC の「固有名詞,地域」）は NameType=Geo、地名に付く単位（「接尾,地域」の都・県・市・区・町）は NameType=GeoUnit。
 * 住所は地名と単位が交互に続く。地名が単位を挟まずに続けば（東京大阪名古屋）、地名の並び。
 */
const placeType = (morpheme: Morpheme): string | undefined => {
  if (morpheme.pos !== "名詞" || morpheme.pos_detail_2 !== "地域") return undefined;
  if (morpheme.pos_detail_1 === "固有名詞") return "Geo";
  return morpheme.pos_detail_1 === "接尾" ? "GeoUnit" : undefined;
};

/** 人名（IPADIC の「固有名詞,人名」）の三段目。姓は Sur、名は Giv、どちらとも言えない人名は Prs（UD の NameType）。 */
const PERSON: Readonly<Record<string, string>> = { 姓: "Sur", 名: "Giv", 一般: "Prs" };

/** 人名と組織名（「固有名詞,組織」は UD の NameType=Com）。地名は placeType が見る。 */
const personOrOrganisation = (morpheme: Morpheme): string | undefined => {
  if (morpheme.pos !== "名詞" || morpheme.pos_detail_1 !== "固有名詞") return undefined;
  if (morpheme.pos_detail_2 === "人名") return PERSON[morpheme.pos_detail_3 ?? ""];
  return morpheme.pos_detail_2 === "組織" ? "Com" : undefined;
};

/** 数を数える単位（IPADIC の「接尾,助数詞」: 丁目・件・人）。UD では NounType=Class。 */
const isCounter = (morpheme: Morpheme): boolean => morpheme.pos === "名詞" && morpheme.pos_detail_1 === "接尾" && morpheme.pos_detail_2 === "助数詞";

const featuresOf = (morpheme: Morpheme, passive: boolean): { features?: Readonly<Record<string, string>> } => {
  if (passive) return { features: { Voice: "Pass" } };
  if (isDependentNoun(morpheme)) return { features: { NounType: "Dependent" } };
  if (isNumeral(morpheme)) return { features: { NumType: "Card" } };
  const name = placeType(morpheme) ?? personOrOrganisation(morpheme);
  if (name !== undefined) return { features: { NameType: name } };
  if (isCounter(morpheme)) return { features: { NounType: "Class" } };
  return {};
};

/**
 * 名詞を修飾しているだけの受動から印を外す。「使用されるフレームワーク」
 * 「開催される BootCamp」は動作主を隠しているのではなく、名前の付けかたで、
 * 書き手に直す余地がない。実文書で測ったら、この形が指摘の 7 割を占めていた。
 *
 * 日本語は修飾が名詞の前に来るので「後ろに名詞が無い」で述語だと言える。
 * 英語は語順が逆なので、この判断は英語のアダプタには持ち込めない。
 *
 * 見るのは**同じ節の中**だけ。読点をまたぐと、「仕様は変更され、担当者が確認した。」の
 * 「担当者」が後ろの名詞として数えられ、述語の受動が修飾と判定されて消える。
 */
const NOMINAL = new Set(["NOUN", "PROPN", "PRON"]);

/** 節の終わり。読点・句点でいったん切れる。 */
const BREAK = new Set(["、", "，", ",", "。", "．", "."]);

const clauseEnd = (tokens: readonly Token[], from: number): number =>
  tokens.find((token) => token.span.start >= from && BREAK.has(token.surface))?.span.start ?? Number.MAX_SAFE_INTEGER;

export const predicateOnly = (tokens: readonly Token[]): Token[] =>
  tokens.map((token) => {
    if (token.features?.["Voice"] !== "Pass") return token;
    const end = clauseEnd(tokens, token.span.end);
    const modifiesNoun = tokens.some((other) => other.span.start >= token.span.end && other.span.end <= end && NOMINAL.has(other.pos));
    if (!modifiesNoun) return token;
    return { span: token.span, surface: token.surface, pos: token.pos, ...(token.lemma === undefined ? {} : { lemma: token.lemma }) };
  });

const inflectionOf = (morpheme: Morpheme, start: number): Inflection => ({
  surface: morpheme.surface_form,
  pos: morpheme.pos,
  detail: morpheme.pos_detail_1,
  form: morpheme.conjugated_form ?? "*",
  start,
});

export const tokenize = (text: string): Token[] | undefined => {
  const tokenizer = state.ready;
  if (tokenizer === undefined) return undefined;
  const read = readAll(tokenizer, text);
  const sequence = read.map(({ morpheme }) => morpheme);
  const inflections = read.map(({ morpheme, start }) => inflectionOf(morpheme, start));
  return read.map(({ morpheme, start }, index) =>
    toToken(
      morpheme,
      start,
      readsAsPassive(sequence, index, PASSIVE_VOCABULARY) && !outsideTheReport(sequence, index),
      isInflectedEcho(inflections, index),
    ),
  );
};

/** 句読点の無い並びをこれより長く渡さない。解析器は並びの長さの二乗で遅くなり、20 万字の 1 行では何分も返らない。 */
const PIECE_LIMIT = 1000;

const analyse = (tokenizer: Tokenizer, text: string): Morpheme[] =>
  readCounterTsu(analyserPieces(text, PIECE_LIMIT).flatMap((piece) => toArray(callMethod(tokenizer, "tokenize", [piece])).flatMap(toMorpheme)));

/** 解析器は片割れのサロゲートで例外を投げる。数量の後ろを数文字だけ読み直すと、絵文字を半分に切ることがある。 */
const readAll = (tokenizer: Tokenizer, text: string): { readonly morpheme: Morpheme; readonly start: number }[] => {
  const readable = wellFormed(text);
  return placed(readable, analyse(tokenizer, readable));
};

/** 形態素と、本文の中での始まり。本文に見つからないものは落とす。 */
const placed = (text: string, raws: readonly Morpheme[]): { readonly morpheme: Morpheme; readonly start: number }[] => {
  const starts = surfaceStarts(
    text,
    raws.map((raw) => raw.surface_form),
  );
  return raws.flatMap((morpheme, index) => {
    const start = starts[index];
    return start === undefined ? [] : [{ morpheme, start }];
  });
};

/**
 * 構造を読むときに使う、IPADIC の細分類まで持った形態素。助数詞（名詞,接尾,助数詞）は
 * 二段目の細分類にしか現れないので、UPOS に寄せた token からは読めない。
 */
export type Morph = {
  readonly start: number;
  readonly end: number;
  readonly surface: string;
  readonly pos: string;
  readonly detail1: string;
  readonly detail2: string;
};

/** 解析器を読み込んでいなければ undefined。呼ぶ側は、形態素なしの読み方に戻る。 */
export const morphemes = (text: string): Morph[] | undefined => {
  const tokenizer = state.ready;
  if (tokenizer === undefined) return undefined;
  return readAll(tokenizer, text).map(({ morpheme: raw, start }) => ({
    start,
    end: start + raw.surface_form.length,
    surface: raw.surface_form,
    pos: raw.pos,
    detail1: raw.pos_detail_1,
    detail2: raw.pos_detail_2,
  }));
};

const isCounterMorph = (morph: Morph): boolean => morph.pos === "名詞" && morph.detail1 === "接尾" && morph.detail2 === "助数詞";

/** 桁の語（万・億）。「26.7 万行」の「万行」は、詰めれば 26.7万 と 行 に分かれる。 */
const isNumeralMorph = (morph: Morph): boolean => morph.pos === "名詞" && morph.detail1 === "数";

/** 一語の副詞と読むか（がんがん）。前後の語に引かれない、その文字列だけの読み。 */
export const readsAsOneAdverb = (text: string): boolean => {
  const read = tokenize(text);
  return read?.length === 1 && read[0]?.pos === "ADV";
};

/**
 * 数のすぐ後ろに詰めて書いたとき、word が数につく語として読まれるか（spaced-counter.ts が使う）。
 * word がそのまま一語の助数詞になるか、桁の語で始まるとき。「件名」は詰めると 件 と 名 に割れるので、助数詞とは読まない。
 */
export const readsAsCounter = (number: string, word: string): boolean => {
  const next = morphemes(number + word)?.find((morph) => morph.start === number.length);
  return next !== undefined && ((next.surface === word && isCounterMorph(next)) || isNumeralMorph(next));
};
