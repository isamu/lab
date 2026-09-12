import { createRequire } from "node:module";
import type { Token } from "chaffjs/plugin";

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

const isPassive = (tagged: readonly Tagged[], at: number): boolean => {
  if (tagged[at]?.pos !== "VBN") return false;
  const before = tagged.slice(0, at).reverse();
  const head = before.find((entry) => !SKIPPABLE.has(entry.pos));
  return head !== undefined && isBe(head);
};

const state: { ready: Tagger | undefined } = { ready: undefined };

export const prepare = (): void => {
  state.ready ??= build();
};

export const isReady = (): boolean => state.ready !== undefined;

/**
 * wink は位置を返さないので、表層を順に照合して復元する。
 * 見つからないものは飛ばし、カーソルは進めない。位置の当てずっぽうを下流に流さない。
 */
const locate = (text: string, tagged: readonly Tagged[]): Token[] =>
  tagged.reduce<{ tokens: Token[]; cursor: number }>(
    (acc, entry, at) => {
      const start = text.indexOf(entry.value, acc.cursor);
      if (start === -1) return acc;
      const end = start + entry.value.length;
      const token = {
        span: { start, end },
        surface: entry.value,
        pos: upos(entry.pos),
        ...(entry.lemma === undefined ? {} : { lemma: entry.lemma }),
        ...(isPassive(tagged, at) ? { features: { Voice: "Pass" } } : {}),
      };
      return { tokens: [...acc.tokens, token], cursor: end };
    },
    { tokens: [], cursor: 0 },
  ).tokens;

export const tokenize = (text: string): Token[] | undefined => {
  const tagger = state.ready;
  if (tagger === undefined) return undefined;
  return locate(text, toArray(callMethod(tagger, "tagSentence", [text])).filter(isTagged));
};
