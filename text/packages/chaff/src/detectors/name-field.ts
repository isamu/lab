/** How many characters a line may add to the long name and still be a line that only names the party. */
export const SLACK = 12;

/** A field label on its own line, after a list marker (Attention:, 宛先：): short, and not a sentence. */
const FIELD_LABEL = /^(?:[-*+]\s+)?[^:：。.]{1,20}[:：]\s*/u;
/**
 * What may follow the name in an address field: nothing, a comma and the next part (, Member Support), or a space and a part
 * that does not go on in lower case (株式会社みなと 総務部). A particle or a verb (は支払う, shall pay) makes the line a sentence.
 */
const NEXT_PART = /^\.?(?:$|\s*[,、，]|\s+(?!\p{Ll}))/u;
export const CLOSES_SENTENCE = /[.。!?！？]$/u;

/** A field whose value is the name and a little more, not a sentence (Attention: Hibari Lab Inc., Member Support). */
export const isNameField = (line: string, name: string): boolean => {
  const label = FIELD_LABEL.exec(line);
  const value = label === null ? "" : line.slice(label[0].length);
  const rest = value.slice(name.length);
  return value.startsWith(name) && NEXT_PART.test(rest) && [...rest].length <= SLACK * 2 && !CLOSES_SENTENCE.test(rest.slice(1));
};

/**
 * After the name on a signature line, the parts of an address: each after a comma or a space, none in lower case, and no
 * 、 (Hibari Lab Inc., Customer Support; 株式会社みなと 総務部). A lower-case word or a 、 goes on as a sentence (, as Supplier, shall pay).
 */
const ADDRESS_PARTS = /^\.?(?:,?\s+[^\s,、，\p{Ll}][^\s,、，]*)*$/u;

/** A line with no label that is the name and the parts of an address: a signature (Hibari Lab Inc., Customer Support). */
export const isSignatureLine = (line: string, name: string): boolean => {
  const rest = line.slice(name.length);
  return line.startsWith(name) && [...rest].length <= SLACK * 2 && ADDRESS_PARTS.test(rest);
};

const linesOf = (text: string): string[] => text.split(/\r?\n/u).map((line) => line.trim());

/**
 * The line from lineStart to lineEnd opens the closing block: a blank line (or nothing) before it, and no sentence after it to
 * the end (a phone number, an address).
 */
export const opensClosingBlock = (source: string, lineStart: number, lineEnd: number): boolean => {
  const before = linesOf(source.slice(0, lineStart)).slice(0, -1);
  const after = linesOf(source.slice(lineEnd));
  return (before.length === 0 || before.at(-1) === "") && after.every((line) => !CLOSES_SENTENCE.test(line));
};
