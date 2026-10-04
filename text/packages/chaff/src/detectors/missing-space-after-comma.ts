import type { Detector, Finding } from "../plugin.ts";
import { quoteAround } from "./quote-around.ts";

// A comma between two words with no space after it ("address,and"): a slip in English prose. A run of values joined by
// commas ("blue,black,brown"), and anything inside an address, a path or an assignment, is data, not prose.

/** One comma with no space after it, where it is, and the two words it joins as written. */
export type TightComma = { readonly offset: number; readonly written: string };

/** A word of three letters or more (a possessive 's may follow), a comma, and a lower-case word of three letters or more. */
const JOINED = /(?<![\p{L}\p{N}])[A-Za-z]{3,}(?:['’]s)?,[a-z]{3,}(?![\p{L}\p{N}])/u;
/** Characters that make a run of text an address, a path, a parameter or data (a=b, a/b, a.b, @a, #a, a_b, 3,abc). */
const DATA_MARK = /[/\\=@#:.&?_|+*~$%^<>{}[\]\p{N}]/u;
/** Opening and closing marks a word of prose may carry ("(and,then)"), and the sentence's own end ("and,then."). */
const OPENERS = "(\"'“‘[";
const CLOSERS = ")\"'”’].,;!?";
/** A run quoted whole, inside brackets or not ("true,false", ("true,false")): a value written out, not two words of the sentence. */
const QUOTED_WHOLE = /^[([]*["'“‘].*["'”’][)\].,;!?]*$/u;
/** A run of text between whitespace. */
const RUN = /\S+/gu;
const COMMA = ",";

/** The run without the marks around it, trimmed by scanning rather than by a pattern that could backtrack. */
const bareOf = (run: string): string => {
  const chars = run.split("");
  const start = chars.findIndex((char) => !OPENERS.includes(char));
  const end = chars.findLastIndex((char) => !CLOSERS.includes(char));
  return start === -1 || end < start ? "" : run.slice(start, end + 1);
};

/** A run holding one comma and nothing that marks it as data. */
const isProseRun = (run: string): boolean => {
  const bare = bareOf(run);
  return bare.split(COMMA).length === 2 && !DATA_MARK.test(bare) && !QUOTED_WHOLE.test(run);
};

/** Each run is read once, so a long line of values costs one pass. */
export const tightCommasIn = (text: string): TightComma[] =>
  [...text.matchAll(RUN)].flatMap((run) => {
    const joined = isProseRun(run[0]) ? JOINED.exec(run[0]) : null;
    return joined === null ? [] : [{ offset: run.index + joined.index + joined[0].indexOf(COMMA), written: joined[0] }];
  });

export const missingSpaceAfterComma: Detector = (doc): Finding[] => {
  const text = doc.prose ?? doc.source;
  return tightCommasIn(text).map((comma) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, comma.offset, comma.offset + 1),
    values: { written: comma.written, offset: comma.offset },
  }));
};
