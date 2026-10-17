import type { Detector, Finding, Lexicon, ProseDocument, Sentence } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { isConventionalPhrase } from "./caps-phrase.ts";
import { minorityReport } from "../spacing-minority.ts";
import { formulaBracketSpans } from "../formula-brackets.ts";
import { isWithinAny, quotedSpans } from "../quoted-span.ts";
import { captionsOf, isCaptionAt, letterheadSpans } from "./caps-caption.ts";
import { lineStarts } from "../position.ts";

/** The letters a mark must touch to count as part of the document's text, by language. */
const SCRIPT: Readonly<Record<string, RegExp>> = {
  ja: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々]/u,
  en: /\p{Script=Latin}/u,
};

/** One way of writing a mark: its kind, which of the two ways it is (side), and how the other way writes it. */
type Form = { readonly kind: string; readonly side: boolean; readonly other: string };

/**
 * The two ways of writing each kind of mark, from the lexicon: pattern is one way, instead_of the other, group the kind.
 * Two patterns may share one instead_of (“ and ” both against "), so the other way of a shared mark is both patterns.
 */
export const formsOf = (lexicon: Lexicon): ReadonlyMap<string, Form> => {
  const forms = new Map<string, Form>();
  lexicon.forEach((entry) => {
    const kind = entry.group ?? entry.pattern;
    const shared = entry.instead_of ?? "";
    forms.set(entry.pattern, { kind, side: true, other: shared });
    const known = forms.get(shared);
    forms.set(shared, { kind, side: false, other: `${known?.side === false ? known.other : ""}${entry.pattern}` });
  });
  return forms;
};

export type Mark = { readonly sentence: Sentence; readonly char: string; readonly form: Form; readonly offset: number; readonly spaced: boolean };

/** Punctuation that may stand between a closing or opening mark and the word it belongs to ("draft." and “draft”.). */
const BETWEEN = /[.,;:!?。、]/u;

/** The letter beside a mark on one side (step -1 or 1), past one punctuation mark. */
const besideLetter = (text: string, at: number, step: number, script: RegExp): boolean => {
  const next = text.charAt(at + step);
  return script.test(next) || (BETWEEN.test(next) && script.test(text.charAt(at + step * 2)));
};

const touchesScript = (text: string, at: number, script: RegExp): boolean => besideLetter(text, at, -1, script) || besideLetter(text, at, 1, script);

/**
 * The marks in a sentence that touch a letter of the document's script, outside 「」『』 quotations and outside the brackets
 * of a formula (× (1 - 時間 ÷ 月平均)), which follow the formula's notation. spaced is the lexicon's pattern side.
 * The letters beside a mark are read in the source, so a mark that opens a sentence (。(2）当社) counts wherever the sentence starts.
 */
export const marksIn = (source: string, sentence: Sentence, forms: ReadonlyMap<string, Form>, script: RegExp): Mark[] => {
  const quoted = quotedSpans(sentence.text);
  const formulas = formulaBracketSpans(sentence.text);
  return sentence.text.split("").flatMap((char, at) => {
    const form = forms.get(char);
    if (form === undefined || !touchesScript(source, sentence.span.start + at, script)) return [];
    if (isWithinAny(quoted, { start: at, end: at }) || isWithinAny(formulas, { start: at, end: at + 1 })) return [];
    return [{ sentence, char, form, offset: sentence.span.start + at, spaced: form.side }];
  });
};

/** Something written one of two ways (spaced is which), at a place in a sentence. */
type Sided = { readonly sentence: Sentence; readonly offset: number; readonly spaced: boolean };

const sidedFinding = (item: Sided, values: Finding["values"], variant?: string): Finding => ({
  rule: "",
  severity: "info",
  line: 0,
  column: 0,
  quote: item.sentence.text.trim(),
  ...(variant === undefined ? {} : { variant }),
  values: { ...values, offset: item.offset },
});

/** The less common way, one finding each, or one finding for a document written both ways (spacing-minority.ts). */
const minorityFindings = <T extends Sided>(items: readonly T[], limit: number, valuesOf: (item: T) => Finding["values"]): Finding[] => {
  const report = minorityReport(items, limit);
  if (report === undefined) return [];
  if (report.mode === "mixed") {
    const { first, odd, spaced, touching } = report;
    return [sidedFinding(first, { ...valuesOf(first), spaced, touching, count: odd, of: items.length, limit }, "mixed")];
  }
  return report.odd.map((item) => sidedFinding(item, { ...valuesOf(item), count: report.odd.length, of: items.length, limit }));
};

/** Sentences written in the document's own language; a quoted sentence in another language follows its own marks. */
const ownSentences = (doc: ProseDocument): readonly Sentence[] => doc.sentences.filter((sentence) => sentence.embeddedLanguage === undefined);

/**
 * A bracketed item number opening a line ((1)開催趣旨, （ア）, (iv), a list bullet before it), both brackets of one width.
 * It numbers the line, a style of its own: the brackets of the prose around it may be written the other width. A
 * bracketed word at a line's head ((背景), (注)) is not a number, and an item number the prose refers to (次の(1)及び(2))
 * is written in the prose; both stay with the prose's brackets.
 */
const LINE_HEAD = /^\s*(?:[-*+] +)?/u;
const BRACKETED = /^([(（[［])([^)）\]］]{1,4})([)）\]］])/u;
const NUMBERING = /^(?:[0-9０-９]{1,3}|[一二三四五六七八九十]{1,3}|[A-Za-zＡ-Ｚａ-ｚァ-ヶぁ-んｦ-ﾝ])$/u;
/** Roman numerals i to x, either case. */
const ROMAN = /^(?:i{2,3}|iv|vi{1,3}|ix|I{2,3}|IV|VI{1,3}|IX)$/u;
const CLOSER_OF: Readonly<Record<string, string>> = { "(": ")", "（": "）", "[": "]", "［": "］" };

const isItemNumber = (text: string): boolean => NUMBERING.test(text) || ROMAN.test(text);

/** The offsets in a line of its item number's opening and closing bracket, or none. */
const enumeratorIn = (line: string): readonly number[] => {
  const head = LINE_HEAD.exec(line)?.[0].length ?? 0;
  const found = BRACKETED.exec(line.slice(head));
  if (found === null || CLOSER_OF[found[1] ?? ""] !== found[3] || !isItemNumber(found[2] ?? "")) return [];
  return [head, head + found[0].length - 1];
};

/** The offsets in `source` of each line's item number's opening and closing bracket. */
export const enumeratorBracketOffsets = (source: string): ReadonlySet<number> => {
  const starts = lineStarts(source);
  return new Set(source.split("\n").flatMap((line, index) => enumeratorIn(line).map((at) => (starts[index] ?? 0) + at)));
};

/** Appended to a mark's kind for an item number's bracket. A lexicon's group, a word from YAML, never holds a NUL. */
const ENUMERATOR_KIND = "\u0000enumerator";

/** A line's item number's bracket is a kind of its own, compared only with the other item numbers' brackets. */
const withEnumeratorKind = (mark: Mark, enumerators: ReadonlySet<number>): Mark =>
  enumerators.has(mark.offset) ? { ...mark, form: { ...mark.form, kind: `${mark.form.kind}${ENUMERATOR_KIND}` } } : mark;

/**
 * A mark written two ways in one document (（ and (, “ and "), the less common way reported. The two ways come from the
 * lexicon; neither is called right. Only marks next to a letter of the document's script count, so a bracket in code-like
 * text (f(x)) or an English aside in a Japanese document does not. A line enumerator's brackets ((1)) are compared apart.
 */
export const markConsistency: Detector = (doc, options): Finding[] => {
  const script = SCRIPT[doc.language];
  if (script === undefined) return [];
  const forms = formsOf(options.lexicon ?? []);
  const enumerators = enumeratorBracketOffsets(doc.source);
  const marks = ownSentences(doc).flatMap((sentence) => marksIn(doc.source, sentence, forms, script).map((mark) => withEnumeratorKind(mark, enumerators)));
  const kinds = [...new Set(marks.map((mark) => mark.form.kind))];
  return kinds.flatMap((kind) =>
    minorityFindings(
      marks.filter((mark) => mark.form.kind === kind),
      options.limit,
      (mark) => ({ mark: mark.char, usual: mark.form.other }),
    ),
  );
};

/**
 * A sentence that surely ends: a lower-case word of two letters or more, then the mark. A number ("11.1."), an abbreviation
 * ("Req.", "e.g.") or a capital ("U.S.") may be a split the adapter made inside a sentence, where one space is usual.
 */
const SENTENCE_END = /(?<![\p{L}\d.])\p{Ll}{2,}[.!?]["'”’)\]]?$/u;
/** The next sentence starts with a capital, past an opening quote: not a citation ("[ISO99]") or an aside in brackets. */
const SENTENCE_START = /^["'“‘]?\p{Lu}/u;
const ONE_SPACE = " ";
const TWO_SPACES = "  ";

/** The space between two sentences on one line, when the first ends with a period, question or exclamation mark. spaced is two spaces. */
export const sentenceGaps = (doc: ProseDocument): Sided[] =>
  ownSentences(doc).flatMap((sentence, at, sentences) => {
    const next = sentences[at + 1];
    if (next === undefined || !SENTENCE_END.test(sentence.text) || !SENTENCE_START.test(next.text)) return [];
    const gap = doc.source.slice(sentence.span.end, next.span.start);
    if (gap !== ONE_SPACE && gap !== TWO_SPACES) return [];
    return [{ sentence: next, spaced: gap === TWO_SPACES, offset: sentence.span.end }];
  });

/** One space between sentences and two, mixed in one document: the less common is reported. */
export const sentenceSpacing: Detector = (doc, options): Finding[] =>
  minorityFindings(sentenceGaps(doc), options.limit, (gap) => ({
    spaces: gap.spaced ? TWO_SPACES.length : ONE_SPACE.length,
    usual: gap.spaced ? ONE_SPACE.length : TWO_SPACES.length,
  }));

type Hit = { readonly sentence: Sentence; readonly matched: string; readonly offset: number };

const hitFinding = (hit: Hit, count: number, limit: number): Finding => ({
  rule: "",
  severity: "info",
  line: 0,
  column: 0,
  quote: hit.sentence.text.trim(),
  values: { matched: hit.matched, count, limit, offset: hit.offset },
});

const hitsOf = (sentences: readonly Sentence[], pattern: RegExp): Hit[] =>
  sentences.flatMap((sentence) =>
    [...sentence.text.matchAll(pattern)].map((match) => ({ sentence, matched: match[0].trim(), offset: sentence.span.start + match.index })),
  );

const reportFrom = (hits: readonly Hit[], limit: number): Finding[] => (hits.length < limit ? [] : hits.map((hit) => hitFinding(hit, hits.length, limit)));

/** A spaced hyphen or a double hyphen between words, standing for a dash ("late - very late", "late--very late"). */
const HYPHEN_DASH = /(?<=[\p{L},;)]) -{1,2} (?=[\p{L}(])|(?<=\p{L})--(?=\p{L})/gu;

/** A dash set as a character (an em dash, an en dash). */
const TRUE_DASH = /[—–]/u;
const DOUBLE_HYPHEN = "--";

/**
 * Whether the hit is a double hyphen in a document that sets no dash as a character: there "--" is how the document types its
 * dash (plain-text standards, typewriter text, Markdown that a typographer turns into a dash), not a hyphen standing in for one.
 */
const isTypedDash = (hit: Hit, setsDashes: boolean): boolean => !setsDashes && hit.matched === DOUBLE_HYPHEN;

export const hyphenDash: Detector = (doc, options): Finding[] => {
  const sentences = ownSentences(doc);
  const setsDashes = sentences.some((sentence) => TRUE_DASH.test(sentence.text));
  return reportFrom(
    hitsOf(sentences, HYPHEN_DASH).filter((hit) => !isTypedDash(hit, setsDashes)),
    options.limit,
  );
};

/** Every way of writing an abbreviation with some of its periods dropped but not all (e.g. → e.g, eg.). */
export const partialForms = (abbreviation: string): string[] => {
  const dots = [...abbreviation].flatMap((char, at) => (char === "." ? [at] : []));
  const subsets = Array.from({ length: 2 ** dots.length }, (_unused, mask) => dots.filter((_dot, bit) => (mask >> bit) % 2 === 1));
  return subsets
    .filter((dropped) => dropped.length > 0 && dropped.length < dots.length)
    .map((dropped) => [...abbreviation].filter((_char, at) => !dropped.includes(at)).join(""));
};

/** One partial form as a pattern: its first letter in either case, not inside a word, not followed by a period or letter. */
const partialPattern = (form: string): string =>
  `(?<![\\p{L}.])[${form.charAt(0).toLowerCase()}${form.charAt(0).toUpperCase()}]${escapeRegExp(form.slice(1))}(?![\\p{L}.])`;

/** Latin abbreviations from the lexicon (e.g., i.e.) written with only some of their periods (e.g, eg.). */
export const latinAbbreviation: Detector = (doc, options): Finding[] => {
  const forms = (options.lexicon ?? []).flatMap((entry) => partialForms(entry.pattern));
  if (forms.length === 0) return [];
  const pattern = new RegExp(forms.map(partialPattern).join("|"), "gu");
  return reportFrom(hitsOf(ownSentences(doc), pattern), options.limit);
};

/** How many all-capital words in a row read as shouting rather than a run of acronyms. */
const SHOUT_WORDS = 3;
const CAPS_RUN = new RegExp(`\\b[A-Z][A-Z']*(?:,? [A-Z][A-Z']*){${String(SHOUT_WORDS - 1)},}\\b`, "gu");
/** One-letter words (I, A) may sit in a run, but a run of them alone ("A B C") is a list of labels. */
const MIN_LONG_WORDS = 2;

const LATIN_WORD = /[A-Za-z][A-Za-z']*/gu;

/** The words a source writes at least once not wholly in capitals (do, Do), in lower case: words, not acronyms. */
export const lowerCaseWords = (source: string): ReadonlySet<string> =>
  new Set((source.match(LATIN_WORD) ?? []).filter((word) => word !== word.toUpperCase()).map((word) => word.toLowerCase()));

/**
 * Whether more than half the words of a capital run are also written elsewhere in lower case. Words the lexicon lists as
 * written in capitals by convention (MUST NOT in a specification) count like acronyms, and a run made of its phrases
 * (NOW, THEREFORE, BE IT RESOLVED) is not shouting.
 */
export const isShouting = (run: string, known: ReadonlySet<string>, conventional: ReadonlySet<string>): boolean => {
  if (isConventionalPhrase(run, conventional)) return false;
  const words = run.split(/,? /u);
  const ordinary = words.filter((word) => !conventional.has(word) && known.has(word.toLowerCase()));
  const long = words.filter((word) => word.length > 1);
  return long.length >= MIN_LONG_WORDS && ordinary.length * 2 > words.length;
};

/**
 * Runs of three or more all-capital words that are ordinary words, not acronyms ("DO NOT DELETE THIS"), and not a
 * caption, a mention of one, or a letterhead.
 */
export const capsShouting: Detector = (doc, options): Finding[] => {
  const known = lowerCaseWords(doc.prose ?? doc.source);
  const conventional = new Set((options.lexicon ?? []).map((entry) => entry.pattern));
  const captions = captionsOf(doc.source);
  const letterheads = letterheadSpans(doc.source);
  const isCaptionOrLetterhead = (hit: Hit): boolean =>
    captions.has(hit.matched) ||
    isCaptionAt(doc.source, hit.offset, hit.offset + hit.matched.length) ||
    isWithinAny(letterheads, { start: hit.offset, end: hit.offset + hit.matched.length });
  const hits = hitsOf(ownSentences(doc), CAPS_RUN).filter((hit) => isShouting(hit.matched, known, conventional) && !isCaptionOrLetterhead(hit));
  return reportFrom(hits, options.limit);
};
