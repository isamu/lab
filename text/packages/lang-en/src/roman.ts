const ROMAN: Readonly<Record<string, number>> = { i: 1, v: 5, x: 10, l: 50, c: 100 };

/** "IV" → 4, "xii" → 12. Undefined for anything that is not a roman numeral. */
export const parseRoman = (text: string): number | undefined => {
  const values = [...text.toLowerCase()].map((char) => ROMAN[char]);
  if (values.length === 0 || values.some((value) => value === undefined)) return undefined;
  const known = values.filter((value) => value !== undefined);
  return known.reduce((total, value, index) => ((known[index + 1] ?? 0) > value ? total - value : total + value), 0);
};
