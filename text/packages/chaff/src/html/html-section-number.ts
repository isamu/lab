// A numbered heading followed by its own first subsection ("3. Results" then "3.1 Data", or "4. Issues" then "(1) Cost").
// A page may set both with the same tag (<h4>3. …</h4><h4>3.1 …</h4>), so the level alone says nothing about which
// holds which. Pure.

const SECTION_NUMBER = /^#{1,6} +(\d+(?:\.\d+)*)\.?(?![\d.])/u;

/** A first item marked in its own way under a section: (1), 1), ①. */
const FIRST_ITEM = /^#{1,6} +(?:[(（][1１][)）]|[1１][)）]|①)/u;

/** The heading line's section number ("## 3. Results" → "3", "#### 3.1 Data" → "3.1"), or undefined. */
export const sectionNumberOf = (line: string): string | undefined => SECTION_NUMBER.exec(line.normalize("NFKC"))?.[1];

/** Whether the next heading opens this numbered heading's first subsection: 3 then 3.1, 2.1 then 2.1.1, 4 then (1). */
export const opensSubsection = (line: string, nextHeading: string | undefined): boolean => {
  const number = sectionNumberOf(line);
  if (number === undefined || nextHeading === undefined) return false;
  if (FIRST_ITEM.test(nextHeading)) return true;
  const next = sectionNumberOf(nextHeading);
  return next !== undefined && next.startsWith(`${number}.`) && next.split(".").length === number.split(".").length + 1;
};
