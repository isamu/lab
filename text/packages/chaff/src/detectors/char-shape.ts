import type { Detector, DocumentProfile, Finding, ProseDocument, Sentence, Span, Token } from "../plugin.ts";
import { compacted } from "./gram-place.ts";
import { leadingCounter, trailingPrefix } from "./counter-edge.ts";
import { maskAddresses } from "../address-chain.ts";
import { isAddressRun } from "./place-run.ts";
import { isOneName } from "./name-run.ts";
import { isOrganisationRun, type OrganisationWords } from "./organisation-run.ts";
import { endsInTitle, isTitlePosition, isTitledName, type TitleWords } from "./titled-run.ts";
import { proseText } from "../measure.ts";
import { parallelDotCount } from "./middle-dot.ts";
import { maskSpans } from "../mask.ts";
import { quotedSpans } from "../quoted-span.ts";
import { nameSpans } from "../team-names.ts";

/**
 * 文字の並びを見る検出。漢字の連なりが住所か名前かだけは、形態素解析の固有名詞と数で決める。
 * 覆った箇所は空白になっているので、proseText で潰してから数える。
 */
const KANJI_RUN = /[一-鿿]+/gu;

/**
 * 漢字の連なりと、その文書全体の座標での範囲。quoted は括弧の中身がまるごとこの連なりであること。
 * placed は、題の名前の置き方（括弧を閉じる、補いの括弧が続く、文がこれだけ）をしていること。
 */
type KanjiRun = { readonly text: string; readonly span: Span | undefined; readonly quoted: boolean; readonly placed: boolean };

const SPACE = /\s/gu;

/** 名前を囲む括弧。鉤括弧と、見出しや分類の名前を囲む隅付き括弧（【浪速区役所公募型比較見積】）。 */
const NAME_MARKS = { "「": "」", "『": "』", "【": "】" };

/**
 * 同じ連なりが文に二度出ても、それぞれの位置で読む。proseText は空白を詰めたり除いたりするだけなので、
 * 空白でない k 文字目は元の文でも空白でない k 文字目。番地の覆いは長さを保つので、proseText の位置がそのまま使える。
 */
/** 番地と、チームが並べた名前を空白で覆う。名前は読み手が 1 語と知っているので、前後は別の連なりになる。 */
const maskedProse = (prose: string, profile: DocumentProfile | undefined, names: readonly string[]): string =>
  maskSpans(maskAddresses(prose, profile), nameSpans(prose, names));

/** 鉤括弧と隅付き括弧の中身が、ちょうどこの範囲（文の先頭からの位置）か。括弧でくくった漢字だけの語は、書き手が 1 つの名前として示したもの。 */
const fillsQuote = (sentence: Sentence, start: number, end: number): boolean =>
  quotedSpans(sentence.text, NAME_MARKS).some((span) => span.start === start && span.end === end);

const runsOf = (sentence: Sentence, profile: DocumentProfile | undefined, names: readonly string[]): KanjiRun[] => {
  const prose = proseText(sentence);
  const printed = compacted(sentence.text, "char").offsets;
  return [...maskedProse(prose, profile, names).matchAll(KANJI_RUN)].map((match) => {
    const before = prose.slice(0, match.index).replace(SPACE, "").length;
    const [start, last] = [printed[before], printed[before + match[0].length - 1]];
    if (start === undefined || last === undefined) return { text: match[0], span: undefined, quoted: false, placed: false };
    const span = { start: sentence.span.start + start, end: sentence.span.start + last + 1 };
    return { text: match[0], span, quoted: fillsQuote(sentence, start, last + 1), placed: isTitlePosition(sentence.text, start, last + 1) };
  });
};

/** 連なりを数えないと決める語彙: 住所の先頭にしか来ない単位（都道府県）と、組織の名前の形と単位と、題の名前を閉じる語。 */
type NameWords = { readonly topUnits: ReadonlySet<string>; readonly organisation: OrganisationWords; readonly title: TitleWords };

/** 1 つの文書で連なりを読むのに要るもの。titled は、文書の中で題として置かれた名前（titledNames）。 */
type RunContext = {
  readonly profile: DocumentProfile | undefined;
  readonly names: readonly string[];
  readonly words: NameWords;
  readonly titled: readonly string[];
};

const coveringOf = (tokens: readonly Token[], span: Span): number[] =>
  tokens.flatMap((token, index) => (token.span.start < span.end && span.start < token.span.end ? [index] : []));

/**
 * 漢字の連なりが住所（東京都港区新橋二丁目）か 1 つの名前（日本銀行）か 1 つの組織の名前（国立研究開発法人産業技術総合研究所）か。
 * 形態素解析の地名・人名・組織名と数、組織の語彙で決める。
 */
const isPlaceName = (tokens: readonly Token[], span: Span, words: NameWords): boolean => {
  const covering = coveringOf(tokens, span);
  return isAddressRun(tokens, covering, words.topUnits) || isOneName(tokens, covering) || isOrganisationRun(tokens, covering, words.organisation);
};

/** 題の名前（大阪市鶴見区役所公募型比較見積実施要綱）か。題を閉じる語で終わり、ここか文書のほかの所で題として置かれている。 */
const isTitle = (tokens: readonly Token[], span: Span, text: string, placed: boolean, context: RunContext): boolean =>
  endsInTitle(
    coveringOf(tokens, span).flatMap((index) => tokens.slice(index, index + 1)),
    context.words.title,
  ) &&
  (placed || isTitledName(text, context.titled));

/**
 * 数えない連なりは空。頭の、数に付いた助数詞（2日日本弁護士連合会の「日」）と、尻の、数に付く接頭の語（施行令第172条の「第」）は数えない。
 * 住所か名前かは、それを外した残りで決める（1日日本銀行の「日本銀行」）。品詞が無ければ判定しない。
 */
const measuredRun = (tokens: readonly Token[] | undefined, run: KanjiRun, context: RunContext): string => {
  if (run.quoted) return "";
  if (tokens === undefined || run.span === undefined) return run.text;
  const counter = leadingCounter(tokens, run.span.start, run.text);
  const prefix = trailingPrefix(tokens, run.span.end, run.text);
  const rest = { start: counter?.span.end ?? run.span.start, end: prefix?.span.start ?? run.span.end };
  const text = run.text.slice(counter?.surface.length ?? 0, run.text.length - (prefix?.surface.length ?? 0));
  return isPlaceName(tokens, rest, context.words) || isTitle(tokens, rest, text, run.placed, context) ? "" : text;
};

const longestKanji = (sentence: Sentence, context: RunContext): string =>
  runsOf(sentence, context.profile, context.names)
    .map((run) => measuredRun(sentence.tokens, run, context))
    .reduce((longest, run) => (run.length > longest.length ? run : longest), "");

/**
 * 文書の中で題として置かれた漢字の連なり: 題の置き方をした文の中の連なりと、見出しの中の連なり。
 * 同じ名前を文の中で使えば（認定職業訓練実施奨励金の支給額）、それも題の名前と読む。
 */
const titledNames = (doc: ProseDocument, profile: DocumentProfile | undefined, names: readonly string[]): string[] => [
  ...doc.sentences.flatMap((sentence) => runsOf(sentence, profile, names).flatMap((run) => (run.placed ? [run.text] : []))),
  ...(doc.markup?.headings ?? []).flatMap((heading) => [...heading.text.matchAll(KANJI_RUN)].map((match) => match[0])),
];

/**
 * 漢字が続くと、どこで語が切れるのか読み手が探すことになる。
 * 「情報処理推進機構認定試験」は 12 字。ひらがなを 1 つ挟むだけで読める。
 */
export const kanjiRun: Detector = (doc, options): Finding[] => {
  const patterns = (id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);
  const words: NameWords = {
    topUnits: new Set(patterns("prefecture-unit")),
    organisation: {
      forms: patterns("organisation-form"),
      closingForms: (doc.lexicons["organisation-form"] ?? []).filter((entry) => entry.position !== "before").map((entry) => entry.pattern),
      units: patterns("organisation-unit"),
    },
    title: { endings: patterns("title-ending") },
  };
  const names = doc.names ?? [];
  const context: RunContext = { profile: doc.profile, names, words, titled: titledNames(doc, doc.profile, names) };
  return doc.sentences
    .map((sentence) => ({ sentence, run: longestKanji(sentence, context) }))
    .filter(({ run }) => run.length > options.limit)
    .map(({ sentence, run }) => ({
      rule: "max-kanji-continuous",
      severity: "warning",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: { word: run, count: run.length, limit: options.limit, offset: sentence.span.start },
    }));
};

/**
 * 中黒で並べると、どこまでが 1 つの項目か分からなくなる。
 * 「企画・開発・運用・保守体制」は、保守体制が 1 つなのか保守と体制なのか読めない。
 */
export const middleDot: Detector = (doc, options): Finding[] =>
  doc.sentences
    .map((sentence) => ({ sentence, count: parallelDotCount(sentence.text) }))
    .filter(({ count }) => count > options.limit)
    .map(({ sentence, count }) => ({
      rule: "no-nakaguro-parallel",
      severity: "info",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: { count, limit: options.limit, offset: sentence.span.start },
    }));
