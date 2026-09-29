/** English agreement: only exactly one takes the singular ("0 findings", "1 finding", "1.5 findings"). */
const isOne = (count: number | string): boolean => String(count) === "1";

export const formFor = (count: number | string, singular: string, plural: string): string => (isOne(count) ? singular : plural);

export const counted = (count: number, singular: string, plural = `${singular}s`): string => `${String(count)} ${formFor(count, singular, plural)}`;
