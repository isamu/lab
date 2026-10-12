import type { FactValue } from "./fact-values.ts";
import type { Fact } from "./labelled-facts.ts";
import { keyOfParts, type QualifierWords } from "./qualified-labels.ts";
import { clauseStartOf } from "./term-values.ts";

/**
 * 動詞と「of 名詞」で項目を言う量（"You used 14.2 GB of data."）。項目の名前は名詞と動詞（data used）で、表の行の見出し
 * "Data used" と同じ。主語が読み手か書き手（you、we）なら条件は無く、ほかの主語（The primary line）は名前の条件になる:
 * data used (primary line) は、表の 主回線 の行の升とだけ比べる。値の後ろは「of 名詞」と、文書の期間を言う語（this month）と、
 * 値の終わり（, や .）だけ。"used 3 GB of data on the trip" のような句が続く値は、条件が付くので読まない。
 */
export type VerbQuantityWords = {
  /** 量を言う動詞。過去分詞も同じ形で、名詞の後ろに置いて項目の名前になるもの（used、consumed）。 */
  readonly verbs: readonly string[];
  /** 文書の宛先か書き手を指す主語（you、we）。名前に条件を付けない。 */
  readonly selves: readonly string[];
  /** 文書の期間そのものを言う語（this month）。値の後ろに置いても、値を変えない。 */
  readonly periods: readonly string[];
  readonly valueEnds: readonly string[];
  readonly qualifiers: QualifierWords;
};

const MAX_SUBJECT_WORDS = 4;
const SUBJECT = /^\p{L}+(?: \p{L}+)*$/u;
const OF_NOUN = /^ of (\p{L}+)/u;

const folded = (text: string): string => text.normalize("NFKC").toLowerCase();

const lineEndOf = (source: string, offset: number): number => {
  const end = source.indexOf("\n", offset);
  return end === -1 ? source.length : end;
};

type Subject = { readonly written: string; readonly verb: string };

/** 値の前の「主語 動詞 」。主語は字と空白だけの短い句。 */
const subjectBefore = (source: string, value: FactValue, words: VerbQuantityWords): Subject | undefined => {
  const head = source.slice(clauseStartOf(source, value.start), value.start);
  const verb = words.verbs.find((word) => folded(head).endsWith(` ${folded(word)} `));
  if (verb === undefined) return undefined;
  const written = head.slice(0, head.length - verb.length - 2).trim();
  const ok = SUBJECT.test(written) && written.split(" ").length <= MAX_SUBJECT_WORDS;
  return ok ? { written, verb: folded(verb) } : undefined;
};

/** 名詞の後ろが、期間の語を除いて値の終わりか。 */
const endsAfterNoun = (rest: string, words: VerbQuantityWords): boolean => {
  const period = words.periods.find((word) => folded(rest).startsWith(` ${folded(word)}`));
  const after = period === undefined ? rest : rest.slice(period.length + 1);
  return after === "" || after.startsWith("|") || words.valueEnds.some((end) => after.startsWith(end));
};

/** 値の後ろの「of 名詞」の名詞。後ろが値の終わりでなければ undefined。 */
const nounAfter = (source: string, value: FactValue, words: VerbQuantityWords): string | undefined => {
  const tail = source.slice(value.end, lineEndOf(source, value.end));
  const match = OF_NOUN.exec(tail);
  if (match === null || match[1] === undefined) return undefined;
  return endsAfterNoun(tail.slice(match[0].length), words) ? folded(match[1]) : undefined;
};

/** 単位の字を持つ量（14.2 GB、300 kWh）。金額と率は、動詞の後ろでも読まない。 */
const isMeasured = (value: FactValue): boolean => value.kind === "quantity" && /\p{L}/u.test(value.unit);

const keyOf = (name: string, subject: string, words: VerbQuantityWords): string | undefined => {
  if (words.selves.some((self) => folded(self) === folded(subject))) return name;
  return keyOfParts(name, subject, words.qualifiers);
};

const verbQuantityFact = (source: string, value: FactValue, words: VerbQuantityWords): Fact | undefined => {
  if (!isMeasured(value)) return undefined;
  const subject = subjectBefore(source, value, words);
  const noun = subject === undefined ? undefined : nounAfter(source, value, words);
  if (subject === undefined || noun === undefined) return undefined;
  const name = `${noun} ${subject.verb}`;
  const key = keyOf(name, subject.written, words);
  return key === undefined ? undefined : { label: key, key, value };
};

/** 文の、動詞と「of 名詞」で項目を言う量。 */
export const verbQuantityFacts = (source: string, values: readonly FactValue[], words: VerbQuantityWords): Fact[] =>
  values.flatMap((value) => {
    const fact = verbQuantityFact(source, value, words);
    return fact === undefined ? [] : [fact];
  });
