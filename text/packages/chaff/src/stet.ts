import type { Finding, Span } from "./plugin.ts";

export type Suppression = {
  readonly rules: readonly string[];
  readonly reason: string | undefined;
  readonly line: number;
  readonly scope: "next" | "section" | "file";
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
const PATTERN = /<!--\s*(stet|stet-section|stet-file)\s*:([^>]*)-->/gu;

const SCOPE: Readonly<Record<string, Suppression["scope"]>> = { stet: "next", "stet-section": "section", "stet-file": "file" };

/** 理由は em dash のあと。書かなくてもよいが、書かないと chaff suppressions に並ぶ。 */
const REASON_MARK = "\u2014";

const RULE_ID = /^[a-z][a-z0-9-]*$/u;

const lineOf = (source: string, offset: number): number => source.slice(0, offset).split("\n").length;

const splitBody = (body: string): { rules: string[]; reason: string | undefined } => {
  const at = body.indexOf(REASON_MARK);
  const head = at === -1 ? body : body.slice(0, at);
  // 残っているのはコメント終端の "--" だけ。正規表現で任意個の "-" を剥がすと、
  // 長いダッシュ列でバックトラックする（そして著者が書いたダッシュまで消す）。
  const raw = at === -1 ? "" : body.slice(at + REASON_MARK.length);
  const tail = (raw.endsWith("--") ? raw.slice(0, -2) : raw).trim();
  return {
    rules: head
      .split(",")
      .map((rule) => rule.trim())
      .filter((rule) => RULE_ID.test(rule)),
    reason: tail.length === 0 ? undefined : tail,
  };
};

export const parseSuppressions = (source: string): Suppression[] =>
  [...source.matchAll(PATTERN)].map((match) => ({
    ...splitBody(match[2] ?? ""),
    line: lineOf(source, match.index),
    scope: SCOPE[match[1] ?? "stet"] ?? "next",
  }));

/** stet が効く範囲。next は直後の塊、section は次の見出しまで、file は全体。 */
const NEXT_LINES = 6;

const covers = (suppression: Suppression, finding: Finding, sectionEnds: readonly number[], lastLine: number): boolean => {
  if (!suppression.rules.includes(finding.rule)) return false;
  if (suppression.scope === "file") return true;
  // 抑制は「この先の箇所」に対して書く。遡って効くと、意図せず黙る範囲が広がる。
  if (finding.line < suppression.line) return false;
  if (suppression.scope === "next") return finding.line - suppression.line <= NEXT_LINES;
  return finding.line <= (sectionEnds.find((line) => line > suppression.line) ?? lastLine);
};

export type Suppressed = { readonly finding: Finding; readonly suppression: Suppression };

export type Applied = { readonly kept: readonly Finding[]; readonly suppressed: readonly Suppressed[]; readonly unusedReasonless: readonly Suppression[] };

export const applySuppressions = (source: string, findings: readonly Finding[], sections: readonly Span[]): Applied => {
  const suppressions = parseSuppressions(source);
  const sectionEnds = sections.map((span) => lineOf(source, span.end));
  const lastLine = source.split("\n").length;
  const matched = findings.map((finding) => ({ finding, suppression: suppressions.find((entry) => covers(entry, finding, sectionEnds, lastLine)) }));
  return {
    kept: matched.filter((entry) => entry.suppression === undefined).map((entry) => entry.finding),
    suppressed: matched.flatMap((entry) => (entry.suppression === undefined ? [] : [{ finding: entry.finding, suppression: entry.suppression }])),
    unusedReasonless: suppressions.filter((entry) => entry.reason === undefined),
  };
};
