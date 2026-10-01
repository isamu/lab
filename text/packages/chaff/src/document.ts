import { headingReadersOf, sectionsOf } from "./document-sections.ts";
import { atxHeadingText, headingText } from "./heading-text.ts";
import { hasTitle } from "./heading-title.ts";
import { maskSpans } from "./mask.ts";
import { spansWithin, unmaskedSoftBreaks } from "./soft-break.ts";
import { segmentJoined } from "./joined-view.ts";
import { documentLineParagraphs } from "./line-paragraphs.ts";
import { closingRun, standaloneLines, subheadingPieces, type StandsAlone } from "./subheading-line.ts";
import { isLinkLine } from "./link-line.ts";
import { speakerLabels } from "./speaker-labels.ts";
import { buildTree, type Outline } from "./structure/build.ts";
import { isMarkdownPath } from "./structure/markdown-path.ts";
import { layoutMasks, textOutline } from "./page-furniture.ts";
import { tokenizedLexicons } from "./lexicon-tokens.ts";
import { plainSource } from "./plain-source.ts";
import { inPageAnchors, isInPageNavigation, isNavigationList, type InPageAnchors } from "./in-page-nav.ts";
import { eachPreOrder } from "./tree-walk.ts";
import { alertReader } from "./template-syntax.ts";
import { opaqueSpans, parse, readMarkdown, spansOfType } from "./markdown-read.ts";
import { spanOf, type MarkdownNode as Node } from "./markdown-node.ts";
import { emailParts, emailVocabulary } from "./email-parts.ts";
import { cutTextSpans } from "./span-cut.ts";
import { markdownFigures } from "./text-figures.ts";
import { documentMarkup } from "./markup.ts";
import { BARE_URL } from "./bare-url.ts";
import type { BulletList, LanguageAdapter, Markup, Paragraph, ProseDocument, Sentence, Span, StructureNode, DocumentProfile } from "./plugin.ts";

/**
 * 本文として数えないもの。
 *
 * コードは文章ではなく、表は文章の形をしていない。
 * **引用は自分の文章ではない。** chaff が言えるのは「2 文に割ってください」までで、
 * 引用文にそれはできない。直せないものを指摘しても、書いた人は動けない。
 */
const NOT_PROSE = new Set(["code", "inlineCode", "html", "yaml", "toml", "table", "blockquote", "thematicBreak", "definition", "image", "imageReference"]);

/** link は `[text](url)` の外側だけを覆う。表示される文字は本文なので残す。 */
export const linkChrome = (node: Node): Span[] => {
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
const DIRECTIVE = /^[ \t]*:::[^\n]*/gmu;

const matchSpans = (source: string, pattern: RegExp): Span[] =>
  [...source.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length }));

const directiveSpans = (source: string): Span[] => [...matchSpans(source, DIRECTIVE), ...matchSpans(source, BARE_URL)];

const collectMasks = (root: Node, source: string, anchors: InPageAnchors, syntax: readonly Span[]): Span[] => {
  const spans: Span[] = [...directiveSpans(source), ...syntax];
  const alertOf = alertReader(source);
  eachPreOrder(root, (node) => {
    if (node.type === "link" || node.type === "linkReference") {
      spans.push(...linkChrome(node));
      return;
    }
    const alert = alertOf(node);
    if (alert !== undefined) {
      spans.push(...alert);
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

/**
 * `neutral` is the source with the template syntax blanked: `## Usage {% if x %}` is headed "Usage". Whether a
 * heading has a title is read from the source, since `## {{ product }}` names something.
 * 引用した返信（outside）の中の見出しは、ほかの人の文書の見出しなので数えない。
 */
const headingsOf = (root: Node, source: string, neutral: string, outside: readonly Span[] = []): Heading[] => {
  const found: Heading[] = [];
  eachPreOrder(root, (node) => {
    if (node.type !== "heading") return;
    const span = spanOf(node);
    const depth = typeof node === "object" && "depth" in node && typeof node.depth === "number" ? node.depth : 1;
    if (span === undefined || startsInside(span, outside)) return;
    // ATX（行頭が #）なら閉じの # も外す。setext の見出しの末尾の # は言葉なので残す。
    const read = source.startsWith("#", span.start) ? atxHeadingText : headingText;
    const written = textOf(node, source);
    const shown = textOf(node, neutral);
    // A blanked tag leaves a run of spaces where the reader sees one gap.
    const text = read(shown === written ? written : shown.replace(/ {2,}/gu, " "));
    if (hasTitle(read(written))) found.push({ depth, text, start: span.start, end: span.end });
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

/**
 * 文の分割は**段落ごと**に行う。
 *
 * 文書全体を一度に渡すと、句点で終わらない行（「条件:」のような見出し的な行）が、
 * 覆った表やコードブロックを越えて次の句点まで飲み込む。段落は文が跨がない境界なので、
 * ここで切れば構造的に起きない。
 */
const shift = (span: Span, by: number): Span => ({ start: by + span.start, end: by + span.end });

const breaksWithin = (breaks: readonly Span[], paragraph: Span): Span[] => spansWithin(breaks, paragraph).map((span) => shift(span, -paragraph.start));

/** 段落の中の行（段落の中の位置）が、一つのリンクだけの行か。 */
const linkLineIn =
  (source: string, links: readonly Span[], paragraph: Span): StandsAlone =>
  (start, end) =>
    isLinkLine(source, shift({ start, end }, paragraph.start), links);

/**
 * 段落を、中の小見出しの行（「（経済再生）」）とリンクだけの行の後ろで切った片。片ごとに分割すれば、
 * 小見出しが次の文に入らず、1 行ずつ並べたリンクが一つの長い文にならない。
 */
const piecesOf = (prose: string, paragraphs: readonly Span[], source: string, links: readonly Span[]): Span[] =>
  paragraphs.flatMap((paragraph) =>
    subheadingPieces(prose.slice(paragraph.start, paragraph.end), linkLineIn(source, links, paragraph)).map((piece) => shift(piece, paragraph.start)),
  );

/**
 * 段落の終わりまで続く、一つで立つリンクだけの行（文書の位置）。記事の一覧のように本文の後に 1 行ずつ並べたリンクは、
 * 箇条書きの項目と同じに読む。段落の途中のリンクの行は、その段落の文の一つのまま。
 */
const linkItemsOf = (prose: string, paragraphs: readonly Span[], source: string, links: readonly Span[]): Span[] =>
  paragraphs.flatMap((paragraph) => {
    const isLink = linkLineIn(source, links, paragraph);
    const text = prose.slice(paragraph.start, paragraph.end);
    const linkLines = standaloneLines(text, isLink).filter((line) => isLink(line.start, line.end));
    return closingRun(linkLines, text.length).map((line) => shift({ start: line.start, end: line.end }, paragraph.start));
  });

/**
 * links: リンク。pieces: 文を分ける片。listSpans: 箇条書きの項目と同じに読む範囲（Markdown の項目と、1 行ずつ並べたリンクの行）。
 * paragraphs: 段落として数える範囲。リンクの行を切り取る（「関連記事：」に続くリンクの行は、箇条書きと同じく段落の外）。
 */
type LineLayout = {
  readonly links: readonly Span[];
  readonly pieces: readonly Span[];
  readonly listSpans: readonly Span[];
  readonly paragraphs: readonly Span[];
};

const lineLayoutOf = (root: Node, source: string, prose: string, paragraphs: readonly Span[]): LineLayout => {
  const links = [...spansOfType(root, "link"), ...spansOfType(root, "linkReference")];
  const linkItems = linkItemsOf(prose, paragraphs, source, links);
  return {
    links,
    pieces: piecesOf(prose, paragraphs, source, links),
    listSpans: [...spansOfType(root, "listItem"), ...linkItems],
    paragraphs: cutTextSpans(paragraphs, linkItems, source),
  };
};

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

const paragraphsOf = (prose: string, spans: readonly Span[], sentences: readonly Sentence[], listSpans: readonly Span[]): Paragraph[] => {
  // 箇条書きの中の段落は「段落」として数えない。項目 1 つを 1 段落と読むと、
  // 段落あたりの文数も長さのばらつきも、箇条書きの多い文書で壊れる。
  const outsideLists = spans.filter((span) => !listSpans.some((list) => span.start >= list.start && span.start < list.end));
  const withSentences = outsideLists.map((span) => ({ span, sentences: sentencesWithin(sentences, span).map((sentence) => sentence.span) }));
  return documentLineParagraphs(prose, withSentences).map((span) => ({ span, sentences: sentencesWithin(sentences, span) }));
};

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

const teamLexicons = (adapter: LanguageAdapter, team: TeamRules): LanguageAdapter["lexicons"] => ({
  ...adapter.lexicons,
  "internal-jargon": team.jargon.map((pattern) => ({ pattern })),
  // 使わない書き方を pattern に、使う書き方を instead_of に置く。語彙表の「同じことの別の書き方」と同じ向き。
  "preferred-term": Object.entries(team.prefer ?? {}).map(([pattern, use]) => ({ pattern, instead_of: use })),
});

const documentOf = (path: string, source: string, adapter: LanguageAdapter, team: TeamRules, profile: DocumentProfile | undefined): ProseDocument => {
  const markdown = isMarkdownPath(path);
  const { root, syntax } = markdown ? readMarkdown(source) : { root: parse(source), syntax: [] };
  const anchors = inPageAnchors(root);
  const emailLayout = emailParts(source, emailVocabulary(adapter.lexicons));
  // 強調の記号は「本文でないもの」だが、太字の数を数えるときの「覆われた場所」ではない。
  // 同じ集合にすると、太字が自分の記号のせいで覆われた場所にあることになり、1 つも数えられなくなる。
  // ページのヘッダーとフッター（テキストの文書）と、線で描いた図も本文ではない。
  const blocks = [...collectMasks(root, source, anchors, syntax), ...layoutMasks(root, source, markdown), ...emailLayout.furniture];
  const prose = proseOf(source, [...blocks, ...emphasisSpans(root, source)]);
  // ページの案内は段落としても数えない。数えると、目次の行が「本題までの段落」に入る。メールのヘッダーや署名の行は段落から切り取る。
  const paragraphSpans = cutTextSpans(
    spansOfType(root, "paragraph", (node) => !isInPageNavigation(node, anchors)),
    emailLayout.furniture,
    source,
  );
  const headings = headingsOf(root, source, maskSpans(source, syntax), emailLayout.replyQuotes);
  // Markdown は段落を流し込んで表示するので、段落の中の改行は読み手に見えない。テキストの文書は行をそのまま見せる（法令は 1 行 1 号）。
  const softBreaks = markdown ? unmaskedSoftBreaks(source, prose) : [];
  const layout = lineLayoutOf(root, source, prose, paragraphSpans);
  const sentences = sentencesOf(prose, layout.pieces, adapter, softBreaks);
  const lexicons = teamLexicons(adapter, team);
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
    sections: sectionsOf(headings, sentences, strongSpans(root, blocks), source.length, headingReadersOf(adapter, tagged, lexicons)),
    sentences,
    listSpans: layout.listSpans,
    paragraphs: paragraphsOf(prose, layout.paragraphs, sentences, layout.listSpans),
    lists: listsOf(root, source, anchors),
    links: layout.links,
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
                outline: markdown ? outlineOf(root, source, syntax, emailLayout.replyQuotes) : textOutline(source, emailLayout.replyQuotes),
                markdown: isMarkdownPath(path),
                profile,
              },
              patterns,
            );
      return tree.value ?? undefined;
    },
    profile,
    prose,
    replyQuotes: emailLayout.replyQuotes,
    get markup(): Markup {
      return documentMarkup(root, source, markdown, [...emailLayout.replyQuotes, ...syntax]);
    },
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

/** 引用した返信も中を読まない。ほかの人の言葉の中の定義や番号は、この文書のものではない。 */
const outlineOf = (root: Node, source: string, syntax: readonly Span[], replyQuotes: readonly Span[]): Outline => ({
  headings: headingsOf(root, source, maskSpans(source, syntax), replyQuotes),
  opaque: [...opaqueSpans(root), ...markdownFigures(root, source), ...syntax, ...replyQuotes],
  tables: spansOfType(root, "table"),
});

/** 構造を読むための Markdown の手がかり。見出しと、中を読まない範囲。返信の引用は、言語パッケージの語彙表で見分ける。 */
export const markdownOutline = (source: string, lexicons: LanguageAdapter["lexicons"] = {}): Outline => {
  const { root, syntax } = readMarkdown(source);
  return outlineOf(root, source, syntax, emailParts(source, emailVocabulary(lexicons)).replyQuotes);
};
