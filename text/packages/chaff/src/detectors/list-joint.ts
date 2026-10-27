// An and / or that joins words inside the last item rather than the list's last two items: an item not finished yet
// ("on or before", "a flexible and lightweight grid") or a run that repeats the conjunction without commas. Pure.
import { commaBefore, firstAt, firstContent, isBareIndefiniteModifier, isBareNounPhrase, isBarePreposition, lastAt } from "./list-item.ts";
import type { ItemScope } from "./list-sentence.ts";
import { lastOf, type View } from "./list-view.ts";
import type { TokenRange } from "./token-column.ts";

/**
 * 最後の項目がまだ閉じていない語だけなら、and / or はその語と後ろの語を結び、後ろの名詞や目的語を共有する。前置詞だけ
 * （on or before Jan 23/58）か、不定冠詞と形容詞だけ（Neat, a flexible and lightweight Sass grid）。
 */
export const joinsUnfinished = (scope: ItemScope, at: number, view: View): boolean => {
  const last = lastOf(view);
  if (last === undefined || commaBefore(scope, at)) return false;
  return isBarePreposition(scope, last.item) || isBareIndefiniteModifier(scope, last.item);
};

/** 項目の最初（fromEnd なら最後）の接続詞が、and / or と同じ深さの同じ語ならその位置。でなければ -1。 */
const sameConjunctionIn = (scope: ItemScope, item: TokenRange, word: string, fromEnd: boolean): number => {
  const at = fromEnd ? lastAt(scope, "conjunction", item) : firstAt(scope, "conjunction", item);
  const sameDepth = scope.sentence.depths[at] === scope.level;
  return sameDepth && scope.sentence.tokens[at]?.surface.toLowerCase() === word ? at : -1;
};

/**
 * 読点を打たずに同じ接続詞を重ねた並び（questions and issues and use cases）。読点を打たない書き方なので、最後の and の前に
 * 読点を打つかの選択を見せない。最後の項目か and の後ろの項目に同じ接続詞があり、2 つの接続詞のあいだが形容詞と名詞だけで、
 * 接続詞の後ろの頭の語どうしが同じ品詞のとき。品詞が違えば、並びのあとに述語や節をつないでいる（apples, pears and plums and ship
 * them daily / engineers and they shipped）。あいだに前置詞や動詞があれば、後ろの接続詞は項目の中のもの（clean water and other
 * attributes important to our physical and mental health）。
 */
export const repeatsConjunction = (scope: ItemScope, at: number, view: View, afterItem: TokenRange): boolean => {
  const last = lastOf(view);
  const word = scope.sentence.tokens[at]?.surface.toLowerCase() ?? "";
  if (last === undefined || commaBefore(scope, at)) return false;
  const kind = firstContent(scope, afterItem)?.pos;
  const before = sameConjunctionIn(scope, last.item, word, true);
  const later = sameConjunctionIn(scope, afterItem, word, false);
  const bareBefore = before !== -1 && isBareNounPhrase(scope, { start: before + 1, end: at });
  const bareLater = later !== -1 && isBareNounPhrase(scope, { start: at + 1, end: later });
  const startsLike = (conjunction: number, end: number): boolean => firstContent(scope, { start: conjunction + 1, end })?.pos === kind;
  return kind !== undefined && ((bareBefore && startsLike(before, at)) || (bareLater && startsLike(later, afterItem.end)));
};
