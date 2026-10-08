import { escapeRegExp } from "./orthography.ts";
import { alternation, valueOf, type CountMismatch, type CountWords } from "./announced-count.ts";

/**
 * 一行に並べた名前の予告（出席者（6名）：田中、鈴木、佐藤 / Attendees (6): Tanaka, Suzuki）。ラベルの後ろの括弧の数と、
 * コロンの後ろに区切って並べた名前の数を比べる。区切りが決まらない並び（名前をつなぐ語がある、括弧が閉じていない、文が続く）と、
 * 閉じていない並び（ほか、etc.）は数えない。言語の知識（区切り、つなぐ語、閉じていないことを言う語）は語彙表から受け取る。
 */
export type MemberWords = {
  /** 名前の区切り。、 , */
  readonly separators: readonly string[];
  /** 名前をつなぐ語。と、and。 */
  readonly joiners: readonly string[];
  /** 並びが閉じていないことを言う語。ほか、etc。 */
  readonly open: readonly string[];
};

const MAX_LABEL_CHARS = 30;
const MAX_MEMBER_CHARS = 40;
const MIN_MEMBERS = 2;
/** 一行に並べる名前の数として読む上限。括弧の年（Holland (1993): ...）を数に読まない。 */
const MAX_ANNOUNCED = 99;

/**
 * 行頭（箇条書きの印の後ろでもよい）のラベル、括弧の中の数（数える語は付いても付かなくてもよい）、コロン。
 * 括弧の中に数以外の語があるもの（約6名、6名以上、5名ほか）は形が合わず、ここで外れる。
 */
const headPattern = (words: CountWords): RegExp => {
  const numbers = words.numbers.length === 0 ? "\\p{Nd}+" : `\\p{Nd}+|${alternation(words.numbers)}`;
  const counter = words.counters.length === 0 ? "" : `(?:[ \\t]?(?<counter>${alternation(words.counters)})(?![A-Za-z]))?`;
  const label = `(?<label>[^\\s\\p{Nd}(（:：|>#*+-][^(（:：\\n]{0,${MAX_LABEL_CHARS}})`;
  const listMark = String.raw`(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)?`;
  return new RegExp(`^[ \\t]*${listMark}${label}[(（][ \\t]*(?<phrase>(?<number>${numbers})${counter})[ \\t]*[)）][ \\t]*[:：][ \\t]*`, "diu");
};

const LATIN_LETTER = /[A-Za-z]/u;

/** 英語の語は語の切れ目で照らす（and が Anderson に当たらない）。日本語の語は字面どおり。atEnd なら末尾の語だけ。 */
const wordPattern = (word: string, atEnd = false): RegExp => {
  const before = LATIN_LETTER.test(word[0] ?? "") ? "(?<![A-Za-z])" : "";
  const after = LATIN_LETTER.test(word.at(-1) ?? "") ? "(?![A-Za-z])" : "";
  return new RegExp(`${before}${escapeRegExp(word)}${after}${atEnd ? "\\s*$" : ""}`, "iu");
};

const BRACKETED = /\([^()（）]*\)|（[^()（）]*）|「[^「」]*」|\[[^[\]]*\]/gu;
const BRACKET = /[()（）「」[\]]/u;
/** 並びの途中で文が切れる、別のラベルが始まる。名前の並びでなく文なので数えない。 */
const NOT_A_NAME_LIST = /[。．.:：;；]/u;
const TRAILING_END = /[。．.]\s*$/u;

/** 括弧の中の注記（議長）を除いた並び。括弧が閉じていなければ undefined。 */
const withoutNotes = (members: string): string | undefined => {
  const stripped = members.replace(BRACKETED, "");
  return BRACKET.test(stripped) ? undefined : stripped;
};

const hasAny = (text: string, words: readonly string[]): boolean => words.some((word) => wordPattern(word).test(text));

/** 閉じていないことを言う語は名前の後ろに付く（田中ほか、etc）。名前の中の字（等々力）は数える。 */
const endsOpen = (member: string, open: readonly string[]): boolean => open.some((word) => wordPattern(word, true).test(member));

/** 最後の名前の前のつなぐ語（, and Ito）は並びの終わりの印で、名前の一部ではない。 */
const withoutLeadingJoiner = (member: string, joiners: readonly string[]): string => {
  const leading = joiners.find((joiner) => new RegExp(`^${escapeRegExp(joiner)}\\s+`, "iu").test(member));
  return leading === undefined ? member : member.slice(leading.length).trimStart();
};

const splitMembers = (text: string, separators: readonly string[]): string[] =>
  text.split(new RegExp(separators.map(escapeRegExp).join("|"), "u")).map((part) => part.trim());

const withLastJoinerOff = (parts: readonly string[], joiners: readonly string[]): string[] => {
  const last = parts.at(-1);
  return last === undefined ? [...parts] : [...parts.slice(0, -1), withoutLeadingJoiner(last, joiners)];
};

const isNameLike = (member: string, words: MemberWords): boolean => member !== "" && member.length <= MAX_MEMBER_CHARS && !hasAny(member, words.joiners);

/** 区切って並べた名前の数。並びとして読めないときは undefined。 */
export const memberCount = (members: string, words: MemberWords): number | undefined => {
  if (words.separators.length === 0) return undefined;
  const notes = withoutNotes(members.trim().replace(TRAILING_END, ""));
  if (notes === undefined || NOT_A_NAME_LIST.test(notes)) return undefined;
  const parts = splitMembers(notes, words.separators);
  if (parts.some((part) => endsOpen(part, words.open))) return undefined;
  const names = withLastJoinerOff(parts, words.joiners);
  return names.length >= MIN_MEMBERS && names.every((name) => isNameLike(name, words)) ? names.length : undefined;
};

/** 次の行に並びが続いてよい行。空行、箇条書き、見出し、引用、表の行は別のもの。 */
const CONTINUATION = /^[ \t]*[^\s\-*+#>|]/u;

const endsWithSeparator = (text: string, words: MemberWords): boolean => words.separators.some((separator) => text.trimEnd().endsWith(separator));

/** 区切りで終わる行は、次の行に並びが続く。 */
const membersFrom = (lines: readonly string[], next: number, soFar: string, words: MemberWords): string => {
  const line = lines[next] ?? "";
  return endsWithSeparator(soFar, words) && CONTINUATION.test(line) ? membersFrom(lines, next + 1, soFar + line, words) : soFar;
};

/**
 * ラベルは短い名前（出席者、Attendees）。区切りを含むもの（Dunn, G.E. (1960):）は文献の著者で、番号で終わるもの（Step 2 (3):）は
 * 番号の付いた項目。どちらも括弧の数は並べた名前の数ではない。
 */
const isLabel = (label: string, members: MemberWords): boolean =>
  !/\p{Nd}\s*$/u.test(label) && !members.separators.some((separator) => label.includes(separator));

/** 数える語の無い数（Attendees (6)）は、ラベル自身が数えるもの（attendees、items）を言うときだけ数。Appendix (3) は番号。 */
const labelCounts = (label: string, counters: readonly string[]): boolean => counters.some((counter) => wordPattern(counter, true).test(label));

type Line = { readonly text: string; readonly start: number };

const linesOf = (text: string): Line[] => {
  const starts = [0, ...[...text.matchAll(/\n/gu)].map((match) => match.index + 1)];
  return text.split("\n").map((line, index) => ({ text: line, start: starts[index] ?? 0 }));
};

/** ラベルと括弧の数。phraseAt は行の中の数の位置、rest はコロンの後ろ。 */
type Head = { readonly phrase: string; readonly phraseAt: number; readonly announced: number; readonly rest: string };

/** 数える語が数に付いているか、ラベルが数えるものを言っている（Attendees (6)）ときだけ、括弧の数を名前の数に読む。 */
const isCount = (announced: number, counter: string | undefined, label: string, words: CountWords): boolean =>
  (counter !== undefined || labelCounts(label, words.counters)) && announced >= 1 && announced <= MAX_ANNOUNCED;

const headOf = (text: string, head: RegExp, words: CountWords, members: MemberWords): Head | undefined => {
  const match = head.exec(text);
  const groups = match?.groups;
  const phraseAt = match?.indices?.groups?.["phrase"]?.[0];
  const label = groups?.["label"] ?? "";
  if (match === null || groups === undefined || phraseAt === undefined || !isLabel(label, members)) return undefined;
  const announced = valueOf(groups["number"] ?? "", words.numbers);
  if (!isCount(announced, groups["counter"], label, words)) return undefined;
  return { phrase: (groups["phrase"] ?? "").trim(), phraseAt, announced, rest: text.slice(match[0].length) };
};

/** 本文（コードや強調の印を空白で覆ったもの）の、一行に並べた名前の予告で、数が合わないもの。 */
export const inlineCountMismatches = (text: string, words: CountWords, members: MemberWords): CountMismatch[] => {
  const head = headPattern(words);
  const lines = linesOf(text);
  const texts = lines.map((line) => line.text);
  return lines.flatMap((line, index) => {
    const found = headOf(line.text, head, words, members);
    const listed = found === undefined ? undefined : memberCount(membersFrom(texts, index + 1, found.rest, members), members);
    if (found === undefined || listed === undefined || listed === found.announced) return [];
    return [{ offset: line.start + found.phraseAt, phrase: found.phrase, announced: found.announced, listed }];
  });
};
