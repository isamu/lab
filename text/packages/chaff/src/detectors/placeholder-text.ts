import type { Lexicon } from "../plugin.ts";

type Span = { readonly start: number; readonly end: number };

/** 雛形の空欄を囲む括弧。記号の形で、どの言語でも同じ。 */
const BRACKETED = /\[([^[\]\n]{1,60})\]|【([^【】\n]{1,30})】|［([^［］\n]{1,30})］/gu;

/** 書き手への指示を囲む丸括弧（（ここに会社名を書く））。丸括弧は説明にも使うので、語彙表の instruction の語で始まるときだけ数える。 */
const PARENTHESIZED = /\(([^()\n]{1,60})\)|（([^（）\n]{1,60})）/gu;

/**
 * 括弧のすぐ後ろ。Markdown のリンク（[text](url)、[text][ref]）と参照の定義（[ref]: url）、
 * 値が続く見出しの札（【氏名】山田、【日付】2024年）は空欄ではない。助詞（【会社名】の）や空白・句読点が続くなら空欄。
 */
const FILLED_AFTER = /^[([:：\p{Script=Han}\p{Script=Katakana}\p{Script=Latin}\p{N}]/u;

/** What may stand around a marker that is the whole value: quotes and brackets, a closing stop. */
const OPENING = /^[\s"'“‘「『(（[［【]*/u;
const CLOSERS: ReadonlySet<string> = new Set("\"'”’」』)）]］】.。!！");
const COLON_NEXT = /^\s*[:：]/u;

/** text without the quotes, brackets, stops and spaces that close it. */
const withoutClosers = (text: string): string => {
  const chars = [...text];
  const last = chars.findLastIndex((char) => !CLOSERS.has(char) && char.trim() !== "");
  return chars.slice(0, last + 1).join("");
};

/** Lexicon groups of placeholder-word. An entry without a group is a word written inside a template's brackets. */
const MARKER = "marker";
const INSTRUCTION = "instruction";
const LABEL = "label";

const innerOf = (match: RegExpExecArray): string => (match[1] ?? match[2] ?? match[3] ?? "").trim().toLowerCase();

/** 括弧の中身が語彙表の語そのものか、その語で始まって空白・アポストロフィが続くか（[Your Name]、[Insert Date]）。 */
const holdsWord = (inner: string, words: Lexicon): boolean =>
  words.some((word) => {
    const pattern = word.pattern.toLowerCase();
    return inner === pattern || (inner.startsWith(pattern) && /^[\s'’]/u.test(inner.slice(pattern.length)));
  });

/** 括弧の中身が指示の書き出しで始まるか（ここに会社名を書く）。 */
const opensWith = (inner: string, words: Lexicon): boolean => words.some((word) => inner.startsWith(word.pattern.toLowerCase()));

const spanOf = (match: RegExpExecArray): Span => ({ start: match.index, end: match.index + match[0].length });

const bracketedSpans = (text: string, pattern: RegExp, holds: (inner: string) => boolean): Span[] =>
  [...text.matchAll(pattern)].filter((match) => !FILLED_AFTER.test(text.slice(match.index + match[0].length)) && holds(innerOf(match))).map(spanOf);

/**
 * A value left as a marker: the whole text is the marker ("TBD", 「未定」), or the marker opens it before a colon
 * ("TBD: owner"), in any case. Only the start of a value counts, so a marker word inside a sentence is not one.
 * The span runs to the end of the value, quotes and the closing stop left out, so the finding quotes the whole note.
 * A checklist task ("[ ] TBD: …") and a comment ("// TBD") keep their mark in front, so the marker does not open them.
 */
const markerSpans = (text: string, markers: Lexicon): Span[] => {
  const start = OPENING.exec(text)?.[0].length ?? 0;
  const rest = text.slice(start);
  const marker = markers.find((entry) => rest.toLowerCase().startsWith(entry.pattern.toLowerCase()));
  if (marker === undefined) return [];
  const after = rest.slice(marker.pattern.length);
  if (withoutClosers(after) === "") return [{ start, end: start + marker.pattern.length }];
  if (!COLON_NEXT.test(after)) return [];
  return [{ start, end: start + withoutClosers(rest).length }];
};

/**
 * A template's instruction label left in the text ("OPTIONAL: General conclusions"): the label exactly as the lexicon
 * writes it, in capitals, opening the line before a colon and some text. "Optional: bring a jacket" is a note, not a label.
 */
const labelSpans = (line: string, labels: Lexicon): Span[] => {
  const start = OPENING.exec(line)?.[0].length ?? 0;
  const rest = line.slice(start);
  const label = labels.find((entry) => rest.startsWith(entry.pattern));
  if (label === undefined) return [];
  const after = rest.slice(label.pattern.length);
  return COLON_NEXT.test(after) && withoutClosers(after.replace(COLON_NEXT, "")) !== "" ? [{ start, end: start + rest.trimEnd().length }] : [];
};

/** Each line of a sentence on its own: values a line apart ("TBD: owner" then "TBD: date") are two blanks, not one. */
const lineMarkerSpans = (text: string, markers: Lexicon, labels: Lexicon): Span[] =>
  text.split("\n").flatMap((line, index, lines) => {
    const offset = lines.slice(0, index).reduce((sum, previous) => sum + previous.length + 1, 0);
    return [...markerSpans(line, markers), ...labelSpans(line, labels)].map((span) => ({ start: span.start + offset, end: span.end + offset }));
  });

/** Lexicon groups of placeholder-word for a run of blank marks (〇〇): the word after it, the word before it, and a unit after it. */
const BLANK_SUFFIX = "blank-suffix";
const BLANK_PREFIX = "blank-prefix";
const BLANK_UNIT = "blank-unit";

/** 伏せ字の記号の並び（〇〇、○○、△△）。例として置いた「○○」と形は同じなので、置かれた位置で空欄かを決める。 */
const BLANK_MARKS = /[○〇◯△]+/gu;
/** A name blank is at least two marks: one ○ is a bullet. */
const NAME_BLANK_LENGTH = 2;
/** 記号の前の数字（二〇二六年、一〇月）。〇 はその数の 0 で、空欄ではない。 */
const NUMERAL_BEFORE = /[\p{N}一二三四五六七八九十百千万]$/u;
/** 行頭から記号までが空白だけか。行頭の「○」は箇条書きの印（○日本に支店等を…）。 */
const atLineHead = (before: string): boolean => (before.split("\n").at(-1) ?? "").trim() === "";

/**
 * 行頭の伏せ字に単位が続くとき、空欄か箇条書きの印か。一字の単位は印の後の語の頭（○日本、○月曜）と同じ形なので、
 * 次にまた伏せ字が来る（〇月〇日）ときだけ空欄。二字以上の単位（〇万円、〇か月）は空欄。
 */
const unitAtLineHead = (unit: string, afterUnit: string): boolean => [...unit].length > 1 || /^[○〇◯△]/u.test(afterUnit);

const startsWithAny = (text: string, words: Lexicon): Lexicon[number] | undefined => words.find((word) => text.startsWith(word.pattern));
const endsWithAny = (text: string, words: Lexicon): boolean => words.some((word) => text.endsWith(word.pattern));

type BlankWords = { readonly suffixes: Lexicon; readonly prefixes: Lexicon; readonly units: Lexicon };

/** 行の残りが空白と伏せ字だけか（「代表取締役 〇〇 〇〇」の姓の後ろ）。 */
const ONLY_BLANKS = /^[\s○〇◯△]*$/u;
/** 項目名のコロンか空白の後ろ（「氏名：〇〇」「総務部長 〇〇」）。行の終わりまで伏せ字なら、その値が空欄。 */
const VALUE_SEPARATOR = /[\s:：]$/u;
/** 番号の組を繋ぐハイフン（〒〇〇〇-〇〇〇〇、03-〇〇〇〇-〇〇〇〇）。伏せ字がその一組なら、番号の空欄。 */
const NUMBER_JOIN_BEFORE = /[-‐－][\d○〇◯]*$/u;
const NUMBER_JOIN_AFTER = /^[-‐－]/u;

/** 名前の長さの伏せ字が、行の終わりまで続く値か、番号の一組か。 */
const isValueOrNumberBlank = (lineBefore: string, lineAfter: string): boolean =>
  (VALUE_SEPARATOR.test(lineBefore) && ONLY_BLANKS.test(lineAfter)) || NUMBER_JOIN_BEFORE.test(lineBefore) || NUMBER_JOIN_AFTER.test(lineAfter);

/** 記号の並びが空欄の位置にあるか。あれば、空欄として言う範囲（後ろに付いた語まで）。 */
const blankSpanAt = (text: string, match: RegExpExecArray, words: BlankWords): Span | undefined => {
  const start = match.index;
  const end = start + match[0].length;
  const before = text.slice(0, start);
  const after = text.slice(end);
  const lineAfter = after.split("\n")[0] ?? "";
  if (match[0].length >= NAME_BLANK_LENGTH) {
    const suffix = startsWithAny(after, words.suffixes);
    if (suffix !== undefined) return { start, end: end + suffix.pattern.length };
    if (endsWithAny(before.trimEnd(), words.prefixes)) return { start, end };
    if (atLineHead(before) && lineAfter.trim() === "") return { start, end };
    if (isValueOrNumberBlank(before.split("\n").at(-1) ?? "", lineAfter)) return { start, end };
  }
  const unit = startsWithAny(after, words.units);
  if (unit === undefined || NUMERAL_BEFORE.test(before)) return undefined;
  return atLineHead(before) && !unitAtLineHead(unit.pattern, after.slice(unit.pattern.length)) ? undefined : { start, end: end + unit.pattern.length };
};

/**
 * 宛名・署名・金額・日付の位置に残った伏せ字（〇〇様、株式会社〇〇、署名の行の〇〇、〇万円、〇月〇日）。
 * 文の中で例として置いた「○○」（○○株式会社作成など）は数えない。位置の語は語彙表の blank-* の組で、使う文書の種類も語彙表が決める。
 */
const blankMarkSpans = (text: string, words: BlankWords): Span[] =>
  words.suffixes.length + words.prefixes.length + words.units.length === 0
    ? []
    : [...text.matchAll(BLANK_MARKS)].flatMap((match) => {
        const span = blankSpanAt(text, match, words);
        return span === undefined ? [] : [span];
      });

/** 文の中の、埋め忘れた雛形の空欄（[Your Name]、【会社名】、（ここに会社名を書く）、TBD: …、〇〇様）の範囲。words は placeholder-word の語彙表。 */
export const placeholderSpans = (text: string, words: Lexicon): Span[] => {
  const bracketWords = words.filter((word) => word.group === undefined);
  const instructions = words.filter((word) => word.group === INSTRUCTION);
  const markers = words.filter((word) => word.group === MARKER);
  const labels = words.filter((word) => word.group === LABEL);
  const blankWords = {
    suffixes: words.filter((word) => word.group === BLANK_SUFFIX),
    prefixes: words.filter((word) => word.group === BLANK_PREFIX),
    units: words.filter((word) => word.group === BLANK_UNIT),
  };
  return [
    ...bracketedSpans(text, BRACKETED, (inner) => holdsWord(inner, bracketWords)),
    ...(instructions.length === 0 ? [] : bracketedSpans(text, PARENTHESIZED, (inner) => opensWith(inner, instructions))),
    ...lineMarkerSpans(text, markers, labels),
    ...blankMarkSpans(text, blankWords),
  ].toSorted((left, right) => left.start - right.start);
};
