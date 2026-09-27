import { markdownOutline, type Heading } from "../document.ts";
import { maskSpans } from "../mask.ts";
import type { Mention, NumberedLine, StructureKind, StructureNode, StructurePatterns } from "../plugin.ts";
import { linesOf, type Line } from "./lines.ts";
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

/** 条番号や 4.2 はそれだけで番地になる。項・号・(a) は親の番地に続ける。親が無ければ節の中の番号とする。 */
const addressOf = (state: State, numbered: NumberedLine): string => {
  if (numbered.absolute) return numbered.number;
  const parent = nearestNumbered(state);
  if (parent !== undefined && parent.rank < NUMBERED_RANK + numbered.depth) return `${parent.draft.address}.${numbered.number}`;
  const section = nearestSection(state);
  return section === undefined ? numbered.number : `${section.draft.address}/${numbered.number}`;
};

const headingAddress = (state: State, depth: number): string => {
  state.headingCounts[depth - 1] = (state.headingCounts[depth - 1] ?? 0) + 1;
  state.headingCounts.fill(0, depth);
  return `h${state.headingCounts
    .slice(0, depth)
    .map((count) => String(count))
    .join(".")}`;
};

const openNumbered = (state: State, line: Line, numbered: NumberedLine): void => {
  const attrs = { label: numbered.label, ...(numbered.heading === "" ? {} : { heading: numbered.heading }) };
  const rank = NUMBERED_RANK + numbered.depth;
  // 番地は閉じる前に決める。閉じると、同じ深さの前の条が親に見えてしまう。
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
];

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

/** 見出しのある行を、行番号から引けるようにする。 */
const headingsByLine = (lines: readonly Line[], headings: readonly Heading[]): Map<number, Heading> =>
  new Map(
    headings.flatMap((heading) => {
      const line = lines.find((candidate) => heading.start >= candidate.start && heading.start <= candidate.start + candidate.text.length);
      if (line === undefined) return [];
      const entry: [number, Heading] = [line.number, heading];
      return [entry];
    }),
  );

const readLine = (state: State, patterns: StructurePatterns, line: Line, heading: Heading | undefined): void => {
  const text = heading?.text ?? line.text;
  const openNumbers = state.stack.flatMap((frame) => (frame.numbered === undefined ? [] : [frame.numbered]));
  const context = { open: openNumbers, isHeading: heading !== undefined };
  const numbered = patterns.numbered(text, context) ?? dottedNumber(text, context);
  if (numbered !== undefined) openNumbered(state, line, numbered);
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
