// A yearless date that names again a day the text gave with its year earlier ("opens on Saturday, January 16, 2027" … "opens
// to the public at 10 a.m. on Saturday, January 16"): the reader already knows which January 16. Pure.

type Point = { readonly offset: number; readonly value: string };

const FULL = /^(\d{4})-(\d{2}-\d{2})$/u;

/**
 * Whether the month and day of `point` (as "01-16") were written with a year before it, in one year only: the same day
 * given in two years (January 16, 2026 and January 16, 2027) leaves the year open.
 */
export const repeatsDatedDay = (point: Point, dated: readonly Point[]): boolean => {
  const years = new Set(
    dated.flatMap((other) => {
      const found = FULL.exec(other.value);
      return found !== null && other.offset < point.offset && found[2] === point.value ? [found[1]] : [];
    }),
  );
  return years.size === 1;
};
