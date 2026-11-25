// An and / or that joins words inside the last item rather than the list's last two items: an item not finished yet
// ("on or before", "a flexible and lightweight grid") or a run that repeats the conjunction without commas. Pure.
import {
  commaBefore,
  contentCount,
  firstAt,
  firstContent,
  hasDeterminer,
  isBareIndefiniteModifier,
  isBareNounPhrase,
  isBarePreposition,
  lastAt,
  lastContent,
} from "./list-item.ts";
import type { ItemScope } from "./list-sentence.ts";
import { lastOf, secondLastOf, type View } from "./list-view.ts";
import type { TokenRange } from "./token-column.ts";

/**
 * 最後の項目がまだ閉じていない語だけなら、and / or はその語と後ろの語を結び、後ろの名詞や目的語を共有する。前置詞だけ
 * （on or before Jan 23/58）か、不定冠詞と形容詞だけ（Neat, a flexible and lightweight Sass grid）。and / or の後ろが前置詞だけでも、
 * 2 つの小辞を結んでいる（drive in and out）。
 */
export const joinsUnfinished = (scope: ItemScope, at: number, view: View, afterItem: TokenRange): boolean => {
  const last = lastOf(view);
  if (last === undefined || commaBefore(scope, at)) return false;
  return isBarePreposition(scope, last.item) || isBareIndefiniteModifier(scope, last.item) || isBarePreposition(scope, afterItem);
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

/** 冠詞を連れない名詞 1 語だけの項目（taxis）。 */
const isBareNoun = (scope: ItemScope, item: TokenRange): boolean =>
  contentCount(scope, item) === 1 && firstContent(scope, item)?.pos === "NOUN" && !hasDeterminer(scope, item);

const endsPlural = (scope: ItemScope, item: TokenRange): boolean => lastContent(scope, item)?.features?.["Number"] === "Plur";

/**
 * 読点の無い or が、複数形の名詞 1 語と名詞 1 語を結び、その前の項目が複数形の名詞で終わらなければ、or は最後の項目の中で 2 つの
 * 選択肢を結ぶ（airfare, train tickets, parking, taxis or rideshares）。前の項目も複数形なら同じ形の並び（apples, pears or plums）、
 * or の前が単数なら選択肢の並び（by card, cheque or cash）。解析器は見慣れない複数形（rideshares）に数を付けないので、or の後ろは数を問わない。
 */
export const pairsAlternatives = (scope: ItemScope, at: number, view: View, afterItem: TokenRange): boolean => {
  const [previous, last] = [secondLastOf(view), lastOf(view)];
  if (previous === undefined || last === undefined || commaBefore(scope, at)) return false;
  if (scope.sentence.tokens[at]?.surface.toLowerCase() !== "or") return false;
  return isBareNoun(scope, last.item) && endsPlural(scope, last.item) && isBareNoun(scope, afterItem) && !endsPlural(scope, previous.item);
};
