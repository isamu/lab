import type { Section } from "./plugin.ts";

/** One heading level's section lengths, compared with each other. */
export type LevelLengths = { readonly lengths: readonly number[] };

/** A section's own text and every subsection under it, up to the next heading at its depth or shallower. */
const withSubsections = (sections: readonly Section[], index: number, size: (section: Section) => number): number => {
  const depth = sections[index]?.depth ?? 0;
  const after = sections.slice(index + 1);
  const end = after.findIndex((section) => section.depth <= depth);
  const subsections = end === -1 ? after : after.slice(0, end);
  return [sections[index], ...subsections].reduce((sum, section) => sum + (section === undefined ? 0 : size(section)), 0);
};

const depthCounts = (sections: readonly Section[]): Map<number, number> =>
  sections.reduce((counts, section) => counts.set(section.depth, (counts.get(section.depth) ?? 0) + 1), new Map<number, number>());

/** The shallowest depth that more than one heading shares: the document's top level of sections, below its title. */
const topDepth = (sections: readonly Section[]): number | undefined =>
  [...depthCounts(sections).entries()]
    .filter(([, count]) => count > 1)
    .map(([depth]) => depth)
    .sort((a, b) => a - b)[0];

/** The nearest heading above the section that is shallower than it. */
const parentOf = (sections: readonly Section[], index: number): Section | undefined => {
  const depth = sections[index]?.depth ?? 0;
  return sections
    .slice(0, index)
    .reverse()
    .find((section) => section.depth < depth);
};

/** A heading that only groups the subsections under it (Pros, Cons): no text of its own. */
const isGroupHeading = (section: Section | undefined, top: number, size: (section: Section) => number): boolean =>
  section !== undefined && section.depth >= top && size(section) === 0;

const topLevel = (sections: readonly Section[], top: number, size: (section: Section) => number): LevelLengths => ({
  lengths: sections
    .flatMap((section, index) => {
      if (section.depth === top) return [withSubsections(sections, index, size)];
      return section.depth < top ? [size(section)] : [];
    })
    .filter((length) => length > 0),
});

type Runs = { readonly runs: readonly (readonly number[])[]; readonly open: boolean };

/** Subsections at one depth, read in order; a run goes on across group headings and ends at any heading with text. */
const subsectionRuns = (sections: readonly Section[], depth: number, top: number, size: (section: Section) => number): LevelLengths[] =>
  sections
    .reduce<Runs>(
      (state, section, index) => {
        if (section.depth === depth && isGroupHeading(parentOf(sections, index), top, size)) {
          const length = withSubsections(sections, index, size);
          const runs = state.open ? [...state.runs.slice(0, -1), [...(state.runs.at(-1) ?? []), length]] : [...state.runs, [length]];
          return { runs, open: true };
        }
        if (section.depth > depth || (section.depth < depth && size(section) === 0)) return state;
        return { runs: state.runs, open: false };
      },
      { runs: [], open: false },
    )
    .runs.map((run) => ({ lengths: run.filter((length) => length > 0) }));

/**
 * Section lengths compared with each other. A subsection is part of its section's length, and the title's introduction
 * is compared with the top level. A run of subsections under headings that only group them is also compared on its own:
 * three pros and three cons are six of one size. Under a heading with text of its own, subsections are parts of that
 * section (seven principles of one guideline), and a section with text between two groups ends the run.
 */
export const sectionLevels = (sections: readonly Section[], size: (section: Section) => number): LevelLengths[] => {
  const top = topDepth(sections);
  if (top === undefined) return [];
  const deeper = [...depthCounts(sections).keys()].filter((depth) => depth > top).sort((a, b) => a - b);
  return [topLevel(sections, top, size), ...deeper.flatMap((depth) => subsectionRuns(sections, depth, top, size))].filter((level) => level.lengths.length > 0);
};

const leadingEmphasis = /^[\s*_]+/u;

/** The section's first paragraph opens with an interviewer's mark (―― in Japanese, Q: in English): a question turn. */
const opensWithPrompt = (source: string, section: Section, firstParagraphStart: number | undefined, marks: readonly string[]): boolean => {
  if (firstParagraphStart === undefined || firstParagraphStart >= section.span.end) return false;
  const text = source.slice(firstParagraphStart, section.span.end).replace(leadingEmphasis, "");
  return marks.some((mark) => text.startsWith(mark));
};

/**
 * An interview: at least half of the headed sections open with the interviewer's question. Each section is one answer,
 * so even lengths are the form, not a template.
 */
export const isInterview = (source: string, sections: readonly Section[], paragraphStarts: readonly number[], marks: readonly string[]): boolean => {
  if (marks.length === 0) return false;
  const headed = sections.filter((section) => section.depth > 0 && section.sentences.length > 0);
  const firstStart = (section: Section): number | undefined => paragraphStarts.find((start) => start >= section.span.start && start < section.span.end);
  const turns = headed.filter((section) => opensWithPrompt(source, section, firstStart(section), marks)).length;
  return turns > 0 && turns * 2 >= headed.length;
};
