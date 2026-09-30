import { hasContent, shapeOf } from "./list-item.ts";
import { FLAG_TESTS, type Flag, type ItemList } from "./list-items.ts";
import { lowerBound, type TokenRange } from "./token-column.ts";

// 並びを切り直したもの。並びの頭を外す、途中の項目のあとから読む、中身の無い項目を除く、の 3 つだけで作れるので、
// 「先頭に置いた項目（pre）+ 並びの from 番目から後ろ（contentOnly なら中身のある項目だけ）」で表す。項目の配列は作らない。

export type View = { readonly list: ItemList; readonly pre: TokenRange | undefined; readonly from: number; readonly contentOnly: boolean };

/** 並びの中の項目。j は並びの中の位置で、pre は -1。 */
export type Member = { readonly item: TokenRange; readonly j: number };

export const wholeList = (list: ItemList): View => ({ list, pre: undefined, from: 0, contentOnly: false });

const frozenCount = (list: ItemList): number => list.frozen.items.length;

const listCount = (list: ItemList): number => frozenCount(list) + list.tail.length;

const itemAt = (list: ItemList, j: number): TokenRange | undefined => (j < frozenCount(list) ? list.frozen.items[j] : list.tail[j - frozenCount(list)]);

const contentAt = (list: ItemList, j: number): boolean => {
  const item = itemAt(list, j);
  if (j < frozenCount(list)) return list.frozen.content[j] ?? false;
  return item !== undefined && hasContent(list.scope, item);
};

const kept = (view: View, j: number): boolean => !view.contentOnly || contentAt(view.list, j);

const flagAt = (list: ItemList, j: number, flag: Flag): boolean => {
  const item = itemAt(list, j);
  if (j < frozenCount(list)) return list.frozen.flags[flag][j] ?? false;
  return item !== undefined && FLAG_TESTS[flag](list.scope, item);
};

const tailPositions = (list: ItemList, from: number): number[] => list.tail.map((__item, offset) => frozenCount(list) + offset).filter((j) => j >= from);

const member = (list: ItemList, j: number): Member | undefined => {
  const item = j === -1 ? undefined : itemAt(list, j);
  return item === undefined ? undefined : { item, j };
};

/** from 以後の、閉じた項目の最初の位置。無ければ -1。 */
const firstFrozenFrom = (view: View, from: number): number => {
  const { frozen } = view.list;
  if (view.contentOnly) return frozen.contentAt[lowerBound(frozen.contentAt, from)] ?? -1;
  return from < frozen.items.length ? from : -1;
};

/** from 以後の最初の項目の位置。無ければ -1。 */
const firstFrom = (view: View, from: number): number => {
  const frozen = firstFrozenFrom(view, from);
  if (frozen !== -1) return frozen;
  return tailPositions(view.list, from).find((j) => kept(view, j)) ?? -1;
};

/** before より前の、view.from 以後の最後の項目の位置。無ければ -1。 */
const lastBefore = (view: View, before: number): number => {
  const { list } = view;
  const fromTail = tailPositions(list, view.from)
    .filter((j) => j < before && kept(view, j))
    .at(-1);
  if (fromTail !== undefined) return fromTail;
  const end = Math.min(before, frozenCount(list));
  const frozen = view.contentOnly ? (list.frozen.contentAt[lowerBound(list.frozen.contentAt, end) - 1] ?? -1) : end - 1;
  return frozen >= view.from ? frozen : -1;
};

const preMember = (view: View): Member | undefined => (view.pre === undefined ? undefined : { item: view.pre, j: -1 });

export const firstOf = (view: View): Member | undefined => preMember(view) ?? member(view.list, firstFrom(view, view.from));

export const secondOf = (view: View): Member | undefined => {
  const first = view.pre === undefined ? firstFrom(view, view.from) : view.from - 1;
  return first === -1 ? undefined : member(view.list, firstFrom(view, first + 1));
};

export const lastOf = (view: View): Member | undefined => member(view.list, lastBefore(view, listCount(view.list))) ?? preMember(view);

export const secondLastOf = (view: View): Member | undefined => {
  const last = lastBefore(view, listCount(view.list));
  if (last === -1) return undefined;
  return member(view.list, lastBefore(view, last)) ?? preMember(view);
};

export const sizeOf = (view: View): number => {
  const { list } = view;
  const frozen = view.contentOnly ? list.frozen.contentAt.length - lowerBound(list.frozen.contentAt, view.from) : Math.max(0, frozenCount(list) - view.from);
  const tail = tailPositions(list, view.from).filter((j) => kept(view, j)).length;
  return (view.pre === undefined ? 0 : 1) + frozen + tail;
};

/** 先頭の項目を外す。 */
export const withoutFirst = (view: View): View => {
  if (view.pre !== undefined) return { ...view, pre: undefined };
  const first = firstFrom(view, view.from);
  return { ...view, from: first === -1 ? listCount(view.list) : first + 1 };
};

/** その項目より後ろ。 */
export const after = (view: View, at: Member): View => ({ ...view, pre: undefined, from: at.j === -1 ? view.from : at.j + 1 });

/** 先頭に項目を置いた、中身のある項目だけの並び。 */
export const contentOnlyWith = (view: View, pre: TokenRange | undefined): View => ({
  ...view,
  pre: pre !== undefined && hasContent(view.list.scope, pre) ? pre : undefined,
  contentOnly: true,
});

const holdsFor = (view: View, flag: Flag, item: TokenRange): boolean => FLAG_TESTS[flag](view.list.scope, item);

/** 問いが真になる最後の項目。 */
export const findLast = (view: View, flag: Flag): Member | undefined => {
  const { list } = view;
  const fromTail = tailPositions(list, view.from)
    .filter((j) => kept(view, j) && flagAt(list, j, flag))
    .at(-1);
  if (fromTail !== undefined) return member(list, fromTail);
  const frozen = (view.contentOnly ? list.frozen.trueWithContentAt : list.frozen.trueAt)[flag].at(-1) ?? -1;
  if (frozen >= view.from) return member(list, frozen);
  return view.pre !== undefined && holdsFor(view, flag, view.pre) ? preMember(view) : undefined;
};

/** 2 番目以後で、問いが真になる最初の項目。 */
export const findAfterFirst = (view: View, flag: Flag): Member | undefined => {
  const { list } = view;
  const first = view.pre === undefined ? firstFrom(view, view.from) : view.from - 1;
  if (first === -1) return undefined;
  const found = view.contentOnly ? list.frozen.trueWithContentAt[flag] : list.frozen.trueAt[flag];
  const frozen = found[lowerBound(found, first + 1)];
  if (frozen !== undefined) return member(list, frozen);
  return member(list, tailPositions(list, first + 1).find((j) => kept(view, j) && flagAt(list, j, flag)) ?? -1);
};

export const some = (view: View, flag: Flag): boolean => findLast(view, flag) !== undefined;

export const every = (view: View, flag: Flag): boolean => {
  const { list } = view;
  if (view.pre !== undefined && !holdsFor(view, flag, view.pre)) return false;
  if ((view.contentOnly ? list.frozen.lastFalseWithContent : list.frozen.lastFalse)[flag] >= view.from) return false;
  return tailPositions(list, view.from).every((j) => !kept(view, j) || flagAt(list, j, flag));
};

/** 中身のある項目の頭の形が、1 種類以下か。 */
export const sameShapes = (view: View): boolean => {
  const { list } = view;
  const { frozen } = list;
  const lastFrozen = frozen.contentAt.at(-1) ?? -1;
  if (lastFrozen >= view.from && frozen.lastShapeChange >= view.from) return false;
  const shapes = new Set([
    ...(view.pre === undefined || !hasContent(list.scope, view.pre) ? [] : [shapeOf(list.scope, view.pre)]),
    ...(lastFrozen >= view.from ? [frozen.shapes[lastFrozen]] : []),
    ...tailPositions(list, view.from)
      .filter((j) => contentAt(list, j))
      .map((j) => shapeOf(list.scope, itemAt(list, j) ?? { start: 0, end: 0 })),
  ]);
  return shapes.size <= 1;
};
