/** A digit with a superscript digit right after it (10³, １０²): a power, which NFKC would turn into a longer number (103). */
const DIGIT_THEN_SUPERSCRIPT = /\p{Nd}[⁰¹²³⁴-⁹]/u;

/** Whether the text, before NFKC, writes a power of a number. A unit's superscript (m³, km²) follows a letter, not a digit. */
export const hasSuperscriptPower = (text: string): boolean => DIGIT_THEN_SUPERSCRIPT.test(text);
