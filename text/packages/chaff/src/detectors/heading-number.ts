/** A heading's number at its head: 3, 4.2, 4.2.1 (a full stop after it, as in "3.", is not part of it). */
const DOTTED_NUMBER = /^(\d{1,3}(?:\.\d{1,3})*)\.?(?!\d)/u;
/** The first item of a bracketed series under a numbered heading: (1), （１）. */
const FIRST_BRACKETED = /^\(1\)/u;

const numberOf = (heading: string): string | undefined => DOTTED_NUMBER.exec(heading.normalize("NFKC").trim())?.[1];

/**
 * Whether `child`, the next heading at the same depth, opens a subsection of `parent` by its number: 3. then 3.1, 4.2 then
 * 4.2.1, or a numbered heading then its first bracketed item ((1)). Some documents number their subsections at the
 * heading level of the section itself, so the depth alone does not show the split.
 */
export const opensSubsection = (parent: string, child: string): boolean => {
  const parentNumber = numberOf(parent);
  if (parentNumber === undefined) return false;
  const normalizedChild = child.normalize("NFKC").trim();
  if (FIRST_BRACKETED.test(normalizedChild)) return true;
  const childNumber = numberOf(normalizedChild);
  return childNumber !== undefined && childNumber.startsWith(`${parentNumber}.`) && !childNumber.slice(parentNumber.length + 1).includes(".");
};
