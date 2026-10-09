import type { Span } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";

export type UnitCount = Span & { readonly amount: number };

const LATIN_UNIT = /^[a-z]+$/iu;

/** 数字と単位（3泊、3 nights、15回）。英字の単位は語の切れ目まで。Pure. */
export const numeralCounts = (text: string, units: readonly string[]): UnitCount[] =>
  units.flatMap((unit) => {
    const tail = LATIN_UNIT.test(unit) ? "(?![\\p{L}\\p{N}])" : "";
    const pattern = new RegExp(`(?<![\\p{N}.,])(\\p{Nd}+)\\s?${escapeRegExp(unit)}${tail}`, "giu");
    return [...text.matchAll(pattern)].map((match) => ({
      start: match.index,
      end: match.index + match[0].length,
      amount: Number((match[1] ?? "").normalize("NFKC")),
    }));
  });
