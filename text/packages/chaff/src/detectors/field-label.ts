// The label of a field that opens a line ("Current project status: Ongoing", 「現在の状況：継続中」). Pure.

/** A label is a short name, not a clause: this many words at most. */
const MAX_LABEL_WORDS = 5;
const MAX_LABEL_CHARS = 40;
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/u;
const FIELD = /^([^:：\n]+)[:：](?!\/\/)/u;
const HAS_LETTER = /\p{L}/u;
/** A sentence ends before the colon, so what precedes it is not a label. */
const SENTENCE_END = /[.!?。！？]/u;

const isLabel = (label: string): boolean =>
  HAS_LETTER.test(label) && !SENTENCE_END.test(label) && label.length <= MAX_LABEL_CHARS && label.trim().split(/\s+/u).length <= MAX_LABEL_WORDS;

/**
 * Where the value of a field on the text's first line starts, just past the colon (the value may be blank), or undefined
 * when the first line opens with no label. Whether the label is a name and not a clause ("The following apply:") is the
 * caller's to judge from the parts of speech.
 */
export const fieldValueStart = (text: string): number | undefined => {
  const marker = LIST_MARKER.exec(text)?.[0] ?? "";
  const field = FIELD.exec(text.slice(marker.length));
  if (field?.[1] === undefined || !isLabel(field[1].replaceAll("**", ""))) return undefined;
  return marker.length + field[0].length;
};
