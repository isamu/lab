import type { Detector, DetectorOptions, DocumentProfile, Finding, ProseDocument, Sentence, Span, Token } from "../plugin.ts";
import { compacted } from "./gram-place.ts";
import { leadingCounter, trailingPrefix } from "./counter-edge.ts";
import { trailingAddressee, type AddresseeSuffix } from "./addressee-edge.ts";
import { leadingPrefix, trailingTitle, type AddresseeWords } from "./addressee-title-edge.ts";
import { followsForm, holdsName, leadingOrdinal, leadingReference, type Edge } from "./kanji-name-edge.ts";
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
import { isIn } from "../lexicon-genres.ts";
import { standaloneNames, unknownPieces } from "./kanji-run-pieces.ts";

/**
 * 文字の並びを見る検出。漢字の連なりが住所か名前かだけは、形態素解析の固有名詞と数で決める。
 * 覆った箇所は空白になっているので、proseText で潰してから数える。
 */
const KANJI_RUN = /[一-鿿]+/gu;

/**
 * 漢字の連なりと、その文書全体の座標での範囲。quoted は括弧の中身がまるごとこの連なりであること。
 * placed は、題の名前の置き方（括弧を閉じる、補いの括弧が続く、文がこれだけ）をしていること。
 * after は、連なりが文の頭にあるときの、その後ろの文字（宛名の行の、空白と「殿」）。頭になければ undefined。
 * before は、文の頭から連なりの前までの文字（空白を挟んだ法人格）。
 */
type KanjiRun = {
  readonly text: string;
  readonly span: Span | undefined;
  readonly quoted: boolean;
  readonly placed: boolean;
  readonly after: string | undefined;
  readonly before: string;
  /** 文がこの連なりだけ（用語集の見出し語の行）。 */
  readonly alone: boolean;
};

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

/**
 * 鉤括弧と隅付き括弧の中身が、この範囲（文の先頭からの位置）と、漢字も平仮名も無い語（ページ、センター）だけか。
 * 括弧でくくった名前は、書き手が 1 つの名前として示したもの（「登録業者情報検索入力ページ」）。
 */
const fillsQuote = (sentence: Sentence, start: number, end: number): boolean =>
  quotedSpans(sentence.text, NAME_MARKS).some((span) => holdsName(sentence.text, span, start, end));

const runsOf = (sentence: Sentence, profile: DocumentProfile | undefined, names: readonly string[]): KanjiRun[] => {
  const prose = proseText(sentence);
  const printed = compacted(sentence.text, "char").offsets;
  return [...maskedProse(prose, profile, names).matchAll(KANJI_RUN)].map((match) => {
    const before = prose.slice(0, match.index).replace(SPACE, "").length;
    const [start, last] = [printed[before], printed[before + match[0].length - 1]];
    if (start === undefined || last === undefined)
      return { text: match[0], span: undefined, quoted: false, placed: false, after: undefined, before: "", alone: false };
    const span = { start: sentence.span.start + start, end: sentence.span.start + last + 1 };
    const after = sentence.text.slice(0, start).trim() === "" ? sentence.text.slice(last + 1) : undefined;
    const quoted = fillsQuote(sentence, start, last + 1);
    const alone = sentence.text.slice(0, start).trim() === "" && sentence.text.slice(last + 1).trim() === "";
    return { text: match[0], span, quoted, placed: isTitlePosition(sentence.text, start, last + 1), after, before: sentence.text.slice(0, start), alone };
  });
};

/** 連なりを数えないと決める語彙: 住所の先頭にしか来ない単位（都道府県）と、組織の名前の形と単位と、題の名前を閉じる語。 */
type NameWords = {
  readonly topUnits: ReadonlySet<string>;
  readonly organisation: OrganisationWords;
  readonly title: TitleWords;
  /** 数の後ろで日付・時刻の位置を言う単位（月）。連なりの頭にあれば、数に付いた助数詞。 */
  readonly positional: readonly string[];
  /** 宛先の名前に付く語（宛、御中）。連なりの尻にあれば、名前の後ろに付いた語。 */
  readonly addressee: readonly string[];
  /** 宛名の並びの、組織の名前の前の「各」と後ろの役職（各…学校長、…協会会長）。 */
  readonly addressees: AddresseeWords;
  /** 前に書いたものを指す語（上記、当該）。連なりの頭にあれば、後ろの語に付いた指示の語。 */
  readonly references: readonly string[];
  /** 並べた物の後ろに付く語（等）。連なりの尻にあれば、名前の後ろに付いた語。 */
  readonly listSuffixes: readonly string[];
  /** 連なりを閉じる、読み手が一つの語と知っている長い語（内閣総理大臣、許可事業者）。その前で連なりを割る。 */
  readonly knownWords: ReadonlySet<string>;
};

type Tail = AddresseeSuffix;

/** 1 つの文書で連なりを読むのに要るもの。titled は、文書の中で題として置かれた名前（titledNames）。 */
type RunContext = {
  readonly profile: DocumentProfile | undefined;
  readonly names: readonly string[];
  readonly words: NameWords;
  readonly titled: readonly string[];
  /** 文書がほかで単独の連なりとして使う組織の名前（standaloneNames: 安全保障理事会）。 */
  readonly terms: ReadonlySet<string>;
  /** 見出し語の行（文がその連なりだけ）を数えない文書か（用語集）。 */
  readonly headwords: boolean;
  /** 知っている語の語数の上限: 知っている語の字数の上限（一字一語のときの語数）。 */
  readonly maxKnownWords: number;
};

const coveringOf = (tokens: readonly Token[], span: Span): number[] =>
  tokens.flatMap((token, index) => (token.span.start < span.end && span.start < token.span.end ? [index] : []));

/**
 * 漢字の連なりが住所（東京都港区新橋二丁目）か 1 つの名前（日本銀行）か 1 つの組織の名前（国立研究開発法人産業技術総合研究所）か。
 * 形態素解析の地名・人名・組織名と数、組織の語彙で決める。
 */
const isPlaceName = (tokens: readonly Token[], span: Span, words: NameWords, formBefore: boolean): boolean => {
  const covering = coveringOf(tokens, span);
  return isAddressRun(tokens, covering, words.topUnits) || isOneName(tokens, covering) || isOrganisationRun(tokens, covering, words.organisation, formBefore);
};

/** 題の名前（大阪市鶴見区役所公募型比較見積実施要綱）か。題を閉じる語で終わり、ここか文書のほかの所で題として置かれている。 */
const isTitle = (tokens: readonly Token[], span: Span, text: string, placed: boolean, context: RunContext): boolean =>
  endsInTitle(
    coveringOf(tokens, span).flatMap((index) => tokens.slice(index, index + 1)),
    context.words.title,
  ) &&
  (placed || isTitledName(text, context.titled));

/** 宛名の行（各国公私立高等専門学校長、…協会会長 殿）: 連なりが行の頭にあり、後ろは空白と宛先に付く語だけ。 */
const isAddresseeLine = (run: KanjiRun, words: NameWords): boolean => {
  const after = run.after?.trim();
  return after !== undefined && (after === "" || words.addressee.includes(after));
};

/** 尻の外す語: 数に付く接頭の語か宛先に付く語と、宛名の行ならその前の役職（日本博物館協会会長殿の「会長殿」）。 */
const tailOf = (tokens: readonly Token[], run: KanjiRun, span: Span, words: NameWords): Tail | undefined => {
  const prefix = trailingPrefix(tokens, span.end, run.text);
  const suffix =
    prefix === undefined
      ? (trailingAddressee(tokens, span.end, run.text, words.addressee) ?? trailingAddressee(tokens, span.end, run.text, words.listSuffixes))
      : { surface: prefix.surface, start: prefix.span.start };
  const title = isAddresseeLine(run, words) ? trailingTitle(run.text.slice(0, run.text.length - (suffix?.surface.length ?? 0)), words.addressees) : undefined;
  if (title === undefined) return suffix;
  return { surface: title + (suffix?.surface ?? ""), start: (suffix?.start ?? span.end) - title.length };
};

/** 外す語を外した残り。頭の「各」は、宛名の行でなければ、残りが名前と決まったときだけ外す（呼び出し側が戻す）。 */
type Measured = { readonly rest: Span; readonly text: string; readonly keptHead: string };

/** 頭の外す語: 数に付いた助数詞、宛名の「各」、前に書いたものを指す語（上記）の順に、最初に当たったもの。prefix は「各」のとき。 */
const headOf = (tokens: readonly Token[], run: KanjiRun, span: Span, name: string, words: NameWords): { head?: Edge; prefix?: Token } => {
  const counter = leadingCounter(tokens, span.start, run.text, words.positional);
  if (counter !== undefined) return { head: counter };
  const prefix = leadingPrefix(tokens, span.start, name, words.addressees);
  if (prefix !== undefined) return { head: prefix, prefix };
  const reference = leadingReference(tokens, span.start, name, words.references) ?? leadingOrdinal(tokens, span.start, name);
  return reference === undefined ? {} : { head: reference };
};

const measuredOf = (tokens: readonly Token[], run: KanjiRun, span: Span, words: NameWords): Measured => {
  const tail = tailOf(tokens, run, span, words);
  const name = run.text.slice(0, run.text.length - (tail?.surface.length ?? 0));
  const { head, prefix } = headOf(tokens, run, span, name, words);
  const keptHead = prefix !== undefined && !isAddresseeLine(run, words) ? prefix.surface : "";
  return { rest: { start: head?.span.end ?? span.start, end: tail?.start ?? span.end }, text: name.slice(head?.surface.length ?? 0), keptHead };
};

/**
 * 数えない連なりは空。頭の、数に付いた助数詞（2日日本弁護士連合会の「日」）と、尻の、数に付く接頭の語（施行令第172条の「第」）と
 * 宛先に付く語（市政情報課宛ての「宛」）は数えない。宛名の「各」と、宛名の行の役職（各国公私立高等専門学校長の「各」と「長」）も数えない。
 * 住所か名前かは、それを外した残りで決める（1日日本銀行の「日本銀行」）。品詞が無ければ判定しない。
 */
const measuredRun = (tokens: readonly Token[] | undefined, run: KanjiRun, context: RunContext): string => {
  if (run.quoted || (context.headwords && run.alone)) return "";
  if (tokens === undefined || run.span === undefined) return run.text;
  const { rest, text, keptHead } = measuredOf(tokens, run, run.span, context.words);
  const formBefore = rest.start === run.span.start && followsForm(run.before, context.words.organisation.forms);
  if (isPlaceName(tokens, rest, context.words, formBefore) || isTitle(tokens, rest, text, run.placed, context)) return "";
  return longestUnknown(tokens, rest, keptHead, context);
};

/** 語の、範囲（span）の中の字。連なりの頭や尻で外した語にまたがる語は、範囲の中だけ。 */
const surfaceWithin = (token: Token, span: Span): string =>
  token.surface.slice(Math.max(0, span.start - token.span.start), Math.max(0, span.end - token.span.start));

/**
 * 連なりの、知っている語（文書がほかで単独で使う組織の名前、連なりを閉じる決まった語）を外した残りのうち、最も長いもの。
 * 安全保障理事会常任理事国は（安全保障理事会を単独で使う文書なら）「常任理事国」、日本国内閣総理大臣は「日本国」を数える。
 * 名前に普通の語が続く連なり（日本弁護士連合会臨時総会決議）は、名前がその文書で単独で使われていなければ、まるごと数える。
 */
const longestUnknown = (tokens: readonly Token[], rest: Span, keptHead: string, context: RunContext): string => {
  const covering = coveringOf(tokens, rest);
  const words = covering.flatMap((index) => tokens.slice(index, index + 1).map((token) => surfaceWithin(token, rest)));
  const whole = words.join("");
  // A run as long as the text holds no known word; reading it word by word would take a pass per word.
  if (![...context.terms, ...context.words.knownWords].some((known) => whole.includes(known))) return keptHead + whole;
  const isKnown = (start: number, end: number): boolean => {
    const piece = words.slice(start, end).join("");
    return context.terms.has(piece) || (end === words.length && context.words.knownWords.has(piece));
  };
  return unknownPieces(words, context.maxKnownWords, isKnown)
    .map((piece) => (piece.first ? keptHead + piece.text : piece.text))
    .reduce((longest, piece) => (piece.length > longest.length ? piece : longest), "");
};

const longestKanji = (sentence: Sentence, context: RunContext): string =>
  runsOf(sentence, context.profile, context.names)
    .map((run) => measuredRun(sentence.tokens, run, context))
    .reduce((longest, run) => (run.length > longest.length ? run : longest), "");

/** 見出しの中の漢字の連なり。 */
const headingRuns = (doc: ProseDocument): string[] =>
  (doc.markup?.headings ?? []).flatMap((heading) => [...heading.text.matchAll(KANJI_RUN)].map((match) => match[0]));

/**
 * 文書の中で題として置かれた漢字の連なり: 題の置き方をした文の中の連なりと、見出しの中の連なり。
 * 同じ名前を文の中で使えば（認定職業訓練実施奨励金の支給額）、それも題の名前と読む。
 */
const titledNames = (doc: ProseDocument, profile: DocumentProfile | undefined, names: readonly string[]): string[] => [
  ...doc.sentences.flatMap((sentence) => runsOf(sentence, profile, names).flatMap((run) => (run.placed ? [run.text] : []))),
  ...headingRuns(doc),
];

/** 割る手がかりにする、文書が単独で使う名前の最短の字数。短い名前（事務局、理事会）は普通の語の一部にもなる。 */
const MIN_TERM_LENGTH = 6;

/** 文書の漢字の連なり: 文の中と、見出しの中。 */
const allRuns = (doc: ProseDocument, profile: DocumentProfile | undefined, names: readonly string[]): string[] => [
  ...doc.sentences.flatMap((sentence) => runsOf(sentence, profile, names).map((run) => run.text)),
  ...headingRuns(doc),
];

/** 文書の genre が、rule の headword_genres（見出し語の行を数えない genre: 用語集）にあるか。 */
const isHeadwordGenre = (options: DetectorOptions): boolean => {
  const genres = options.settings?.["headword_genres"];
  const genre = options.genre;
  return genre !== undefined && Array.isArray(genres) && genres.some((target: string) => isIn(genre, target));
};

/**
 * 漢字が続くと、どこで語が切れるのか読み手が探すことになる。
 * 「情報処理推進機構認定試験」は 12 字。ひらがなを 1 つ挟むだけで読める。
 */
export const kanjiRun: Detector = (doc, options): Finding[] => {
  const patterns = (id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);
  const organisation: OrganisationWords = {
    forms: patterns("organisation-form"),
    closingForms: (doc.lexicons["organisation-form"] ?? []).filter((entry) => entry.position !== "before").map((entry) => entry.pattern),
    units: patterns("organisation-unit"),
  };
  const words: NameWords = {
    topUnits: new Set(patterns("prefecture-unit")),
    organisation,
    title: { endings: patterns("title-ending") },
    positional: patterns("calendar-unit"),
    addressee: patterns("addressee-suffix"),
    addressees: { prefixes: patterns("addressee-prefix"), titles: patterns("addressee-title"), endings: organisation.units, forms: organisation.closingForms },
    references: patterns("reference-prefix"),
    listSuffixes: patterns("list-suffix"),
    knownWords: new Set(patterns("kanji-known-word")),
  };
  const names = doc.names ?? [];
  const context: RunContext = {
    profile: doc.profile,
    names,
    words,
    titled: titledNames(doc, doc.profile, names),
    terms: standaloneNames(allRuns(doc, doc.profile, names), MIN_TERM_LENGTH, options.limit, organisation.units),
    headwords: isHeadwordGenre(options),
    maxKnownWords: Math.max(options.limit, ...[...words.knownWords].map((word) => [...word].length)),
  };
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
 * 語彙表（nakaguro-word）の、中黒を含めて 1 語の語（キャッシュ・フロー）の中黒は並べていないので数えない。
 */
export const middleDot: Detector = (doc, options): Finding[] => {
  const words = (options.lexicon ?? []).map((entry) => entry.pattern).toSorted((left, right) => right.length - left.length);
  return doc.sentences
    .map((sentence) => ({ sentence, count: parallelDotCount(sentence.text, words) }))
    .filter(({ count }) => count > options.limit)
    .map(({ sentence, count }) => ({
      rule: "no-nakaguro-parallel",
      severity: "info",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: { count, limit: options.limit, offset: sentence.span.start },
    }));
};
