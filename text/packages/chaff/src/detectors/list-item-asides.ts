// Items of a list that are not among its items: a note set as one more bullet, and a cited title. Pure.

/** A list item's marker (- , 1. ). */
const LIST_MARKER = /^\s*(?:\d+[.)]|[-*+])\s+/u;

/**
 * An item that opens with a date and runs straight on into a title, with no full stop (- 平成25年8月23日命を守るために…): a
 * list of press releases or notices, each title quoted as it was published. Its form is not the writer's to align. A date
 * followed by a particle (令和6年8月23日に…) opens the writer's own sentence.
 */
const DATED_TITLE = /^(?:(?:令和|平成|昭和)[0-9０-９元]{1,2}|\d{4})年[0-9０-９]{1,2}月[0-9０-９]{1,2}日(?![にのはをがでとへもや、，。\s])[^。．]+$/u;

export const isDatedTitle = (written: string): boolean => DATED_TITLE.test(written.replace(LIST_MARKER, "").trim());

/** The note lead (※, 注：) an item opens with, if any. */
const noteLeadOf = (written: string, noteLeads: readonly string[]): string | undefined => {
  const text = written.replace(LIST_MARKER, "").trimStart();
  return noteLeads.find((lead) => lead !== "" && text.startsWith(lead));
};

/**
 * Items that open with a note lead fewer than half the group's items share (- ※電話によるご意見は… after - （１）郵送…): a note on
 * the list set as one more bullet, not one of its items. Items that all open with ※ are compared among themselves.
 */
export const noteItems = (written: readonly string[], noteLeads: readonly string[]): ReadonlySet<number> => {
  const leads = written.map((text) => noteLeadOf(text, noteLeads));
  const share = (lead: string): number => leads.filter((other) => other === lead).length;
  return new Set(leads.flatMap((lead, index) => (lead !== undefined && share(lead) * 2 < written.length ? [index] : [])));
};
