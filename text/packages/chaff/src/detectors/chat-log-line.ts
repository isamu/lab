// A line of a pasted chat log ("<jinxer-wm> FIRING: PHPFPMTooBusy: Not enough idle PHP-FPM workers"): the speaker's nick in
// angle brackets, then what the speaker (often an alert bot) said. The words are the speaker's, not the writer's. Pure.

type Span = { readonly start: number; readonly end: number };

const LIST_MARK = String.raw`(?:[-*+][ \t]+)?`;
const TIME = String.raw`(?:\[?\d{1,2}:\d{2}(?::\d{2})?\]?[ \t]+)?`;
const NICK = String.raw`<[A-Za-z_\x5B-\x60{|}][\w\x5B-\x60{|}-]{0,31}>`;
/**
 * An IRC-style nick in angle brackets at the start of a line, after an optional list mark and time ("- [21:00] <bot> …"),
 * then a space and the message. The nick has no space, so an HTML tag with attributes (<a href="…">) is not one.
 */
const CHAT_LINE = new RegExp(String.raw`^[ \t]*${LIST_MARK}${TIME}${NICK}[ \t]+\S.*`, "gmu");

/** The lines of the source that are a pasted chat log's messages. */
export const chatLogSpans = (source: string): Span[] =>
  [...source.matchAll(CHAT_LINE)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
