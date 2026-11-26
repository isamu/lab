import type { Token } from "../plugin.ts";
import { isClause, openingOf } from "./list-item.ts";
import { firstOf, secondOf, withoutFirst, type View } from "./list-view.ts";
import type { TokenRange } from "./token-column.ts";

// 節のあとに読点で続く不定詞の句（defines a sandbox for them, to reduce the risks and to minimise the impact）は目的を言う句で、
// 節は並びの項目ではない。

const isInfinitiveMark = (token: Token | undefined): boolean => token?.pos === "PART" && token.surface.toLowerCase() === "to";

/**
 * 節のあとに不定詞の句が続くなら、節を外した並び。並びがあるなら不定詞の句から。節が不定詞を含めば（We want to read, to write and
 * to sing）、節の終わりが最初の項目なので外さない。
 */
export const afterClauseBeforeInfinitives = (view: View, afterItem: TokenRange): View => {
  const { scope } = view.list;
  const [clause, next] = [firstOf(view), secondOf(view)];
  if (clause === undefined || next === undefined || !isClause(scope, clause.item)) return view;
  const opensInfinitive = (item: TokenRange): boolean => isInfinitiveMark(openingOf(scope, item));
  const carriesInfinitive = scope.sentence.tokens.slice(clause.item.start, clause.item.end).some(isInfinitiveMark);
  return opensInfinitive(next.item) && opensInfinitive(afterItem) && !carriesInfinitive ? withoutFirst(view) : view;
};
