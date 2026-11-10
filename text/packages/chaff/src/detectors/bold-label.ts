import type { Detector, DetectorOptions, Finding, Paragraph, ProseDocument, Span, Token } from "../plugin.ts";

/** A bold run longer than this is a bold sentence, not a label. */
const MAX_LABEL_CHARS = 40;

/** The bullet or number that opens a list item. */
const ITEM_MARKER = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+/u;

/** A task box, after the marker or at the start of an item whose marker was already cut. */
const TASK_BOX = /^\[[ xX]\][ \t]+/u;

/** `**Label**: text` or `**Label:** text`. The label holds no delimiter, so `**a** and **b**: text` is not one label. */
const BOLD_LABEL = new RegExp(String.raw`^(\*\*|__)(?!\s)((?:(?!\1)[^\n]){1,${MAX_LABEL_CHARS}}?)(?:\1[ \t]*[:：]|[:：]\1)[ \t]*\S`, "u");

/** A label that is only code (`--flag`, `timeout_ms`) names an option or a field: the way reference documentation lists them. */
const CODE_SPAN = /^`[^`]+`$/u;

/** A link around the whole label: inline, reference, collapsed or shortcut. Its text is what the reader sees. */
const WHOLE_LINK = /^\[([^\]\n]+)\](?:\([^)\s]*\)|\[[^\]\n]*\])?$/u;

const isCodeOnly = (label: string): boolean => CODE_SPAN.test(label.replace(WHOLE_LINK, "$1"));

/** The label a list item opens with in bold before a colon and more text, or undefined. `item` is the item as written, marker and all. */
export const boldLabelOf = (item: string): string | undefined => {
  const label = BOLD_LABEL.exec(item.replace(ITEM_MARKER, "").replace(TASK_BOX, ""))?.[2]?.trim();
  return label === undefined || isCodeOnly(label) ? undefined : label;
};

/** `**Label:**` opening a paragraph, with text after it or standing alone over the list it introduces. */
const STANDING_LABEL = new RegExp(String.raw`^(\*\*|__)(?!\s)((?:(?!\1)[^\n]){1,${MAX_LABEL_CHARS}}?)(?:\1[ \t]*[:：]|[:：]\1)`, "u");

/** The bold label a paragraph or item opens with, whether text follows it on the line or not. */
export const standingBoldLabelOf = (text: string): string | undefined => STANDING_LABEL.exec(text.replace(ITEM_MARKER, "").replace(TASK_BOX, ""))?.[2]?.trim();

/** Whether an item opens with a bold label of any kind, code-only ones included: bold that labels rather than emphasises. */
export const opensWithBoldLabel = (item: string): boolean => BOLD_LABEL.test(item.replace(ITEM_MARKER, "").replace(TASK_BOX, ""));

/** Whether the line holding `offset` is quoted (`> - **a**：…`): someone else's words, not the writer's to fix. */
export const isQuotedAt = (source: string, offset: number): boolean => source.slice(source.lastIndexOf("\n", offset - 1) + 1, offset).includes(">");

/** A bold run longer than this is a paragraph in bold, not a lead sentence. */
const MAX_LEAD_CHARS = 80;

/** `**Label.** text`: a bold lead sentence, its stop inside the bold, then the item goes on. The same label, closed by a stop instead of a colon. */
const BOLD_LEAD = new RegExp(String.raw`^(\*\*|__)(?!\s)((?:(?!\1)[^\n]){1,${MAX_LEAD_CHARS}}?[.!?。！？])\1[ \t]*\S`, "u");

/** The lead sentence a list item opens with in bold, its stop left off, or undefined. `item` is the item as written, marker and all. */
export const boldLeadOf = (item: string): string | undefined =>
  BOLD_LEAD.exec(item.replace(ITEM_MARKER, "").replace(TASK_BOX, ""))?.[2]
    ?.trim()
    .replace(/[.!?。！？]$/u, "");

const labelOrLeadOf = (item: string): string | undefined => boldLabelOf(item) ?? boldLeadOf(item);

const unquotedItemsOf = (doc: ProseDocument, spans: readonly Span[], opens: (item: string) => string | undefined): Span[] =>
  spans.filter((span) => !isQuotedAt(doc.source, span.start) && opens(doc.source.slice(span.start, span.end)) !== undefined);

const unquotedItems = (doc: ProseDocument, opens: (item: string) => string | undefined): Span[] =>
  unquotedItemsOf(
    doc,
    doc.lists.flatMap((list) => list.itemSpans),
    opens,
  ).toSorted((left, right) => left.start - right.start);

/**
 * How long an item's text after its bold opening runs before it counts as a paragraph, in words or, for a language
 * written without spaces, characters (the 2.5 characters a word that MIN_DOCUMENT_LENGTH uses).
 */
export const PARAGRAPH_ITEM_LENGTH = { word: 40, char: 100 };

const OPENING_BOLD = /^(\*\*|__).*?\1/su;

/** The length of an item's text after its marker and its bold opening, in the document's unit. */
const explanationLength = (item: string, unit: "word" | "char"): number => {
  const rest = item.replace(ITEM_MARKER, "").replace(TASK_BOX, "").replace(OPENING_BOLD, "").trim();
  return unit === "char" ? rest.replace(/\s+/gu, "").length : rest.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
};

const median = (values: readonly number[]): number => values.toSorted((left, right) => left - right)[Math.floor(values.length / 2)] ?? 0;

/**
 * Whether a list's bold-opened items each run a paragraph (- **Get feedback early.** and forty words more): a handbook's
 * tips, the advice in bold and the item explaining it at length. Generated lists keep each item to a sentence or two.
 */
export const isParagraphList = (doc: ProseDocument, items: readonly Span[]): boolean =>
  items.length > 0 &&
  median(items.map((span) => explanationLength(doc.source.slice(span.start, span.end), doc.lengthUnit))) >= PARAGRAPH_ITEM_LENGTH[doc.lengthUnit];

/** The bold-opened items of lists that are captions, not paragraphs, in document order. */
const captionItems = (doc: ProseDocument, opens: (item: string) => string | undefined): Span[] =>
  doc.lists
    .flatMap((list) => {
      const items = unquotedItemsOf(doc, list.itemSpans, opens);
      return isParagraphList(doc, items) ? [] : items;
    })
    .toSorted((left, right) => left.start - right.start);

/** The list items, in document order, that open with a bold label and are not quoted. */
export const boldLabelItems = (doc: ProseDocument): Span[] => unquotedItems(doc, boldLabelOf);

/** Bold lead sentences that report on their own (the rule's min_leads). */
const DEFAULT_MIN_LEADS = 3;

/** Paragraphs opened by a bold statement that report on their own (the rule's min_clause_paragraphs). */
const DEFAULT_MIN_CLAUSE_PARAGRAPHS = 3;

const countSetting = (options: DetectorOptions, name: string, fallback: number): number => {
  const value = options.settings?.[name];
  return typeof value === "number" ? value : fallback;
};

const minLeads = (options: DetectorOptions): number => countSetting(options, "min_leads", DEFAULT_MIN_LEADS);

const VERBAL = new Set(["VERB", "AUX"]);

/** Words that state something: a verb after a first word that is not one. An imperative (Talk to …), a term (Work schedule) or a gerund heading is not. */
const isStatement = (tokens: readonly Token[]): boolean => {
  const words = tokens.filter((token) => token.pos !== "PUNCT" && token.pos !== "SYM");
  const head = words[0];
  return head !== undefined && !VERBAL.has(head.pos) && words.slice(1).some((token) => VERBAL.has(token.pos));
};

/**
 * A whole instruction in bold, closed by its own stop (**Pick the quietest room you can.**): a verb in its plain form first
 * and words after it. A run-in head closed by a colon (**Talk to the people:**) or a gerund (**Examining who is involved.**)
 * is not one.
 */
const OBJECT_OPENERS = new Set(["DET", "PRON"]);

/** The tagger reads an opening verb it also knows as a noun as a noun (Face the window); a determiner right after it says verb. */
const readsAsVerb = (head: Token, next: Token | undefined): boolean =>
  head.pos === "VERB" || (head.pos === "NOUN" && next !== undefined && OBJECT_OPENERS.has(next.pos));

const isImperativeSentence = (tokens: readonly Token[]): boolean => {
  const words = tokens.filter((token) => token.pos !== "PUNCT" && token.pos !== "SYM");
  const head = words[0];
  return head !== undefined && !/ing$/iu.test(head.surface) && readsAsVerb(head, words[1]);
};

type OpeningRun = { readonly words: string; readonly end: number; readonly stopped: boolean };

/** The bold run a paragraph opens with, as a label or lead sentence, where in the paragraph its words end, and whether a stop closes it. */
const openingRunOf = (text: string): OpeningRun | undefined => {
  const label = BOLD_LABEL.exec(text);
  const match = label ?? BOLD_LEAD.exec(text);
  const words = match?.[2];
  if (match?.[1] === undefined || words === undefined || isCodeOnly(words.trim())) return undefined;
  return { words: words.trim(), end: match[1].length + words.length, stopped: label === null };
};

/**
 * The statement a paragraph opens with in bold (**Usage grew each week**: …), or a whole instruction closed by its stop
 * (**Pick the quietest room you can.** …), or undefined. A question (an FAQ's) is not a statement.
 */
const boldStatementOf = (doc: ProseDocument, paragraph: Paragraph): string | undefined => {
  const { start, end } = paragraph.span;
  const run = isQuotedAt(doc.source, start) ? undefined : openingRunOf(doc.source.slice(start, end));
  if (run === undefined || /[?？]$/u.test(run.words)) return undefined;
  const runEnd = start + run.end;
  const tokens = paragraph.sentences.flatMap((sentence) => sentence.tokens ?? []).filter((token) => token.span.start >= start && token.span.start < runEnd);
  return isStatement(tokens) || (run.stopped && isImperativeSentence(tokens)) ? run.words.replace(/[.!。！]$/u, "") : undefined;
};

/** The count reported and the limit it reached: all the labelled items, or else the bold lead sentences alone, or undefined. */
const reached = (items: readonly Span[], leads: number, options: DetectorOptions): { count: number; limit: number } | undefined => {
  if (items.length >= options.limit) return { count: items.length, limit: options.limit };
  const least = minLeads(options);
  return leads >= least ? { count: leads, limit: least } : undefined;
};

const finding = (doc: ProseDocument, span: Span, label: string, found: { count: number; limit: number }, variant?: string): Finding => ({
  rule: "bold-label-list",
  severity: "info",
  line: 0,
  column: 0,
  quote: (doc.source.slice(span.start, span.end).split("\n")[0] ?? "").trim(),
  values: { label, count: found.count, limit: found.limit, offset: span.start },
  ...(variant === undefined ? {} : { variant }),
});

/**
 * Paragraphs that each open with a bold statement (**Usage grew each week**: …) or a whole bold instruction (**Pick a quiet
 * room.** …): findings or tips set as captions. Human run-in heads are terms, imperatives closed by a colon, gerunds or
 * questions (**Work schedule**:, **Talk to the people:**, **Examining the risks.**, **Who is my audience?**), and are not counted.
 */
const statementParagraphs = (doc: ProseDocument, options: DetectorOptions): Finding[] => {
  const statements = doc.paragraphs.flatMap((paragraph) => {
    const label = boldStatementOf(doc, paragraph);
    return label === undefined ? [] : [{ span: paragraph.span, label }];
  });
  const first = statements[0];
  const limit = countSetting(options, "min_clause_paragraphs", DEFAULT_MIN_CLAUSE_PARAGRAPHS);
  return first === undefined || statements.length < limit ? [] : [finding(doc, first.span, first.label, { count: statements.length, limit }, "paragraphs")];
};

/**
 * A count, not a density: a person writes one or two labels even in a long article. A bold lead sentence counts as a label.
 * Bold lead sentences (- **Check one result by hand.** …) report at fewer items than colon labels: human documents write a few
 * colon labels for steps or fields (- **Gather input**: …), but rarely make a list of bold lead sentences. A list whose items
 * each run a paragraph after the bold is a handbook's tips and is not counted.
 */
export const boldLabelList: Detector = (doc, options): Finding[] => {
  const items = captionItems(doc, labelOrLeadOf);
  const first = items[0];
  const leads = items.filter((span) => boldLabelOf(doc.source.slice(span.start, span.end)) === undefined).length;
  const found = reached(items, leads, options);
  const paragraphs = statementParagraphs(doc, options);
  if (first === undefined || found === undefined) return paragraphs;
  return [finding(doc, first, labelOrLeadOf(doc.source.slice(first.start, first.end)) ?? "", found)];
};
