// A postal address closed by its postcode right before an and / or ("… Upper Street, Leeds LS1 4AB, or email us"). The
// commas between the address's lines are the address's, not a list's. Pure.

/** UK (LS1 4AB, TW9 4DU, EC1A 1BB), US state and ZIP (IL 62701, DC 20001-1234), Canada (K1A 0B1). */
const POSTCODE = String.raw`(?:[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}|[A-Z]{2} \d{5}(?:-\d{4})?|[A-Z]\d[A-Z] \d[A-Z]\d)`;
const POSTCODE_BEFORE = new RegExp(String.raw`(?<![\w-])${POSTCODE},?[ \t]*$`, "u");
/** How far back the postcode may start: the longest one and its comma, with room for spacing. */
const REACH = 24;

/** Whether the text before offset ends with a postcode, the comma after it allowed. */
export const followsPostcode = (source: string, offset: number): boolean => POSTCODE_BEFORE.test(source.slice(Math.max(0, offset - REACH), offset));
