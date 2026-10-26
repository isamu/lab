// A facility or an organisation named by a run of nouns that ends on a word closing a name (こども動物園, 福島復興浜通りセンター).
// The name keeps the spelling it was given, so its words (こども, 浜通り) are not the writer's spelling of the same words, unless
// the document writes the name itself two ways (こども家庭庁 and 子ども家庭庁). Pure.

import type { Span, Token } from "./plugin.ts";

const NAME_PARTS = new Set(["NOUN", "PROPN"]);

const isTouching = (left: Token | undefined, right: Token): boolean => left !== undefined && left.span.end === right.span.start;

/** The runs of nouns written onto each other. */
const nounRuns = (tokens: readonly Token[]): Token[][] =>
  tokens.reduce<Token[][]>((runs, token, at) => {
    if (!NAME_PARTS.has(token.pos)) return runs;
    const current = runs.at(-1);
    if (current !== undefined && current.at(-1) === tokens[at - 1] && isTouching(tokens[at - 1], token)) return [...runs.slice(0, -1), [...current, token]];
    return [...runs, [token]];
  }, []);

/** Whether the run's last word ends on a name's closing word and a word stands before the closing word. */
const closesName = (run: readonly Token[], endings: readonly string[]): boolean => {
  const last = run.at(-1)?.surface ?? "";
  const written = run.map((token) => token.surface).join("");
  return endings.some((ending) => last.endsWith(ending) && written.length > ending.length);
};

/** A name in the source: where it lies, how it is written and how it reads. */
export type NameRun = Span & { readonly written: string; readonly reading: string };

/** The names in tokens: noun runs that end on one of endings (園, センター). */
export const nameEndingRuns = (tokens: readonly Token[], endings: readonly string[]): NameRun[] =>
  nounRuns(tokens)
    .filter((run) => closesName(run, endings))
    .flatMap((run) => {
      const [first, last] = [run[0], run.at(-1)];
      if (first === undefined || last === undefined) return [];
      const written = run.map((token) => token.surface).join("");
      const reading = run.map((token) => token.reading ?? token.surface).join("");
      return [{ start: first.span.start, end: last.span.end, written, reading }];
    });

/** The names written one way only among names: a reading written two ways (こども家庭庁, 子ども家庭庁) is not a name's own spelling. */
export const namesWrittenOneWay = (names: readonly NameRun[]): Set<string> => {
  const ways = names.reduce(
    (byReading, name) => byReading.set(name.reading, (byReading.get(name.reading) ?? new Set<string>()).add(name.written)),
    new Map<string, Set<string>>(),
  );
  return new Set(names.filter((name) => ways.get(name.reading)?.size === 1).map((name) => name.written));
};
