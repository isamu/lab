// A prerequisite ("Before you begin, stop the service", 「作業を始める前に、」) written after the numbered steps of its own
// section: the reader has done the steps by the time they read it. Pure; the openers come from the language's
// prerequisite-opener lexicon.

/** A span of the source, and the text of a sentence there. */
export type Placed = { readonly start: number; readonly end: number };
export type PlacedSentence = Placed & { readonly text: string };

/**
 * What may follow an opener: a comma, or the end of the sentence. "Before you begin step 3" names one step, and
 * 「始める前に戻すには」 is a state to return to, not a prerequisite.
 */
const AFTER_OPENER = new Set([",", "、", "，", ""]);

/** Whether a sentence opens with one of the openers, as a phrase of its own. */
export const opensWithPrerequisite = (text: string, openers: readonly string[]): boolean => {
  const lowered = text.trimStart().toLowerCase();
  return openers.some((opener) => {
    const target = opener.toLowerCase();
    return lowered.startsWith(target) && AFTER_OPENER.has(lowered.charAt(target.length));
  });
};

/**
 * The sentences that open with a prerequisite and come after a numbered procedure ending in the same section. A section's
 * prerequisite for a later section's steps comes before those steps, in that section, and is not reported.
 */
export const latePrerequisites = (
  sections: readonly Placed[],
  procedures: readonly Placed[],
  sentences: readonly PlacedSentence[],
  openers: readonly string[],
): PlacedSentence[] =>
  sentences.filter((sentence) => {
    if (!opensWithPrerequisite(sentence.text, openers)) return false;
    const section = sections.findLast((candidate) => candidate.start <= sentence.start && sentence.start < candidate.end);
    if (section === undefined) return false;
    return procedures.some((procedure) => procedure.start >= section.start && procedure.end <= sentence.start);
  });
