// The part of a subject line that is a reference number, not words to read.

/** A closing bracket's pair, for a reference in brackets at the subject's end. */
const OPENING_OF: Readonly<Record<string, string>> = { ")": "(", "）": "（", "]": "[", "］": "［", "】": "【" };
const CODE_CHARACTER = /[\w#-]/u;
const DIGIT = /\d/u;
const LATIN_OR_HASH = /[A-Za-z#]/u;
/** A run of digits this long is a number to look up even with no letter (請求番号 2026103101). */
const MIN_DIGIT_RUN = 5;

/** The runs of code characters (A-20481, #58213) in a text. */
const codesIn = (text: string): string[] =>
  [...text].reduce<string[]>(
    (codes, char) => {
      if (!CODE_CHARACTER.test(char)) return codes.at(-1) === "" ? codes : [...codes, ""];
      return [...codes.slice(0, -1), `${codes.at(-1) ?? ""}${char}`];
    },
    [""],
  );

/** An order, ticket or invoice number: a code with a digit and a Latin letter or "#", or a long run of digits. */
const isReferenceCode = (code: string): boolean =>
  DIGIT.test(code) && (LATIN_OR_HASH.test(code) || (code.length >= MIN_DIGIT_RUN && [...code].every((char) => DIGIT.test(char))));

/**
 * "…について（ご注文番号：A-20481）" counts as "…について": a reference number in brackets at the end is what the reader
 * searches the inbox for, not words to read, so its length does not make a subject long.
 */
export const withoutReferenceSuffix = (subject: string): string => {
  const trimmed = subject.trimEnd();
  const opening = OPENING_OF[trimmed.at(-1) ?? ""];
  if (opening === undefined) return subject;
  const start = trimmed.lastIndexOf(opening);
  if (start <= 0) return subject;
  return codesIn(trimmed.slice(start + 1, -1)).some(isReferenceCode) ? trimmed.slice(0, start).trimEnd() : subject;
};
