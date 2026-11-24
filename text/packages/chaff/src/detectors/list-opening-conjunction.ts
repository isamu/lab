import { firstAt, hasContent } from "./list-item.ts";
import { firstOf, secondOf, withoutFirst, type View } from "./list-view.ts";

// 文頭の接続詞（And if you have questions about any of this, come in and ask）は前の文とつなぐ語で、並びの項目の一部ではない。

const SENTENCE_MARKS = new Set(["PUNCT", "SYM"]);

/**
 * 文頭の接続詞（And if you have questions about any of this, come in and ask / But when …,）を外した並び。接続詞の後ろの
 * 導入の句（if …,）を導入の句として確かめるため。文頭が接続詞でなければ undefined。
 */
export const withoutOpeningConjunction = (view: View): View | undefined => {
  const { scope } = view.list;
  const first = firstOf(view);
  if (first === undefined || secondOf(view) === undefined) return undefined;
  const at = firstAt(scope, "open", first.item);
  const { tokens } = scope.sentence;
  const opensSentence = tokens.slice(0, at).every((token) => SENTENCE_MARKS.has(token.pos));
  if (!opensSentence || tokens[at]?.pos !== "CCONJ") return undefined;
  const rest = { start: at + 1, end: first.item.end };
  return hasContent(scope, rest) ? { ...withoutFirst(view), pre: rest } : undefined;
};
