/**
 * A comma or question mark at the edge of a lexicon pattern (、正直 / honestly,) only says where the phrase stands
 * in the sentence; the message quotes the phrase without it. A period is kept: it may end an abbreviation (etc.).
 */
const EDGE_MARKS: ReadonlySet<string> = new Set([" ", "、", "，", ",", "?", "？"]);

const isEdgeMark = (char: string): boolean => EDGE_MARKS.has(char);

export const quotedPattern = (pattern: string): string => {
  const chars = [...pattern];
  const start = chars.findIndex((char) => !isEdgeMark(char));
  const end = chars.findLastIndex((char) => !isEdgeMark(char));
  return start === -1 ? pattern : chars.slice(start, end + 1).join("");
};
