import type { Detector, Finding } from "../plugin.ts";
import { findingAt, markupOf } from "./markup-finding.ts";
import { bareLinkText, comparableLinkText, isVagueLinkText, linkTextOf } from "../link-text.ts";

/** 言葉がそれだけでは行き先を言わないリンク（`[こちら](url)`、`[click here](url)`）。どの言葉かは語彙表 vague-link-text が言う。 */
export const vagueLinkText: Detector = (doc, options): Finding[] => {
  const vague = new Set((options.lexicon ?? []).map((entry) => comparableLinkText(entry.pattern)));
  return (markupOf(doc)?.links ?? []).flatMap((link) => {
    const text = linkTextOf(doc.source.slice(link.start, link.end));
    return text !== undefined && isVagueLinkText(text, vague) ? [findingAt(doc, link, { text: bareLinkText(text) })] : [];
  });
};
