// Whether a word is part of an address or a file name rather than a word of the sentence. Pure.

/** A word joined to a dot, an at sign or a slash is part of an address or a file name (github.com, user@example), spelled as it must be. */
const ADDRESS_NEIGHBOUR = /[.@/\\_]/u;
const WORD_CHAR = /\w/u;

/** Whether text[start, end) is joined to an address mark before it, or to one followed by more of the address after it. */
export const isPartOfAddress = (text: string, start: number, end: number): boolean =>
  ADDRESS_NEIGHBOUR.test(text.charAt(start - 1)) || (ADDRESS_NEIGHBOUR.test(text.charAt(end)) && WORD_CHAR.test(text.charAt(end + 1)));
