import type { Token } from "../plugin.ts";
import { APPOSITIVE_ANCHOR, NOMINAL, verbFormOf, type Columns, type ItemScope } from "./list-sentence.ts";
import { countIn, firstIn, lastIn, lowerBound, type TokenRange } from "./token-column.ts";

// 並びの項目への問い。項目は文の中の一続きの範囲で、and / or と同じ深さの読点を除いたもの。どの問いも範囲を読み直さず、
// 文を一度読んで作った列（list-sentence.ts）から答える。

type ColumnName = keyof Columns;

const count = (scope: ItemScope, name: ColumnName, item: TokenRange): number => countIn(scope.sentence.column[name], item, scope.admit);

const tokenAt = (scope: ItemScope, index: number): Token | undefined => (index === -1 ? undefined : scope.sentence.tokens[index]);

export const firstAt = (scope: ItemScope, name: ColumnName, item: TokenRange): number => firstIn(scope.sentence.column[name], item, scope.admit);

const first = (scope: ItemScope, name: ColumnName, item: TokenRange): Token | undefined => tokenAt(scope, firstAt(scope, name, item));

const last = (scope: ItemScope, name: ColumnName, item: TokenRange): Token | undefined =>
  tokenAt(scope, lastIn(scope.sentence.column[name], item, scope.admit));

export const hasContent = (scope: ItemScope, item: TokenRange): boolean => count(scope, "content", item) > 0;

export const contentCount = (scope: ItemScope, item: TokenRange): number => count(scope, "content", item);

export const firstContent = (scope: ItemScope, item: TokenRange): Token | undefined => first(scope, "content", item);

export const lastContent = (scope: ItemScope, item: TokenRange): Token | undefined => last(scope, "content", item);

const shapeOfHead = (head: Token | undefined): string | undefined => {
  if (head === undefined) return undefined;
  return NOMINAL.has(head.pos) ? "NOMINAL" : head.pos;
};

/** 冠詞や引用符を飛ばした、項目の頭の品詞。the parser と an exporter と samples を同じ形と見る。 */
export const shapeOf = (scope: ItemScope, item: TokenRange): string | undefined => shapeOfHead(firstContent(scope, item));

/** 副詞を飛ばした頭の形。explain and justify と ultimately ensure は同じ動詞の項目。 */
export const leadShape = (scope: ItemScope, item: TokenRange): string | undefined => shapeOfHead(first(scope, "contentNotAdverb", item));

export const openingOf = (scope: ItemScope, item: TokenRange): Token | undefined => first(scope, "open", item);

export const isParticiple = (token: Token): boolean => token.features?.["VerbForm"] === "Part";

export const openingKind = (scope: ItemScope, item: TokenRange): string | undefined => {
  const opening = openingOf(scope, item);
  return opening !== undefined && isParticiple(opening) ? "PARTICIPLE" : shapeOf(scope, item);
};

export const hasVerb = (scope: ItemScope, item: TokenRange): boolean => count(scope, "verbal", item) > 0;

export const hasListConjunction = (scope: ItemScope, item: TokenRange): boolean => count(scope, "conjunction", item) > 0;

export const hasAdposition = (scope: ItemScope, item: TokenRange): boolean => count(scope, "adposition", item) > 0;

export const hasDeterminer = (scope: ItemScope, item: TokenRange): boolean => count(scope, "determiner", item) > 0;

/** 主語と述語のある項目。the team fixed the bug / these are crucial。gets us more は述語だけ。頭は冠詞か名詞なので、動詞はその後ろ。 */
export const isClause = (scope: ItemScope, item: TokenRange): boolean => {
  const opening = openingOf(scope, item);
  if (opening === undefined || !(opening.pos === "DET" || NOMINAL.has(opening.pos))) return false;
  return hasVerb(scope, item);
};

/** 頭の語のあとに前置詞の句を連れた項目（updates on the Google Doc）。 */
export const hasPrepositionalTail = (scope: ItemScope, item: TokenRange): boolean => {
  const head = firstAt(scope, "content", item);
  return hasAdposition(scope, { start: head === -1 ? item.start : head + 1, end: item.end });
};

/** 項目の頭の分詞とその形。副詞は飛ばす（originally written）。引用符の中の語（‘modelling’）は語の例なので分詞と読まない。 */
export const participleOpening = (scope: ItemScope, item: TokenRange): { readonly at: number; readonly form: string } | undefined => {
  const at = firstAt(scope, "notPunctuationOrAdverb", item);
  const opening = tokenAt(scope, at);
  if (opening === undefined) return undefined;
  const form = scope.sentence.words.participle.has(opening.surface.toLowerCase()) ? "Ger" : verbFormOf(opening);
  return form === undefined ? undefined : { at, form };
};

export const hasParticiple = (scope: ItemScope, item: TokenRange, form: string): boolean => count(scope, form === "Ger" ? "gerund" : "participle", item) > 0;

/** 名詞にかかる語。解析器は分詞を過去形とも読む（registered or certified mail の certified）ので、動詞も数える。 */
const MODIFIER = new Set(["ADJ", "VERB"]);

export const isModifier = (token: Token | undefined): boolean => token?.pos === "ADJ" || (token !== undefined && isParticiple(token));

/** 修飾語と名詞だけの句（certified mail / artificial flavor）。冠詞や目的語を連れた動詞（adopt their resources）は違う。 */
export const isModifiedNoun = (scope: ItemScope, item: TokenRange): boolean => {
  const headAt = firstAt(scope, "open", item);
  const tail = { start: headAt === -1 ? item.end : headAt + 1, end: item.end };
  const tailLength = count(scope, "open", tail);
  const nounPhrase = tailLength > 0 && tailLength === count(scope, "nounPhraseTail", tail);
  return MODIFIER.has(tokenAt(scope, headAt)?.pos ?? "") && nounPhrase && APPOSITIVE_ANCHOR.has(last(scope, "open", tail)?.pos ?? "");
};

export const isPluralNounPhrase = (scope: ItemScope, item: TokenRange): boolean =>
  count(scope, "content", item) === count(scope, "nounPhraseTail", item) && lastContent(scope, item)?.features?.["Number"] === "Plur";

export const firstNoun = (scope: ItemScope, item: TokenRange): Token | undefined => first(scope, "noun", item);

export const lastNoun = (scope: ItemScope, item: TokenRange): Token | undefined => last(scope, "noun", item);

/** and / or の後ろの項目。次の読点か節の切れ目まで。 */
export const itemAfter = (scope: ItemScope, at: number): TokenRange => {
  const rest = { start: at + 1, end: scope.sentence.tokens.length };
  const end = firstIn(scope.sentence.column.itemEnd, rest);
  return { start: rest.start, end: end === -1 ? rest.end : end };
};

/**
 * 項目の中で、and / or と同じ深さにある最後の例の句（such as / e.g.）の直後の位置。無ければ -1。句は項目の中で終わるものだけ。
 * 項目の終わりをまたぐ句は、項目の最後の数語から始まるものだけなので、後ろから見て数個で決まる。
 */
export const exampleEnd = (scope: ItemScope, item: TokenRange): number => {
  const starts = scope.sentence.exampleStarts.get(scope.level) ?? [];
  const within = (from: number): number => {
    const start = starts[from];
    if (start === undefined || start < item.start) return -1;
    const end = (scope.sentence.exampleEnds[start] ?? []).find((phraseLast) => phraseLast < item.end);
    return end === undefined ? within(from - 1) : end + 1;
  };
  return within(lowerBound(starts, item.end) - 1);
};
