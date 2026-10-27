// Whether a list goes on past an and / or. Then that and / or is inside an item, not the list's last joint, and it casts no
// vote on the serial comma. Pure.
import { hasAdposition, hasVerb, isClause, itemAfter, leadShape } from "./list-item.ts";
import { isListConjunction, type ItemScope } from "./list-sentence.ts";
import type { TokenRange } from "./token-column.ts";

/**
 * and の後ろの項目のあとも同じ並びが続くなら、この and は項目の中にある。読点ごとに同じ頭の形で動詞の無い項目を読み進め、
 * 同じ形の項目を連れた and / or に着けば並びの最後の継ぎ目はそちら（searches and seizures, and the Eighth's ban /
 * homeownership counseling and financial literacy, commercial conversions to housing, and support for manufactured housing）。
 * and / or に着かずにダッシュかセミコロンで閉じれば、and / or の無い並びの項目の中（interests—psychological integrity,
 * autonomous judgment, time and attention, emotional investment—that）。文の終わりで閉じるのは並びのあとの同格
 * （apples, pears and plums, the fruit we sell）とも、コロンで閉じるのは題名の副題とも読めるので、続きと読まない。
 * 途中の項目を挟まずに and / or が続き、頭の形か節かどうかが違えば、別の節をつなぐ and で、この and までが並び
 * （apples, pears and plums, and went home / and figs fell）。
 */
const ENCLOSING_BREAK: ReadonlySet<string> = new Set(["—", ";"]);

/** 位置 end の記号が、and / or と同じ深さの読点か。 */
const levelComma = (scope: ItemScope, end: number): boolean => scope.sentence.tokens[end]?.surface === "," && scope.sentence.depths[end] === scope.level;

/** 項目の語を小文字でつないだもの。読点や引用符は除く。 */
const wordsOf = (scope: ItemScope, item: TokenRange): string =>
  scope.sentence.tokens
    .slice(item.start, item.end)
    .filter((token) => token.pos !== "PUNCT" && token.pos !== "X")
    .map((token) => token.surface.toLowerCase())
    .join(" ");

/** 並びの残りを言う語だけの項目（and so forth / or the like）。 */
const endsOpenList = (scope: ItemScope, item: TokenRange): boolean => scope.sentence.words.openListEnd?.has(wordsOf(scope, item)) ?? false;

/**
 * 読点のあとに、頭の形が shape の and / or の項目か、並びの残りを言う語（and so forth）が来るか。and / or が来なければ undefined。
 */
const conjunctionAfter = (scope: ItemScope, end: number, shape: string): boolean | undefined => {
  if (!isListConjunction(scope.sentence.tokens[end + 1])) return undefined;
  const following = itemAfter(scope, end + 1);
  return leadShape(scope, following) === shape || endsOpenList(scope, following);
};

const QUOTE_MARKS: ReadonlySet<string> = new Set(['"', "“", "”", "'", "‘", "’"]);

/** 読点の後ろの項目が引用符で始まる。引用した題名の始まりで、並びの続きではない（Bundick, Cairó, and Petrosky-Nadeau (2025), "Labor Market Dynamics, …）。 */
const opensQuotation = (scope: ItemScope, comma: number): boolean => QUOTE_MARKS.has(scope.sentence.tokens[comma + 1]?.surface ?? "");

/** 読点 start から、頭の形が shape で動詞の無い項目を 1 つ以上読み進めた先の答え。 */
export type Walk = (scope: ItemScope, start: number, shape: string) => boolean;

/** 1 つの文の Walk。and / or ごとに同じ読点を読み直すと語数の二乗になるので、通った読点の答えを覚える。 */
export const walker = (): Walk => {
  const known = new Map<string, boolean>();
  const keyOf = (scope: ItemScope, end: number, shape: string): string => `${String(scope.level)}:${String(end)}:${shape}`;
  return (scope, start, shape) => {
    const passed: number[] = [];
    let end = start;
    let answer: boolean | undefined;
    while (answer === undefined) {
      const next = itemAfter(scope, end);
      passed.push(end);
      answer = known.get(keyOf(scope, end, shape));
      if (answer !== undefined) break;
      if (leadShape(scope, next) !== shape || hasVerb(scope, next) || opensQuotation(scope, end)) answer = false;
      else if (!levelComma(scope, next.end)) answer = ENCLOSING_BREAK.has(scope.sentence.tokens[next.end]?.surface ?? "");
      else answer = conjunctionAfter(scope, next.end, shape);
      end = next.end;
    }
    const settled = answer;
    passed.forEach((comma) => known.set(keyOf(scope, comma, shape), settled));
    return settled;
  };
};

/**
 * 項目を挟んで読み進めるのは、and の後ろが前置詞も動詞も連れない短い項目のときだけ。長い項目の尻からは次の並びが始まりうる
 * （the duties of loyalty, care, good faith, and candour into criteria governing engagement optimisation, aggregate harm
 * monitoring, and revision authority は 2 つの並び）。
 */
export const listContinues = (scope: ItemScope, afterItem: TokenRange, walk: Walk): boolean => {
  const shape = leadShape(scope, afterItem);
  if (shape === undefined || !levelComma(scope, afterItem.end)) return false;
  const following = conjunctionAfter(scope, afterItem.end, shape);
  const next = itemAfter(scope, afterItem.end + 1);
  if (following !== undefined) return following && (endsOpenList(scope, next) || isClause(scope, next) === isClause(scope, afterItem));
  return !hasAdposition(scope, afterItem) && !hasVerb(scope, afterItem) && walk(scope, afterItem.end, shape);
};
