/**
 * A curly double quote written as the inch mark: a decimal number, then the mark, then a unit (".015 “Hg/hr",
 * "29.92”Hg"). It quotes nothing, so it opens and closes nothing. text is the section, offset the mark's position.
 */

/**
 * A number with a decimal part right before the mark, with at most one space between. A year or a count never has one,
 * so "In 1969 “Hurricane Camille struck" stays an unclosed quote.
 */
const DECIMAL_BEFORE = /\.\p{Nd}+[ \u00A0]?$/u;

/** A short run of letters right after the mark: the unit (Hg, in). */
const UNIT_AFTER = /^\p{L}{1,3}(?!\p{L})/u;

const LOOK_AROUND = 40;
const OPENING = "\u201C";
const CLOSING = "\u201D";

/** Where the paragraph holding offset ends: the next blank line, or the end of the text. */
const paragraphEnd = (text: string, offset: number): number => {
  const blank = /\n[ \t\u3000]*\n/u.exec(text.slice(offset));
  return blank === null ? text.length : offset + blank.index;
};

const betweenNumberAndUnit = (text: string, offset: number): boolean =>
  DECIMAL_BEFORE.test(text.slice(Math.max(0, offset - LOOK_AROUND), offset)) && UNIT_AFTER.test(text.slice(offset + 1, offset + 1 + LOOK_AROUND));

/** A closing mark in rest that is not taken by an opening mark written after the start of rest. */
const closesEarlier = (rest: string): boolean => {
  const depth = { open: 0, closed: false };
  [...rest].forEach((mark) => {
    if (depth.closed) return;
    if (mark === OPENING) depth.open += 1;
    else if (mark === CLOSING && depth.open === 0) depth.closed = true;
    else if (mark === CLOSING) depth.open -= 1;
  });
  return depth.closed;
};

/**
 * The mark at offset is an inch mark. An opening mark is one only when nothing in its paragraph closes it ("at 2.5
 * “Hg” quotes something); a closing mark only when no quote is open.
 */
export const isInchMark = (text: string, offset: number, quoteOpen: boolean): boolean => {
  const mark = text.charAt(offset);
  if ((mark !== OPENING && mark !== CLOSING) || !betweenNumberAndUnit(text, offset)) return false;
  if (mark === CLOSING) return !quoteOpen;
  return !closesEarlier(text.slice(offset + 1, paragraphEnd(text, offset)));
};
