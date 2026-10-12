import type { Span } from "../plugin.ts";
import type { FactValue } from "./fact-values.ts";
import { withoutEdgeMarks } from "./trim-marks.ts";

/**
 * 数えた数で始まる名前（「1箱の重さ」「1人あたりの料金」）。数は名前の一部で、「2箱の重さ」は別の項目。
 * 年や月や日付で始まる名前（「2026年の売上」）は、数えた数ではないので読まない。数える語と続きの語は言語パッケージの語彙表から取る。
 */
export type CountLabelWords = { readonly counters: readonly string[]; readonly links: readonly string[] };

const LETTER = /\p{L}/u;

const normalized = (text: string): string => text.normalize("NFKC");

/** value が、cell の頭に書いた数えた数で、そのすぐ後ろに続きの語と名前の字があるか。 */
export const isCountLabelHead = (source: string, cell: Span, value: FactValue, words: CountLabelWords): boolean => {
  if (value.kind !== "quantity" || withoutEdgeMarks(source.slice(cell.start, value.start)) !== "") return false;
  if (!words.counters.some((counter) => normalized(counter) === value.unit)) return false;
  const after = source.slice(value.end, cell.end);
  const link = words.links.find((word) => after.startsWith(word));
  return link !== undefined && LETTER.test(after.slice(link.length));
};
