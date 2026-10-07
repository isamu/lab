// warning-without-action: a warning paragraph (Warning:, 注意：, > [!WARNING]) none of whose sentences tells the reader what
// to do (warning-action.ts). In English a sentence that opens with its verb (Export today's orders first) is an action too.
// A GitHub alert (> [!WARNING]) is read to the end of its block quote.
import { isInstruction, isStatement } from "./technical-docs.ts";
import { quoteAt } from "./structure-tree.ts";
import { namesAction, quoteBlockEnd, warningTextStart, type WarningWords } from "../warning-action.ts";
import type { Detector, Finding, Paragraph, ProseDocument, Sentence } from "../plugin.ts";

const wordsOf = (doc: ProseDocument): WarningWords => ({
  labels: (doc.lexicons["warning-label"] ?? []).map((entry) => entry.pattern),
  actions: (doc.lexicons["warning-action"] ?? []).map((entry) => entry.pattern),
});

/** An English sentence that opens with its verb, read from the parts of speech past the label: an instruction. */
const opensWithVerb = (doc: ProseDocument, sentence: Sentence, from: number): boolean => {
  const tokens = (sentence.tokens ?? []).filter((token) => token.span.start >= from);
  return doc.language === "en" && tokens.length > 0 && isInstruction(tokens) && !isStatement(tokens);
};

const isAction = (doc: ProseDocument, sentence: Sentence, from: number, words: WarningWords): boolean => {
  const start = Math.max(sentence.span.start, from);
  if (start >= sentence.span.end) return false;
  return namesAction(doc.source.slice(start, sentence.span.end), words.actions) || opensWithVerb(doc, sentence, start);
};

const warningWithoutAction = (doc: ProseDocument, paragraph: Paragraph, words: WarningWords): Finding[] => {
  const textStart = warningTextStart(doc.source.slice(paragraph.span.start, paragraph.span.end), words.labels);
  if (textStart === undefined) return [];
  const from = paragraph.span.start + textStart;
  const end = quoteBlockEnd(doc.source, paragraph.span.start) ?? paragraph.span.end;
  const said = doc.sentences.filter((sentence) => sentence.span.end > from && sentence.span.start < end);
  if (said.length === 0 || said.some((sentence) => isAction(doc, sentence, from, words))) return [];
  return [
    {
      rule: "warning-without-action",
      severity: "info",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, paragraph.span.start),
      values: { offset: paragraph.span.start },
    },
  ];
};

export const warningAction: Detector = (doc): Finding[] => {
  const words = wordsOf(doc);
  if (words.labels.length === 0) return [];
  return doc.paragraphs.flatMap((paragraph) => warningWithoutAction(doc, paragraph, words));
};
