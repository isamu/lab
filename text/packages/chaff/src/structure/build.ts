import { markdownOutline, type Heading } from "../document.ts";
import { maskSpans } from "../mask.ts";
import type { Mention, NumberedLine, NumberingContext, StructureKind, StructureNode, StructurePatterns } from "../plugin.ts";
import { lineNumberAt, linesOf, type Line } from "./lines.ts";
import { dottedNumber } from "./universal.ts";

/** 組み立て中の節点。できあがったら StructureNode に固める。 */
type Draft = {
  readonly kind: StructureKind;
  readonly address: string;
  readonly start: number;
  end: number;
  readonly line: number;
  readonly attrs: Readonly<Record<string, string | number>>;
  readonly children: Draft[];
};

/** 開いている節点。rank の大きいものほど内側。 */
type Frame = { readonly draft: Draft; readonly rank: number; readonly numbered?: NumberedLine | undefined };

/**
 * 見出しは深さ 1〜6 を rank にする。番号のまとまりは必ず見出しの内側に入るので、
 * それより大きい rank から数える。「## 第3条」の下の番号だけの項は、見出しに閉じられずに条の中へ入る。
 */
const NUMBERED_RANK = 10;

type State = {
  readonly stack: Frame[];
  /** 見出しの深さごとの通し番号。番号の無い見出しの番地 h2.1 を作る。 */
  readonly headingCounts: number[];
};

const draftOf = (kind: StructureKind, address: string, line: Line, attrs: Readonly<Record<string, string | number>>): Draft => ({
  kind,
  address,
  start: line.start,
  end: line.start + line.text.length,
  line: line.number,
  attrs,
  children: [],
});

const top = (state: State): Frame => {
  const frame = state.stack.at(-1);
  if (frame === undefined) throw new Error("the document frame was closed");
  return frame;
};

/** 自分と同じか内側の rank を閉じてから、親の子として開く。 */
const open = (state: State, frame: Frame): void => {
  while (state.stack.length > 1 && top(state).rank >= frame.rank) state.stack.pop();
  top(state).draft.children.push(frame.draft);
  state.stack.push(frame);
};

const nearestNumbered = (state: State): Frame | undefined => [...state.stack].reverse().find((frame) => frame.numbered !== undefined);

const nearestSection = (state: State): Frame | undefined => [...state.stack].reverse().find((frame) => frame.draft.kind === "section");

/**
 * 条番号や 4.2 はそれだけで番地になる。項・号・(a) は親の番地に続ける。親が無ければ節の中の番号とする。
 * 呼ぶ前に自分と同じか内側の rank は閉じてあるので、残っている番号付きの節点が親。
 */
const addressOf = (state: State, numbered: NumberedLine): string => {
  if (numbered.absolute) return numbered.number;
  const parent = nearestNumbered(state);
  if (parent !== undefined) return `${parent.draft.address}.${numbered.number}`;
  const section = nearestSection(state);
  return section === undefined ? numbered.number : `${section.draft.address}/${numbered.number}`;
};

/** 飛ばした深さは 0 と数える。「# A」の直後の「### C」は h1.0.1。番地に空の部品を作らない。 */
const headingAddress = (state: State, depth: number): string => {
  state.headingCounts[depth - 1] = (state.headingCounts[depth - 1] ?? 0) + 1;
  state.headingCounts.fill(0, depth);
  const counts = Array.from({ length: depth }, (_, index) => state.headingCounts[index] ?? 0);
  return `h${counts.map((count) => String(count)).join(".")}`;
};

/**
 * 見出しに書いた番号（「## 第3条」）は、見出しの深さで入れ子にする。本文の番号は見出しの内側に入る。
 * 見出しの深さを捨てると、「## 第3条」の下の「### 詳細」が条の外に出てしまう。
 */
const openNumbered = (state: State, line: Line, numbered: NumberedLine, headingDepth: number | undefined): void => {
  const attrs = { label: numbered.label, ...(numbered.heading === "" ? {} : { heading: numbered.heading }) };
  const rank = headingDepth ?? NUMBERED_RANK + numbered.depth;
  // 番地は、自分と同じか内側を閉じてから決める。閉じる前だと、同じ深さの前の条を親と取り違える。
  while (state.stack.length > 1 && top(state).rank >= rank) state.stack.pop();
  open(state, { draft: draftOf(numbered.kind, addressOf(state, numbered), line, attrs), rank, numbered });
};

const openSection = (state: State, line: Line, heading: Heading): void => {
  while (state.stack.length > 1 && top(state).rank >= heading.depth) state.stack.pop();
  open(state, { draft: draftOf("section", headingAddress(state, heading.depth), line, { heading: heading.text }), rank: heading.depth });
};

const LEAVES: readonly { readonly kind: StructureKind; readonly find: (patterns: StructurePatterns, text: string) => readonly Mention[] }[] = [
  { kind: "definition", find: (patterns, text) => patterns.definitions(text) },
  { kind: "reference", find: (patterns, text) => patterns.references(text) },
  { kind: "obligation", find: (patterns, text) => patterns.obligations(text) },
  { kind: "quantity", find: (patterns, text) => patterns.quantities(text) },
  { kind: "date", find: (patterns, text) => patterns.dates?.(text) ?? [] },
];

/** 言語を問わない通し番号。後ろが単位なら数量なので番号にしない。 */
const universalNumber = (patterns: StructurePatterns, text: string, context: NumberingContext): NumberedLine | undefined => {
  const dotted = dottedNumber(text, context);
  return dotted !== undefined && patterns.countedAfter?.(dotted.number, dotted.rest) === true ? undefined : dotted;
};

/** 行の中の定義・参照・義務・数量を、いま開いている最も内側の節点の子にする。 */
const addLeaves = (state: State, patterns: StructurePatterns, line: Line, text: string, offset: number): void => {
  const parent = top(state).draft;
  const leaves = LEAVES.flatMap(({ kind, find }) =>
    find(patterns, text).map((mention) => ({ kind, start: line.start + offset + mention.start, end: line.start + offset + mention.end, attrs: mention.attrs })),
  ).sort((left, right) => left.start - right.start);
  leaves.forEach((leaf) =>
    parent.children.push({ kind: leaf.kind, address: "", start: leaf.start, end: leaf.end, line: line.number, attrs: leaf.attrs, children: [] }),
  );
};

const extend = (state: State, end: number): void => {
  state.stack.forEach((frame) => {
    frame.draft.end = Math.max(frame.draft.end, end);
  });
};

const freeze = (draft: Draft): StructureNode => ({
  kind: draft.kind,
  address: draft.address,
  span: { start: draft.start, end: draft.end },
  line: draft.line,
  attrs: draft.attrs,
  children: draft.children.map(freeze),
});

export type StructureInput = { readonly path: string; readonly source: string; readonly language: string; readonly markdown: boolean };

/** 見出しのある行を、行番号から引けるようにする。見出しごとに全行を探し直さない。 */
const headingsByLine = (lines: readonly Line[], headings: readonly Heading[]): Map<number, Heading> =>
  new Map(
    headings.flatMap((heading) => {
      const number = lineNumberAt(lines, heading.start);
      if (number === undefined) return [];
      const entry: [number, Heading] = [number, heading];
      return [entry];
    }),
  );

/** 見出しの行から「#」の印を外した文字列。コードを覆った後の行から取るので、見出しの中のコードも読まない。 */
const atxText = (text: string): string => {
  const body = text
    .trim()
    .replace(/^#{1,6}(?=[ \t]|$)/u, "")
    .trim();
  const closing = body.search(/[ \t]#+$/u);
  return (closing === -1 ? body : body.slice(0, closing)).trim();
};

const readLine = (state: State, patterns: StructurePatterns, line: Line, heading: Heading | undefined): void => {
  const text = heading === undefined ? line.text : atxText(line.text);
  const openNumbers = state.stack.flatMap((frame) => (frame.numbered === undefined ? [] : [frame.numbered]));
  const context = { open: openNumbers, isHeading: heading !== undefined };
  const numbered = patterns.numbered(text, context) ?? universalNumber(patterns, text, context);
  // 番号付きの見出しも見出しの通し番号を進める。進めないと、その下の「### 詳細」が前の見出しの番地を名乗る。
  if (numbered !== undefined && heading !== undefined) headingAddress(state, heading.depth);
  if (numbered !== undefined) openNumbered(state, line, numbered, heading?.depth);
  else if (heading !== undefined) openSection(state, line, heading);
  extend(state, line.start + line.text.length);
  // 番号付きの行は番号の後ろだけを読む。「第3条（支払）」の「第3条」を自分への参照として拾わない。
  const scanned = numbered === undefined ? text : numbered.rest;
  const offset = Math.max(0, line.text.lastIndexOf(scanned));
  if (scanned !== "") addLeaves(state, patterns, line, scanned, offset);
};

/**
 * 文書を番地の付いた木にする。番号の書き方は言語パッケージが読み、ここは入れ子と番地だけを決める。
 * Markdown では見出しとコードの範囲を使い、.txt は行頭の番号だけで組む。
 */
export const buildStructure = (input: StructureInput, patterns: StructurePatterns): StructureNode => {
  const outline = input.markdown ? markdownOutline(input.source) : { headings: [], opaque: [] };
  // コードは同じ長さの空白で覆ってから読む。コードブロックの行は空になって飛ばされ、
  // 文中の `第99条` は参照として拾われない。位置は元の文書のまま。
  const lines = linesOf(maskSpans(input.source, outline.opaque));
  const headings = headingsByLine(lines, outline.headings);
  const doc = draftOf("doc", "", { text: "", start: 0, number: 1 }, { path: input.path, language: input.language });
  doc.end = input.source.length;
  const state: State = { stack: [{ draft: doc, rank: 0 }], headingCounts: [] };
  lines.filter((line) => line.text.trim() !== "").forEach((line) => readLine(state, patterns, line, headings.get(line.number)));
  return freeze(doc);
};
