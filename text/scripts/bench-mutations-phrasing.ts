// Seeded mistakes of stock phrasing for `yarn bench`, in either language: a preamble before the first heading, a
// clichéd closing, a padded opening, an empty intensifier, hedges stacked in one sentence, a chat reply's knowledge-cutoff line, a template
// blank left unfilled, one paragraph opener repeated, sentences chained with "And" (そして),
// a spelling the team does not use, and a pet phrase used in paragraph after paragraph. Pure and deterministic, like scripts/bench-mutations.ts.
import {
  isJapanese,
  isPoliteDocument,
  isProse,
  isRow,
  linesOf,
  proseAt,
  replaceLine,
  rewriteFirst,
  splitSentences,
  type Mutation,
  type Plant,
  type PlantContext,
} from "./bench-text.ts";
import { SECTION, blocksOf, isParagraph, type Block } from "./bench-mutations-layout.ts";
import { MIN_DOCUMENT_LENGTH } from "../packages/chaff/src/detectors/signals.ts";

const SENTENCE_END = /[。.!?]$/u;

const isSection = (line: string): boolean => SECTION.test(line);

/** 見出しでも表でも箇条書きでもない、文で終わる行。 */
const isSentenceLine = (line: string): boolean => isProse(line) && !isRow(line) && SENTENCE_END.test(line.trimEnd());

const joinSentences = (sentences: readonly string[]): string => sentences.join(isJapanese(sentences.join("")) ? "" : " ");

// 英語の文頭に語句を足すとき、小文字にしてよい語。人名や社名（Ito, Roomly）は小文字にできないので、この語で始まる文にだけ足す。
const LOWERABLE = new Set(["The", "This", "These", "That", "Those", "We", "Our", "It", "Its", "They", "Their", "There", "Each", "Every", "A", "An"]);

const firstWordOf = (sentence: string): string => sentence.trim().split(/\s+/u)[0] ?? "";

// 漢字で書く接続詞。「また、一方で」のように重ねない。
const KANJI_OPENER = /^(?:一方|他方|次に)/u;

/** 語句を文頭に足す。英語は小文字にしてよい語で始まる文だけ。日本語は漢字かカタカナで始まる文だけで、挨拶（こんにちは）には足さない。 */
const prefixed = (prefix: string, sentence: string): string | undefined => {
  const trimmed = sentence.trimStart();
  if (isJapanese(prefix)) return /^[一-龠々ァ-ヶ]/u.test(trimmed) && !KANJI_OPENER.test(trimmed) ? `${prefix}${trimmed}` : undefined;
  const word = firstWordOf(trimmed);
  return LOWERABLE.has(word) ? `${prefix}${word.toLowerCase()}${trimmed.slice(word.length)}` : undefined;
};

/** 行の最初の文に語句を足す。 */
const prefixLine = (prefix: string, line: string): string | undefined => {
  const [first, ...rest] = splitSentences(line);
  const head = first === undefined ? undefined : prefixed(prefix, first);
  return head === undefined ? undefined : joinSentences([head, ...rest]);
};

// --- preamble-length ---

/** 最初の節見出しを消す。見出しの下の段落が、本題の前の前置きになる。前置きの段落が上限を超えるときだけ植える。 */
export const dropFirstHeading = (source: string, context: PlantContext): Plant | undefined => {
  const limit = context.limits["preamble-length"];
  const lines = linesOf(source);
  const first = lines.findIndex(isSection);
  const next = lines.findIndex((line, index) => index > first && isSection(line));
  if (limit === undefined || first < 0 || next < 0) return undefined;
  const preamble = blocksOf(lines).filter((block) => block.start < next && isParagraph(lines, block)).length;
  const blankAfter = lines[first + 1]?.trim() === "" ? first + 1 : first;
  return preamble <= limit ? undefined : { source: lines.filter((_, at) => at < first || at > blankAfter).join("\n"), line: first + 1 };
};

// --- closing-cliche ---

const CLOSING = { ja: "いかがでしたか。", en: "Thanks for reading." };

/** 記事の最後に、どの記事にも付けられる結びの一文を段落として足す。 */
export const closeWithCliche = (source: string): Plant => {
  const lines = linesOf(source.trimEnd());
  return { source: [...lines, "", isJapanese(source) ? CLOSING.ja : CLOSING.en, ""].join("\n"), line: lines.length + 2 };
};

// --- padded-intro ---

const PADDED = {
  polite: "近年、業務の効率化が注目されています。",
  plain: "近年、業務の効率化が注目されている。",
  en: "In recent years, the way teams work has changed a great deal.",
};

const paddingFor = (source: string): string => {
  if (!isJapanese(source)) return PADDED.en;
  return isPoliteDocument(source) ? PADDED.polite : PADDED.plain;
};

/** 最初の文の後ろに、どの記事の書き出しにもなる一文を足す。 */
export const padOpening = (source: string): Plant | undefined => {
  const padding = paddingFor(source);
  return rewriteFirst(source, isSentenceLine, (line) => {
    const [first, ...rest] = splitSentences(line);
    return first === undefined ? undefined : joinSentences([first, padding, ...rest]);
  });
};

// --- empty-intensifier ---

const EMPHASIS = { polite: "これは非常に重要です。", plain: "これは非常に重要である。", en: "This is extremely important." };

const emphasisFor = (source: string): string => {
  if (!isJapanese(source)) return EMPHASIS.en;
  return isPoliteDocument(source) ? EMPHASIS.polite : EMPHASIS.plain;
};

/** 最初の節の最初の段落で、最初の文の後ろに一文を足す。節見出しの無い文書（挨拶で始まる手紙）には植えない。 */
const addToFirstSection = (source: string, added: string): Plant | undefined => {
  const lines = linesOf(source);
  const heading = lines.findIndex(isSection);
  const block = heading < 0 ? undefined : blocksOf(lines).find((candidate) => candidate.start > heading && isParagraph(lines, candidate));
  const [first, ...rest] = block === undefined ? [] : splitSentences(lines[block.start] ?? "");
  if (block === undefined || first === undefined) return undefined;
  return { source: replaceLine(lines, block.start, joinSentences([first, added, ...rest])), line: block.start + 1 };
};

/** 最初の節の最初の段落に、中身の無い強調の一文を足す。 */
export const intensify = (source: string): Plant | undefined => addToFirstSection(source, emphasisFor(source));

// --- excessive-hedging ---

const STACKED_HEDGE = {
  polite: "これで遅れは減るかもしれないと思われます。",
  plain: "これで遅れは減るかもしれないと思われる。",
  en: "This may possibly cut the delays.",
};

const stackedHedgeFor = (source: string): string => {
  if (!isJapanese(source)) return STACKED_HEDGE.en;
  return isPoliteDocument(source) ? STACKED_HEDGE.polite : STACKED_HEDGE.plain;
};

/** 最初の節の最初の段落に、逃げの表現を 1 つの文に重ねた一文を足す。 */
export const stackHedges = (source: string): Plant | undefined => addToFirstSection(source, stackedHedgeFor(source));

// --- assistant-residue ---

const RESIDUE = {
  polite: "私の知識は昨年時点のものです。",
  plain: "私の知識は昨年時点のものである。",
  en: "As of my last knowledge update, this was still the plan.",
};

const residueFor = (source: string): string => {
  if (!isJapanese(source)) return RESIDUE.en;
  return isPoliteDocument(source) ? RESIDUE.polite : RESIDUE.plain;
};

/** 最初の節の最初の段落に、チャットの返事に残る知識の期限の断り書きを足す。 */
export const leaveResidue = (source: string): Plant | undefined => addToFirstSection(source, residueFor(source));

// --- unfilled-placeholder ---

const BLANK = {
  polite: "詳しくは【担当者名】までご連絡ください。",
  plain: "詳しくは【担当者名】に問い合わせる。",
  en: "For details, contact [Your Name].",
};

const blankFor = (source: string): string => {
  if (!isJapanese(source)) return BLANK.en;
  return isPoliteDocument(source) ? BLANK.polite : BLANK.plain;
};

/** 最初の節の最初の段落に、雛形の空欄を埋め忘れた一文を足す。 */
export const leaveBlank = (source: string): Plant | undefined => addToFirstSection(source, blankFor(source));

// --- chat-citation-residue ---

const CHAT_LINK = {
  polite: "手順は[公式の説明](https://example.com/setup?utm_source=chatgpt.com)のとおりです。",
  plain: "手順は[公式の説明](https://example.com/setup?utm_source=chatgpt.com)のとおりである。",
  en: "The steps follow [the official guide](https://example.com/setup?utm_source=chatgpt.com).",
};

const chatLinkFor = (source: string): string => {
  if (!isJapanese(source)) return CHAT_LINK.en;
  return isPoliteDocument(source) ? CHAT_LINK.polite : CHAT_LINK.plain;
};

/** 最初の節の最初の段落に、チャットの答えから貼ったままのリンクを足す。 */
export const pasteChatLink = (source: string): Plant | undefined => addToFirstSection(source, chatLinkFor(source));

// --- repeated-conjunction ---

const OPENER = { ja: "また、", en: "Also, " };

type Run = { readonly done: readonly (readonly Block[])[]; readonly current: readonly Block[] };

/** 語句を足せる段落の、見出しだけを挟んで続く並び。表や箇条書きや足せない段落が挟まると切れる。文書の最初の段落には、付け足す相手が無いので足さない。 */
const openableRuns = (lines: readonly string[], opener: string): (readonly Block[])[] => {
  const firstParagraph = blocksOf(lines).find((block) => isParagraph(lines, block))?.start;
  const runs = blocksOf(lines).reduce<Run>(
    (acc, block) => {
      if (block.end - block.start === 1 && isSection(lines[block.start] ?? "")) return acc;
      const openable = block.start !== firstParagraph && isParagraph(lines, block) && prefixLine(opener, lines[block.start] ?? "") !== undefined;
      return openable ? { done: acc.done, current: [...acc.current, block] } : { done: [...acc.done, acc.current], current: [] };
    },
    { done: [], current: [] },
  );
  return [...runs.done, runs.current];
};

/** 続く段落のうち上限より一つ多い数を、同じ接続詞で始める。 */
export const repeatOpener = (source: string, context: PlantContext): Plant | undefined => {
  const limit = context.limits["repeated-conjunction"];
  const opener = isJapanese(source) ? OPENER.ja : OPENER.en;
  const lines = linesOf(source);
  const run = limit === undefined ? undefined : openableRuns(lines, opener).find((blocks) => blocks.length > limit);
  if (limit === undefined || run === undefined) return undefined;
  const starts = run.slice(0, limit + 1).map((block) => block.start);
  const rewritten = lines.map((line, index) => (starts.includes(index) ? (prefixLine(opener, line) ?? line) : line));
  return { source: rewritten.join("\n"), line: (starts[0] ?? 0) + 1 };
};

// --- sentence-initial-conjunction-run ---

const CHAIN = { ja: "そして、", en: "And " };

/** 段落の二文目から、上限より一つ多い文を接続詞（And、そして）で始める。どの文も足せる語で始まる段落だけ。 */
const chainLine = (line: string, count: number): string | undefined => {
  const [first, ...rest] = splitSentences(line);
  const chain = isJapanese(line) ? CHAIN.ja : CHAIN.en;
  const chained = rest.slice(0, count).map((sentence) => prefixed(chain, sentence));
  if (first === undefined || chained.length < count || chained.some((sentence) => sentence === undefined)) return undefined;
  return joinSentences([first, ...chained.flatMap((sentence) => sentence ?? []), ...rest.slice(count)]);
};

/** 文を接続詞でつなぎ続ける。上限より一つ多い文を続けて "And"（日本語は「そして、」）で始める。 */
export const chainWithConjunction = (source: string, context: PlantContext): Plant | undefined => {
  const limit = context.limits["sentence-initial-conjunction-run"];
  if (limit === undefined) return undefined;
  return rewriteFirst(
    source,
    (line) => isSentenceLine(line) && chainLine(line, limit + 1) !== undefined,
    (line) => chainLine(line, limit + 1),
  );
};

// --- ngram-repetition ---

// 書き手の口癖。述語（言う・goes）を含むので、品詞で言い回しを見分ける ngram-repetition にも言い回しとして数えられる。
const PET_PHRASE = { polite: "言うまでもないことですが、", plain: "言うまでもないことだが、", en: "It goes without saying that " };

const petPhraseFor = (source: string): string => {
  if (!isJapanese(source)) return PET_PHRASE.en;
  return isPoliteDocument(source) ? PET_PHRASE.polite : PET_PHRASE.plain;
};

/** 段落の、前置きを足せる最初の文の頭に足す。足せる文が無ければ undefined。 */
const prefixFirstFitting = (phrase: string, line: string): string | undefined => {
  const sentences = splitSentences(line);
  const at = sentences.findIndex((sentence) => prefixed(phrase, sentence) !== undefined);
  const head = sentences[at];
  const phrased = head === undefined ? undefined : prefixed(phrase, head);
  return phrased === undefined ? undefined : joinSentences(sentences.map((sentence, index) => (index === at ? phrased : sentence)));
};

/** chaff が繰り返しを数える長さか。短い文書では ngram-repetition は走らない。 */
export const isCounted = (source: string, context: PlantContext): boolean =>
  context.lengthUnit !== undefined && context.documentLength !== undefined && context.documentLength(source) >= MIN_DOCUMENT_LENGTH[context.lengthUnit];

/**
 * 上限より一つ多い段落で、同じ口癖を文の頭に足す。一つの段落には一度だけ: 続く文の頭をそろえると、別の rule
 * （repeated-sentence-head）の誤りになる。足した後でも chaff が数えない短さの文書には植えない。
 */
export const repeatPetPhrase = (source: string, context: PlantContext): Plant | undefined => {
  const limit = context.limits["ngram-repetition"];
  const phrase = petPhraseFor(source);
  const lines = linesOf(source);
  const prose = proseAt(lines);
  const targets = lines.flatMap((line, index) => (prose(index) && isSentenceLine(line) && prefixFirstFitting(phrase, line) !== undefined ? [index] : []));
  if (limit === undefined || targets.length <= limit) return undefined;
  const chosen = targets.slice(0, limit + 1);
  const rewritten = lines.map((line, index) => (chosen.includes(index) ? (prefixFirstFitting(phrase, line) ?? line) : line)).join("\n");
  return isCounted(rewritten, context) ? { source: rewritten, line: (chosen[0] ?? 0) + 1 } : undefined;
};

// --- preferred-term ---

type Spelling = { readonly use: string; readonly avoid: string };

const SPELLINGS: readonly Spelling[] = [
  { use: "打ち合わせ", avoid: "打合せ" },
  { use: "問い合わせ", avoid: "問合せ" },
  { use: "受け付け", avoid: "受付け" },
  { use: "取り消", avoid: "取消" },
  { use: "申し込", avoid: "申込" },
  { use: "email", avoid: "e-mail" },
  { use: "setup", avoid: "set-up" },
];

/** bench のチームが chaff.yaml の prefer に書いた { 使わない書き方: 使う書き方 }。植える書き方と同じ。 */
export const TEAM_PREFER: Readonly<Record<string, string>> = Object.fromEntries(SPELLINGS.map(({ use, avoid }) => [avoid, use]));

const avoidedIn = (line: string): string | undefined => {
  const spelling = SPELLINGS.find(({ use }) => line.includes(use));
  return spelling === undefined ? undefined : line.replace(spelling.use, spelling.avoid);
};

/** チームが決めた書き方の一つを、使わないと決めた書き方にする。 */
export const avoidedSpelling = (source: string): Plant | undefined => rewriteFirst(source, (line) => isProse(line) && avoidedIn(line) !== undefined, avoidedIn);

/** The mistakes of stock phrasing, in the order `yarn bench` plants them after the others. */
export const PHRASING_MUTATIONS: readonly Mutation[] = [
  { id: "heading-dropped", rule: "preamble-length", languages: ["ja", "en"], reportsOn: "document", plant: dropFirstHeading },
  { id: "cliche-closing", rule: "closing-cliche", languages: ["ja", "en"], plant: closeWithCliche },
  { id: "padded-opening", rule: "padded-intro", languages: ["ja", "en"], plant: padOpening },
  { id: "intensified", rule: "empty-intensifier", languages: ["ja", "en"], plant: intensify },
  { id: "hedges-stacked", rule: "excessive-hedging", languages: ["ja", "en"], plant: stackHedges },
  { id: "residue-left", rule: "assistant-residue", languages: ["ja", "en"], plant: leaveResidue },
  { id: "blank-left", rule: "unfilled-placeholder", languages: ["ja", "en"], plant: leaveBlank },
  { id: "chat-link-pasted", rule: "chat-citation-residue", languages: ["ja", "en"], plant: pasteChatLink },
  { id: "opener-repeated", rule: "repeated-conjunction", languages: ["ja", "en"], plant: repeatOpener },
  { id: "and-chained", rule: "sentence-initial-conjunction-run", languages: ["en"], plant: chainWithConjunction },
  { id: "soshite-chained", rule: "sentence-initial-conjunction-run", languages: ["ja"], plant: chainWithConjunction },
  { id: "spelling-avoided", rule: "preferred-term", languages: ["ja", "en"], plant: avoidedSpelling },
  { id: "pet-phrase", rule: "ngram-repetition", languages: ["ja", "en"], plant: repeatPetPhrase },
];
