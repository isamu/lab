import type { Detector, Finding, Lexicon, ProseDocument, Sentence } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { minorityReport } from "../spacing-minority.ts";
import { isWithinAny, quotedSpans } from "../quoted-span.ts";

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

/** The marks in a sentence that touch a letter of the document's script, outside 「」『』 quotations. spaced is the lexicon's pattern side. */
export const marksIn = (sentence: Sentence, forms: ReadonlyMap<string, Form>, script: RegExp): Mark[] => {
  const quoted = quotedSpans(sentence.text);
  return sentence.text.split("").flatMap((char, at) => {
    const form = forms.get(char);
    if (form === undefined || !touchesScript(sentence.text, at, script)) return [];
    if (isWithinAny(quoted, { start: at, end: at })) return [];
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
 * A mark written two ways in one document (（ and (, “ and "), the less common way reported. The two ways come from the
 * lexicon; neither is called right. Only marks next to a letter of the document's script count, so a bracket in code-like
 * text (f(x)) or an English aside in a Japanese document does not.
 */
export const markConsistency: Detector = (doc, options): Finding[] => {
  const script = SCRIPT[doc.language];
  if (script === undefined) return [];
  const forms = formsOf(options.lexicon ?? []);
  const marks = ownSentences(doc).flatMap((sentence) => marksIn(sentence, forms, script));
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

export const hyphenDash: Detector = (doc, options): Finding[] => reportFrom(hitsOf(ownSentences(doc), HYPHEN_DASH), options.limit);

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
 * written in capitals by convention (MUST NOT in a specification) count like acronyms.
 */
export const isShouting = (run: string, known: ReadonlySet<string>, conventional: ReadonlySet<string>): boolean => {
  const words = run.split(/,? /u);
  const ordinary = words.filter((word) => !conventional.has(word) && known.has(word.toLowerCase()));
  const long = words.filter((word) => word.length > 1);
  return long.length >= MIN_LONG_WORDS && ordinary.length * 2 > words.length;
};

/** Runs of three or more all-capital words that are ordinary words, not acronyms ("DO NOT DELETE THIS"). */
export const capsShouting: Detector = (doc, options): Finding[] => {
  const known = lowerCaseWords(doc.prose ?? doc.source);
  const conventional = new Set((options.lexicon ?? []).map((entry) => entry.pattern));
  const hits = hitsOf(ownSentences(doc), CAPS_RUN).filter((hit) => isShouting(hit.matched, known, conventional));
  return reportFrom(hits, options.limit);
};
