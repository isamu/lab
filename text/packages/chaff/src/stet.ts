import type { Finding, RuleDefinition, Span } from "./plugin.ts";
import { stetBlockEnd } from "./stet-block.ts";
import { readStetBody } from "./stet-body.ts";
import { lineStarts, placeOf } from "./position.ts";
import { parse } from "./markdown-read.ts";

export type Suppression = {
  readonly rules: readonly string[];
  /** A rule named only as `rule["text"]`: the matched texts its silenced findings must have. */
  readonly matching: Readonly<Record<string, readonly string[]>>;
  readonly reason: string | undefined;
  readonly line: number;
  /**
   * The last line it covers. `stet` (scope next): the end of the block right below the comment. `stet-begin` (scope range):
   * the line of its `stet-end`. Other scopes: the comment's last line.
   */
  readonly blockEnd: number;
  readonly scope: "next" | "section" | "file" | "range";
};

/** A stet that cannot do what it says, listed by `chaff suppressions` with the stets that give no reason. */
export type StetProblem = {
  readonly kind: "unclosed" | "stray-end" | "no-rules" | "unknown-rule" | "no-matched-text";
  readonly line: number;
  /** The rule entry as written, for unknown-rule and no-matched-text. */
  readonly rule?: string;
};

/**
 * 校正記号 stet（ラテン語で「そのままにせよ」）。
 * 指摘は一般には正しいが、この箇所は意図的だ、と書く手段。
 * これが無いと、残された手は「ルールごと切る」しかなくなる。workflow spec §7.1。
 *
 * 中身の切り分けは正規表現でやらない。入れ子の量指定子はバックトラックが超線形になり、
 * 長い HTML コメントを 1 つ置かれるだけで検査が止まる。ここは ">" を含まない塊として
 * 取り出し、あとはコードで割る。
 */
const PATTERN = /<!--\s*(stet|stet-section|stet-file|stet-begin)\s*:([^>]*)-->/gu;

/** A range's close carries nothing: what it closes and why are on its stet-begin. */
const END_PATTERN = /<!--\s*stet-end\s*-->/gu;

const SCOPE: Readonly<Record<string, Suppression["scope"]>> = { stet: "next", "stet-section": "section", "stet-file": "file", "stet-begin": "range" };

const scopeOf = (match: RegExpMatchArray): Suppression["scope"] => SCOPE[match[1] ?? "stet"] ?? "next";

/** 1-based line of an offset, from a table built once: a document can hold thousands of stets. */
const lineFinder = (source: string): ((offset: number) => number) => {
  const starts = lineStarts(source);
  return (offset) => placeOf(starts, offset).line;
};

type Read = Suppression & { readonly offset: number; readonly malformed: readonly string[] };

const readAll = (source: string, lineAt: (offset: number) => number): Read[] => {
  const matches = [...source.matchAll(PATTERN)];
  // Only a plain stet needs the tree, to find the block it stops at; a stet-file alone does not pay for a parse.
  const root = matches.some((match) => scopeOf(match) === "next") ? parse(source) : undefined;
  return matches.map((match) => {
    const comment = { start: match.index, end: match.index + match[0].length };
    const scope = scopeOf(match);
    return {
      ...readStetBody(match[2] ?? ""),
      line: lineAt(match.index),
      blockEnd: root !== undefined && scope === "next" ? stetBlockEnd(source, root, comment, lineAt) : lineAt(comment.end),
      scope,
      offset: match.index,
    };
  });
};

type Paired = { readonly closed: ReadonlyMap<Read, number>; readonly problems: readonly StetProblem[] };

/** Each stet-end closes the nearest open stet-begin above it, so ranges nest. What is left open, or closes nothing, is a problem. */
const pairRanges = (reads: readonly Read[], source: string, lineAt: (offset: number) => number): Paired => {
  const ends = [...source.matchAll(END_PATTERN)].map((match) => ({ offset: match.index, line: lineAt(match.index) }));
  const events = [...reads.filter((read) => read.scope === "range").map((read) => ({ offset: read.offset, begin: read })), ...ends].toSorted(
    (left, right) => left.offset - right.offset,
  );
  // A stack, not a fold: a document can hold thousands of ranges, and copying the state per comment is quadratic.
  const open: Read[] = [];
  const closed = new Map<Read, number>();
  const stray: number[] = [];
  events.forEach((event) => {
    if ("begin" in event) open.push(event.begin);
    else {
      const begin = open.pop();
      if (begin === undefined) stray.push(event.line);
      else closed.set(begin, event.line);
    }
  });
  const unclosed = open.map((read): StetProblem => ({ kind: "unclosed", line: read.line }));
  return { closed, problems: [...unclosed, ...stray.map((line): StetProblem => ({ kind: "stray-end", line }))] };
};

/** What chaff knows of each rule a stet may name: whether its findings carry the text they matched (`{matched}`). */
export type KnownRules = ReadonlyMap<string, { readonly showsMatched: boolean }>;

const showsMatched = (rule: Pick<RuleDefinition, "message" | "messages">): boolean =>
  [rule.message, ...Object.values(rule.messages)].some((message) => Object.values(message).some((text) => text.includes("{matched}")));

export const knownRulesOf = (rules: readonly Pick<RuleDefinition, "id" | "message" | "messages">[]): KnownRules =>
  new Map(rules.map((rule) => [rule.id, { showsMatched: showsMatched(rule) }]));

const ruleProblems = (read: Read, known: KnownRules | undefined): StetProblem[] => {
  const malformed = read.malformed.map((rule): StetProblem => ({ kind: "unknown-rule", line: read.line, rule }));
  const none: StetProblem[] = read.rules.length === 0 && read.malformed.length === 0 ? [{ kind: "no-rules", line: read.line }] : [];
  if (known === undefined) return [...none, ...malformed];
  const unknown = read.rules.filter((rule) => !known.has(rule)).map((rule): StetProblem => ({ kind: "unknown-rule", line: read.line, rule }));
  const blind = Object.keys(read.matching)
    .filter((rule) => known.get(rule)?.showsMatched === false)
    .map((rule): StetProblem => ({ kind: "no-matched-text", line: read.line, rule }));
  return [...none, ...malformed, ...unknown, ...blind];
};

const toSuppression = (read: Read, blockEnd: number): Suppression => ({
  rules: read.rules,
  matching: read.matching,
  reason: read.reason,
  line: read.line,
  blockEnd,
  scope: read.scope,
});

export type Parsed = { readonly suppressions: readonly Suppression[]; readonly problems: readonly StetProblem[] };

/** Every stet in the text, and what is wrong with any of them. A stet-begin with no stet-end silences nothing. */
export const readSuppressions = (source: string, known?: KnownRules): Parsed => {
  const lineAt = lineFinder(source);
  const reads = readAll(source, lineAt);
  const paired = pairRanges(reads, source, lineAt);
  const usable = reads.flatMap((read) => {
    if (read.scope !== "range") return [toSuppression(read, read.blockEnd)];
    const end = paired.closed.get(read);
    return end === undefined ? [] : [toSuppression(read, end)];
  });
  const problems = [...paired.problems, ...reads.flatMap((read) => ruleProblems(read, known))].toSorted((left, right) => left.line - right.line);
  return { suppressions: usable, problems };
};

export const parseSuppressions = (source: string): Suppression[] => [...readSuppressions(source).suppressions];

/** A finding's matched text is its `matched` value: what a rule shows as {matched} in its message. */
const matchesText = (suppression: Suppression, finding: Finding): boolean => {
  const texts = suppression.matching[finding.rule];
  return texts === undefined || texts.includes(String(finding.values["matched"] ?? ""));
};

/** stet が効く範囲。next は直後の塊（段落・見出し・箇条書き・表）の終わりまで、range は stet-end まで、section は次の見出しまで、file は全体。 */
const covers = (suppression: Suppression, finding: Finding, sectionEnds: readonly number[], lastLine: number): boolean => {
  if (!suppression.rules.includes(finding.rule) || !matchesText(suppression, finding)) return false;
  if (suppression.scope === "file") return true;
  // 抑制は「この先の箇所」に対して書く。遡って効くと、意図せず黙る範囲が広がる。
  if (finding.line < suppression.line) return false;
  if (suppression.scope === "next" || suppression.scope === "range") return finding.line <= suppression.blockEnd;
  return finding.line <= (sectionEnds.find((line) => line > suppression.line) ?? lastLine);
};

export type Suppressed = { readonly finding: Finding; readonly suppression: Suppression };

export type Applied = {
  readonly kept: readonly Finding[];
  readonly suppressed: readonly Suppressed[];
  readonly unusedReasonless: readonly Suppression[];
  /** Every rule a stet in the document names, whether or not it silenced anything. */
  readonly named: readonly string[];
  /** Every stet-begin … stet-end in the document, for `chaff suppressions` to list with its lines and reason. */
  readonly ranges: readonly Suppression[];
  readonly problems: readonly StetProblem[];
};

export const applySuppressions = (source: string, findings: readonly Finding[], sections: readonly Span[], known?: KnownRules): Applied => {
  const { suppressions, problems } = readSuppressions(source, known);
  const lineAt = lineFinder(source);
  const sectionEnds = sections.map((span) => lineAt(span.end));
  const lastLine = source.split("\n").length;
  const matched = findings.map((finding) => ({ finding, suppression: suppressions.find((entry) => covers(entry, finding, sectionEnds, lastLine)) }));
  return {
    kept: matched.filter((entry) => entry.suppression === undefined).map((entry) => entry.finding),
    suppressed: matched.flatMap((entry) => (entry.suppression === undefined ? [] : [{ finding: entry.finding, suppression: entry.suppression }])),
    unusedReasonless: suppressions.filter((entry) => entry.reason === undefined),
    named: [...new Set(suppressions.flatMap((entry) => entry.rules))],
    ranges: suppressions.filter((entry) => entry.scope === "range"),
    problems,
  };
};
