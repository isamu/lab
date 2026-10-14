import type { Sentence, Span, StructureKind, StructureNode, Token } from "../plugin.ts";
import { preOrder } from "../tree-walk.ts";
import { isStatement } from "./technical-docs.ts";

/**
 * 形態素解析が数と読んだ語（UD の NumType=Card）。漢数字の「二割」「十五分」も、算用数字と同じ具体的な数。
 * 言い回しの「二人三脚」「一人ひとり」は、辞書が一語として持つので数にならない。
 */
const isCardinal = (token: Token): boolean => token.features?.["NumType"] === "Card";

const HYPHEN = /^[-‐‑]$/u;

/** ハイフンで前の語に続く数（one-on-one の後ろの one）は、合成語の部品。 */
const isCompoundPart = (token: Token, previous: Token | undefined): boolean =>
  previous !== undefined && previous.span.end === token.span.start && HYPHEN.test(previous.surface);

/** 数の語（UPOS の NUM）が、すぐ後ろの複数形の名詞を数えている（five minutes）。one of や two-way は量ではない。 */
const countsPlural = (tokens: readonly Token[], index: number): boolean => {
  const token = tokens[index];
  return token?.pos === "NUM" && tokens[index + 1]?.features?.["Number"] === "Plur" && !isCompoundPart(token, tokens[index - 1]);
};

/** 品詞が無ければ何も言わない。数字そのものは呼ぶ側が文字で見る。 */
export const hasNumeral = (tokens: readonly Token[]): boolean => tokens.some((token, index) => isCardinal(token) || countsPlural(tokens, index));

/** 節の中で始まるものがある。節は見出しの直後から次の見出しの前まで。 */
export const startsWithin = (section: Span, spans: readonly Span[]): boolean => spans.some((span) => span.start >= section.start && span.start < section.end);

/** 構造の木が読んだ参照（第3条・Section VI）・数量・日付。どれも読み手が確かめに行ける具体物。 */
const EVIDENCE: ReadonlySet<StructureKind> = new Set(["reference", "quantity", "date"]);

export const evidenceSpans = (root: StructureNode | undefined): Span[] =>
  root === undefined ? [] : preOrder(root).flatMap((node) => (EVIDENCE.has(node.kind) ? [node.span] : []));

/** 読み手にすることを伝える言い方。英語は文の書き出し（Never use, Please submit）、日本語は文末（〜ください、〜しましょう）。 */
export type AdviceWords = { readonly openers: readonly string[]; readonly endings: readonly string[] };

const CLOSERS = new Set(Array.from("\"'”’」』）)】〕〉》］]"));
const TERMINALS = new Set(Array.from("。．.!！"));
const QUESTION_MARKS = new Set(["?", "？"]);
const SKIPPED = new Set(["PUNCT", "SYM", "X", "SPACE"]);

/** 文末から、閉じ括弧・引用符（と、渡されれば句点）を外した残り。 */
const withoutTail = (text: string, tail: ReadonlySet<string>): string => {
  const chars = Array.from(text.trimEnd());
  const last = chars.findLastIndex((char) => !tail.has(char) && char.trim() !== "");
  return chars.slice(0, last + 1).join("");
};

const isQuestion = (text: string): boolean => QUESTION_MARKS.has(Array.from(withoutTail(text, CLOSERS)).at(-1) ?? "");

const opensWith = (text: string, openers: readonly string[]): boolean => {
  const lower = text.trimStart().toLowerCase();
  return openers.some((opener) => lower.startsWith(`${opener} `));
};

const endsWith = (text: string, endings: readonly string[]): boolean => {
  const body = withoutTail(text, new Set([...CLOSERS, ...TERMINALS]));
  return endings.some((ending) => body.endsWith(ending));
};

/** 項目の番号（a, 12, iv）。 */
const ENUMERATOR = /^(?:\p{L}|\p{Nd}{1,3}|[ivx]{1,4})$/iu;
const BRACKETED = /^[(（](.+)[)）]$/u;
const MARKED = /^(.+)[.)）．]$/u;

/** 項目の番号だけが文として切り出されたもの（a. や (1)）。述べることも問うことも無い。 */
export const isLabelOnly = (sentence: Pick<Sentence, "text">): boolean => {
  const text = sentence.text.trim();
  const core = BRACKETED.exec(text)?.[1] ?? MARKED.exec(text)?.[1];
  return core !== undefined && ENUMERATOR.test(core);
};

/** 動詞の目的語の書き出し（Use a generator, Review our benefits）。名詞と読まれた語の後ろにこれが来れば、その語は動詞。 */
const OBJECT_OPENER = new Set(["DET", "PRON"]);

/**
 * 原形の動詞（Keep, Take）。解析器が名詞と読んだ、動詞にもなる語も、目的語が続けば同じ（Use a generator）。
 * 後ろが名詞や前置詞なら名詞句の頭（evidence of complexity, trust development plans）。
 */
const isBaseVerb = (token: Token, next: Token | undefined): boolean =>
  (token.pos === "VERB" && token.lemma?.toLowerCase() === token.surface.toLowerCase() && token.features?.["VerbForm"] === undefined) ||
  (token.pos === "NOUN" && token.features?.["AlsoVerb"] === "Yes" && token.features["Number"] !== "Plur" && OBJECT_OPENER.has(next?.pos ?? ""));

/** 頭の語が一語として立っている。空白を置かずに続けば、語の一部（Cloud.gov の Cloud）。 */
const standsAlone = (tokens: readonly Token[], head: Token): boolean => {
  const after = tokens[tokens.indexOf(head) + 1];
  return after === undefined || after.span.start > head.span.end || after === tokens.at(-1) || after.surface === ",";
};

/**
 * 動詞で始まる英語の文（Keep freezers closed）は指示。すぐ後ろがコロンなら見出し語（Release: none）で、主語のある文は述べる文。
 * 日本語は動詞が文末に来るので、品詞では読まない。
 */
const opensWithVerb = (tokens: readonly Token[], language: string): boolean => {
  const [head, next] = tokens.filter((token) => !SKIPPED.has(token.pos) || token.surface === ":");
  return language === "en" && head !== undefined && isBaseVerb(head, next) && standsAlone(tokens, head) && next?.surface !== ":" && !isStatement(tokens);
};

/**
 * 読み手が裏づけを求められることを述べた文。問い（情報提供の依頼に並ぶ質問）と指示（安全の手引き）は主張ではなく、
 * 数字が欠けているとは言えない。
 */
export const isClaim = (sentence: Pick<Sentence, "text" | "tokens">, language: string, words: AdviceWords): boolean =>
  !isQuestion(sentence.text) &&
  !opensWith(sentence.text, words.openers) &&
  !endsWith(sentence.text, words.endings) &&
  !opensWithVerb(sentence.tokens ?? [], language);
