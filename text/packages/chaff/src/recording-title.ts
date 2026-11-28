import type { Section, Sentence } from "./plugin.ts";

// A heading that ends with a running time in brackets (（3分00秒）, (12:30)) is the title of a video or a recording the page
// shows, and the text under it is that recording's own caption. Neither is the writer's to shorten or to bring into the
// page's register. Pure.

/** Minutes and seconds in brackets (（3分00秒）, （45秒）). */
const MINUTES_END = /[(（]\s*[0-9０-９]+(?:分(?:[0-9０-９]+秒)?|秒)\s*[)）]$/u;
/** A clock time in brackets ((12:30), (1:02:15)). */
const CLOCK_END = /[(（]\s*\d{1,2}(?::\d{2}){1,2}\s*[)）]$/u;

export const isRecordingTitle = (heading: string): boolean => MINUTES_END.test(heading.trim()) || CLOCK_END.test(heading.trim());

/** The sentences of every section a recording's title heads: its caption, in the recording's words. */
export const recordingCaptionSentences = (sections: readonly Section[]): Set<Sentence> =>
  new Set(sections.filter((section) => isRecordingTitle(section.unlabeledHeading ?? section.heading)).flatMap((section) => section.sentences));
