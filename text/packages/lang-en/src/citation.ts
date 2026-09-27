// A reference into another document: "Section 9 of the Master Agreement" is not this document's Section 9.

const OF = /^,? of (?:the )?/u;
const CAPITALISED = /^[A-Z][\w'’-]*/u;
/**
 * How a document names itself. "Section 3 of the Agreement" in an agreement means this one.
 * "the Act" and "the Code" are left out: a statute calls itself "this Act", and a contract's "the Act" is a law it cites.
 */
const SELF = new Set(["Agreement", "Contract", "Terms", "Policy"]);
/** Words that may sit inside a title: "Code of Federal Regulations". */
const JOINERS = new Set(["of", "and", "for", "on"]);
const MAX_WORDS = 8;

/** Capitalised words from the start of `rest`, allowing a joiner between two of them. Punctuation ends the title. */
const titleWords = (rest: string): string[] => {
  const tokens = rest.split(" ");
  const words: string[] = [];
  for (let index = 0; index < tokens.length && words.length < MAX_WORDS; index += 1) {
    const token = tokens[index] ?? "";
    const word = CAPITALISED.exec(token)?.[0];
    const joins = word === undefined && words.length > 0 && JOINERS.has(token) && CAPITALISED.test(tokens[index + 1] ?? "");
    if (word === undefined && !joins) break;
    words.push(word ?? token);
    if (word !== undefined && word.length < token.length) break;
  }
  return words;
};

/**
 * The document named right after a reference, or undefined when the reference is into this document.
 * "of this Agreement" and "of the Agreement" are this document; "of the Master Agreement" is another.
 */
export const citedDocumentAfter = (text: string, end: number): string | undefined => {
  const rest = text.slice(end, end + 120);
  const of = OF.exec(rest);
  if (of === null) return undefined;
  const words = titleWords(rest.slice(of[0].length));
  if (words.length === 0) return undefined;
  const name = words.join(" ");
  return words.length === 1 && SELF.has(name) ? undefined : name;
};
