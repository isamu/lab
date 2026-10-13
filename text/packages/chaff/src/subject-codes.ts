// The one code a product document is about (a recall's or a warranty's model): named in its title, or labelled on a line
// of its own or in a table (型番：NH-805, | Model | MW-4120S |), and written once elsewhere with two neighbours swapped
// (NH-850). Only when the document names no other code in those places: a catalog naming two is about two items. Pure.
import type { LexiconEntry, Span } from "./plugin.ts";
import { labelBefore, swapsNeighbours, withoutUrls } from "./phone-numbers.ts";
import { charactersOf, LABEL_TO_NUMBER, REFERENCE_SHAPE, type ReferenceNumber, type ReferenceVariant } from "./reference-numbers.ts";
import { isCodeWith } from "./unlabelled-references.ts";

/** Digits enough for a model's code (FT-38); the two letters a short code must hold keep out form names (A-12, B-21). */
export const MIN_SUBJECT_DIGITS = 2;
const MIN_SUBJECT_LETTERS = 2;
const LETTER = /[A-Z]/gu;
const FIRST_PART = /^[^-‐−－]*/u;
const TITLE_GROUP = "title";

/** A short code: two letters or more before its hyphen, and two digits or more (FT-38, KR-M230; not A-12B). */
export const isSubjectCode = (written: string): boolean =>
  isCodeWith(MIN_SUBJECT_DIGITS)(written) && (charactersOf(FIRST_PART.exec(written)?.[0] ?? "").match(LETTER)?.length ?? 0) >= MIN_SUBJECT_LETTERS;

/** What the document gives: its prose (tables masked), its title as written (the prose masks it), its labels, the groups that name an item, the codes its tables label, and every code in a table. */
export type SubjectCodeInput = {
  readonly prose: string;
  readonly title: { readonly start: number; readonly text: string } | undefined;
  readonly labels: readonly LexiconEntry[];
  readonly listed: ReadonlySet<string>;
  readonly tabled: readonly ReferenceNumber[];
  readonly known: ReadonlySet<string>;
};

type CodeWriting = ReferenceNumber & { readonly anchor: boolean; readonly group: string | undefined };

const lineAround = (text: string, offset: number): Span => {
  const start = text.lastIndexOf("\n", offset - 1) + 1;
  const end = text.indexOf("\n", offset);
  return { start, end: end === -1 ? text.length : end };
};

/** Whether a code's line holds a label of the given labels, the separators and the code, and nothing else (型番：NH-805). */
const isFieldLine = (text: string, offset: number, written: string, between: string, labels: readonly LexiconEntry[]): boolean => {
  const line = lineAround(text, offset);
  const head = text
    .slice(line.start, offset - between.length)
    .trim()
    .toLowerCase();
  const rest = text.slice(offset + written.length, line.end).trim();
  return rest === "" && labels.some((label) => label.pattern.toLowerCase() === head);
};

const shortCodes = (text: string): RegExpExecArray[] => [...text.matchAll(REFERENCE_SHAPE)].filter((match) => isSubjectCode(match[0]));

/** Every short code of the title, each an anchor. */
const titleWritings = (title: SubjectCodeInput["title"]): CodeWriting[] =>
  title === undefined
    ? []
    : shortCodes(title.text).map((match) => ({
        offset: title.start + match.index,
        written: match[0],
        characters: charactersOf(match[0]),
        label: TITLE_GROUP,
        anchor: true,
        group: undefined,
      }));

/** Every short code of the prose, as an anchor when a field line of a listed kind labels it. */
const proseWritings = (text: string, input: SubjectCodeInput): CodeWriting[] =>
  shortCodes(text).map((match) => {
    const written = match[0];
    const offset = match.index;
    const label = labelBefore(text, offset, input.labels);
    const group = label !== undefined && LABEL_TO_NUMBER.test(label.between) ? label.group : undefined;
    const onField = group !== undefined && input.listed.has(group) && isFieldLine(text, offset, written, label?.between ?? "", input.labels);
    return { offset, written, characters: charactersOf(written), label: group ?? TITLE_GROUP, anchor: onField, group };
  });

/** The title's codes and the prose's, one writing per place. */
const writingsOf = (text: string, input: SubjectCodeInput): CodeWriting[] => {
  const inTitle = titleWritings(input.title);
  return [...inTitle, ...proseWritings(text, input).filter((writing) => !inTitle.some((title) => title.offset === writing.offset))];
};

/** The writings of the document's one code with two neighbours swapped, each written once, of a listed kind or unlabelled, on a line that does not name the code itself. */
export const subjectCodeVariants = (input: SubjectCodeInput): ReferenceVariant[] => {
  const text = withoutUrls(input.prose);
  const writings = writingsOf(text, input);
  const anchors = [
    ...writings.filter((writing) => writing.anchor),
    ...input.tabled.filter((code) => input.listed.has(code.label) && isSubjectCode(code.written)),
  ];
  const subject = anchors[0];
  if (subject === undefined || anchors.some((anchor) => anchor.characters !== subject.characters)) return [];
  const timesWritten = (characters: string): number => writings.filter((writing) => writing.characters === characters).length;
  return writings.flatMap((writing) => {
    const line = lineAround(text, writing.offset);
    const slip =
      !writing.anchor &&
      (writing.group === undefined || input.listed.has(writing.group)) &&
      !input.known.has(writing.characters) &&
      timesWritten(writing.characters) === 1 &&
      swapsNeighbours(subject.characters, writing.characters) &&
      !writings.some((other) => other.characters === subject.characters && other.offset >= line.start && other.offset < line.end);
    if (!slip) return [];
    const { offset, written, characters } = writing;
    return [{ number: { offset, written, characters, label: subject.label }, other: subject }];
  });
};
