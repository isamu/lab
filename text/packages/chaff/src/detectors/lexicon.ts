import { joinWords } from "./word-list.ts";
import { straightApostrophes } from "../orthography.ts";
import { wordsOf } from "./structure.ts";
import type { Detector, Finding, Lexicon, LexiconEntry, ProseDocument, Sentence, Span, Token } from "../plugin.ts";
import { entryIn, entryOpens, entryRanges, type TokenRange } from "./lexicon-match.ts";
import { scoped, scopeMarkersOf, type ScopeMarkers } from "./superlative-scope.ts";
import { namesQuantity } from "./superlative-name.ts";
import { namesAmount } from "./superlative-amount.ts";
import { restricted, type Restrictors } from "./superlative-clause.ts";
import { stackedHedges, type StackedHedge } from "./stacked-hedge.ts";
import { comparisonMarkersOf, counterpartBefore, onlyQuoted, quotedRange, type ComparisonMarkers } from "./superlative-comparison.ts";

const PER = 1000;

/** 密度を見る rule は短い文書を測らない。単位は言語で違うので床も分ける。 */
const FLOOR = { word: 200, char: 500 };

type Hit = { readonly sentence: Sentence; readonly matched: string };

const hitsFor = (doc: ProseDocument, lexicon: Lexicon): Hit[] =>
  doc.sentences.flatMap((sentence) => lexicon.filter((entry) => entryIn(sentence, entry)).map((entry) => ({ sentence, matched: entry.pattern })));

/**
 * 床より短い文書の扱い。skip は測らない。at-floor は SHORT_LENGTH の長さの文書として測り、一つだけなら言わない（一つは礼儀）。
 * クッション言葉はメールや手紙のような短い文書に重なるので at-floor。逃げの表現は短い文書でも一文に重ねた形で見つかるので skip。
 */
type ShortDocuments = "skip" | "at-floor";

/** 短い文書を測るときの長さ。どちらの言語でも、既定の水準で三つ目から言う長さ（二つは「お忙しいところ恐れ入りますが」のように普通に重なる）。 */
const SHORT_LENGTH = { word: 400, char: 500 };

/** 短い文書でも、これより少なければ言わない。 */
const SHORT_MINIMUM_HITS = 2;

const perThousand = (count: number, length: number): number => (length === 0 ? 0 : Math.round((count / length) * PER));

/**
 * 単位長あたりの出現率。件数で数えると長い文書ほど当たる（bold-density と同じ）。
 * 短すぎて測らない文書、1 つも無いとき、閾値に収まるときは undefined。
 */
export const rateOver = (doc: ProseDocument, count: number, limit: number): number | undefined => {
  const length = wordsOf(doc);
  const rate = perThousand(count, length);
  return length < FLOOR[doc.lengthUnit] || count === 0 || rate <= limit ? undefined : rate;
};

/** rule の id は呼び出し側が持つ。detector は「密度が閾値を超えたか」しか知らない。指摘が言う密度は、短い文書でも文書の実際の長さでの値。 */
const densityRule =
  (rule: string, short: ShortDocuments = "skip"): Detector =>
  (doc, options): Finding[] => {
    const hits = hitsFor(doc, options.lexicon ?? []);
    const length = wordsOf(doc);
    const isShort = length < FLOOR[doc.lengthUnit];
    if (hits.length === 0 || (isShort && (short === "skip" || hits.length < SHORT_MINIMUM_HITS))) return [];
    if (perThousand(hits.length, isShort ? SHORT_LENGTH[doc.lengthUnit] : length) <= options.limit) return [];
    const density = perThousand(hits.length, length);
    return hits.map((hit) => ({
      rule,
      severity: "warning",
      line: 0,
      column: 0,
      quote: hit.sentence.text.trim(),
      values: { matched: hit.matched, count: hits.length, density, limit: options.limit, offset: hit.sentence.span.start },
    }));
  };

const hedgingDensity = densityRule("excessive-hedging");
export const cushionDensity = densityRule("cushion-phrase-density", "at-floor");
/** 語彙表の語の密度だけを見る rule が共通で使う。rule の id は実行側が入れる。 */
export const phraseDensity = densityRule("");

/** 書いたとおりの字。行の折り返しをまたいでいたら空白 1 つに。 */
const writtenAt = (source: string, span: Span): string => source.slice(span.start, span.end).replace(/\s+/gu, " ").trim();

const stackedFinding = (doc: ProseDocument, stacked: StackedHedge): Finding => ({
  rule: "excessive-hedging",
  severity: "warning",
  line: 0,
  column: 0,
  quote: stacked.sentence.text.trim(),
  variant: "stacked",
  values: {
    matched: joinWords(
      stacked.spans.map((span) => writtenAt(doc.source, span)),
      doc.language,
    ),
    count: stacked.spans.length,
    offset: stacked.spans[0]?.start ?? stacked.sentence.span.start,
  },
});

/**
 * 逃げの表現は 2 つの見方で探す。1 つの文に重ねたもの（短い文書でも 1 文で分かる）と、文書全体の密度。
 * 重ねた文は密度の側では出さない。同じ文を同じ rule で 2 度言わない。
 */
export const hedging: Detector = (doc, options): Finding[] => {
  const stacked = stackedHedges(doc.sentences, {
    hedges: options.lexicon ?? [],
    frames: doc.lexicons["hedge-frame"] ?? [],
    scope: doc.lexicons["hedge-scope"] ?? [],
  });
  const reported = new Set(stacked.map((entry) => entry.sentence.span.start));
  const density = hedgingDensity(doc, options).filter((finding) => !reported.has(Number(finding.values["offset"])));
  return [...stacked.map((entry) => stackedFinding(doc, entry)), ...density];
};

/** 数字は語ではないので言語を問わない。数があれば測った結果を言っている。品詞の数（NUM）は "the best one" の one まで含むので使わない。 */
const DIGIT = /\d/u;

type Qualifiers = {
  readonly comparison: ComparisonMarkers;
  readonly scope: ScopeMarkers;
  readonly quantityNouns: Lexicon;
  readonly amounts: Lexicon;
  readonly restrictors: Restrictors;
};

const qualifiersOf = (doc: ProseDocument): Qualifiers => ({
  comparison: comparisonMarkersOf(doc.lexicons["comparison-marker"] ?? []),
  scope: scopeMarkersOf(doc.lexicons["superlative-scope"] ?? []),
  quantityNouns: doc.lexicons["quantity-noun"] ?? [],
  amounts: doc.lexicons["superlative-amount"] ?? [],
  restrictors: {
    relatives: doc.lexicons["relative-word"] ?? [],
    bounds: doc.lexicons["superlative-bound"] ?? [],
    subjects: doc.lexicons["subject-pronoun"] ?? [],
  },
});

/** 範囲・節・分詞・形容詞・すぐ前の相手のどれかが最上級を限っているか、最上級が量か名前を言っているか。 */
const qualifiedAt = (tokens: readonly Token[], range: TokenRange, qualifiers: Qualifiers): boolean =>
  counterpartBefore(tokens, range, qualifiers.comparison.before) ||
  scoped(tokens, range, qualifiers.scope) ||
  restricted(tokens, range, qualifiers.restrictors) ||
  namesQuantity(tokens, range, qualifiers.quantityNouns) ||
  namesAmount(tokens, range, qualifiers.amounts);

/** どの出現も引いた言葉か、限られているか、量を言うときだけ。1 つでもそうでない出現があれば、その文には限定の無い最上級がある。 */
const everyQualified = (sentence: Sentence, entry: LexiconEntry, qualifiers: Qualifiers): boolean => {
  const tokens = sentence.tokens ?? [];
  const ranges = entryRanges(sentence, entry);
  return ranges.length > 0 && ranges.every((range) => quotedRange(sentence, range) || qualifiedAt(tokens, range, qualifiers));
};

const qualified = (sentence: Sentence, entry: LexiconEntry, qualifiers: Qualifiers): boolean =>
  DIGIT.test(sentence.text) ||
  onlyQuoted(sentence, entry) ||
  qualifiers.comparison.anywhere.some((marker) => entryIn(sentence, marker)) ||
  everyQualified(sentence, entry, qualifiers);

const bareHits = (doc: ProseDocument, lexicon: Lexicon): Hit[] => {
  const qualifiers = qualifiersOf(doc);
  return doc.sentences.flatMap((sentence) =>
    lexicon.filter((entry) => entryIn(sentence, entry) && !qualified(sentence, entry, qualifiers)).map((entry) => ({ sentence, matched: entry.pattern })),
  );
};

/**
 * 限定のない最上級。「最も速い」だけでは、何と比べて最もなのかが無い。
 * 同じ文に比較対象・条件・範囲（日本で最も、the best in the world）があれば、それは主張であって誇張ではない。
 * 比較と範囲を言う語は言語パッケージの語彙表が持つ。
 */
export const unqualifiedSuperlative: Detector = (doc, options): Finding[] => {
  const bare = bareHits(doc, options.lexicon ?? []);
  if (bare.length < options.limit) return [];
  return bare.map((hit) => ({
    rule: "unqualified-superlative",
    severity: "warning",
    line: 0,
    column: 0,
    quote: hit.sentence.text.trim(),
    values: { matched: hit.matched, count: bare.length, limit: options.limit, offset: hit.sentence.span.start },
  }));
};

const openerOf = (doc: ProseDocument, lexicon: Lexicon): (string | undefined)[] =>
  doc.paragraphs.map((paragraph) => {
    const head = paragraph.sentences[0];
    return head === undefined ? undefined : lexicon.find((entry) => entryOpens(head, entry))?.pattern;
  });

/**
 * 段落が同じ接続詞で始まり続ける。1 つなら流れを作るが、続くとどの段落も
 * 前の段落の付け足しに見えて、話がどこへ向かっているのか分からなくなる。
 */
export const repeatedConjunction: Detector = (doc, options): Finding[] => {
  const openers = openerOf(doc, options.lexicon ?? []);
  const runs = openers.reduce<{ runs: number[][]; current: number[] }>(
    (acc, opener, index) => {
      if (opener === undefined) return { runs: [...acc.runs, acc.current], current: [] };
      return { runs: acc.runs, current: [...acc.current, index] };
    },
    { runs: [], current: [] },
  );
  return [...runs.runs, runs.current]
    .filter((run) => run.length > options.limit)
    .flatMap((run) => {
      const at = doc.paragraphs[run[0] ?? 0];
      return at === undefined
        ? []
        : [
            {
              rule: "repeated-conjunction",
              severity: "warning" as const,
              line: 0,
              column: 0,
              quote: at.sentences[0]?.text.trim() ?? "",
              values: { count: run.length, limit: options.limit, offset: at.span.start },
            },
          ];
    });
};

/**
 * AI 生成の signal。1 つでは何も言えないので、重みを足し合わせて文書の点にする。
 * 単独で断じない。§20.2 の複合シグナルの入口で、これだけで「AI が書いた」とは言わない。
 */
export const aiTell: Detector = (doc, options): Finding[] => {
  const entries = [...new Map((options.lexicon ?? []).map((entry) => [entry.pattern.toLowerCase(), entry])).values()];
  const found = entries.filter((entry) => doc.sentences.some((sentence) => entryIn(sentence, entry)));
  const score = Math.round(found.reduce((sum, entry) => sum + (entry.weight ?? 1), 0) * 10);
  const first = doc.sentences.find((sentence) => found.some((entry) => entryIn(sentence, entry)));
  if (first === undefined || score <= options.limit) return [];
  return [
    {
      rule: "ai-tell",
      severity: "info",
      line: 0,
      column: 0,
      quote: first.text.trim(),
      values: {
        word: joinWords(
          found.map((entry) => entry.pattern.toLowerCase()),
          doc.language,
        ),
        count: found.length,
        density: score,
        limit: options.limit,
        offset: first.span.start,
      },
    },
  ];
};

/**
 * 同じことを言う 2 つの書きかたが、1 つの文書で混ざっているか。
 *
 * **どちらが正しいかは決めない。** 短縮形を使うかどうかは文体の選択で、
 * 立場を取ると方針の違う書き手に rule ごと無視される。spec §12.3。
 *
 * 語彙表は対を持つ（`pattern` と `instead_of`）。片方だけを数えても、
 * 意図した硬い文体なのか不統一なのかが分からない。
 */
/**
 * 語の境界で照合する。部分一致だと「it isn't」が「it is」を含んでしまい、
 * 短縮形を使っている文が「使っていない」側に数えられる。
 */
const containsWord = (text: string, word: string): boolean => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\b`, "u").test(text);

/** アポストロフィの形（don’t と don't）は短縮形かどうかを変えない。違うのは印刷の形で、文体ではない。 */
const comparableText = (sentence: Sentence): string => straightApostrophes(sentence.text).toLowerCase();

export const contractionMix: Detector = (doc, options): Finding[] => {
  const pairs = (options.lexicon ?? []).flatMap((entry) => (entry.instead_of === undefined ? [] : [{ short: entry.pattern, long: entry.instead_of }]));
  const body = doc.sentences.map(comparableText).join(" ");
  const used = pairs.filter((pair) => containsWord(body, pair.short.toLowerCase()));
  const spelled = pairs.filter((pair) => containsWord(body, pair.long.toLowerCase()));
  // 片方しか無ければ一貫している。両方あるときだけ、少数派を指摘する。
  if (used.length === 0 || spelled.length === 0) return [];
  const minorityIsShort = used.length <= spelled.length;
  const few = minorityIsShort ? used : spelled;
  if (few.length > options.limit) return [];
  const wanted = few.map((pair) => (minorityIsShort ? pair.short : pair.long).toLowerCase());
  const hits = doc.sentences.flatMap((sentence) => {
    const text = comparableText(sentence);
    const matched = wanted.find((word) => containsWord(text, word));
    return matched === undefined ? [] : [{ sentence, matched }];
  });
  return hits.map((hit) => ({
    rule: "contraction-consistency",
    severity: "info",
    line: 0,
    column: 0,
    quote: hit.sentence.text.trim(),
    values: { matched: hit.matched, count: few.length, limit: options.limit, offset: hit.sentence.span.start },
  }));
};
