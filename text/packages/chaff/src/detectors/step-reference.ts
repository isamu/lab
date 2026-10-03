import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { quoteAround } from "./quote-around.ts";

// 本文が指す手順の番号（「手順5を参照」「see step 5」）が、文書のどの手順にも無い所。
// 手順は、手順の語（語彙表 step-word）と番号で始まる見出しと、番号付きの箇条書きの項目。手順が一つも無い文書では言わない。
// 番号のすぐ後ろの語（語彙表 figure-elsewhere の of・in）や前の文書の名前が、ほかの文書の手順だと言えば数えない。

/** 無い手順を指す参照 1 つ。label は書いたままの参照、last は文書の手順の最後の番号。 */
export type MissingStep = { readonly offset: number; readonly label: string; readonly last: number };

/**
 * 手順を読むのに要るもの。source は見出しの印（#）を残した文書、prose はコードを覆った本文（位置は source と同じ）。
 * elsewhere は参照がほかの文書の手順を指すか（参照の始まりと終わりの位置で）。
 */
export type StepText = { readonly source: string; readonly prose: string; readonly elsewhere: (start: number, end: number) => boolean };

const FULLWIDTH_OFFSET = 0xfee0;
const LIST_ITEM = /^[ \t]*(?<number>\d{1,3})[.)][ \t]/u;
const HEADING = /^#{1,6}[ \t]+/u;

const halfWidth = (text: string): string => text.replace(/[０-９]/gu, (char) => String.fromCharCode(char.charCodeAt(0) - FULLWIDTH_OFFSET));

type Mention = { readonly offset: number; readonly label: string; readonly number: number; readonly heading: boolean };

const mentionPattern = (words: readonly string[]): RegExp =>
  new RegExp(`(?<![A-Za-z])(?:${words.map(escapeRegExp).join("|")})[ \\t\\u3000]?(?<number>[0-9０-９]{1,3})(?![0-9０-９A-Za-z])`, "gu");

const isHeadingAt = (source: string, offset: number): boolean => HEADING.test(source.slice(source.lastIndexOf("\n", offset - 1) + 1, offset));

/** 本文の参照（コードを覆った prose から）と、見出しの手順（prose は見出しも覆うので source から）。 */
const mentionsOf = ({ source, prose }: StepText, words: readonly string[]): Mention[] => {
  const toMention = (match: RegExpExecArray | RegExpMatchArray, heading: boolean): Mention => ({
    offset: match.index ?? 0,
    label: match[0],
    number: Number(halfWidth(match.groups?.["number"] ?? "")),
    heading,
  });
  const headings = [...source.matchAll(mentionPattern(words))].filter((match) => isHeadingAt(source, match.index)).map((match) => toMention(match, true));
  const references = [...prose.matchAll(mentionPattern(words))].filter((match) => !isHeadingAt(source, match.index)).map((match) => toMention(match, false));
  return [...headings, ...references];
};

const listNumbers = (prose: string): number[] =>
  prose.split("\n").flatMap((line) => {
    const number = LIST_ITEM.exec(line)?.groups?.["number"];
    return number === undefined ? [] : [Number(number)];
  });

/** 文書のどの手順にも無い番号を指す参照。手順の最後の番号を超えるものだけ（箇条書きが二つあれば、番号はどちらかにある）。 */
export const missingSteps = (text: StepText, words: readonly string[]): MissingStep[] => {
  if (words.length === 0) return [];
  const mentions = mentionsOf(text, words);
  const steps = [...mentions.filter((mention) => mention.heading).map((mention) => mention.number), ...listNumbers(text.prose)];
  if (steps.length === 0) return [];
  const last = Math.max(...steps);
  return mentions
    .filter((mention) => !mention.heading && mention.number > last && !text.elsewhere(mention.offset, mention.offset + mention.label.length))
    .map((mention) => ({ offset: mention.offset, label: mention.label, last }));
};

/** 番号のすぐ後ろが figure-elsewhere の語か、すぐ前がこの文書でない文書の名前なら、ほかの文書の手順。 */
const elsewhereOf =
  (doc: ProseDocument, text: string) =>
  (start: number, end: number): boolean => {
    const after = text.slice(end).trimStart();
    const placed = (doc.lexicons["figure-elsewhere"] ?? []).some((entry) => after.startsWith(`${entry.pattern} `) && /^\s/u.test(text.slice(end)));
    const named = doc.namedDocument?.(text, start);
    return placed || (named !== undefined && !named.self);
  };

export const stepReference: Detector = (doc): Finding[] => {
  const prose = doc.prose ?? doc.source;
  const words = (doc.lexicons["step-word"] ?? []).map((entry) => entry.pattern);
  return missingSteps({ source: doc.source, prose, elsewhere: elsewhereOf(doc, prose) }, words).map((missing) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(prose, missing.offset, missing.offset + missing.label.length),
    values: { label: missing.label, last: missing.last, offset: missing.offset },
  }));
};
