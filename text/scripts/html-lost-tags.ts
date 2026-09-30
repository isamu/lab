// A paragraph's start tag that lost its "<" upstream and so reached the page as text: the eCFR serves 16 CFR 310.4(b)
// with "… 45 CFR 160.103. P&gt;(2) It is an abusive …", where "P>" is what is left of the <P> that opened paragraph (2).
// Read as text it glues the paragraph to the one before and leaves "P>" in the sentence. Only a P and a ">" standing
// after a sentence's end and right before a paragraph's designation ("(2)", "(iv)", "(A)") and a capital are taken for the lost
// tag; "P>0.05", "P > (2)" and a formula opening a sentence ("P>(2) follows") stay text. Pure.

const LOST_PARAGRAPH_TAG = /(?<=[.;:][)"'”’]?[ \t])[Pp](?:&gt;|>)(?=\([0-9A-Za-z]{1,4}\)[ \t]\p{Lu})/gu;

/** Whether at is inside a tag. An attribute's ">" is escaped by then (withAttributeMarkupEscaped), so a tag has none before its end. */
const isInsideTag = (html: string, at: number): boolean => html.lastIndexOf("<", at) > html.lastIndexOf(">", at - 1);

/** The HTML with each lost paragraph start tag in its text put back as <p>. */
export const withLostParagraphTagsRestored = (html: string): string =>
  html.replace(LOST_PARAGRAPH_TAG, (lost: string, at: number) => (isInsideTag(html, at) ? lost : "<p>"));
