// contact-variant: one email address or postal address written two ways in one document (contacts/emails.ts,
// contacts/addresses.ts). The address labels come from the language's address-label lexicon; a two-column table row named
// by one is read as that label's line for addresses (contacts/table-rows.ts); emails in tables stay unread.
import { addressVariants } from "../contacts/addresses.ts";
import { emailVariants } from "../contacts/emails.ts";
import { proseWithLabelledRows } from "../contacts/table-rows.ts";
import { proseAndTablesOf } from "../table-text.ts";
import type { Variant, Writing } from "../contacts/variants.ts";
import { quoteAt } from "./structure-tree.ts";
import type { Detector, Finding } from "../plugin.ts";

const findingOf = (source: string, { writing, other }: Variant<Writing>, variant?: string): Finding => ({
  rule: "",
  severity: "info",
  line: 0,
  column: 0,
  quote: quoteAt(source, writing.offset),
  values: { written: writing.written, other: other.written, offset: writing.offset },
  ...(variant === undefined ? {} : { variant }),
});

export const contactVariant: Detector = (doc, options): Finding[] => {
  const labels = options.lexicon ?? [];
  const text = doc.prose ?? doc.source;
  const emails = emailVariants(text).map((found) => findingOf(doc.source, found));
  const addresses = addressVariants(proseWithLabelledRows(text, proseAndTablesOf(doc), labels), labels).map(({ variant, found }) =>
    findingOf(doc.source, found, variant),
  );
  return [...emails, ...addresses].toSorted((a, b) => Number(a.values?.["offset"]) - Number(b.values?.["offset"]));
};
