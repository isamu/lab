// A typewritten document: plain text that sets no typographic mark at all (no dash, no curly quote, no ellipsis
// character). It can only type a dash as a hyphen ("Fetch - Living Standard"), the way a plain-text standard does. Pure.

const TYPOGRAPHIC_MARK = /[—–‘’“”…]/u;

/** Whether a document is plain text (not Markdown) and sets no typographic mark. */
export const isTypewritten = (source: string, markdown: boolean): boolean => !markdown && !TYPOGRAPHIC_MARK.test(source);
