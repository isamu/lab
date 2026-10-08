// parameter-table-mismatch: a parameter table that names a parameter the signature above it does not take, or leaves out
// one it does (parameter-table.ts). The header words of a parameter table come from the parameter-header lexicon.
import { quoteAt } from "./structure-tree.ts";
import { parameterSlips } from "../parameter-table.ts";
import type { Detector, Finding } from "../plugin.ts";

export const parameterTable: Detector = (doc): Finding[] => {
  const headers = new Set((doc.lexicons["parameter-header"] ?? []).map((entry) => entry.pattern.toLowerCase()));
  return parameterSlips(doc.source, headers).map((slip) => ({
    rule: "parameter-table-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, slip.offset),
    values: { name: slip.name, function: slip.fn, side: slip.side, offset: slip.offset },
  }));
};
