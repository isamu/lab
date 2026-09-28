// A reference into another document: "Section 9 of the Master Agreement" is not this document's Section 9.

const OF = /^,? of (?:the |that |those )?/u;
/** "section 4(2)(a) (exception to liability …) of the Damages (Scotland) Act 2011": the gloss sits between the number and the name. */
const GLOSS = /^ \([^()]{1,100}\)/u;
const CONNECTOR = /^(?:,? (?:to|and|or)|,) /u;
/** "9", "29(2)", "(g)", and a roman "V" for a list of Articles. The roman numeral must end the word: "VIII", not "Vendor". */
const LISTED_NUMBERS = [/^\d{1,3}[A-Z]{0,2}(?:\([a-z0-9]{1,4}\))*/u, /^(?:\([a-z0-9]{1,4}\))+/u, /^[IVXLC]{1,7}\b/u];

const listedNumber = (text: string): string | undefined => LISTED_NUMBERS.map((pattern) => pattern.exec(text)?.[0]).find((found) => found !== undefined);

/**
 * A listed number is a reference only where the list goes on or ends: "Sections 1, 2 and 9 of" or "Section 3 and 4." —
 * not "Section 3 and 4 days", where the 4 counts days.
 */
const MEMBER_END = /^(?:$|[,;.:)]|\s(?:to|and|or|of)\b|\s\()/u;

export type ListMember = { readonly start: number; readonly text: string };

/** Every number listed after a reference, with where it ends. `start` is from the start of `rest`. */
const listed = (rest: string): (ListMember & { readonly end: number })[] => {
  const found: (ListMember & { end: number })[] = [];
  let end = 0;
  for (;;) {
    const connector = CONNECTOR.exec(rest.slice(end))?.[0];
    const number = connector === undefined ? undefined : listedNumber(rest.slice(end + connector.length));
    if (connector === undefined || number === undefined) return found;
    const start = end + connector.length;
    end = start + number.length;
    found.push({ start, text: number, end });
  }
};

/** "Article 58(2)(c) to (g) and (j) of the UK GDPR": the list runs on to the name that governs all of it. */
const listEnd = (rest: string): number => listed(rest).at(-1)?.end ?? 0;

/**
 * The members after a reference, "2" and "9" in "Sections 1, 2 and 9". After a plural ("Sections") every listed number
 * is one; after a singular ("Section 3 and 4 days") only one where the list goes on or ends.
 */
export const listMembers = (rest: string, plural: boolean): ListMember[] =>
  listed(rest)
    .filter((member) => plural || MEMBER_END.test(rest.slice(member.end)))
    .map(({ start, text }) => ({ start, text }));

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
  const rest = text.slice(end, end + 200);
  const afterList = listEnd(rest);
  const listed = afterList + (GLOSS.exec(rest.slice(afterList))?.[0].length ?? 0);
  const of = OF.exec(rest.slice(listed));
  if (of === null) return undefined;
  const words = titleWords(rest.slice(listed + of[0].length));
  if (words.length === 0) return undefined;
  const name = words.join(" ");
  return words.length === 1 && SELF.has(name) ? undefined : name;
};
