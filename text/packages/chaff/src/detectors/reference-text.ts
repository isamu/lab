import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { inDocumentOrder, referenceResolver, type StructureIssue } from "../structure/issues.ts";
import { titleMismatches, topicMisses, type ReferenceInput } from "../structure/reference-text.ts";
import { quoteAt } from "./structure-tree.ts";

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

/** 文書の中の参照と、参照先の引き方。他の文書の名が付いた参照（民法第709条）は、この文書の見出しと比べない。 */
const inputOf = (doc: ProseDocument): ReferenceInput | undefined => {
  const tree = doc.structure;
  if (tree === undefined) return undefined;
  return {
    source: doc.source,
    references: inDocumentOrder(tree).filter((node) => node.kind === "reference" && node.attrs["document"] === undefined),
    targetOf: referenceResolver(tree),
    words: {
      asides: patternsOf(doc, "reference-aside"),
      topicLinks: patternsOf(doc, "reference-topic-link"),
      vagueTopics: patternsOf(doc, "reference-topic-vague"),
    },
  };
};

const findingsOf =
  (rule: string, issuesOf: (input: ReferenceInput) => StructureIssue[]): Detector =>
  (doc): Finding[] => {
    const input = inputOf(doc);
    return input === undefined
      ? []
      : issuesOf(input).map((issue) => ({
          rule,
          severity: "warning",
          line: 0,
          column: 0,
          quote: quoteAt(doc.source, issue.offset),
          values: { ...issue.values, offset: issue.offset },
        }));
  };

/** 「第2章「料金」」の名前が、第2章の見出しと合わない。 */
export const referenceTitleMismatch: Detector = findingsOf("reference-title-mismatch", titleMismatches);

/** 「第2章で述べた料金体系」の話題が、第2章に無い。 */
export const referenceTopicMissing: Detector = findingsOf("reference-topic-missing", topicMisses);
