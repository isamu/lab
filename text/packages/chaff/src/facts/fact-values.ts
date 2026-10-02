import type { Span, StructureNode } from "../plugin.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import { overlapsAny, spanIndex, type SpanIndex } from "../compare/spans.ts";

/**
 * 値として読むもの。木の数量と日付（`chaff compare` と同じ読み）と、品詞の読める言語では固有名詞。
 * key は値の正体で、書き方が違っても同じ値なら同じ（3,000円と3000円、10月5日と10/5）。
 */
export type ValueKind = "quantity" | "date" | "name";

export type FactValue = Span & { readonly kind: ValueKind; readonly key: string; readonly unit: string };

const attr = (node: StructureNode, name: string): string => String(node.attrs[name] ?? "");

/** 数の前に書いた単位（$300、$ 300）があれば、その始まり。木の数量は数から始まる。 */
const startWithUnitBefore = (source: string, start: number, unit: string): number => {
  if (unit === "") return start;
  const gap = source[start - 1] === " " ? 1 : 0;
  const from = start - gap - unit.length;
  return from >= 0 && source.slice(from, start - gap) === unit ? from : start;
};

/** 数のすぐ後ろに書いた単位（25%の%）。木の数量は単位の前で終わることがある。 */
const endWithUnitAfter = (source: string, end: number, unit: string): number => (unit !== "" && source.startsWith(unit, end) ? end + unit.length : end);

const nodeValue = (node: StructureNode, source: string): FactValue[] => {
  if (node.kind === "date") return [{ start: node.span.start, end: node.span.end, kind: "date", key: attr(node, "value"), unit: "" }];
  if (node.kind !== "quantity") return [];
  const unit = attr(node, "unit");
  return [
    {
      start: startWithUnitBefore(source, node.span.start, unit),
      end: endWithUnitAfter(source, node.span.end, unit),
      kind: "quantity",
      key: attr(node, "value"),
      unit: unit.normalize("NFKC"),
    },
  ];
};

/**
 * 単位を書かない数（「Seats: 40」）。前後が字や数や時刻の : でないもの。1.2.3 のような版の番号は数にしない。
 * 単位の無い数は、単位の無い数とだけ比べる。
 */
const BARE_NUMBER = /(?<![\p{L}\p{N}.,:/-])[0-9０-９]+(?:[,，][0-9０-９]{3})*(?:[.．][0-9０-９]+)?(?![\p{L}\p{N}%:/,，-]|[.．][0-9０-９])/gu;

const bareValues = (source: string, taken: SpanIndex): FactValue[] =>
  [...source.matchAll(BARE_NUMBER)].flatMap((match): FactValue[] => {
    const span = { start: match.index, end: match.index + match[0].length };
    if (overlapsAny(taken, span)) return [];
    const key = String(Number(match[0].normalize("NFKC").replace(/,/gu, "")));
    return [{ ...span, kind: "quantity", key, unit: "" }];
  });

/** 木の数量と日付、それと重ならない固有名詞と、単位を書かない数。文書の中の順に並べる。 */
export const factValues = (tree: StructureNode, source: string, names: readonly Span[]): FactValue[] => {
  const tagged = inDocumentOrder(tree).flatMap((node) => nodeValue(node, source));
  const taken = spanIndex(tagged);
  const named = names
    .filter((name) => !overlapsAny(taken, name))
    .map((name): FactValue => ({ start: name.start, end: name.end, kind: "name", key: source.slice(name.start, name.end).normalize("NFKC"), unit: "" }));
  const bare = bareValues(source, spanIndex([...tagged, ...named]));
  return [...tagged, ...named, ...bare].toSorted((left, right) => left.start - right.start);
};

/** 日付の書き方の細かさ。年月日、年月、月日。違う細かさどうしは、重なる部分だけを比べる。 */
const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const YEAR_MONTH = /^\d{4}-\d{2}$/u;
const MONTH_DAY = /^\d{2}-\d{2}$/u;

type Precision = "full" | "year-month" | "month-day" | "other";

const precisionOf = (key: string): Precision => {
  if (FULL_DATE.test(key)) return "full";
  if (YEAR_MONTH.test(key)) return "year-month";
  return MONTH_DAY.test(key) ? "month-day" : "other";
};

const YEAR_MONTH_LENGTH = 7;
const MONTH_DAY_FROM = 5;

/** 年月日の日付を、もう一方の細かさに揃える。揃えられなければ undefined。 */
const narrowed = (full: string, other: string, precision: Precision): [string, string] | undefined => {
  if (precision === "month-day") return [full.slice(MONTH_DAY_FROM), other];
  return precision === "year-month" ? [full.slice(0, YEAR_MONTH_LENGTH), other] : undefined;
};

/** 二つの日付を比べられる形。比べられなければ undefined（年月と月日には重なる部分が無い）。 */
const comparableDates = (left: string, right: string): [string, string] | undefined => {
  const [a, b] = [precisionOf(left), precisionOf(right)];
  if (a === b) return a === "other" && left !== right ? undefined : [left, right];
  if (a === "full") return narrowed(left, right, b);
  if (b !== "full") return undefined;
  const pair = narrowed(right, left, a);
  return pair === undefined ? undefined : [pair[1], pair[0]];
};

/** 同じ種類の値で、比べられるもの。数量は同じ単位どうし（単位の違いは別の rule が見る）。 */
export const comparable = (left: FactValue, right: FactValue): boolean => {
  if (left.kind !== right.kind) return false;
  if (left.kind === "quantity") return left.unit === right.unit;
  return left.kind !== "date" || comparableDates(left.key, right.key) !== undefined;
};

/** 比べられる二つの値が同じか。月日だけの日付は、年まで書いた日付の月日と同じなら同じ。 */
export const sameValue = (left: FactValue, right: FactValue): boolean => {
  if (left.kind !== "date") return left.key === right.key;
  const pair = comparableDates(left.key, right.key);
  return pair !== undefined && pair[0] === pair[1];
};
