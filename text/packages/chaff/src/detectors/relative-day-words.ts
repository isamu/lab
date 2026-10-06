// relative-date-mismatch, the day words: 「来週月曜（10月12日）」「明日（10月7日）」"next Monday (October 12)" against the
// date field of an email or minutes. The words are the lexicons relative-week, relative-day, weekday and message-date-field;
// the reckoning is derived/relative-weekdays.ts.
import type { Finding, ProseDocument, Span } from "../plugin.ts";
import type { DatedValue } from "../derived/relative-dates.ts";
import { relativeDayMismatch, type DayWord } from "../derived/relative-weekdays.ts";
import { escapeRegExp } from "../orthography.ts";
import { quoteAt } from "./structure-tree.ts";

const FULL = /^\d{4}-\d{2}-\d{2}$/u;
const LATIN = /^[A-Za-z]/u;
/** 文書の書き出し: 最初の見出しより前と、最初の見出しの節。メールや議事録の頭の日付（日付：、Date:）が書かれる所。 */
const OPENING_SECTIONS = 1;
/** The separators a date may follow its day word with: a space, a bracket, a comma (「来週月曜（10月12日）」). */
const SEPARATORS = /[\s,、，(（:：]/gu;

const wordPattern = (word: string): RegExp => new RegExp(LATIN.test(word) ? `\\b${escapeRegExp(word)}\\b` : escapeRegExp(word), "giu");

const spansOf = (source: string, word: string): Span[] =>
  [...source.matchAll(wordPattern(word))].map((match) => ({ start: match.index, end: match.index + match[0].length }));

/** The weekday written right after a week word (Sunday is 0), and where it ends: the name, or the name without its last 日 (月曜). */
const weekdayAt = (source: string, at: number, names: readonly string[]): { readonly weekday: number; readonly end: number } | undefined => {
  const gap = source.slice(at).length - source.slice(at).trimStart().length;
  const rest = source.slice(at + gap).toLowerCase();
  const found = names
    .map((name, weekday) => {
      const lower = name.toLowerCase();
      const short = LATIN.test(name) ? lower : lower.slice(0, -1);
      const written = [lower, short].find((form) => form.length >= 2 && rest.startsWith(form));
      return written === undefined ? undefined : { weekday, end: at + gap + written.length };
    })
    .find((entry) => entry !== undefined);
  return gap > 1 ? undefined : found;
};

const dayWordsOf = (doc: ProseDocument): DayWord[] => {
  const names = (doc.lexicons["weekday"] ?? []).map((entry) => entry.pattern);
  const weeks = (doc.lexicons["relative-week"] ?? []).flatMap((entry): DayWord[] =>
    spansOf(doc.source, entry.pattern).flatMap((span) => {
      const day = weekdayAt(doc.source, span.end, names);
      return day === undefined ? [] : [{ start: span.start, end: day.end, kind: "weekday", weeks: Number(entry.group), weekday: day.weekday }];
    }),
  );
  const days = (doc.lexicons["relative-day"] ?? []).flatMap((entry): DayWord[] =>
    spansOf(doc.source, entry.pattern).map((span) => ({ ...span, kind: "day", days: Number(entry.group) })),
  );
  // 「再来週」の中の「来週」、「明後日」の中の「明日」は読まない: 長い語が覆う語を落とす。
  const all = [...weeks, ...days];
  return all.filter(
    (word) => !all.some((other) => other !== word && other.start <= word.start && word.end <= other.end && other.end - other.start > word.end - word.start),
  );
};

/** The date written right after the day word: only separators and a link word (の, on) between. */
const targetOf = (doc: ProseDocument, dates: readonly DatedValue[], word: DayWord): DatedValue | undefined => {
  const next = dates.find((date) => date.start >= word.end);
  if (next === undefined) return undefined;
  const between = doc.source.slice(word.end, next.start).replace(SEPARATORS, "").toLowerCase();
  const links = (doc.lexicons["relative-link"] ?? []).map((entry) => entry.pattern.replace(SEPARATORS, "").toLowerCase());
  return between === "" || links.includes(between) ? next : undefined;
};

const lineStartAt = (source: string, offset: number): number => source.lastIndexOf("\n", offset - 1) + 1;

const lineAt = (source: string, offset: number): string => {
  const start = lineStartAt(source, offset);
  const end = source.indexOf("\n", offset);
  return source.slice(start, end === -1 ? source.length : end);
};

const FIELD_MARK = /^\s*(?:[-*+]\s+)?(?<label>[^:：]{1,12})[:：]/u;

/**
 * The date the day words count from: the first full date on a date field of the opening (「日付:」「日時:」"Date:", lexicon
 * message-date-field), before the first heading or in the first heading's section. A document without one (a press release
 * whose only date is an update stamp) has no date to count from.
 */
const baseOf = (doc: ProseDocument, dates: readonly DatedValue[], starts: readonly number[]): DatedValue | undefined => {
  const labels = (doc.lexicons["message-date-field"] ?? []).map((entry) => entry.pattern.toLowerCase());
  return dates.find((date) => {
    const label = FIELD_MARK.exec(lineAt(doc.source, date.start))?.groups?.["label"]?.trim().toLowerCase() ?? "";
    return FULL.test(date.value) && labels.includes(label) && starts.filter((start) => start <= date.start).length <= OPENING_SECTIONS;
  });
};

const QUOTED_LINE = /^\s*>/u;

/**
 * Day words the document's date does not count: in a quoted reply (「> 明日（10月2日）」 counts from the quoted mail's date),
 * or in a section whose heading names a date (「## 10月1日の会」: its 「本日」 is that day).
 */
const countedFromBase = (doc: ProseDocument, word: DayWord, datedHeadings: readonly number[], starts: readonly number[]): boolean => {
  const section = starts.filter((start) => start <= word.start).at(-1);
  return !QUOTED_LINE.test(lineAt(doc.source, word.start)) && (section === undefined || !datedHeadings.includes(section));
};

export const dayWordFindings = (doc: ProseDocument, dates: readonly DatedValue[]): Finding[] => {
  const starts = doc.sections.filter((section) => section.depth > 0).map((section) => section.span.start);
  const base = baseOf(doc, dates, starts);
  if (base === undefined) return [];
  const datedHeadings = starts.filter((start) => dates.some((date) => date.start >= start && date.start < start + lineAt(doc.source, start).length));
  return dayWordsOf(doc)
    .filter((word) => countedFromBase(doc, word, datedHeadings, starts))
    .flatMap((word): Finding[] => {
      const target = targetOf(doc, dates, word);
      const expected = target === undefined || target === base ? undefined : relativeDayMismatch(base.value, word, target.value);
      if (target === undefined || expected === undefined) return [];
      return [
        {
          rule: "relative-date-mismatch",
          severity: "warning",
          line: 0,
          column: 0,
          quote: quoteAt(doc.source, target.start),
          values: {
            base: doc.source.slice(base.start, base.end),
            relative: doc.source.slice(word.start, word.end),
            target: doc.source.slice(target.start, target.end),
            expected,
            offset: target.start,
          },
        },
      ];
    });
};
