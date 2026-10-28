import { joinWords } from "./word-list.ts";
import { wordsOf } from "./structure.ts";
import type { Detector, Finding, Lexicon, LexiconEntry, ProseDocument, Sentence, Span, Token } from "../plugin.ts";
import { entryIn, entryOpens, entryRanges, type TokenRange } from "./lexicon-match.ts";
import { sentencesWithHeadings } from "./heading-sentences.ts";
import { scoped, scopeMarkersOf, type ScopeMarkers } from "./superlative-scope.ts";
import { makesWord, namesQuantity } from "./superlative-name.ts";
import { namesAmount } from "./superlative-amount.ts";
import { restricted, type Restrictors } from "./superlative-clause.ts";
import { stackedHedges, type StackedHedge } from "./stacked-hedge.ts";
import { comparisonMarkersOf, counterpartBefore, onlyQuoted, quotedRange, type ComparisonMarkers } from "./superlative-comparison.ts";
import { inPhrase, ownedBefore } from "./superlative-phrase.ts";
import { asked, contextOf, pointsAtReferent, ranksParts, sought, viewpointBefore, type Context } from "./superlative-context.ts";

const PER = 1000;

/** 密度を見る rule は短い文書を測らない。単位は言語で違うので床も分ける。 */
const FLOOR = { word: 200, char: 500 };

type Hit = { readonly sentence: Sentence; readonly matched: string; readonly group?: string | undefined };

const hitsFor = (doc: ProseDocument, lexicon: Lexicon): Hit[] =>
  doc.sentences.flatMap((sentence) =>
    lexicon.filter((entry) => entryIn(sentence, entry)).map((entry) => ({ sentence, matched: entry.pattern, group: entry.group })),
  );

/**
 * A lexicon word in group address says how the document speaks to its reader (あなたの). Alone it is the writer's chosen
 * register, so it counts only beside a phrase from outside the group.
 */
const ADDRESS_GROUP = "address";
const onlyAddress = (hits: readonly Hit[]): boolean => hits.every((hit) => hit.group === ADDRESS_GROUP);

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
    if (onlyAddress(hits) || (isShort && (short === "skip" || hits.length < SHORT_MINIMUM_HITS))) return [];
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

/** 数字は語ではないので言語を問わない。数があれば測った結果を言っている。全角の数字（最大５億ドル）も数字。品詞の数（NUM）は "the best one" の one まで含むので使わない。 */
const DIGIT = /\p{Nd}/u;

type Qualifiers = {
  readonly comparison: ComparisonMarkers;
  readonly scope: ScopeMarkers;
  readonly quantityNouns: Lexicon;
  readonly suffixes: Lexicon;
  readonly amounts: Lexicon;
  readonly restrictors: Restrictors;
  readonly phrases: Lexicon;
  readonly owners: Lexicon;
  readonly context: Context;
};

const qualifiersOf = (doc: ProseDocument): Qualifiers => ({
  comparison: comparisonMarkersOf(doc.lexicons["comparison-marker"] ?? []),
  scope: scopeMarkersOf(doc.lexicons["superlative-scope"] ?? [], doc.lexicons["superlative-purpose"], doc.lexicons["superlative-realm"]),
  quantityNouns: doc.lexicons["quantity-noun"] ?? [],
  suffixes: doc.lexicons["superlative-suffix"] ?? [],
  amounts: doc.lexicons["superlative-amount"] ?? [],
  restrictors: {
    relatives: doc.lexicons["relative-word"] ?? [],
    bounds: doc.lexicons["superlative-bound"] ?? [],
    subjects: doc.lexicons["subject-pronoun"] ?? [],
  },
  phrases: doc.lexicons["superlative-phrase"] ?? [],
  owners: doc.lexicons["superlative-owner"] ?? [],
  context: contextOf(doc.lexicons),
});

/** 範囲・持ち主・節・分詞・形容詞・すぐ前の相手のどれかが最上級を限っているか、最上級が量か名前を言っているか。 */
const qualifiedAt = (tokens: readonly Token[], range: TokenRange, qualifiers: Qualifiers): boolean =>
  counterpartBefore(tokens, range, qualifiers.comparison.before) ||
  scoped(tokens, range, qualifiers.scope) ||
  ownedBefore(tokens, range, qualifiers.owners) ||
  viewpointBefore(tokens, range, qualifiers.context.viewpoints) ||
  pointsAtReferent(tokens, range, qualifiers.context.referents) ||
  ranksParts(tokens, range, qualifiers.context.parts) ||
  restricted(tokens, range, qualifiers.restrictors) ||
  namesQuantity(tokens, range, qualifiers.quantityNouns) ||
  makesWord(tokens, range, qualifiers.suffixes) ||
  namesAmount(tokens, range, qualifiers.amounts);

/** どの出現も引いた言葉か、限られているか、量を言うときだけ。1 つでもそうでない出現があれば、その文には限定の無い最上級がある。 */
const everyQualified = (sentence: Sentence, entry: LexiconEntry, qualifiers: Qualifiers): boolean => {
  const tokens = sentence.tokens ?? [];
  const ranges = entryRanges(sentence, entry);
  return (
    ranges.length > 0 &&
    ranges.every(
      (range) =>
        quotedRange(sentence, range) ||
        inPhrase(tokens, range, qualifiers.phrases) ||
        sought(sentence, range, qualifiers.context.goals) ||
        qualifiedAt(tokens, range, qualifiers),
    )
  );
};

const qualified = (sentence: Sentence, entry: LexiconEntry, qualifiers: Qualifiers): boolean =>
  DIGIT.test(sentence.text) ||
  asked(sentence) ||
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
 * 書き手が書いた語。引用符の中だけの語（words such as "delves" and "pivotal"）は、例に挙げたか人の言葉を引いたもの。
 * 品詞があれば当たった語の並びごとに見る（活用した形も原形で当たる）。無ければ字で照らす。
 */
const writtenIn = (sentence: Sentence, entry: LexiconEntry): boolean =>
  sentence.tokens === undefined || entry.tokens === undefined || entry.tokens.length === 0
    ? entryIn(sentence, entry) && !onlyQuoted(sentence, entry)
    : entryRanges(sentence, entry).some((range) => !quotedRange(sentence, range));

/**
 * AI 生成の signal。1 つでは何も言えないので、重みを足し合わせて文書の点にする。見出しも読む（「〜をわかりやすく解説」のような題）。
 * 単独で断じない。§20.2 の複合シグナルの入口で、これだけで「AI が書いた」とは言わない。
 */
export const aiTell: Detector = (doc, options): Finding[] => {
  const entries = [...new Map((options.lexicon ?? []).map((entry) => [entry.pattern.toLowerCase(), entry])).values()];
  const sentences = sentencesWithHeadings(doc);
  const found = entries.filter((entry) => sentences.some((sentence) => writtenIn(sentence, entry)));
  const score = Math.round(found.reduce((sum, entry) => sum + (entry.weight ?? 1), 0) * 10);
  const first = sentences.find((sentence) => found.some((entry) => writtenIn(sentence, entry)));
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
