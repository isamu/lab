import type { Span } from "../plugin.ts";
import { sameValue, type FactValue } from "./fact-values.ts";

/**
 * 出来事の日付。文が出来事の語（提供、release）を一つの組だけ含み、日付を一つだけ持つとき、その日付をその出来事の日付と読む。
 * 冒頭や要約の文の日付を、本文の同じ組の出来事の日付と比べる。本文の日付が一通りに揃っていて、違うときだけ言う。
 * 年月日まで書いた日付どうしだけを比べる。日付が二つある文（期間）や、組が二つある文（発表した日と提供する日）は読まない。
 * 本文の文が、冒頭の文に無い名前（別の製品、別の催し）を持つなら、別の出来事として比べない。
 */
export type EventWord = { readonly pattern: string; readonly group: string };

/** names: 文の中の固有名詞などの名前。 */
export type EventSentence = Span & { readonly text: string; readonly summary: boolean; readonly names: readonly string[] };

export type EventDateConflict = { readonly label: string; readonly value: FactValue; readonly other: FactValue };

type EventDate = { readonly group: string; readonly label: string; readonly value: FactValue; readonly sentence: EventSentence };

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/u;

const normalized = (text: string): string => text.normalize("NFKC").toLowerCase();

const startsWord = (text: string, at: number): boolean => at === 0 || !/[a-z]/u.test(text.charAt(at - 1));

/** 文の中の出来事の語。英字の語は語の頭からだけ（releases は release、prerelease は違う）。 */
const wordsIn = (text: string, words: readonly EventWord[]): EventWord[] => {
  const folded = normalized(text);
  return words.filter((word) => {
    const pattern = normalized(word.pattern);
    const at = folded.indexOf(pattern);
    return at >= 0 && (!/^[a-z]/u.test(pattern) || startsWord(folded, at));
  });
};

const inside = (sentence: Span, value: Span): boolean => sentence.start <= value.start && value.end <= sentence.end;

const eventDateOf = (sentence: EventSentence, dates: readonly FactValue[], words: readonly EventWord[]): EventDate[] => {
  const own = dates.filter((date) => inside(sentence, date));
  const found = wordsIn(sentence.text, words);
  const groups = new Set(found.map((word) => word.group));
  const [date, word] = [own[0], found[0]];
  if (own.length !== 1 || groups.size !== 1 || date === undefined || word === undefined || !FULL_DATE.test(date.key)) return [];
  return [{ group: word.group, label: word.pattern, value: date, sentence }];
};

const distinct = (values: readonly FactValue[]): FactValue[] =>
  values.reduce<FactValue[]>((kept, value) => (kept.some((seen) => sameValue(seen, value)) ? kept : [...kept, value]), []);

/** 本文の文の名前が、どれも冒頭の文にある（名前の無い「提供開始日は」も同じ出来事と読む）。 */
const sameSubject = (event: EventDate, other: EventDate): boolean => other.sentence.names.every((name) => event.sentence.names.includes(name));

const conflictOf = (event: EventDate, body: readonly EventDate[]): EventDateConflict[] => {
  const values = distinct(body.filter((other) => other.group === event.group && sameSubject(event, other)).map((other) => other.value));
  const only = values.length === 1 ? values[0] : undefined;
  return only === undefined || sameValue(event.value, only) ? [] : [{ label: event.label, value: event.value, other: only }];
};

/** 冒頭や要約の出来事の日付が、本文で揃って書かれた同じ出来事の日付と違う。dates は日付の値だけ。 */
export const eventDateConflicts = (sentences: readonly EventSentence[], dates: readonly FactValue[], words: readonly EventWord[]): EventDateConflict[] => {
  const events = sentences.flatMap((sentence) => eventDateOf(sentence, dates, words));
  const body = events.filter((event) => !event.sentence.summary);
  return events.filter((event) => event.sentence.summary).flatMap((event) => conflictOf(event, body));
};
