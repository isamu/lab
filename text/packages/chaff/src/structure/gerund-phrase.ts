// A defined phrase led by an English gerund and its object ("Exercising your options" means ...) names an act, and the
// document then writes the act as a verb: exercise your options, exercised their options. Pure.

const GERUND = /^(\p{Script=Latin}{2,})ing$/u;
/** A consonant written twice before -ing (running, setting): the verb has it once. */
const DOUBLED = /(\p{Script=Latin})\1$/u;

/** The verb forms a stem takes (file, files, filed, filing for "Filing"; exercise for "Exercising"). */
const formsOf = (stem: string): string[] => {
  const single = DOUBLED.test(stem) ? [stem.slice(0, -1)] : [];
  return [...new Set([stem, `${stem}e`, `${stem}es`, `${stem}s`, `${stem}ed`, `${stem}ing`, ...single, ...single.map((verb) => `${verb}s`)])];
};

const capitalised = (word: string): boolean => word.charAt(0) !== word.charAt(0).toLowerCase();

/**
 * The same phrase with its leading gerund written as the other forms of its verb ("exercise your options",
 * "exercised your options" for "Exercising your options"). Only when a determiner follows the gerund (a, the, your):
 * then it takes an object and is a verb. "Building materials" and "Pricing information" name things, and "Licensing"
 * alone may be a noun. Empty when the phrase does not take that shape.
 */
export const verbFormsOf = (term: string, determiners: ReadonlySet<string>): string[] => {
  const [first, second, ...rest] = term.split(" ");
  if (first === undefined || second === undefined || !determiners.has(second.toLowerCase())) return [];
  const stem = GERUND.exec(first.toLowerCase())?.[1];
  if (stem === undefined) return [];
  return formsOf(stem)
    .map((form) => (capitalised(first) ? `${form.charAt(0).toUpperCase()}${form.slice(1)}` : form))
    .map((form) => [form, second, ...rest].join(" "))
    .filter((form) => form !== term);
};
