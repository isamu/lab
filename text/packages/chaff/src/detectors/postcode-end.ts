// A postal address closed by its postcode right before an and / or ("… Upper Street, Leeds LS1 4AB, or email us"). The
// commas between the address's lines are the address's, not a list's. Pure.

/** UK (LS1 4AB, TW9 4DU, EC1A 1BB), US state and ZIP (IL 62701, DC 20001-1234), Canada (K1A 0B1). */
const POSTCODE = String.raw`(?:[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}|[A-Z]{2} \d{5}(?:-\d{4})?|[A-Z]\d[A-Z] \d[A-Z]\d)`;
/**
 * The place the postcode is written after: a town (Leeds, Springfield,) or a province's code (ON). A code after a
 * lower-case word ("model X1 4AB") is a product's, not an address's.
 */
const PLACE = String.raw`(?<![\w-])(?:[A-Z][a-z]+|[A-Z]{2}),? `;
const POSTCODE_BEFORE = new RegExp(String.raw`${PLACE}${POSTCODE},?[ \t]*$`, "u");
/** How far back the place may start: a long town name, the longest postcode and its comma, with room for spacing. */
const REACH = 48;

/** Whether the text before offset ends with a place and its postcode, the comma after it allowed. */
export const followsPostcode = (source: string, offset: number): boolean => POSTCODE_BEFORE.test(source.slice(Math.max(0, offset - REACH), offset));
