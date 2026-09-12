import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Token } from "chaffjs/plugin";

const require = createRequire(import.meta.url);

/**
 * kuromoji は CommonJS で、辞書を非同期に読む。ESM からは createRequire で取る。
 * 辞書の初期化に 1.5 秒かかるので、prepare が呼ばれるまで触らない。
 */
type Morpheme = {
  readonly word_position: number;
  readonly surface_form: string;
  readonly pos: string;
  readonly pos_detail_1: string;
  readonly basic_form: string;
};

type Tokenizer = Record<string, unknown>;

type BuildDone = (error: Error | null, tokenizer: unknown) => void;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const toArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

const isCallable = (value: unknown): value is (...args: readonly unknown[]) => unknown => typeof value === "function";

const isTokenizer = (value: unknown): value is Tokenizer => isRecord(value) && isCallable(value["tokenize"]);

const isMorpheme = (value: unknown): value is Morpheme =>
  isRecord(value) &&
  typeof value["word_position"] === "number" &&
  typeof value["surface_form"] === "string" &&
  typeof value["pos"] === "string" &&
  typeof value["pos_detail_1"] === "string" &&
  typeof value["basic_form"] === "string";

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
 * 受動の「れる/られる」。IPADIC では動詞の接尾として出る。
 * ただしこの語は可能・尊敬・自発も表す。区別は文脈が要るのでここではしない。
 * 受動と言い切らず「受動の形」として印を付け、どう扱うかは rule 側に委ねる。
 */
const PASSIVE_LEMMA = new Set(["れる", "られる"]);

const isPassive = (morpheme: Morpheme): boolean => morpheme.pos === "動詞" && morpheme.pos_detail_1 === "接尾" && PASSIVE_LEMMA.has(morpheme.basic_form);

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
 * span は渡した文字列の先頭を 0 とする。kuromoji の word_position は 1 始まりなので 1 引く。
 * 形の違うものが混ざったら、その 1 つを落とす。位置が NaN の token を下流に流さない。
 */
const toToken = (morpheme: Morpheme): Token => ({
  span: { start: morpheme.word_position - 1, end: morpheme.word_position - 1 + morpheme.surface_form.length },
  surface: morpheme.surface_form,
  // UD の日本語では「れる/られる」は AUX。IPADIC の「動詞,接尾」をそこへ寄せる。
  pos: isPassive(morpheme) ? "AUX" : upos(morpheme.pos, morpheme.pos_detail_1),
  ...(morpheme.basic_form === "*" ? {} : { lemma: morpheme.basic_form }),
  ...(isPassive(morpheme) ? { features: { Voice: "Pass" } } : {}),
});

/**
 * 名詞を修飾しているだけの受動から印を外す。「使用されるフレームワーク」
 * 「開催される BootCamp」は動作主を隠しているのではなく、名前の付けかたで、
 * 書き手に直す余地がない。実文書で測ったら、この形が指摘の 7 割を占めていた。
 *
 * 日本語は修飾が名詞の前に来るので「後ろに名詞が無い」で述語だと言える。
 * 英語は語順が逆なので、この判断は英語のアダプタには持ち込めない。
 */
const NOMINAL = new Set(["NOUN", "PROPN", "PRON"]);

export const predicateOnly = (tokens: readonly Token[]): Token[] =>
  tokens.map((token) => {
    if (token.features?.["Voice"] !== "Pass") return token;
    const modifiesNoun = tokens.some((other) => other.span.start >= token.span.end && NOMINAL.has(other.pos));
    if (!modifiesNoun) return token;
    return { span: token.span, surface: token.surface, pos: token.pos, ...(token.lemma === undefined ? {} : { lemma: token.lemma }) };
  });

export const tokenize = (text: string): Token[] | undefined => {
  const tokenizer = state.ready;
  if (tokenizer === undefined) return undefined;
  return toArray(callMethod(tokenizer, "tokenize", [text]))
    .filter(isMorpheme)
    .map(toToken);
};
