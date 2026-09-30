import type { Span, StructureKind, StructureNode, Token } from "../plugin.ts";
import { preOrder } from "../tree-walk.ts";

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
