// Seeded mistakes for `yarn bench`. Each mutation plants one mistake in a clean sample and says on which line it is.
// Pure and deterministic: the same sample always gets the same mistake at the same place (the first or the largest
// candidate, never a random one).

import {
  isJapanese,
  isPoliteDocument,
  isProse,
  isRow,
  linesOf,
  lowerFirst,
  replaceLine,
  rewriteFirst,
  splitSentences,
  type Mutation,
  type Plant,
  type PlantContext,
} from "./bench-text.ts";
import { boldSection, dashes, decorate, dropSection, echoHeading, jargon, joinParagraphs } from "./bench-mutations-layout.ts";
import { doubleHonorific, doubleParticle, dotList, glueKanji, humbleForms, kanjiAdverb, passiveJa, strayParticleSpace } from "./bench-mutations-ja.ts";
import { doubleArticle, expletives, flipFirstList, flipLastHeading, passiveEn, pluralAfterArticle } from "./bench-mutations-en.ts";
import * as phrasing from "./bench-mutations-phrasing.ts";
import { MARKUP_MUTATIONS } from "./bench-mutations-markup.ts";
import { MARK_MUTATIONS } from "./bench-mutations-marks.ts";
import { NAME_MUTATIONS } from "./bench-mutations-names.ts";
import { FACT_MUTATIONS } from "./bench-mutations-facts.ts";
import { LIST_MUTATIONS } from "./bench-mutations-lists.ts";
import { dropOneLongVowel, spaceLatin } from "./bench-mutations-orthography.ts";
import { CHARACTER_MUTATIONS } from "./bench-mutations-characters.ts";
import { OUTLINE_MUTATIONS } from "./bench-mutations-outline.ts";
import { WORDING_MUTATIONS } from "./bench-mutations-wording.ts";
import { MODAL_MUTATIONS } from "./bench-mutations-modal.ts";
import { ABSOLUTE_MUTATIONS } from "./bench-mutations-absolute.ts";
import { REQUIREMENT_MUTATIONS } from "./bench-mutations-requirements.ts";
import { POINTER_MUTATIONS } from "./bench-mutations-pointers.ts";
import { DEFINITION_MUTATIONS } from "./bench-mutations-definitions.ts";

// --- date-weekday-mismatch ---

const JA_WEEKDAYS = "月火水木金土日";
const EN_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const JA_WEEKDAY = /(\d{4}年\d{1,2}月\d{1,2}日[（(])([月火水木金土日])/u;
const EN_WEEKDAY = new RegExp(`\\b(${EN_WEEKDAYS.join("|")})\\b`, "u");
const YEAR = /\b\d{4}\b/u;

const nextOf = <T>(items: readonly T[], item: T): T | undefined => items[(items.indexOf(item) + 1) % items.length];

const shiftJaWeekday = (line: string): string | undefined =>
  line.replace(JA_WEEKDAY, (_, date: string, day: string) => `${date}${nextOf([...JA_WEEKDAYS], day) ?? day}`);

const shiftEnWeekday = (line: string): string | undefined => line.replace(EN_WEEKDAY, (day: string) => nextOf(EN_WEEKDAYS, day) ?? day);

const hasEnWeekday = (line: string): boolean => EN_WEEKDAY.test(line) && YEAR.test(line);

/** 年まで書いた日付の曜日を、次の曜日に書き換える。 */
export const shiftWeekday = (source: string): Plant | undefined =>
  rewriteFirst(source, (line) => JA_WEEKDAY.test(line), shiftJaWeekday) ?? rewriteFirst(source, hasEnWeekday, shiftEnWeekday);

// --- date-order ---

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const FULL_DATE = new RegExp(`\\d{4}年\\d{1,2}月\\d{1,2}日|\\d{4}-\\d{2}-\\d{2}|\\d{1,2} (?:${MONTHS}) \\d{4}|(?:${MONTHS}) \\d{1,2}, \\d{4}`, "u");
const MIN_DATED_ROWS = 4;

const isDatedRow = (line: string): boolean => isRow(line) && FULL_DATE.test(line);

/** 日付のある行が続くところを、行番号の並びとして集める。 */
const datedBlocks = (lines: readonly string[]): number[][] =>
  lines.reduce<number[][]>((blocks, line, index) => {
    if (!isDatedRow(line)) return blocks;
    const last = blocks.at(-1);
    return last !== undefined && last.at(-1) === index - 1 ? [...blocks.slice(0, -1), [...last, index]] : [...blocks, [index]];
  }, []);

const swapLines = (lines: readonly string[], upper: number, lower: number): string => {
  const swapped = new Map([
    [upper, lower],
    [lower, upper],
  ]);
  return lines.map((line, at) => lines[swapped.get(at) ?? at] ?? line).join("\n");
};

/** 日付の並ぶ行の真ん中の二行を入れ替える。四行以上あれば、並びの向きは多いほうで決まる。 */
export const swapDatedRows = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const block = datedBlocks(lines).find((rows) => rows.length >= MIN_DATED_ROWS);
  const upper = block?.[Math.floor(block.length / 2) - 1];
  const lower = block?.[Math.floor(block.length / 2)];
  return upper === undefined || lower === undefined ? undefined : { source: swapLines(lines, upper, lower), line: lower + 1 };
};

// --- total-mismatch ---

const TOTAL_WORD = /^(?:合計|小計|総計|Total|Subtotal|Grand total)(?![a-z])/iu;
const firstCell = (line: string): string => line.replace(/^\s*(?:\||[-*])\s*/u, "");
const isTotalRow = (line: string): boolean => isRow(line) && TOTAL_WORD.test(firstCell(line));
const isSeparator = (line: string): boolean => /^\s*\|[\s:|-]*$/u.test(line);
const isItemRow = (line: string): boolean => isRow(line) && !isSeparator(line) && /\d/u.test(line);

const blockStart = (lines: readonly string[], index: number): number => (index > 0 && isRow(lines[index - 1] ?? "") ? blockStart(lines, index - 1) : index);

// 内訳が一つしか残らない合計は、足し算として確かめようがない。消した後に二つ残るときだけ植える。
const MIN_ITEMS = 3;

/** 合計の上の内訳から最初の一行を消す。合計は直さないので、内訳ひとつぶん合わなくなる。 */
export const dropItem = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const total = lines.findIndex(isTotalRow);
  if (total < 0) return undefined;
  const start = blockStart(lines, total);
  const items = lines.slice(start, total).filter(isItemRow).length;
  const item = lines.slice(start, total).findIndex(isItemRow);
  if (item < 0 || items < MIN_ITEMS) return undefined;
  return { source: lines.filter((_, at) => at !== start + item).join("\n"), line: total };
};

// --- dangling-reference, numbering-gap ---

// 番号のすぐ後が空白か括弧か行末の行だけを見出しとする。行頭の「第2条の届出をした」は本文。
const HEADINGS: readonly RegExp[] = [
  /^(?:#{1,6} ?)?第(\d+)条(?=[\s（(]|$)/u,
  /^(?:#{1,6} )?(?:Article|Section) ([\d.]*\d)(?=[\s(]|$)/u,
  /^#{1,6} ([\d.]*\d)\.? /u,
];
const REFERENCES: readonly RegExp[] = [/第(\d+)条/u, /\b(?:Article|Section) ([\d.]*\d)/u, /(?<![\d.])(\d[\d.]*\d)節/u];

const firstNumber = (line: string, patterns: readonly RegExp[]): string | undefined =>
  patterns.reduce<string | undefined>((found, pattern) => found ?? pattern.exec(line)?.[1], undefined);

const headingNumber = (line: string): string | undefined => firstNumber(line, HEADINGS);

const isNumberedHeading = (line: string): boolean => headingNumber(line) !== undefined;

/** 最後の桁を一つ進める。"3.2" は "3.3"、"6" は "7"。 */
export const nextNumber = (label: string): string => {
  const parts = label.split(".");
  const last = Number(parts.at(-1));
  return [...parts.slice(0, -1), String(last + 1)].join(".");
};

const freeNumber = (label: string, taken: ReadonlySet<string>): string => (taken.has(label) ? freeNumber(nextNumber(label), taken) : label);

/** 行の中でいちばん先に現れる参照。 */
const firstReference = (line: string): RegExpExecArray | undefined =>
  REFERENCES.map((pattern) => pattern.exec(line))
    .filter((match) => match !== null)
    .reduce<RegExpExecArray | undefined>((best, match) => (best === undefined || match.index < best.index ? match : best), undefined);

/** 本文の最初の参照を、文書に無い番号に書き換える。 */
export const breakReference = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const taken = new Set(lines.flatMap((line) => headingNumber(line) ?? []));
  const isReferring = (line: string): boolean => !isNumberedHeading(line) && isProse(line) && firstReference(line) !== undefined;
  return rewriteFirst(source, isReferring, (line) => {
    const match = firstReference(line);
    const number = match?.[1];
    if (match === undefined || number === undefined) return undefined;
    const label = match[0].replace(number, freeNumber(nextNumber(number), taken));
    return `${line.slice(0, match.index)}${label}${line.slice(match.index + match[0].length)}`;
  });
};

/** 最後の番号付きの見出しを一つ飛ばす。その前の番号が抜けたことになる。 */
export const skipLastNumber = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const index = lines.findLastIndex(isNumberedHeading);
  const line = lines[index];
  const number = line === undefined ? undefined : headingNumber(line);
  return line === undefined || number === undefined
    ? undefined
    : { source: replaceLine(lines, index, line.replace(number, nextNumber(number))), line: index + 1 };
};

// --- duplicate-definition ---

const DEFINITIONS: readonly (readonly [RegExp, string, string])[] = [
  [/「[^「」\n]+」とは/u, "。", "をいう。"],
  [/"[^"\n]+" means /u, ".", "."],
];

/** 定義の書き出しから、文の終わりまで。終わりが定義の形でなければ定義ではない。 */
const definitionIn = (source: string): string | undefined =>
  DEFINITIONS.reduce<string | undefined>((found, [start, stop, ending]) => {
    const at = found === undefined ? start.exec(source)?.index : undefined;
    const end = at === undefined ? -1 : source.indexOf(stop, at);
    const sentence = at === undefined || end < 0 ? undefined : source.slice(at, end + stop.length);
    return found ?? (sentence !== undefined && !sentence.includes("\n") && sentence.endsWith(ending) ? sentence : undefined);
  }, undefined);

/** 最初の定義文を、文書の最後の段落としてもう一度書く。 */
export const defineTwice = (source: string): Plant | undefined => {
  const definition = definitionIn(source);
  if (definition === undefined) return undefined;
  const lines = linesOf(source.trimEnd());
  return { source: [...lines, "", definition, ""].join("\n"), line: lines.length + 2 };
};

// --- max-sentence-length ---

type Pair = { readonly index: number; readonly at: number; readonly length: number; readonly sentences: readonly string[] };

const sentenceLength = (sentence: string): number => (isJapanese(sentence) ? [...sentence.trim()].length : sentence.trim().split(/\s+/u).length);

const pairsOf = (line: string, index: number): Pair[] => {
  const sentences = splitSentences(line).filter((sentence) => sentence.trim() !== "");
  return sentences.slice(1).map((_, at) => ({
    index,
    at,
    length: sentenceLength(sentences[at] ?? "") + sentenceLength(sentences[at + 1] ?? ""),
    sentences,
  }));
};

const joinTwo = (first: string, second: string): string =>
  isJapanese(first) ? `${first.replace(/。$/u, "、")}${second}` : `${first.replace(/[.!?]$/u, ",")} and ${lowerFirst(second)}`;

const joinedLine = (pair: Pair): string =>
  [...pair.sentences.slice(0, pair.at), joinTwo(pair.sentences[pair.at] ?? "", pair.sentences[pair.at + 1] ?? ""), ...pair.sentences.slice(pair.at + 2)].join(
    isJapanese(pair.sentences.join("")) ? "" : " ",
  );

/** 並んだ二文のうち、つないだときにいちばん長くなる組をつなぐ。つないでも上限に届かなければ植えない。 */
export const joinSentences = (source: string, context: PlantContext): Plant | undefined => {
  const lines = linesOf(source);
  const pairs = lines.flatMap((line, index) => (isProse(line) && !isRow(line) ? pairsOf(line, index) : []));
  const longest = pairs.reduce<Pair | undefined>((best, pair) => (best === undefined || pair.length > best.length ? pair : best), undefined);
  const limit = context.limits["max-sentence-length"];
  return longest === undefined || limit === undefined || longest.length <= limit
    ? undefined
    : { source: replaceLine(lines, longest.index, joinedLine(longest)), line: longest.index + 1 };
};

// --- no-mixed-desumasu ---

// 語尾を替えてよいのは、漢字・カタカナ（訪問します、連携する）か「ように」に続くところだけ。
// 「ございます」「いたします」を機械的に替えると、日本語でない文になる。
const STEM = "(?<=[一-龠々ァ-ヶー]|ように)";
const PLAIN_ENDING = new RegExp(`${STEM}(する|した|である)。`, "u");
const POLITE_ENDING_AFTER_STEM = new RegExp(`${STEM}(します|しました|です)。`, "u");
const TO_POLITE: Readonly<Record<string, string>> = { する: "します", した: "しました", である: "です" };
const TO_PLAIN: Readonly<Record<string, string>> = { します: "する", しました: "した", です: "である" };
const plantEnding = (source: string, ending: RegExp, swaps: Readonly<Record<string, string>>): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && ending.test(line),
    (line) => line.replace(ending, (_, word: string) => `${swaps[word] ?? word}。`),
  );

/**
 * である調の文書に、です・ます調の文を一つ混ぜる。混ぜた文と比べ合う文（同じ箇条書き・本文）に、混ぜた後で chaff の読む である調の
 * 文が一つも無いか、です・ます調より少なければ植えない: 混ぜた文が少数派にならない。文がみな「こと」で終わる要件一覧がこれ。
 */
export const politeInPlain = (source: string, context: PlantContext): Plant | undefined => {
  const plant = isPoliteDocument(source) ? undefined : plantEnding(source, PLAIN_ENDING, TO_POLITE);
  const counts = plant === undefined ? undefined : context.registers?.(plant.source, plant.line);
  return counts !== undefined && counts.plain > 0 && counts.plain >= counts.polite ? plant : undefined;
};

/** です・ます調の文書に、である調の文を一つ混ぜる。 */
export const plainInPolite = (source: string): Plant | undefined =>
  isPoliteDocument(source) ? plantEnding(source, POLITE_ENDING_AFTER_STEM, TO_PLAIN) : undefined;

// --- no-doubled-joshi ---

const RUN_CHAR = /[一-龠々ァ-ヶー]/u;
const NOUN_NO_NOUN = /[一-龠々ァ-ヶー]の[一-龠々ァ-ヶー]/u;

/** 位置 end の直前で終わる、漢字とカタカナの続きの始まり。 */
const runStart = (line: string, end: number): number => (end > 0 && RUN_CHAR.test(line.charAt(end - 1)) ? runStart(line, end - 1) : end);
const NESTED_NO = "当社の部門の";

/** 「AのB」の前に「当社の部門の」を足して、「の」を三つ続ける。 */
export const nestNo = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && NOUN_NO_NOUN.test(line),
    (line) => {
      const found = NOUN_NO_NOUN.exec(line)?.index;
      const at = found === undefined ? undefined : runStart(line, found + 1);
      return at === undefined ? undefined : `${line.slice(0, at)}${NESTED_NO}${line.slice(at)}`;
    },
  );

// --- undefined-acronym ---

const JA_GLOSS = /[ァ-ヶー一-龠々][（(]([A-Z]{2,})[）)]/u;
const EN_GLOSS = /\(([A-Z]{2,})\)/u;

const initialsOf = (words: readonly string[]): string => words.map((word) => word.charAt(0).toUpperCase()).join("");

/** 括弧の前の語の頭文字が略語を綴るときだけ、説明として消す。「Yamada (IT)」の IT は説明ではない。 */
const dropEnGloss = (line: string): string | undefined => {
  const match = EN_GLOSS.exec(line);
  const acronym = match?.[1];
  if (match === null || acronym === undefined) return undefined;
  const before = line.slice(0, match.index).trimEnd().split(" ");
  const expansion = before.slice(before.length - acronym.length);
  if (initialsOf(expansion) !== acronym) return undefined;
  return `${[...before.slice(0, before.length - acronym.length), acronym].join(" ")}${line.slice(match.index + match[0].length)}`;
};

/** 日本語の説明は頭文字で確かめられないので、同じ行の後でもう一度使う略語だけを説明として扱う。 */
const hasJaGloss = (line: string): boolean => {
  const match = JA_GLOSS.exec(line);
  return match?.[1] !== undefined && line.slice(match.index + match[0].length).includes(match[1]);
};

/** 「サービス品質保証（SLA）」を「SLA」にする。説明は括弧の直前まで続く漢字とカタカナ。 */
const dropJaGloss = (line: string): string | undefined => {
  const match = JA_GLOSS.exec(line);
  const acronym = match?.[1];
  if (match === null || acronym === undefined) return undefined;
  return `${line.slice(0, runStart(line, match.index + 1))}${acronym}${line.slice(match.index + match[0].length)}`;
};

/** 略語の最初の説明（「サービス品質保証（SLA）」）を消して、略語だけを残す。 */
export const dropGloss = (source: string): Plant | undefined =>
  rewriteFirst(source, (line) => isProse(line) && hasJaGloss(line), dropJaGloss) ??
  rewriteFirst(source, (line) => isProse(line) && dropEnGloss(line) !== undefined, dropEnGloss);

// --- contraction-consistency ---

type Swap = readonly [string, string];

const CONTRACTIONS: readonly Swap[] = [
  ["do not", "don't"],
  ["does not", "doesn't"],
  ["is not", "isn't"],
  ["cannot", "can't"],
  ["will not", "won't"],
  ["it is", "it's"],
];

const sameCase = (found: string, word: string): string => (/^[A-Z]/u.test(found) ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word);
const wordPattern = (word: string): RegExp => new RegExp(`\\b${word}\\b`, "iu");
const MIN_SPELLED_OUT = 2;

/** 短縮形を使わない文書で、一か所だけ短縮形にする。書き分けの対が二種類以上あるときだけ。 */
export const contract = (source: string): Plant | undefined => {
  const body = linesOf(source).filter(isProse).join("\n");
  const spelled = CONTRACTIONS.filter(([long]) => wordPattern(long).test(body));
  if (spelled.length < MIN_SPELLED_OUT || CONTRACTIONS.some(([, short]) => wordPattern(short).test(body))) return undefined;
  const hasSpelled = (line: string): boolean => isProse(line) && spelled.some(([long]) => wordPattern(long).test(line));
  return rewriteFirst(source, hasSpelled, (line) => {
    const pair = spelled.find(([long]) => wordPattern(long).test(line));
    return pair === undefined ? undefined : line.replace(wordPattern(pair[0]), (found) => sameCase(found, pair[1]));
  });
};

export const MUTATIONS: readonly Mutation[] = [
  { id: "weekday-shift", rule: "date-weekday-mismatch", languages: ["ja", "en"], plant: shiftWeekday },
  { id: "rows-swapped", rule: "date-order", languages: ["ja", "en"], plant: swapDatedRows },
  { id: "item-dropped", rule: "total-mismatch", languages: ["ja", "en"], plant: dropItem },
  ...FACT_MUTATIONS,
  ...LIST_MUTATIONS,
  { id: "reference-broken", rule: "dangling-reference", languages: ["ja", "en"], plant: breakReference },
  { id: "number-skipped", rule: "numbering-gap", languages: ["ja", "en"], plant: skipLastNumber },
  { id: "defined-twice", rule: "duplicate-definition", languages: ["ja", "en"], plant: defineTwice },
  { id: "sentences-joined", rule: "max-sentence-length", languages: ["ja", "en"], plant: joinSentences },
  { id: "polite-in-plain", rule: "no-mixed-desumasu", languages: ["ja"], plant: politeInPlain },
  { id: "plain-in-polite", rule: "no-mixed-desumasu", languages: ["ja"], plant: plainInPolite },
  { id: "no-nested", rule: "no-doubled-joshi", languages: ["ja"], plant: nestNo },
  { id: "gloss-dropped", rule: "undefined-acronym", languages: ["ja", "en"], plant: dropGloss },
  { id: "latin-spaced", rule: "latin-spacing", languages: ["ja"], plant: spaceLatin },
  { id: "space-strayed", rule: "stray-space", languages: ["ja"], plant: strayParticleSpace },
  { id: "contracted", rule: "contraction-consistency", languages: ["en"], plant: contract },
  { id: "paragraphs-joined", rule: "max-paragraph-length", languages: ["ja", "en"], plant: joinParagraphs },
  { id: "heading-echoed", rule: "heading-echo", languages: ["ja", "en"], plant: echoHeading },
  { id: "bold-heavy", rule: "bold-density", languages: ["ja", "en"], plant: boldSection },
  { id: "emoji-decorated", rule: "emoji-density", languages: ["ja", "en"], plant: decorate },
  { id: "commas-dashed", rule: "no-em-dash", languages: ["ja", "en"], plant: dashes },
  { id: "jargon-used", rule: "internal-jargon", languages: ["ja", "en"], plant: jargon },
  { id: "section-dropped", rule: "required-sections", languages: ["ja", "en"], reportsOn: "document", plant: dropSection },
  { id: "kanji-glued", rule: "max-kanji-continuous", languages: ["ja"], plant: glueKanji },
  { id: "commas-dotted", rule: "no-nakaguro-parallel", languages: ["ja"], plant: dotList },
  { id: "keigo-doubled", rule: "double-keigo", languages: ["ja"], plant: doubleHonorific },
  { id: "humble-overused", rule: "sasete-itadaku", languages: ["ja"], plant: humbleForms },
  { id: "adverb-kanji", rule: "hiragana-fukushi", languages: ["ja"], plant: kanjiAdverb },
  { id: "passive-ja", rule: "agentless-passive", languages: ["ja"], plant: passiveJa },
  { id: "passive-en", rule: "agentless-passive", languages: ["en"], plant: passiveEn },
  { id: "expletives", rule: "expletive-construction", languages: ["en"], plant: expletives },
  { id: "oxford-flipped", rule: "oxford-comma-consistency", languages: ["en"], plant: flipFirstList },
  { id: "heading-recased", rule: "title-case-consistency", languages: ["en"], plant: flipLastHeading },
  { id: "particle-doubled", rule: "doubled-word", languages: ["ja"], plant: doubleParticle },
  { id: "article-doubled", rule: "doubled-word", languages: ["en"], plant: doubleArticle },
  { id: "plural-after-article", rule: "agreement-slip", languages: ["en"], plant: pluralAfterArticle },
  ...phrasing.PHRASING_MUTATIONS,
  { id: "long-vowel-dropped", rule: "katakana-long-vowel", languages: ["ja"], plant: dropOneLongVowel },
  ...MARKUP_MUTATIONS,
  ...MARK_MUTATIONS,
  ...NAME_MUTATIONS,
  ...CHARACTER_MUTATIONS,
  ...OUTLINE_MUTATIONS,
  ...WORDING_MUTATIONS,
  ...MODAL_MUTATIONS,
  ...ABSOLUTE_MUTATIONS,
  ...REQUIREMENT_MUTATIONS,
  ...POINTER_MUTATIONS,
  ...DEFINITION_MUTATIONS,
];
