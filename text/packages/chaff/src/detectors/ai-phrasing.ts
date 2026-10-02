import type { Detector, Finding, Lexicon, LexiconEntry, ProseDocument, Sentence } from "../plugin.ts";
import { wordsOf } from "./structure.ts";
import { MIN_DOCUMENT_LENGTH } from "./signals.ts";
import { entryIn, entryOpens } from "./lexicon-match.ts";
import { contrastSentences, type ContrastWords } from "./contrast-frame.ts";
import { placeholderSpans } from "./placeholder-text.ts";
import { colonLeadIns } from "./list-lead-in.ts";

// 生成文に多い形。語はどれも言語パッケージの語彙表が持ち、ここは形だけを知る。

const PER = 1000;
/** 密度は小数 1 桁まで。日本語の 1000 字あたりは 1 と 2 の間で人と生成文が分かれる。 */
const TENTHS = 10;
/** 重みの合計を 10 倍した点で比べる（ai-tell と同じ）。重み 0.5 の言い回し 2 つで 10。 */
const SCORE_SCALE = 10;
/** 1 つは重なりではない。短い文書では 1 つでも密度が上限を超えるので、数でも止める。 */
const PILE = 2;

/** 当たった文と語。offset は指摘する位置で、無ければ文の頭。 */
type Hit = { readonly sentence: Sentence; readonly matched: string; readonly offset?: number };

const findingOf = (hit: Hit, values: Readonly<Record<string, number>>): Finding => ({
  rule: "",
  severity: "info",
  line: 0,
  column: 0,
  quote: hit.sentence.text.trim(),
  values: { matched: hit.matched, ...values, offset: hit.offset ?? hit.sentence.span.start },
});

/** 1000 語（日本語は 1000 字）あたりの数が上限を超えたら、当たった文をすべて言う。短い文書は密度が暴れるので測らない。 */
export const densityFindings = (doc: ProseDocument, hits: readonly Hit[], limit: number): Finding[] => {
  const length = wordsOf(doc);
  if (hits.length < PILE || length < MIN_DOCUMENT_LENGTH[doc.lengthUnit]) return [];
  const density = Math.round((hits.length / length) * PER * TENTHS) / TENTHS;
  return density <= limit ? [] : hits.map((hit) => findingOf(hit, { count: hits.length, density, limit }));
};

const firstIn = (sentence: Sentence, lexicon: Lexicon): LexiconEntry | undefined => lexicon.find((entry) => entryIn(sentence, entry));

const contrastWordsOf = (doc: ProseDocument, frames: Lexicon): ContrastWords => ({
  frames,
  leads: doc.lexicons["contrast-lead"] ?? [],
  turns: doc.lexicons["contrast-turn"] ?? [],
});

/** 対比の枠（It's not X, it's Y、単なる X ではなく）。1 つなら論点の整理だが、重なると言い回しの癖になる。 */
export const contrastFraming: Detector = (doc, options): Finding[] => {
  const words = contrastWordsOf(doc, options.lexicon ?? []);
  const hits = contrastSentences(doc.sentences, words).map((sentence) => ({
    sentence,
    matched: (firstIn(sentence, words.frames) ?? firstIn(sentence, words.leads))?.pattern ?? "",
  }));
  return densityFindings(doc, hits, options.limit);
};

/** 語彙表の語で始まる文。 */
const openerHits = (doc: ProseDocument, lexicon: Lexicon): Hit[] =>
  doc.sentences.flatMap((sentence) => {
    const opener = lexicon.find((entry) => entryOpens(sentence, entry));
    return opener === undefined ? [] : [{ sentence, matched: opener.pattern }];
  });

/** 文頭の決まった接ぎ（Moreover、さらに）の密度。話を運ぶ語（However、また）は語彙表に入れない。 */
export const openerDensity: Detector = (doc, options): Finding[] => densityFindings(doc, openerHits(doc, options.lexicon ?? []), options.limit);

/**
 * 予告の文頭（重要なのは、Here's the thing）の数。limit は指摘に要る数。
 * 密度ではなく数で見る。人の記事も長さによらず 1 つ 2 つは書き、生成文は短い記事にも重ねる。
 */
export const openerPile: Detector = (doc, options): Finding[] => {
  const hits = openerHits(doc, options.lexicon ?? []);
  return hits.length === 0 || hits.length < options.limit ? [] : hits.map((hit) => findingOf(hit, { count: hits.length, limit: options.limit }));
};

/**
 * コロンで箇条書きへ渡す文（以下の通りです：）。1 つなら案内だが、節ごとに続くと説明が箇条書きの前置きだけになる。
 * 数えるのは文書の言語の文だけ。和文の中の英文（Examples include:）は、英語ではふつうの書き方なので数えない。
 */
export const colonLeadIn: Detector = (doc, options): Finding[] => {
  const inDocumentLanguage = doc.sentences.filter((sentence) => sentence.embeddedLanguage === undefined);
  const hits = colonLeadIns(inDocumentLanguage, doc.lists, doc.listSpans, doc.source).map((sentence) => ({ sentence, matched: sentence.text.trim() }));
  return densityFindings(doc, hits, options.limit);
};

const distinct = (lexicon: Lexicon): LexiconEntry[] => [...new Map(lexicon.map((entry) => [entry.pattern.toLowerCase(), entry])).values()];

const weightOf = (entry: LexiconEntry): number => entry.weight ?? 1;

const keyOf = (entry: LexiconEntry): string => entry.pattern.toLowerCase();

type Tally = { readonly score: number; readonly counted: ReadonlySet<string>; readonly hits: readonly Hit[] };

const NOTHING: Tally = { score: 0, counted: new Set(), hits: [] };

/** 1 つの文を足す。重みは、まだ数えていない語のうち最も重いもの。文の語はすべて数えたことにする。 */
const withSentence = (tally: Tally, sentence: Sentence, inSentence: readonly LexiconEntry[]): Tally => {
  const fresh = inSentence.filter((entry) => !tally.counted.has(keyOf(entry)));
  const added = fresh.length === 0 ? 0 : Math.max(...fresh.map(weightOf));
  const matched = (fresh[0] ?? inSentence[0])?.pattern ?? "";
  return {
    score: tally.score + added,
    counted: new Set([...tally.counted, ...inSentence.map(keyOf)]),
    hits: [...tally.hits, { sentence, matched }],
  };
};

/**
 * 1 つの文は 1 つの言い回しとして数える（Let me know if you'd like a more detailed breakdown は礼 1 つ）。
 * 前の文で数えた語は、別の文にあっても数えない（I hope this helps を 2 回書いても礼 1 つ）。
 */
const tallyOf = (sentences: readonly Sentence[], entries: readonly LexiconEntry[]): Tally =>
  sentences.reduce<Tally>((tally, sentence) => {
    const inSentence = entries.filter((entry) => entryIn(sentence, entry));
    return inSentence.length === 0 ? tally : withSentence(tally, sentence, inSentence);
  }, NOTHING);

/**
 * 会話の返事の名残（As of my last knowledge update、私の知識は）。重みを足した点が上限に届いたら、当たった文をすべて言う。
 * 名残そのもの（知識の期限、AI としての断り）は 1 つで届き、人も書く礼（I hope this helps）は 2 つ重なって届く。
 */
export const assistantResidue: Detector = (doc, options): Finding[] => {
  const tally = tallyOf(doc.sentences, distinct(options.lexicon ?? []));
  const score = Math.round(tally.score * SCORE_SCALE);
  if (tally.hits.length === 0 || score < options.limit) return [];
  return tally.hits.map((hit) => findingOf(hit, { count: tally.counted.size, density: score, limit: options.limit }));
};

/** 埋め忘れた雛形の空欄（[Your Name]、【会社名】）。limit は指摘に要る数。 */
export const unfilledPlaceholder: Detector = (doc, options): Finding[] => {
  const words = options.lexicon ?? [];
  const blanks = doc.sentences.flatMap((sentence) =>
    placeholderSpans(sentence.text, words).map((span) => ({
      sentence,
      matched: sentence.text.slice(span.start, span.end),
      offset: sentence.span.start + span.start,
    })),
  );
  if (blanks.length === 0 || blanks.length < options.limit) return [];
  return blanks.map((blank) => findingOf(blank, { count: blanks.length, limit: options.limit }));
};
