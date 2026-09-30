// Seeded mistakes of layout and decoration for `yarn bench`, in either language: a joined paragraph, a heading echoed by
// its first sentence, too much bold, emoji or dashes, team jargon and a missing required section.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isPoliteDocument, isProse, isRow, linesOf, proseAt, rewriteFirst, splitSentences, type Plant, type PlantContext } from "./bench-text.ts";
import { MIN_DOCUMENT_LENGTH } from "../packages/chaff/src/detectors/signals.ts";

export type Block = { readonly start: number; readonly end: number };

/** 空行で区切られた行のかたまり。end は含まない。 */
export const blocksOf = (lines: readonly string[]): Block[] =>
  lines.reduce<Block[]>((blocks, line, index) => {
    if (line.trim() === "") return blocks;
    const last = blocks.at(-1);
    return last !== undefined && last.end === index
      ? [...blocks.slice(0, -1), { start: last.start, end: index + 1 }]
      : [...blocks, { start: index, end: index + 1 }];
  }, []);

// --- max-paragraph-length ---

// 文で終わる行だけの段落。「第4条（管理）」のような条の見出しの行は段落に入れない。
const SENTENCE_END = /[。.!?]$/u;

export const isParagraph = (lines: readonly string[], block: Block): boolean => {
  const isProseLine = proseAt(lines);
  return lines.slice(block.start, block.end).every((line, at) => isProseLine(block.start + at) && !isRow(line) && SENTENCE_END.test(line.trimEnd()));
};

const HEADING = /^#{1,6}\s/u;

/** 段落のあいだにあってよい行。空行と見出しだけ。箇条書きや表を挟む段落はつながない。 */
const isSeparator = (line: string): boolean => line.trim() === "" || HEADING.test(line);

type LengthUnit = "char" | "word";

/** chaff と同じ単位の長さ。文字は空白を除いて数え、語は空白で区切って数える。 */
const sizeOf = (sentence: string, unit: LengthUnit): number =>
  unit === "char" ? sentence.replace(/\s+/gu, "").length : sentence.split(/\s+/u).filter((word) => word !== "").length;

type Measure = { readonly count: number; readonly size: number };

const measureOf = (lines: readonly string[], block: Block, unit: LengthUnit): Measure => {
  const sentences = lines.slice(block.start, block.end).flatMap((line) => splitSentences(line).filter((sentence) => sentence.trim() !== ""));
  return { count: sentences.length, size: sentences.reduce((sum, sentence) => sum + sizeOf(sentence, unit), 0) };
};

/** 見出しと空行だけを挟んで続く段落の並び。 */
const chainsOf = (lines: readonly string[], paragraphs: readonly Block[]): Block[][] =>
  paragraphs.reduce<Block[][]>((chains, paragraph) => {
    const chain = chains.at(-1);
    const previous = chain?.at(-1);
    const joinable = chain !== undefined && previous !== undefined && lines.slice(previous.end, paragraph.start).every(isSeparator);
    return joinable ? [...chains.slice(0, -1), [...chain, paragraph]] : [...chains, [paragraph]];
  }, []);

/** from から始めて、文の数も長さも上限を超えるまで段落を足したときの最後の段落の位置。2 つ以上つなぐ。 */
const endOfRun = (measures: readonly Measure[], from: number, isTooLong: (total: Measure) => boolean): number | undefined => {
  const totals = measures
    .slice(from)
    .map((_, at) =>
      measures
        .slice(from, from + at + 1)
        .reduce((sum, measure) => ({ count: sum.count + measure.count, size: sum.size + measure.size }), { count: 0, size: 0 }),
    );
  const at = totals.findIndex((total, index) => index > 0 && isTooLong(total));
  return at < 0 ? undefined : from + at;
};

type Run = { readonly first: Block; readonly last: Block; readonly joined: number };

const runsOf = (lines: readonly string[], chain: readonly Block[], unit: LengthUnit, isTooLong: (total: Measure) => boolean): Run[] => {
  const measures = chain.map((paragraph) => measureOf(lines, paragraph, unit));
  return chain.flatMap((first, from) => {
    const to = endOfRun(measures, from, isTooLong);
    const last = to === undefined ? undefined : chain[to];
    return to === undefined || last === undefined ? [] : [{ first, last, joined: to - from + 1 }];
  });
};

/**
 * 段落のあいだの空行と見出しを消して、1 行の段落にする（行を並べただけだと、chaff は 1 行 1 段落の文書として読む）。chaff の max-paragraph-length と同じく、文の数が上限を超え、
 * 長さも「上限 × 普通の文の長さ」を超えるまで次の段落をつなぐ。つなぐ段落がいちばん少ない並びを選び、足りなければ植えない。
 */
export const joinParagraphs = (source: string, context: PlantContext): Plant | undefined => {
  const limit = context.limits["max-paragraph-length"];
  if (limit === undefined) return undefined;
  const lengthLimit = limit * (context.fullSentences?.["max-paragraph-length"] ?? 0);
  const isTooLong = (total: Measure): boolean => total.count > limit && total.size > lengthLimit;
  const unit = context.lengthUnit ?? (isJapanese(source) ? "char" : "word");
  const lines = linesOf(source);
  const paragraphs = blocksOf(lines).filter((block) => isParagraph(lines, block));
  const runs = chainsOf(lines, paragraphs).flatMap((chain) => runsOf(lines, chain, unit, isTooLong));
  const best = runs.reduce<Run | undefined>((found, run) => (found === undefined || run.joined < found.joined ? run : found), undefined);
  if (best === undefined) return undefined;
  const joined = lines.slice(best.first.start, best.last.end).filter((line) => !isSeparator(line));
  const paragraph = joined.map((line) => line.trim()).join(unit === "char" ? "" : " ");
  return { source: [...lines.slice(0, best.first.start), paragraph, ...lines.slice(best.last.end)].join("\n"), line: best.first.start + 1 };
};

// --- heading-echo ---

export const SECTION = /^#{2,6} +(\S.*)$/u;
// chaff は見出しの文字 3-gram が四つ未満だと測らない。節の番号を除いて六文字ある見出しにだけ植える。
const MIN_HEADING_CHARS = 6;

// 節の番号は言い直さない。行頭の「2. 」は Markdown では番号付きの箇条書きになる。
const withoutNumber = (heading: string): string => heading.replace(/^[\d.]+\s*/u, "");

const echoOf = (heading: string, polite: boolean): string => {
  const words = withoutNumber(heading);
  const ending = polite ? "します" : "する";
  return isJapanese(words) ? `${words}について説明${ending}。` : `This section covers ${words}.`;
};

/** 最初の十分に長い節見出しの直後に、見出しを言い直すだけの一文を足す。 */
export const echoHeading = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const index = lines.findIndex((line) => [...withoutNumber(SECTION.exec(line)?.[1] ?? "").replace(/\s+/gu, "")].length >= MIN_HEADING_CHARS);
  const heading = SECTION.exec(lines[index] ?? "")?.[1];
  if (heading === undefined) return undefined;
  const echo = echoOf(heading, isPoliteDocument(source));
  return { source: [...lines.slice(0, index + 1), "", echo, ...lines.slice(index + 1)].join("\n"), line: index + 3 };
};

// --- bold-density ---

// chaff は 200 字に満たない節の密度を測らない（count-per-section.ts）。
const MIN_SECTION_CHARS = 200;
const PER = 1000;
// 上限ちょうどでは chaff と字の数えかたが少しずれただけで外れる。上限の倍の密度にする。
const BOLD_MARGIN = 2;
const BOLD_TARGET = /[一-龠々ァ-ヶー]{2,}|[A-Za-z]{4,}/gu;

const sectionsOf = (lines: readonly string[]): Block[] =>
  lines.reduce<Block[]>((sections, line, index) => {
    if (SECTION.test(line)) return [...sections, { start: index + 1, end: index + 1 }];
    const last = sections.at(-1);
    return last === undefined ? sections : [...sections.slice(0, -1), { start: last.start, end: index + 1 }];
  }, []);

/** 節の文の字数。空白は数えない。 */
const proseChars = (lines: readonly string[], block: Block): number => {
  const isProseLine = proseAt(lines);
  return lines.slice(block.start, block.end).reduce((sum, line, at) => sum + (isProseLine(block.start + at) ? line.replace(/\s+/gu, "").length : 0), 0);
};

const boldLine = (line: string, budget: number): { readonly line: string; readonly used: number } => {
  const spans = [...line.matchAll(BOLD_TARGET)].slice(0, budget);
  const bolded = spans.reduceRight((text, span) => `${text.slice(0, span.index)}**${span[0]}**${text.slice(span.index + span[0].length)}`, line);
  return { line: bolded, used: spans.length };
};

/** 200 字以上ある最初の節で、語を上限の倍の密度になるまで太字にする。 */
export const boldSection = (source: string, context: PlantContext): Plant | undefined => {
  const limit = context.limits["bold-density"];
  const lines = linesOf(source);
  const isProseLine = proseAt(lines);
  const section = sectionsOf(lines).find((block) => proseChars(lines, block) >= MIN_SECTION_CHARS);
  if (limit === undefined || section === undefined) return undefined;
  const wanted = Math.floor((proseChars(lines, section) * limit * BOLD_MARGIN) / PER) + 1;
  const result = lines.reduce<{ lines: string[]; left: number }>(
    (acc, line, index) => {
      const inSection = index >= section.start && index < section.end && isProseLine(index);
      const bolded = inSection ? boldLine(line, acc.left) : { line, used: 0 };
      return { lines: [...acc.lines, bolded.line], left: acc.left - bolded.used };
    },
    { lines: [], left: wanted },
  );
  const first = lines.findIndex((_, index) => index >= section.start && isProseLine(index));
  return result.left > 0 ? undefined : { source: result.lines.join("\n"), line: first + 1 };
};

// --- emoji-density, no-em-dash ---

// chaff は短い文書の密度を測らない。
const isLongEnough = (lines: readonly string[]): boolean => {
  const isProseLine = proseAt(lines);
  const body = lines.filter((_, index) => isProseLine(index)).join(" ");
  return isJapanese(body) ? body.replace(/\s+/gu, "").length >= MIN_DOCUMENT_LENGTH.char : body.split(/\s+/u).length >= MIN_DOCUMENT_LENGTH.word;
};

/** 本文のすべての行を書き換える。最初に書き換えた行を指す。短い文書には植えない。 */
const rewriteAll = (source: string, rewrite: (line: string) => string): Plant | undefined => {
  const lines = linesOf(source);
  if (!isLongEnough(lines)) return undefined;
  const isProseLine = proseAt(lines);
  const rewritten = lines.map((line, index) => (isProseLine(index) ? rewrite(line) : line));
  const first = rewritten.findIndex((line, index) => line !== lines[index]);
  return first < 0 ? undefined : { source: rewritten.join("\n"), line: first + 1 };
};

const EMOJI = "✅";

/** 本文のすべての行の頭に絵文字を付ける。 */
export const decorate = (source: string): Plant | undefined => rewriteAll(source, (line) => line.replace(/^(\s*[-*]\s)?/u, (prefix) => `${prefix}${EMOJI} `));

/** 本文の各行の最初の読点を、ダッシュにする。 */
export const dashes = (source: string): Plant | undefined =>
  rewriteAll(source, (line) => (isJapanese(line) ? line.replace("、", "——") : line.replace(", ", " — ")));

// --- internal-jargon ---

type Swap = readonly [RegExp, string];

const JARGON_SWAPS: readonly Swap[] = [
  [/相談/u, "壁打ち"],
  [/合意/u, "握り"],
  [/確認/u, "目線合わせ"],
  [/\bfollow up\b/u, "circle back"],
  [/\bmeet\b/u, "sync up"],
  [/\bdiscuss\b/u, "double-click on"],
];

/** bench のチームが chaff.yaml の jargon に並べた語。植える語と同じ。 */
export const TEAM_JARGON: readonly string[] = JARGON_SWAPS.map(([, word]) => word);

const jargonOf = (line: string): string | undefined => {
  const swap = JARGON_SWAPS.find(([plain]) => plain.test(line));
  return swap === undefined ? undefined : line.replace(swap[0], swap[1]);
};

/** 普通の語を一つ、チームが使わないと決めた社内用語にする。 */
export const jargon = (source: string): Plant | undefined => rewriteFirst(source, (line) => isProse(line) && jargonOf(line) !== undefined, jargonOf);

// --- required-sections ---

/** bench のチームが chaff.yaml の required_sections に並べた見出し。誤りの無い見本にある節見出しすべて。 */
export const requiredSectionsOf = (source: string): string[] => linesOf(source).flatMap((line) => SECTION.exec(line)?.[1] ?? []);

/** 最後の節見出しを消す。本文は前の節に続く。 */
export const dropSection = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const index = lines.findLastIndex((line) => SECTION.test(line));
  return index < 0 ? undefined : { source: lines.filter((_, at) => at !== index).join("\n"), line: index + 1 };
};
