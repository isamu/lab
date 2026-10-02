import type { Detector, Finding } from "../plugin.ts";
import { listStatementsIn, outsideMembers } from "../announced-list.ts";
import { linesOf, lineNumberAt } from "../structure/lines.ts";
import { quoteAt } from "./structure-tree.ts";

/** 最初に挙げた一覧（対応 OS は Windows と macOS）に無い名前を、後の文が同じ語で言う所（Linux にも対応）。 */
export const outsideAnnouncedList: Detector = (doc): Finding[] => {
  const lowered = (id: string): Set<string> => new Set((doc.lexicons[id] ?? []).map((entry) => entry.pattern.toLowerCase()));
  const words = { frames: doc.lexicons["enumeration-frame"] ?? [], joiners: lowered("enumeration-joiner"), negations: lowered("enumeration-negation") };
  const statements = doc.sentences.flatMap((sentence) => listStatementsIn(sentence, words, doc.source));
  const lines = linesOf(doc.source);
  return outsideMembers(statements).map(({ member, announced }) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, member.offset),
    values: {
      name: member.name,
      list: announced.members.map((listed) => listed.name).join(", "),
      listLine: lineNumberAt(lines, announced.offset) ?? 0,
      offset: member.offset,
    },
  }));
};
