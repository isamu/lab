import type { StructureNode } from "../plugin.ts";

/**
 * 相対の参照（relative-find.ts が見つけたもの）に番地を与える。木ができてからでないと「次条」は決まらないので、ここは木を読むだけの後段。
 * 前・次は、書いた場所を含む同じ深さのまとまりの前後。条は文書を通して並ぶので文書全体、項と号は同じ親の中で数える。
 * 同は、その前の参照（相対のものも含む）の番地を、その深さまで切ったもの。他の文書を指していれば、それも引き継ぐ。
 * 番地を決められないもの（最初の条の「前条」、何も引いていない「同条」）は木から外す。当て推量の番地で誤りを言わない。
 */

/** range は「第四十三条から第五十五条まで 削除」のように、一行で並びをまとめたもの。番地は最初のものしか持たない。 */
type Place = { readonly address: string; readonly level: number; readonly range?: boolean };

type Last = { readonly target: string; readonly document: string | undefined };

const NUMBERED = new Set(["chapter", "article", "item"]);

const placeOf = (node: StructureNode): Place | undefined =>
  NUMBERED.has(node.kind) && node.level !== undefined ? { address: node.address, level: node.level, range: node.ordinalTo !== undefined } : undefined;

/** 番号の付いた子。Markdown の見出し（section）は番号の外なので、その中まで見る。 */
const numberedChildren = (node: StructureNode, level: number): StructureNode[] =>
  node.children.flatMap((child) => {
    if (NUMBERED.has(child.kind)) return child.level === level ? [child] : [];
    return child.kind === "section" ? numberedChildren(child, level) : [];
  });

type Context = {
  readonly articles: readonly Place[];
  /** 条の深さ。同の番地を切るときの起点。 */
  readonly articleLevel: number | undefined;
  /** 最初のものに番号を振らない深さ（法令の項）。 */
  readonly implicitLevel: number | undefined;
  /** 深さごとに、最後に名指しされた番地。「前項」は項だけを名指しするので、「同条」の行き先を変えない。 */
  readonly last: Map<number, Last>;
  /** 参照を、始まる位置で引けるようにする。「若しくは第九項」のような並びの続きが、元の参照を引く。 */
  readonly byStart: Map<number, Last>;
};

/** 同じ親の下で同じ深さのもの。番号の無い最初のもの（法令の第 1 項）があるなら、それを先頭に足す。 */
const siblingsUnder = (parent: StructureNode, level: number, implicitLevel: number | undefined): Place[] => {
  const children = numberedChildren(parent, level);
  const explicit = children.flatMap((child) => {
    const place = placeOf(child);
    return place === undefined ? [] : [place];
  });
  const firstOrdinal = children[0]?.ordinal;
  const implicit = level === implicitLevel && parent.level === level - 1 && firstOrdinal !== 1;
  return implicit ? [{ address: `${parent.address}.1`, level }, ...explicit] : explicit;
};

type Anchor = { readonly place: Place; readonly siblings: readonly Place[] };

/** 書いた場所を含む、その深さのまとまり。第 1 項の本文にいて項が開いていなければ、番号の無い第 1 項。 */
const anchorAt = (path: readonly StructureNode[], level: number, context: Context): Anchor | undefined => {
  const index = path.findLastIndex((node) => NUMBERED.has(node.kind) && node.level === level);
  const node = path[index];
  if (node !== undefined) {
    const place = placeOf(node);
    // 親は番号の付いた一つ上のまとまり。あいだの Markdown の見出しは飛ばす。無ければ文書（条より外のまとまり）。
    const parent = path.slice(0, index).findLast((candidate) => NUMBERED.has(candidate.kind) && (candidate.level ?? 0) < level) ?? path[0];
    if (place === undefined || parent === undefined) return undefined;
    return { place, siblings: node.kind === "article" ? context.articles : siblingsUnder(parent, level, context.implicitLevel) };
  }
  const parent = path.findLast((candidate) => NUMBERED.has(candidate.kind) && candidate.level === level - 1);
  if (level !== context.implicitLevel || parent === undefined) return undefined;
  const siblings = siblingsUnder(parent, level, context.implicitLevel);
  const first = siblings[0];
  return first === undefined ? undefined : { place: first, siblings };
};

/**
 * by だけ前後にずらす。範囲の行（第四十三条から第五十五条まで 削除）は中の条を一つずつ持たないので、数えてまたげば行き先がずれる。
 * 前に数えて範囲をまたぐか範囲に当たる、後ろに数えて範囲をまたぐなら決めない。後ろに数えて範囲に当たるのは、その最初の条なので正しい。
 */
const shifted = (anchor: Anchor, by: number): Place | undefined => {
  const index = anchor.siblings.findIndex((place) => place.address === anchor.place.address);
  if (index === -1) return undefined;
  const crossed = by > 0 ? anchor.siblings.slice(index + 1, index + by) : anchor.siblings.slice(Math.max(0, index + by), index);
  return crossed.some((place) => place.range === true) ? undefined : anchor.siblings[index + by];
};

/** 前の全部（前各項）は、前に一つでもあれば最初のもの。 */
const allBefore = (anchor: Anchor): Place | undefined => (shifted(anchor, -1) === undefined ? undefined : anchor.siblings[0]);

/**
 * 前・次・本で決まる場所。「各」（count 0）は前の全部なので、最初のものを指す。
 */
const byPosition = (way: string, count: number, anchor: Anchor): Place | undefined => {
  if (way === "current") return anchor.place;
  if (way === "after") return shifted(anchor, Math.max(count, 1));
  return count === 0 ? allBefore(anchor) : shifted(anchor, -count);
};

/** 同: その前の参照の番地を、この深さまで切る。条より外のまとまりは番地の形が違うので扱わない。 */
const bySame = (level: number, last: Last | undefined): Place | undefined => (last === undefined ? undefined : { address: last.target, level });

/** 並びの続き: 元の参照の番地を、この深さまで切る。元の参照の番地が決まらなければ決めない。 */
const continued = (level: number, node: StructureNode, context: Context): Last | undefined => {
  const origin = context.byStart.get(node.span.start - Number(node.attrs["continues"]));
  if (origin === undefined || context.articleLevel === undefined || level < context.articleLevel) return undefined;
  const parts = origin.target.split(".");
  const kept = level - context.articleLevel + 1;
  return parts.length < kept ? undefined : { target: parts.slice(0, kept).join("."), document: origin.document };
};

/**
 * 参照が名指しした深さを覚える。名指しは、書き出しの深さ（第〇条なら条、前項なら項）から番地の深さまで。
 * 番地を深さで切る起点は条。条より外のまとまりは番地の形が違うので覚えない。
 */
const remember = (context: Context, target: string, document: string | undefined, from: number): void => {
  const articleLevel = context.articleLevel;
  // 章・節は番地の形（ch1）が条から始まらないので覚えない。覚えると「同条」が章を指してしまう。
  if (articleLevel === undefined || from < articleLevel) return;
  const parts = target.split(".");
  parts.forEach((_, index) => {
    const level = articleLevel + index;
    if (level >= from) context.last.set(level, { target: parts.slice(0, index + 1).join("."), document });
  });
};

/** 「第二項第三号」を足す。一つ深いものは続け、二つ深い号は番号の無い第 1 項の中（x.1.n）に置く。 */
const withSuffix = (place: Place, suffix: string, implicitLevel: number | undefined): Place | undefined =>
  suffix
    .split(",")
    .filter((part) => part !== "")
    .reduce<Place | undefined>((current, part) => {
      const [depth, value] = part.split(":").map(Number);
      if (current === undefined || depth === undefined || value === undefined) return undefined;
      if (depth === current.level + 1) return { address: `${current.address}.${String(value)}`, level: depth };
      if (implicitLevel === current.level + 1 && depth === current.level + 2) return { address: `${current.address}.1.${String(value)}`, level: depth };
      return undefined;
    }, place);

/** 番号の無い第 1 項（x.1）は、条そのものでもある。 */
const fallbackOf = (place: Place, implicitLevel: number | undefined): string | undefined =>
  place.level === implicitLevel && place.address.endsWith(".1") ? place.address.slice(0, -".1".length) : undefined;

const baseOf = (way: string, node: StructureNode, anchor: Anchor | undefined, last: Last | undefined, context: Context): Place | undefined => {
  const level = Number(node.attrs["level"]);
  if (way === "same") return bySame(level, last);
  if (way === "continue") {
    const origin = continued(level, node, context);
    return origin === undefined ? undefined : { address: origin.target, level };
  }
  return anchor === undefined ? undefined : byPosition(way, Number(node.attrs["count"]), anchor);
};

/** 同と並びの続きは、元の参照が他の文書を指していれば、それを引き継ぐ。前・次・本はこの文書の中。 */
const documentOf = (way: string, node: StructureNode, last: Last | undefined, context: Context): string | undefined => {
  if (way === "same") return last?.document;
  return way === "continue" ? continued(Number(node.attrs["level"]), node, context)?.document : undefined;
};

const resolveOne = (node: StructureNode, path: readonly StructureNode[], context: Context): StructureNode | undefined => {
  const way = String(node.attrs["relative"]);
  const level = Number(node.attrs["level"]);
  const last = context.last.get(level);
  const anchor = way === "same" || way === "continue" ? undefined : anchorAt(path, level, context);
  const base = baseOf(way, node, anchor, last, context);
  const place = base === undefined ? undefined : withSuffix(base, String(node.attrs["suffix"] ?? ""), context.implicitLevel);
  if (place === undefined) return undefined;
  const fallback = fallbackOf(place, context.implicitLevel);
  const document = documentOf(way, node, last, context);
  const attrs = {
    target: place.address,
    label: String(node.attrs["label"]),
    ...(fallback === undefined ? {} : { fallback }),
    ...(document === undefined ? {} : { document }),
  };
  return { ...node, attrs };
};

const isRelative = (node: StructureNode): boolean => node.kind === "reference" && node.attrs["relative"] !== undefined;

/** 文書の順に読み、参照ごとに「その前の参照」を覚える。 */
const walk = (node: StructureNode, path: readonly StructureNode[], context: Context): StructureNode | undefined => {
  if (isRelative(node)) {
    const resolved = resolveOne(node, path, context);
    const target = resolved === undefined ? undefined : String(resolved.attrs["target"]);
    const document = optional(resolved?.attrs["document"]);
    if (target !== undefined) context.byStart.set(node.span.start, { target, document });
    if (target !== undefined) remember(context, target, document, Number(node.attrs["names"] ?? node.attrs["level"]));
    return resolved;
  }
  if (node.kind === "reference") {
    const target = String(node.attrs["target"]);
    const document = optional(node.attrs["document"]);
    context.byStart.set(node.span.start, { target, document });
    remember(context, target, document, context.articleLevel ?? 0);
  }
  const inside = [...path, node];
  const children = node.children.flatMap((child) => {
    const kept = walk(child, inside, context);
    return kept === undefined ? [] : [kept];
  });
  return { ...node, children };
};

const optional = (value: string | number | undefined): string | undefined => (value === undefined ? undefined : String(value));

const articlesOf = (node: StructureNode): Place[] => {
  const place = node.kind === "article" ? placeOf(node) : undefined;
  return [...(place === undefined ? [] : [place]), ...node.children.flatMap(articlesOf)];
};

export const resolveRelative = (tree: StructureNode, implicitLevel: number | undefined): StructureNode => {
  const articles = articlesOf(tree);
  return walk(tree, [], { articles, articleLevel: articles[0]?.level, implicitLevel, last: new Map(), byStart: new Map() }) ?? tree;
};
