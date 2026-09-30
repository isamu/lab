import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmTable } from "micromark-extension-gfm-table";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";
import { frontmatter } from "micromark-extension-frontmatter";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { atxHeadingText, headingText } from "./heading-text.ts";
import { hasTitle } from "./heading-title.ts";
import { maskSpans } from "./mask.ts";
import { spansWithin, unmaskedSoftBreaks } from "./soft-break.ts";
import { segmentJoined } from "./joined-view.ts";
import { lineParagraphs } from "./line-paragraphs.ts";
import { speakerLabels } from "./speaker-labels.ts";
import { buildTree, type Outline } from "./structure/build.ts";
import { isMarkdownPath } from "./structure/markdown-path.ts";
import { pageFurniture, textOutline } from "./page-furniture.ts";
import { tokenizedLexicons } from "./lexicon-tokens.ts";
import { plainSource } from "./plain-source.ts";
import { inPageAnchors, isInPageNavigation, isNavigationList, type InPageAnchors } from "./in-page-nav.ts";
import { eachPreOrder } from "./tree-walk.ts";
import type { BulletList, LanguageAdapter, Paragraph, ProseDocument, Section, Sentence, Span, StructureNode, DocumentProfile, Token } from "./plugin.ts";

type Place = { readonly offset?: number | undefined };
type Node = {
  readonly type: string;
  readonly url?: string | undefined;
  readonly value?: string | undefined;
  readonly identifier?: string | undefined;
  readonly position?: { readonly start: Place; readonly end: Place } | undefined;
  readonly children?: readonly Node[] | undefined;
};

/**
 * 本文として数えないもの。
 *
 * コードは文章ではなく、表は文章の形をしていない。
 * **引用は自分の文章ではない。** chaff が言えるのは「2 文に割ってください」までで、
 * 引用文にそれはできない。直せないものを指摘しても、書いた人は動けない。
 */
const NOT_PROSE = new Set(["code", "inlineCode", "html", "yaml", "toml", "table", "blockquote", "thematicBreak", "definition", "image", "imageReference"]);

const spanOf = (node: Node): Span | undefined => {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined ? undefined : { start, end };
};

const parse = (source: string): Node =>
  fromMarkdown(source, { extensions: [gfmTable(), frontmatter(["yaml"])], mdastExtensions: [gfmTableFromMarkdown(), frontmatterFromMarkdown(["yaml"])] });

/** link は `[text](url)` の外側だけを覆う。表示される文字は本文なので残す。 */
const linkChrome = (node: Node): Span[] => {
  const whole = spanOf(node);
  const first = node.children?.[0];
  const last = node.children?.at(-1);
  const inner = first === undefined || last === undefined ? undefined : { start: spanOf(first)?.start, end: spanOf(last)?.end };
  if (whole === undefined || inner?.start === undefined || inner.end === undefined) return whole === undefined ? [] : [whole];
  return [
    { start: whole.start, end: inner.start },
    { start: inner.end, end: whole.end },
  ];
};

/**
 * 強調の記号（`**` `*` `_` `~~`）だけを覆う。囲まれた文字は本文なので残す。
 *
 * 残すと解析器が `**。` を 1 語の名詞として拾い、文の終わりが消える。
 * 実文書で「文末が名詞」の誤検知を追って見つけた。文長にも同じだけ効いている。
 */
const MARKER = /^[*_~]+/u;

const emphasisChrome = (node: Node, source: string): Span[] => {
  const whole = spanOf(node);
  if (whole === undefined) return [];
  const width = MARKER.exec(source.slice(whole.start, whole.end))?.[0].length ?? 0;
  if (width === 0) return [];
  return [
    { start: whole.start, end: whole.start + width },
    { start: whole.end - width, end: whole.end },
  ];
};

const EMPHASIS = new Set(["strong", "emphasis", "delete"]);

/**
 * `:::note` `:::` のようなディレクティブ。Zenn・Docusaurus・VitePress が使う記法で、
 * 標準の Markdown には無いため段落として解析される。囲みの指定であって文章ではない。
 */
const DIRECTIVE = /^:::[^\n]*/gmu;

/**
 * `https://…` をそのまま書いた URL。GFM の autolink 拡張を入れていないので mdast では
 * ただのテキストになり、本文として残る。残すと、見出しと URL の中の識別子が一致して
 * 「見出しの繰り返し」と読まれる。表示される文字も本文ではない。
 */
const BARE_URL = /https?:\/\/[^\s)<>"'\]]+/gu;

const matchSpans = (source: string, pattern: RegExp): Span[] =>
  [...source.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length }));

const directiveSpans = (source: string): Span[] => [...matchSpans(source, DIRECTIVE), ...matchSpans(source, BARE_URL)];

const collectMasks = (root: Node, source: string, anchors: InPageAnchors): Span[] => {
  const spans: Span[] = [...directiveSpans(source)];
  eachPreOrder(root, (node) => {
    if (node.type === "link" || node.type === "linkReference") {
      spans.push(...linkChrome(node));
      return;
    }
    if (!NOT_PROSE.has(node.type) && node.type !== "heading" && !isInPageNavigation(node, anchors)) return;
    const span = spanOf(node);
    if (span !== undefined) spans.push(span);
  });
  return spans;
};

const emphasisSpans = (root: Node, source: string): Span[] => {
  const spans: Span[] = [];
  eachPreOrder(root, (node) => {
    if (EMPHASIS.has(node.type)) spans.push(...emphasisChrome(node, source));
  });
  return spans;
};

const textOf = (node: Node, source: string): string => {
  const parts: string[] = [];
  eachPreOrder(node, (child) => {
    if (child.type !== "text" && child.type !== "inlineCode") return;
    const span = spanOf(child);
    if (span !== undefined) parts.push(source.slice(span.start, span.end));
  });
  return parts.join("");
};

export type Heading = { readonly depth: number; readonly text: string; readonly start: number; readonly end: number };

const headingsOf = (root: Node, source: string): Heading[] => {
  const found: Heading[] = [];
  eachPreOrder(root, (node) => {
    if (node.type !== "heading") return;
    const span = spanOf(node);
    const depth = typeof node === "object" && "depth" in node && typeof node.depth === "number" ? node.depth : 1;
    if (span === undefined) return;
    // ATX（行頭が #）なら閉じの # も外す。setext の見出しの末尾の # は言葉なので残す。
    const read = source.startsWith("#", span.start) ? atxHeadingText : headingText;
    const text = read(textOf(node, source));
    if (hasTitle(text)) found.push({ depth, text, start: span.start, end: span.end });
  });
  return found;
};

const startsInside = (span: Span, regions: readonly Span[]): boolean => regions.some((region) => span.start >= region.start && span.start < region.end);

/**
 * 本文の強調だけを数える。
 *
 * 表のセルや見出しの中の太字はラベルであって強調ではない。
 * 「太字は読者の目を止める道具」という bold-density の理屈が当てはまらない。
 * 「本文でないもの」の定義は覆う範囲（collectMasks）に 1 つだけ置き、ここはそれを使う。
 */
const strongSpans = (root: Node, masked: readonly Span[]): Span[] => {
  const found: Span[] = [];
  eachPreOrder(root, (node) => {
    if (node.type !== "strong") return;
    const span = spanOf(node);
    if (span !== undefined && !startsInside(span, masked)) found.push(span);
  });
  return found;
};

const within = (span: Span, from: number, to: number): boolean => span.start >= from && span.start < to;

const spansOfType = (root: Node, type: string, keep: (node: Node) => boolean = () => true): Span[] => {
  const found: Span[] = [];
  eachPreOrder(root, (node) => {
    if (node.type !== type || !keep(node)) return;
    const span = spanOf(node);
    if (span !== undefined) found.push(span);
  });
  return found;
};

/**
 * 文の分割は**段落ごと**に行う。
 *
 * 文書全体を一度に渡すと、句点で終わらない行（「条件:」のような見出し的な行）が、
 * 覆った表やコードブロックを越えて次の句点まで飲み込む。段落は文が跨がない境界なので、
 * ここで切れば構造的に起きない。
 */
const shift = (span: Span, by: number): Span => ({ start: by + span.start, end: by + span.end });

const breaksWithin = (breaks: readonly Span[], paragraph: Span): Span[] => spansWithin(breaks, paragraph).map((span) => shift(span, -paragraph.start));

const sentencesOf = (prose: string, paragraphs: readonly Span[], adapter: LanguageAdapter, softBreaks: readonly Span[]): Sentence[] =>
  paragraphs.flatMap((paragraph) =>
    segmentJoined(prose.slice(paragraph.start, paragraph.end), breaksWithin(softBreaks, paragraph), (text) => adapter.segment(text))
      .filter((sentence) => sentence.text.trim().length > 0)
      .map((sentence) => ({
        span: shift(sentence.span, paragraph.start),
        text: sentence.text,
        ...(sentence.tokens === undefined ? {} : { tokens: sentence.tokens.map((token) => ({ ...token, span: shift(token.span, paragraph.start) })) }),
        ...(sentence.wrapBreaks === undefined ? {} : { wrapBreaks: sentence.wrapBreaks.map((span) => shift(span, paragraph.start)) }),
        ...(sentence.embeddedLanguage === undefined ? {} : { embeddedLanguage: sentence.embeddedLanguage }),
      })),
  );

/** 見出しの語。品詞を読んでいない文書（文が tokens を持たない）では分けない。 */
const headingTokensOf = (adapter: LanguageAdapter, tagged: boolean, heading: string): { headingTokens?: readonly Token[] } =>
  tagged && heading !== "" ? { headingTokens: adapter.segment(heading).sentences.flatMap((sentence) => sentence.tokens ?? []) } : {};

const sectionsOf = (
  headings: readonly Heading[],
  sentences: readonly Sentence[],
  strongs: readonly Span[],
  length: number,
  tokensOf: (heading: string) => { headingTokens?: readonly Token[] },
): Section[] => {
  const bounds = headings.map((heading, index) => ({ heading, from: heading.end, to: headings[index + 1]?.start ?? length }));
  const lead = { heading: { depth: 0, text: "", start: 0, end: 0 }, from: 0, to: headings[0]?.start ?? length };
  return [lead, ...bounds]
    .filter((bound) => bound.to > bound.from)
    .map(({ heading, from, to }) => {
      const inside = sentences.filter((sentence) => within(sentence.span, from, to));
      return {
        depth: heading.depth,
        heading: heading.text,
        ...tokensOf(heading.text),
        span: { start: from, end: to },
        sentences: inside,
        strongCount: strongs.filter((span) => within(span, from, to)).length,
        firstSentence: inside[0],
      };
    });
};

/** sentences（並び順）の中で、start が offset 以上の最初の添字。1 行 1 段落の何万行でも、段落ごとに全部をなめない。 */
const firstStartingAt = (sentences: readonly Sentence[], offset: number): number => {
  const search = (low: number, high: number): number => {
    if (low >= high) return low;
    const middle = (low + high) >> 1;
    return (sentences[middle]?.span.start ?? Number.POSITIVE_INFINITY) >= offset ? search(low, middle) : search(middle + 1, high);
  };
  return search(0, sentences.length);
};

const sentencesWithin = (sentences: readonly Sentence[], span: Span): Sentence[] =>
  sentences.slice(firstStartingAt(sentences, span.start), firstStartingAt(sentences, span.end));

const paragraphsOf = (prose: string, spans: readonly Span[], sentences: readonly Sentence[], listSpans: readonly Span[]): Paragraph[] =>
  spans
    // 箇条書きの中の段落は「段落」として数えない。項目 1 つを 1 段落と読むと、
    // 段落あたりの文数も長さのばらつきも、箇条書きの多い文書で壊れる。
    .filter((span) => !listSpans.some((list) => span.start >= list.start && span.start < list.end))
    .flatMap((span) =>
      lineParagraphs(
        prose,
        span,
        sentencesWithin(sentences, span).map((sentence) => sentence.span),
      ),
    )
    .map((span) => ({ span, sentences: sentencesWithin(sentences, span) }));

/** 箇条書きは list ノードの直下の項目を数える。入れ子の項目は内側の list のものとして数える。目次のような案内だけの箇条書きは数えない。 */
const listsOf = (root: Node, source: string, anchors: InPageAnchors): BulletList[] => {
  const found: BulletList[] = [];
  eachPreOrder(root, (node) => {
    if (node.type !== "list" || isNavigationList(node, anchors)) return;
    const span = spanOf(node);
    if (span === undefined) return;
    const items = (node.children ?? []).flatMap((child) => {
      const item = spanOf(child);
      return child.type === "listItem" && item !== undefined ? [source.slice(item.start, item.end).replace(/\s+/gu, "").length] : [];
    });
    if (items.length > 0) found.push({ span, items });
  });
  return found;
};

/** チームが chaff.yaml に書いたもの。語彙表と同じ器に入れて、detector には出所を見せない。 */
export type TeamRules = {
  readonly jargon: readonly string[];
  readonly requiredSections: readonly string[];
  /** { 使わない書き方: 使う書き方 }。preferred-term が語彙表として読む。 */
  readonly prefer?: Readonly<Record<string, string>>;
  /** チームの固有名詞。1 つの名前として読む rule が見る。 */
  readonly names?: readonly string[];
};

const EMPTY_TEAM: TeamRules = { jargon: [], requiredSections: [] };

/** Config から取り出す。document は Config の形を知らない。 */
export const teamRules = (config: {
  readonly jargon: readonly string[];
  readonly requiredSections: readonly string[];
  readonly prefer?: Readonly<Record<string, string>>;
  readonly names?: readonly string[];
}): TeamRules => ({
  jargon: config.jargon,
  prefer: config.prefer ?? {},
  requiredSections: config.requiredSections,
  names: config.names ?? [],
});

/**
 * masked を覆った本文から、話し手の名前（戯曲・議事録）も覆う。名前は誰が話すかの印で、文でも本文でもない。
 * 名前は覆った後の本文で探す。コードや表の中の行頭を話し手と数えない。
 */
const proseOf = (source: string, masked: readonly Span[]): string => {
  const unlabelled = maskSpans(source, masked);
  return maskSpans(unlabelled, speakerLabels(unlabelled));
};

const documentOf = (path: string, source: string, adapter: LanguageAdapter, team: TeamRules, profile: DocumentProfile | undefined): ProseDocument => {
  const root = parse(source);
  const anchors = inPageAnchors(root);
  // 強調の記号は「本文でないもの」だが、太字の数を数えるときの「覆われた場所」ではない。
  // 同じ集合にすると、太字が自分の記号のせいで覆われた場所にあることになり、1 つも数えられなくなる。
  // テキストの文書は、ページのヘッダーとフッターも本文ではない（Markdown には改ページが無い）。
  const blocks = [...collectMasks(root, source, anchors), ...(isMarkdownPath(path) ? [] : pageFurniture(source))];
  const masked = [...blocks, ...emphasisSpans(root, source)];
  const prose = proseOf(source, masked);
  // ページの案内は段落としても数えない。数えると、目次の行が「本題までの段落」に入る。
  const paragraphSpans = spansOfType(root, "paragraph", (node) => !isInPageNavigation(node, anchors));
  const listItems = spansOfType(root, "listItem");
  // Markdown は段落を流し込んで表示するので、段落の中の改行は読み手に見えない。テキストの文書は行をそのまま見せる（法令は 1 行 1 号）。
  const softBreaks = isMarkdownPath(path) ? unmaskedSoftBreaks(source, prose) : [];
  const sentences = sentencesOf(prose, paragraphSpans, adapter, softBreaks);
  const lexicons = {
    ...adapter.lexicons,
    "internal-jargon": team.jargon.map((pattern) => ({ pattern })),
    // 使わない書き方を pattern に、使う書き方を instead_of に置く。語彙表の「同じことの別の書き方」と同じ向き。
    "preferred-term": Object.entries(team.prefer ?? {}).map(([pattern, use]) => ({ pattern, instead_of: use })),
  };
  const tagged = sentences.some((sentence) => sentence.tokens !== undefined);
  const patterns = adapter.structure;
  // null は「作ったが構造を読めない言語だった」、undefined は「まだ作っていない」。
  const tree: { value: StructureNode | null | undefined } = { value: undefined };
  return {
    path,
    source,
    language: adapter.id,
    lengthUnit: adapter.capabilities.lengthUnit,
    capabilities: adapter.capabilities,
    sections: sectionsOf(headingsOf(root, source), sentences, strongSpans(root, blocks), source.length, (heading) => headingTokensOf(adapter, tagged, heading)),
    sentences,
    listSpans: listItems,
    paragraphs: paragraphsOf(prose, paragraphSpans, sentences, listItems),
    lists: listsOf(root, source, anchors),
    links: [...spansOfType(root, "link"), ...spansOfType(root, "linkReference")],
    lexicons: tagged ? tokenizedLexicons(lexicons, adapter) : lexicons,
    requiredSections: team.requiredSections,
    names: team.names ?? [],
    // 構造の rule（参照先が無い・番号の抜け）が読む木。どの rule も読まなければ作らない。何万行の契約書で、他の rule の lint に代金を払わせない。
    get structure(): StructureNode | undefined {
      tree.value ??=
        patterns === undefined
          ? null
          : buildTree(
              {
                path,
                source,
                language: adapter.id,
                // テキストの文書は、ページの飾りを覆って読む。フッターの「Section 9」を木の節にしない。
                outline: isMarkdownPath(path) ? outlineOf(root, source) : textOutline(source),
                markdown: isMarkdownPath(path),
                profile,
              },
              patterns,
            );
      return tree.value ?? undefined;
    },
    profile,
    prose,
  };
};

/**
 * 文書モデルを作る。text はファイルの中身のままでよい。先頭の BOM を外し、CRLF と CR を LF にそろえた doc.source を読む。
 * 位置（span・offset）はすべて doc.source の上の位置で、渡した text の上の位置ではない。行と桁は同じ。
 */
export const buildDocument = (
  path: string,
  text: string,
  adapter: LanguageAdapter,
  team: TeamRules = EMPTY_TEAM,
  profile: DocumentProfile | undefined = undefined,
): ProseDocument => documentOf(path, plainSource(text), adapter, team, profile);

/** 番号を探してはいけない範囲。コードの中の「第3条」は条ではなく、参照でもない。 */
const OPAQUE = ["code", "inlineCode", "html", "yaml", "toml"];

const outlineOf = (root: Node, source: string): Outline => ({
  headings: headingsOf(root, source),
  opaque: OPAQUE.flatMap((type) => spansOfType(root, type)),
});

/** 構造を読むための Markdown の手がかり。見出しと、中を読まない範囲。 */
export const markdownOutline = (source: string): Outline => outlineOf(parse(source), source);
