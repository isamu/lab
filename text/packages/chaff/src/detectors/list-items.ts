import {
  exampleEnd,
  firstContent,
  hasContent,
  hasPrepositionalTail,
  hasVerb,
  isClause,
  lastContent,
  openingOf,
  participleOpening,
  shapeOf,
} from "./list-item.ts";
import { isListConjunction, scopeOf, VERBAL, type ItemScope, type ListSentence } from "./list-sentence.ts";
import { lowerBound, type TokenRange } from "./token-column.ts";

// and / or の前の項目を、節の頭から読点ごとに切った並び。and / or ごとに節の頭から切り直すと、and の多い文で語数の二乗になる。
// ここでは深さごとに一度だけ左から読み、読点で閉じた項目は固めて、並び全体への問い（どれも節か、最後に例の句がある項目はどれか）
// に答えるための表を足していく。and / or のたびに作るのは、まだ閉じていない最後の 1、2 項目だけ。

/** 項目ごとに一度だけ答えを覚えておく問い。 */
export type Flag = "closed" | "example" | "participle" | "verbalShape" | "hasVerb" | "isClause" | "prepositionalTail" | "notNounHead" | "notProperNounHead";

type FlagTest = (scope: ItemScope, item: TokenRange) => boolean;

export const FLAG_TESTS: Readonly<Record<Flag, FlagTest>> = {
  closed: (scope, item) => isListConjunction(openingOf(scope, item)),
  example: (scope, item) => exampleEnd(scope, item) !== -1,
  participle: (scope, item) => participleOpening(scope, item) !== undefined,
  verbalShape: (scope, item) => VERBAL.has(shapeOf(scope, item) ?? ""),
  hasVerb,
  isClause,
  prepositionalTail: hasPrepositionalTail,
  notNounHead: (scope, item) => firstContent(scope, item)?.pos !== "NOUN",
  notProperNounHead: (scope, item) => firstContent(scope, item)?.pos !== "PROPN",
};

const FLAGS = Object.keys(FLAG_TESTS).filter((name): name is Flag => Object.hasOwn(FLAG_TESTS, name));

type PerFlag<T> = Record<Flag, T>;

const perFlag = <T>(make: () => T): PerFlag<T> => ({
  closed: make(),
  example: make(),
  participle: make(),
  verbalShape: make(),
  hasVerb: make(),
  isClause: make(),
  prepositionalTail: make(),
  notNounHead: make(),
  notProperNounHead: make(),
});

/** 閉じた項目と、その問いの答え。trueAt は答えが真の項目の位置、lastFalse は最後に偽だった位置（WithContent は中身のある項目だけ）。 */
type Frozen = {
  readonly items: TokenRange[];
  readonly content: boolean[];
  readonly contentAt: number[];
  readonly shapes: (string | undefined)[];
  /** 中身のある項目のうち、次の中身のある項目と頭の形が違う最後のもの。無ければ -1。 */
  lastShapeChange: number;
  readonly flags: PerFlag<boolean[]>;
  readonly trueAt: PerFlag<number[]>;
  readonly trueWithContentAt: PerFlag<number[]>;
  readonly lastFalse: PerFlag<number>;
  readonly lastFalseWithContent: PerFlag<number>;
};

const emptyFrozen = (): Frozen => ({
  items: [],
  content: [],
  contentAt: [],
  shapes: [],
  lastShapeChange: -1,
  flags: perFlag((): boolean[] => []),
  trueAt: perFlag((): number[] => []),
  trueWithContentAt: perFlag((): number[] => []),
  lastFalse: perFlag(() => -1),
  lastFalseWithContent: perFlag(() => -1),
});

const recordFlags = (frozen: Frozen, scope: ItemScope, item: TokenRange, content: boolean): void => {
  const index = frozen.items.length - 1;
  FLAGS.forEach((flag) => {
    const holds = FLAG_TESTS[flag](scope, item);
    frozen.flags[flag].push(holds);
    if (holds) frozen.trueAt[flag].push(index);
    else frozen.lastFalse[flag] = index;
    if (holds && content) frozen.trueWithContentAt[flag].push(index);
    if (!holds && content) frozen.lastFalseWithContent[flag] = index;
  });
};

const freeze = (frozen: Frozen, scope: ItemScope, item: TokenRange): void => {
  const content = hasContent(scope, item);
  const shape = shapeOf(scope, item);
  const previous = frozen.contentAt.at(-1);
  frozen.items.push(item);
  frozen.content.push(content);
  frozen.shapes.push(shape);
  if (content && previous !== undefined && frozen.shapes[previous] !== shape) frozen.lastShapeChange = previous;
  if (content) frozen.contentAt.push(frozen.items.length - 1);
  recordFlags(frozen, scope, item, content);
};

/** 形容詞のあとの読点は、名詞の前で形容詞を重ねているだけのことが多い（the long, winding bridge）。次の項目が名詞で終わるならつなげ直す。 */
const stacks = (scope: ItemScope, previous: TokenRange, item: TokenRange): boolean =>
  lastContent(scope, previous)?.pos === "ADJ" && lastContent(scope, item)?.pos !== "ADJ";

/** 1 つの深さの並び。start は節の頭、rawStart は読点でまだ閉じていない項目の頭、pending は次の項目とつながりうる最後の項目。 */
type LevelItems = {
  readonly start: number;
  readonly scope: ItemScope;
  readonly commas: readonly number[];
  nextComma: number;
  rawStart: number;
  pending: TokenRange | undefined;
  readonly frozen: Frozen;
};

/** 節の頭から and / or までの項目。閉じた項目の表と、まだ閉じていない最後の 1、2 項目。 */
export type ItemList = { readonly scope: ItemScope; readonly frozen: Frozen; readonly tail: readonly TokenRange[] };

const addItem = (items: LevelItems, item: TokenRange): void => {
  if (item.end <= item.start) return;
  if (items.pending !== undefined && stacks(items.scope, items.pending, item)) {
    items.pending = { start: items.pending.start, end: item.end };
    return;
  }
  if (items.pending !== undefined) freeze(items.frozen, items.scope, items.pending);
  items.pending = item;
};

const tailOf = (scope: ItemScope, pending: TokenRange | undefined, live: TokenRange | undefined): TokenRange[] => {
  if (live === undefined) return pending === undefined ? [] : [pending];
  if (pending === undefined) return [live];
  return stacks(scope, pending, live) ? [{ start: pending.start, end: live.end }] : [pending, live];
};

/** 深さごとの並びを、and / or の位置 at まで読み進める。at は呼ぶたびに大きくなる。返した並びは、次に読み進めるまでのもの。 */
export const listReader = (sentence: ListSentence): ((at: number) => ItemList) => {
  const byLevel = new Map<number, LevelItems>();
  const opened = (level: number, start: number): LevelItems => {
    const known = byLevel.get(level);
    if (known !== undefined && known.start === start) return known;
    const commas = sentence.commas.get(level) ?? [];
    const scope = scopeOf(sentence, level);
    const fresh = { start, scope, commas, nextComma: lowerBound(commas, start), rawStart: start, pending: undefined, frozen: emptyFrozen() };
    byLevel.set(level, fresh);
    return fresh;
  };
  return (at) => {
    const level = sentence.depths[at] ?? 0;
    const items = opened(level, (sentence.column.clauseBreak.previous[at] ?? -1) + 1);
    const reached = lowerBound(items.commas, at);
    items.commas.slice(items.nextComma, reached).forEach((comma) => {
      addItem(items, { start: items.rawStart, end: comma });
      items.rawStart = comma + 1;
    });
    items.nextComma = reached;
    const live = items.rawStart < at ? { start: items.rawStart, end: at } : undefined;
    return { scope: items.scope, frozen: items.frozen, tail: tailOf(items.scope, items.pending, live) };
  };
};
