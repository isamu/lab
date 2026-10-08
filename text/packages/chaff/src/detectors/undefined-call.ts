// undefined-function-call: a function called in a code example that the page never defines, where the page documents
// one whose name it extends (wrapText( on a page about wrap) (undefined-call.ts). The functions a programming language
// provides come from the code-global lexicon.
import { quoteAt } from "./structure-tree.ts";
import { undefinedCalls } from "../undefined-call.ts";
import type { Detector, Finding } from "../plugin.ts";

export const undefinedCall: Detector = (doc): Finding[] => {
  const headings = (doc.markup?.headings ?? []).map((heading) => heading.text);
  const globals = (doc.lexicons["code-global"] ?? []).map((entry) => entry.pattern);
  return undefinedCalls(doc.source, headings, globals).map((call) => ({
    rule: "undefined-function-call",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, call.offset),
    values: { name: call.name, documented: call.documented, offset: call.offset },
  }));
};
