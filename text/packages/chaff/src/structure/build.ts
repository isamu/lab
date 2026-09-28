import type { Heading } from "../document.ts";
import { atxHeadingText, headingText } from "../heading-text.ts";
import { addressSpans } from "../address-chain.ts";
import { relativeMentions } from "./relative-find.ts";
import { resolveRelative } from "./relative-resolve.ts";
import { maskSpans } from "../mask.ts";
import type { DocumentProfile, Mention, NumberedLine, NumberingContext, Span, StructureKind, StructureNode, StructurePatterns } from "../plugin.ts";
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
  readonly ordinal?: number | undefined;
  readonly level?: number | undefined;
  readonly ordinalTo?: number | undefined;
  readonly numbering?: string | undefined;
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
  /** opensDefinitionScope の行を含んだ条。ここに入る定義はその条の中でだけ比べる。 */
  readonly scopedArticles: Set<Draft>;
  readonly profile: DocumentProfile | undefined;
  /** 見出しだけの行（文書の種類の caption）の行番号と、その言葉。すぐ次の行の条が見出しに使う。 */
  readonly captions: Map<number, string>;
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
  const draft = {
    ...draftOf(numbered.kind, addressOf(state, numbered), line, attrs),
    ordinal: numbered.ordinal,
    level: numbered.depth,
    ordinalTo: numbered.ordinalTo,
    numbering: numbered.numbering,
  };
  open(state, { draft, rank, numbered });
};

const openSection = (state: State, line: Line, heading: Heading): void => {
  while (state.stack.length > 1 && top(state).rank >= heading.depth) state.stack.pop();
  open(state, { draft: draftOf("section", headingAddress(state, heading.depth), line, { heading: heading.text }), rank: heading.depth });
};

/** 番地（文書の種類が決める「前二項」など）の中の数は、数量ではない。 */
const outsideAddresses = (mentions: readonly Mention[], text: string, profile: DocumentProfile | undefined): readonly Mention[] => {
  const spans = addressSpans(text, profile);
  return spans.length === 0 ? mentions : mentions.filter((mention) => !spans.some((span) => span.start <= mention.start && mention.end <= span.end));
};

/** 番地を名指しした参照（第百五十七条第一項）の一部は、相対の参照ではない。 */
const withoutAbsolute = (relative: readonly Mention[], absolute: readonly Mention[]): readonly Mention[] =>
  relative.filter((mention) => !absolute.some((other) => mention.start < other.end && other.start < mention.end));

type LeafFinder = (patterns: StructurePatterns, text: string, profile: DocumentProfile | undefined) => readonly Mention[];

const LEAVES: readonly { readonly kind: StructureKind; readonly find: LeafFinder }[] = [
  { kind: "definition", find: (patterns, text) => patterns.definitions(text) },
  { kind: "reference", find: (patterns, text) => patterns.references(text) },
  {
    kind: "reference",
    find: (patterns, text, profile) => {
      const absolute = patterns.references(text);
      return withoutAbsolute(relativeMentions(text, profile, patterns.number, absolute), absolute);
    },
  },
  { kind: "obligation", find: (patterns, text) => patterns.obligations(text) },
  { kind: "quantity", find: (patterns, text, profile) => outsideAddresses(patterns.quantities(text), text, profile) },
  { kind: "date", find: (patterns, text) => patterns.dates?.(text) ?? [] },
];

/** 言語を問わない通し番号。後ろが単位なら数量なので番号にしない。 */
const universalNumber = (patterns: StructurePatterns, text: string, context: NumberingContext): NumberedLine | undefined => {
  const dotted = dottedNumber(text, context);
  return dotted !== undefined && patterns.countedAfter?.(dotted.number, dotted.rest) === true ? undefined : dotted;
};

/** 行の中の定義・参照・義務・数量を、いま開いている最も内側の節点の子にする。 */
const enclosingArticle = (state: State): Draft | undefined => [...state.stack].reverse().find((frame) => frame.draft.kind === "article")?.draft;

const scopeOf = (state: State, patterns: StructurePatterns, text: string): Readonly<Record<string, string>> => {
  const article = enclosingArticle(state);
  if (article === undefined) return {};
  if (patterns.opensDefinitionScope?.(text) === true) state.scopedArticles.add(article);
  return state.scopedArticles.has(article) ? { scope: "local" } : {};
};

const addLeaves = (state: State, patterns: StructurePatterns, line: Line, text: string, offset: number): void => {
  const parent = top(state).draft;
  const scope = scopeOf(state, patterns, text);
  const leaves = LEAVES.flatMap(({ kind, find }) =>
    find(patterns, text, state.profile).map((mention) => ({
      kind,
      start: line.start + offset + mention.start,
      end: line.start + offset + mention.end,
      attrs: mention.attrs,
    })),
  ).sort((left, right) => left.start - right.start);
  leaves.forEach((leaf) =>
    parent.children.push({
      kind: leaf.kind,
      address: "",
      start: leaf.start,
      end: leaf.end,
      line: line.number,
      attrs: leaf.kind === "definition" ? { ...leaf.attrs, ...scope } : leaf.attrs,
      children: [],
    }),
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
  ...(draft.ordinal === undefined ? {} : { ordinal: draft.ordinal }),
  ...(draft.level === undefined ? {} : { level: draft.level }),
  ...(draft.ordinalTo === undefined ? {} : { ordinalTo: draft.ordinalTo }),
  ...(draft.numbering === undefined ? {} : { numbering: draft.numbering }),
});

/** Markdown から取った手がかり。見出しと、中を読まない範囲（コード）。.txt はどちらも空。 */
export type Outline = { readonly headings: readonly Heading[]; readonly opaque: readonly Span[] };

export const NO_OUTLINE: Outline = { headings: [], opaque: [] };

export type StructureInput = {
  readonly path: string;
  readonly source: string;
  readonly language: string;
  readonly outline: Outline;
  readonly profile?: DocumentProfile | undefined;
};

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

/**
 * 見出しの行から見出しの言葉を取る。コードを覆った後の行から取るので、見出しの中のコードも読まない。
 * ATX（行頭が #）なら印と閉じの # を外す。setext（下線で書く見出し）の末尾の # は言葉なので残す。
 */
const headingLineText = (text: string): string => {
  const line = text.trim();
  if (!line.startsWith("#")) return headingText(line);
  return atxHeadingText(line.replace(/^#{1,6}(?=[ \t]|$)/u, "").trim());
};

const captionPatterns = new WeakMap<DocumentProfile, RegExp | undefined>();

/** 文書の種類が決めた見出しだけの行なら、その言葉（最初の括弧の中、括弧が無ければ行全体）。 */
const captionOf = (profile: DocumentProfile | undefined, text: string): string | undefined => {
  if (profile === undefined) return undefined;
  if (!captionPatterns.has(profile)) captionPatterns.set(profile, profile.caption === undefined ? undefined : new RegExp(profile.caption, "u"));
  const found = captionPatterns.get(profile)?.exec(text);
  const words = (found?.[1] ?? found?.[0])?.trim();
  return words === "" ? undefined : words;
};

/** 見出しの無い条のすぐ前の行が見出しだけの行なら、それを条の見出しにする。 */
const withCaption = (state: State, line: Line, numbered: NumberedLine | undefined): NumberedLine | undefined => {
  const caption = numbered?.kind === "article" && numbered.heading === "" ? state.captions.get(line.number - 1) : undefined;
  return numbered === undefined || caption === undefined ? numbered : { ...numbered, heading: caption };
};

const readLine = (state: State, patterns: StructurePatterns, line: Line, heading: Heading | undefined): void => {
  const text = heading === undefined ? line.text : headingLineText(line.text);
  const openNumbers = state.stack.flatMap((frame) => (frame.numbered === undefined ? [] : [frame.numbered]));
  const context = { open: openNumbers, isHeading: heading !== undefined };
  const numbered = withCaption(state, line, patterns.numbered(text, context) ?? universalNumber(patterns, text, context));
  const caption = numbered === undefined && heading === undefined ? captionOf(state.profile, text) : undefined;
  if (caption !== undefined) state.captions.set(line.number, caption);
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
export const buildTree = (input: StructureInput, patterns: StructurePatterns): StructureNode => {
  const outline = input.outline;
  // コードは同じ長さの空白で覆ってから読む。コードブロックの行は空になって飛ばされ、
  // 文中の `第99条` は参照として拾われない。位置は元の文書のまま。
  const lines = linesOf(maskSpans(input.source, outline.opaque));
  const headings = headingsByLine(lines, outline.headings);
  const attrs = { path: input.path, language: input.language, ...(input.profile === undefined ? {} : { profile: input.profile.id }) };
  const doc = draftOf("doc", "", { text: "", start: 0, number: 1 }, attrs);
  doc.end = input.source.length;
  const state: State = { stack: [{ draft: doc, rank: 0 }], headingCounts: [], scopedArticles: new Set(), profile: input.profile, captions: new Map() };
  lines.forEach((line) => {
    if (line.text.trim() !== "") readLine(state, patterns, line, headings.get(line.number));
    // コードの行は覆って読まないが、開いている節の中身ではある。節の最後にコードブロックがあっても、範囲をそこまで伸ばす。
    else if (input.source.slice(line.start, line.start + line.text.length).trim() !== "") extend(state, line.start + line.text.length);
  });
  const tree = freeze(doc);
  const relative = input.profile?.relative;
  return relative === undefined ? tree : resolveRelative(tree, relative.implicitFirst);
};
