import type { Detector, Finding, Span } from "../plugin.ts";
import { codePointName } from "./invisible-character.ts";

/**
 * A character that looks like a common one but is another code point, so search, sorting and a dictionary miss it.
 * radical: a Kangxi or supplementary radical (⼈ U+2F08 for 人), from PDF text or an input method's radical list.
 * compatibility: a CJK compatibility ideograph (or one of its supplement) that Unicode maps to a unified one (樂 U+F914 for 樂).
 * decomposed: a letter and a separate combining mark (か + U+3099 for が, e + U+0301 for é), from file names or text
 * copied on macOS. spacing-mark: kana followed by the spacing ゛ or ゜, typed in place of the combined letter.
 */
export type LookalikeKind = "radical" | "compatibility" | "decomposed" | "spacing-mark";

export type Lookalike = { readonly span: Span; readonly kind: LookalikeKind; readonly written: string; readonly usual: string };

const RADICAL = /[\u2E80-\u2EFF\u2F00-\u2FDF]/u;
const COMPATIBILITY = /[\uF900-\uFAFF\u{2F800}-\u{2FA1F}]/u;
/** A letter or mark base and the combining marks after it. */
const WITH_MARKS = /\P{M}\p{M}+/gu;
/** Kana followed by the spacing voiced or semi-voiced mark (か゛, は゜). */
const SPACING_MARK = /[\p{Script=Hiragana}\p{Script=Katakana}][゛゜]/gu;
const COMBINING_OF: Readonly<Record<string, string>> = { "゛": "゙", "゜": "゚" };
const SINGLE_CHAR = /[\u2E80-\u2EFF\u2F00-\u2FDF\uF900-\uFAFF\u{2F800}-\u{2FA1F}]/gu;

/** A radical or compatibility ideograph, with the unified ideograph it stands for. One that maps to nothing is left alone. */
const singleLookalikes = (source: string): Lookalike[] =>
  [...source.matchAll(SINGLE_CHAR)].flatMap((match) => {
    const written = match[0];
    const radical = RADICAL.test(written);
    const usual = written.normalize(radical ? "NFKC" : "NFC");
    if (usual === written || (!radical && !COMPATIBILITY.test(written))) return [];
    return [{ span: { start: match.index, end: match.index + written.length }, kind: radical ? "radical" : "compatibility", written, usual }];
  });

/** A base and combining marks that compose into one precomposed letter. Marks with no precomposed form are writing, not a slip. */
const decomposedLookalikes = (source: string): Lookalike[] =>
  [...source.matchAll(WITH_MARKS)].flatMap((match) => {
    const usual = match[0].normalize("NFC");
    if (Array.from(usual).length >= Array.from(match[0]).length) return [];
    return [{ span: { start: match.index, end: match.index + match[0].length }, kind: "decomposed", written: match[0], usual }];
  });

/** Kana and a spacing ゛ or ゜ whose combining form makes one letter (か゛ → が). */
const spacingMarkLookalikes = (source: string): Lookalike[] =>
  [...source.matchAll(SPACING_MARK)].flatMap((match) => {
    const [kana = "", mark = ""] = Array.from(match[0]);
    const usual = `${kana}${COMBINING_OF[mark] ?? ""}`.normalize("NFC");
    if (Array.from(usual).length !== 1) return [];
    return [{ span: { start: match.index, end: match.index + match[0].length }, kind: "spacing-mark", written: match[0], usual }];
  });

export const lookalikesIn = (source: string): Lookalike[] =>
  [...singleLookalikes(source), ...decomposedLookalikes(source), ...spacingMarkLookalikes(source)].toSorted(
    (left, right) => left.span.start - right.span.start,
  );

const QUOTE_REACH = 20;

const quoteOf = (source: string, span: Span): string =>
  source
    .slice(Math.max(0, span.start - QUOTE_REACH), span.end + QUOTE_REACH)
    .replace(/\s+/gu, " ")
    .trim();

const codesOf = (text: string): string => Array.from(text).map(codePointName).join(" ");

export const lookalikeCharacter: Detector = (doc): Finding[] =>
  lookalikesIn(doc.source).map((lookalike) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteOf(doc.source, lookalike.span),
    values: { written: lookalike.written, usual: lookalike.usual, code: codesOf(lookalike.written), offset: lookalike.span.start },
    variant: lookalike.kind,
  }));
