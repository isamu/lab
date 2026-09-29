// Seeded mistakes of layout and decoration for `yarn bench`, in either language: a joined paragraph, a heading echoed by
// its first sentence, too much bold, emoji or dashes, team jargon and a missing required section.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isPoliteDocument, isProse, isRow, linesOf, proseAt, rewriteFirst, splitSentences, type Plant, type PlantContext } from "./bench-text.ts";

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

const sentenceCount = (lines: readonly string[], block: Block): number =>
  lines.slice(block.start, block.end).flatMap((line) => splitSentences(line).filter((sentence) => sentence.trim() !== "")).length;

type Join = { readonly upper: Block; readonly lower: Block; readonly count: number };

/** 空行だけを挟んで並ぶ二つの段落の空行を消して、一つの段落にする。文がいちばん多くなる組を選び、上限を超えなければ植えない。 */
export const joinParagraphs = (source: string, context: PlantContext): Plant | undefined => {
  const limit = context.limits["max-paragraph-length"];
  const lines = linesOf(source);
  const paragraphs = blocksOf(lines).filter((block) => isParagraph(lines, block));
  const joins = paragraphs.slice(1).flatMap((lower, at) => {
    const upper = paragraphs[at];
    const between = upper === undefined ? [] : lines.slice(upper.end, lower.start);
    return upper === undefined || between.some((line) => line.trim() !== "")
      ? []
      : [{ upper, lower, count: sentenceCount(lines, upper) + sentenceCount(lines, lower) }];
  });
  const best = joins.reduce<Join | undefined>((found, join) => (found === undefined || join.count > found.count ? join : found), undefined);
  if (limit === undefined || best === undefined || best.count <= limit) return undefined;
  return { source: lines.filter((_, index) => index < best.upper.end || index >= best.lower.start).join("\n"), line: best.upper.start + 1 };
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

// chaff は短い文書の密度を測らない（signals.ts の FLOOR）。英語は 200 語、日本語は 500 字。
const FLOOR_WORDS = 200;
const FLOOR_CHARS = 500;

const isLongEnough = (lines: readonly string[]): boolean => {
  const isProseLine = proseAt(lines);
  const body = lines.filter((_, index) => isProseLine(index)).join(" ");
  return isJapanese(body) ? body.replace(/\s+/gu, "").length >= FLOOR_CHARS : body.split(/\s+/u).length >= FLOOR_WORDS;
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
