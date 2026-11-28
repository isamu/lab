import { RULE_ID } from "./extension/plugin-name.ts";

/** What one stet comment says: the rules it names, the matched texts some of them are limited to, and why. */
export type StetBody = {
  /** Every rule named, once, whether bare or with a matched text. */
  readonly rules: readonly string[];
  /** A rule named only as `rule["text"]`: the texts its silenced findings must have matched. A bare name lifts the limit. */
  readonly matching: Readonly<Record<string, readonly string[]>>;
  readonly reason: string | undefined;
  /** Entries in the rule list that are not a rule name nor `rule["text"]`, as written. */
  readonly malformed: readonly string[];
};

/** 理由は em dash のあと。書かなくてもよいが、書かないと chaff suppressions に並ぶ。 */
const REASON_MARK = "—";

/** `["…"]` after a rule name. No nested quantifier: a long comment must not make the scan backtrack. */
const QUOTED = /\["[^"]*"\]/gu;

type Range = { readonly start: number; readonly end: number };

const quotedRanges = (body: string): Range[] => [...body.matchAll(QUOTED)].map((match) => ({ start: match.index, end: match.index + match[0].length }));

const isQuoted = (at: number, quoted: readonly Range[]): boolean => quoted.some((range) => at >= range.start && at < range.end);

/** Every index of `mark` in `body` outside a `["…"]`: a matched text may hold a comma or a dash. */
const marksOutside = (body: string, mark: string, quoted: readonly Range[]): number[] =>
  Array.from({ length: body.length }, (_unused, index) => index).filter((at) => body[at] === mark && !isQuoted(at, quoted));

const splitAt = (text: string, cuts: readonly number[]): string[] =>
  [...cuts, text.length].map((cut, index) => text.slice(index === 0 ? 0 : (cuts[index - 1] ?? 0) + 1, cut));

const reasonOf = (raw: string): string | undefined => {
  // 残っているのはコメント終端の "--" だけ。正規表現で任意個の "-" を剥がすと、
  // 長いダッシュ列でバックトラックする（そして著者が書いたダッシュまで消す）。
  const tail = (raw.endsWith("--") ? raw.slice(0, -2) : raw).trim();
  return tail.length === 0 ? undefined : tail;
};

type Entry = { readonly rule: string; readonly text: string | undefined } | { readonly malformed: string };

const entryOf = (piece: string): Entry => {
  if (RULE_ID.test(piece)) return { rule: piece, text: undefined };
  const open = piece.indexOf('["');
  const rule = open === -1 ? "" : piece.slice(0, open);
  const quoted = open === -1 ? "" : piece.slice(open);
  return RULE_ID.test(rule) && quoted.endsWith('"]') && quoted.length >= 4 && !quoted.slice(2, -2).includes('"')
    ? { rule, text: quoted.slice(2, -2) }
    : { malformed: piece };
};

const matchingOf = (entries: readonly Entry[]): Record<string, string[]> => {
  const named = entries.flatMap((entry) => ("rule" in entry ? [entry] : []));
  const bare = new Set(named.filter((entry) => entry.text === undefined).map((entry) => entry.rule));
  const limited = named.flatMap((entry) => (entry.text === undefined || bare.has(entry.rule) ? [] : [{ rule: entry.rule, text: entry.text }]));
  return limited.reduce<Record<string, string[]>>((all, entry) => ({ ...all, [entry.rule]: [...(all[entry.rule] ?? []), entry.text] }), {});
};

/** Reads the part of a stet comment after its colon: `rule-a, rule-b["text"] — reason`. */
export const readStetBody = (body: string): StetBody => {
  const quoted = quotedRanges(body);
  const at = marksOutside(body, REASON_MARK, quoted)[0];
  const head = at === undefined ? body : body.slice(0, at);
  const entries = splitAt(head, marksOutside(head, ",", quoted))
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0)
    .map(entryOf);
  return {
    rules: [...new Set(entries.flatMap((entry) => ("rule" in entry ? [entry.rule] : [])))],
    matching: matchingOf(entries),
    reason: at === undefined ? undefined : reasonOf(body.slice(at + REASON_MARK.length)),
    malformed: entries.flatMap((entry) => ("malformed" in entry ? [entry.malformed] : [])),
  };
};
