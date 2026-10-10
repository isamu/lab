import { escapeRegExp } from "../orthography.ts";

// 期間の名前（第2四半期、Q2、FY2026、2026年3月期、上期）を読む。純関数: 書き方は語彙表から受け取る。
// 書き方の {n} は四半期や半期の番号、{y} は年、{e} は期間の終わる年、{m} は月、{_} は値に入らない短い語（Fiscal Year Ending {_} {e} の日付）。
// FY2026 が 2026 年に始まる年か終わる年かは会社で違うので、{y} の名前と {e} の名前は比べない。
// 番号を書かない書き方（Second Quarter、上期）は、同じ期間の番号付きの書き方を instead_of に持つ。

export type PeriodFrame = { readonly pattern: string; readonly kind: string; readonly insteadOf?: string | undefined };

/** 文の中の期間の名前一つ。shape は値に使った部分（y,m なら年と月）で、同じ shape どうしだけを比べる。order は前後を比べる数。 */
export type PeriodLabel = {
  readonly start: number;
  readonly end: number;
  readonly written: string;
  readonly kind: string;
  readonly shape: string;
  readonly value: string;
  readonly order: number;
  /** 年を持たない名前（四半期、半期）。一年の中の一部を言う。 */
  readonly withinYear: boolean;
};

export type CompiledFrame = { readonly regex: RegExp; readonly kind: string; readonly insteadOf: string | undefined };

const PLACEHOLDER = /\{([nyem_])\}/gu;
const SLOT: Readonly<Record<string, string>> = {
  n: "(?<n>[1-4１-４])",
  y: "(?<y>[0-9０-９]{4})",
  e: "(?<e>[0-9０-９]{4})",
  m: "(?<m>[0-9０-９]{1,2})",
  _: "[^\\n|。.!?]{1,24}?",
};
const BEFORE = "(?<![A-Za-z0-9０-９])";
const AFTER = "(?![A-Za-z0-9０-９])";

const literal = (text: string): string => escapeRegExp(text).replaceAll(" ", "[ \\t\\u00a0]+");

const bodyOf = (pattern: string): string =>
  pattern
    .split(PLACEHOLDER)
    .map((piece, index) => (index % 2 === 1 ? (SLOT[piece] ?? "") : literal(piece)))
    .join("");

const startsAlnum = (pattern: string): boolean => /^(?:[A-Za-z0-9]|\{[nyem]\})/u.test(pattern);
const endsAlnum = (pattern: string): boolean => /(?:[A-Za-z0-9]|\{[nyem]\})$/u.test(pattern);

const compile = (frame: PeriodFrame): CompiledFrame => ({
  regex: new RegExp(`${startsAlnum(frame.pattern) ? BEFORE : ""}${bodyOf(frame.pattern)}${endsAlnum(frame.pattern) ? AFTER : ""}`, "giu"),
  kind: frame.kind,
  insteadOf: frame.insteadOf,
});

export const compileFrames = (frames: readonly PeriodFrame[]): readonly CompiledFrame[] => frames.filter((frame) => frame.pattern !== "").map(compile);

const halfWidth = (digits: string): string => digits.replace(/[０-９]/gu, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));

const KEY_ORDER = ["y", "e", "m", "n"] as const;

type Parts = Readonly<Partial<Record<(typeof KEY_ORDER)[number], number>>>;

const partsOf = (groups: Readonly<Record<string, string | undefined>> | undefined): Parts =>
  Object.fromEntries(KEY_ORDER.flatMap((key) => (groups?.[key] === undefined ? [] : [[key, Number(halfWidth(groups[key]))]])));

/** 番号を書かない書き方の値は、instead_of に書いた番号付きの書き方から読む。 */
const insteadParts = (insteadOf: string, frames: readonly CompiledFrame[], kind: string): Parts | undefined => {
  const frame = frames.find(
    (candidate) => candidate.kind === kind && candidate.insteadOf === undefined && new RegExp(`^(?:${candidate.regex.source})$`, "iu").test(insteadOf),
  );
  if (frame === undefined) return undefined;
  return partsOf(new RegExp(`^(?:${frame.regex.source})$`, "iu").exec(insteadOf)?.groups);
};

const labelOf = (match: RegExpExecArray, parts: Parts, kind: string): PeriodLabel | undefined => {
  const keys = KEY_ORDER.filter((key) => parts[key] !== undefined);
  if (keys.length === 0) return undefined;
  return {
    start: match.index,
    end: match.index + match[0].length,
    written: match[0],
    kind,
    shape: keys.join(","),
    value: keys.map((key) => `${key}${String(parts[key])}`).join(","),
    order: keys.reduce((sum, key) => sum * 100 + (parts[key] ?? 0), 0),
    withinYear: parts.y === undefined && parts.e === undefined,
  };
};

const matchesOf = (text: string, frame: CompiledFrame, frames: readonly CompiledFrame[]): PeriodLabel[] =>
  [...text.matchAll(frame.regex)].flatMap((match) => {
    const parts = frame.insteadOf === undefined ? partsOf(match.groups) : insteadParts(frame.insteadOf, frames, frame.kind);
    const label = parts === undefined ? undefined : labelOf(match, parts, frame.kind);
    return label === undefined ? [] : [label];
  });

const overlaps = (left: PeriodLabel, right: PeriodLabel): boolean => left.start < right.end && right.start < left.end;

/** 文の中の期間の名前。同じ種類の名前が重なれば長いほう（Fiscal Year Ending … 2027 の中の Year Ending … 2027 は一つ）。 */
export const periodLabelsIn = (text: string, frames: readonly CompiledFrame[]): PeriodLabel[] => {
  const all = frames.flatMap((frame) => matchesOf(text, frame, frames)).toSorted((left, right) => right.written.length - left.written.length);
  const kept: PeriodLabel[] = [];
  all.forEach((label) => {
    if (!kept.some((other) => other.kind === label.kind && overlaps(other, label))) kept.push(label);
  });
  return kept.toSorted((left, right) => left.start - right.start);
};
