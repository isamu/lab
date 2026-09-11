import type { Detector, Finding, Sentence } from "../plugin.ts";

const HEAD_CHARS = 6;

const headOf = (sentence: Sentence): string => sentence.text.trim().replace(/\s+/gu, "").slice(0, HEAD_CHARS);

type Run = { readonly head: string; readonly members: readonly Sentence[] };

const runsOf = (sentences: readonly Sentence[]): Run[] =>
  sentences.reduce<Run[]>((acc, sentence) => {
    const head = headOf(sentence);
    const last = acc.at(-1);
    if (last !== undefined && last.head === head && head.length === HEAD_CHARS) {
      return [...acc.slice(0, -1), { head, members: [...last.members, sentence] }];
    }
    return [...acc, { head, members: [sentence] }];
  }, []);

export const repeatedHead: Detector = (doc, options): Finding[] =>
  runsOf(doc.sentences)
    .filter((run) => run.members.length > options.limit)
    .map((run) => ({
      rule: "repeated-sentence-head",
      severity: "warning",
      line: 0,
      column: 0,
      quote: run.members.map((sentence) => sentence.text.trim()).join(" "),
      values: { head: run.head, count: run.members.length, limit: options.limit, offset: run.members[0]?.span.start ?? 0 },
    }));
