import type { Detector, Finding, Sentence } from "../plugin.ts";
import { groupHits, groupsOfLexicon, groupVerdict, type GroupHit, type GroupVerdict } from "../term-groups.ts";
import { joinWords } from "./word-list.ts";

type Placed = GroupHit & { readonly sentence: Sentence };

const findingAt = (hit: Placed, values: Finding["values"], variant?: string): Finding => ({
  rule: "",
  severity: "warning",
  line: 0,
  column: 0,
  quote: hit.sentence.text.trim(),
  ...(variant === undefined ? {} : { variant }),
  values: { ...values, matched: hit.sentence.text.slice(hit.span.start, hit.span.end), offset: hit.sentence.span.start + hit.span.start },
});

/** The places a verdict reports, when its less-used side reaches the limit. A tie is one place: no side is taken. */
const findingsOf = (verdict: GroupVerdict<Placed>, total: number, limit: number, language: string): Finding[] => {
  if (verdict.kind === "minority") {
    if (verdict.odd.length < limit) return [];
    return verdict.odd.map((hit) => findingAt(hit, { preferred: verdict.usual, other: verdict.usualCount, count: verdict.odd.length, limit }));
  }
  const top = Math.max(...verdict.members.map((entry) => entry.count));
  if (total - top < limit) return [];
  const forms = joinWords(
    verdict.members.map((entry) => entry.member),
    language,
  );
  return [findingAt(verdict.first, { forms, count: top, limit }, "tie")];
};

/** The groups the team lists under consistent in chaff.yaml: within one text, the places of a member the text uses less. */
export const termConsistency: Detector = (doc, options): Finding[] => {
  const groups = groupsOfLexicon(options.lexicon ?? []);
  const hits: Placed[] = doc.sentences.flatMap((sentence) => groupHits(sentence.text, groups).map((hit) => ({ ...hit, sentence })));
  return groups.flatMap((_, group) => {
    const mine = hits.filter((hit) => hit.group === group);
    const verdict = groupVerdict(mine);
    return verdict === undefined ? [] : findingsOf(verdict, mine.length, options.limit, doc.language);
  });
};
