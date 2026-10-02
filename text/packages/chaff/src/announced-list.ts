import type { Lexicon, LexiconEntry, Sentence, Token } from "./plugin.ts";
import { entryRanges } from "./detectors/lexicon-match.ts";

// 一覧を言う語（supported on、に対応）の隣に並べた名前を読み、後の文が、最初に挙げた一覧に無い名前を同じ語で言っていないかを見る。
// 「対応 OS は Windows と macOS」と書いたあとの「Linux にも対応」。どちらが正しいかは決めず、一覧の外の名前を指す。

export type ListMember = { readonly name: string; readonly offset: number };

export type ListStatement = { readonly group: string; readonly offset: number; readonly members: readonly ListMember[] };

export type OutsideMember = { readonly member: ListMember; readonly announced: ListStatement };

const UPPER = /\p{Lu}/u;

/**
 * 名前の語。固有名詞のほか、大文字を含む名詞（macOS、Linux）。日本語の解析器は英字の名前を名詞とも固有名詞とも読むので、
 * 品詞だけでは同じ一覧の名前が揃わない。
 */
const isNameToken = (token: Token): boolean => token.pos === "PROPN" || (token.pos === "NOUN" && UPPER.test(token.surface));

const isJoiner = (token: Token, joiners: ReadonlySet<string>): boolean => joiners.has(token.surface.toLowerCase());

/** 名前の語の並び（前へ読んだときは逆順）から、source の上の名前。 */
const memberOf = (run: readonly Token[], source: string): ListMember | undefined => {
  if (run.length === 0) return undefined;
  const start = Math.min(...run.map((token) => token.span.start));
  const end = Math.max(...run.map((token) => token.span.end));
  return { name: source.slice(start, end).replaceAll(/\s+/gu, " "), offset: start };
};

/**
 * 並んだ名前を、語の並びの順に読む。固有名詞が続けば一つの名前、つなぐ語（and、と、、）は名前の区切り。ほかの語に当たったら止まる。
 * 名前で始まらなければ一覧ではない（supported on the web）。
 */
export const namesInOrder = (tokens: readonly Token[], joiners: ReadonlySet<string>, source: string): ListMember[] => {
  const runs: Token[][] = [[]];
  tokens.every((token) => {
    const current = runs.at(-1) ?? [];
    if (isNameToken(token)) current.push(token);
    else if (isJoiner(token, joiners) && current.length > 0) runs.push([]);
    else return false;
    return true;
  });
  return runs.flatMap((run) => memberOf(run, source) ?? []);
};

/** 一覧の語の、一つの現れから読んだ名前。before の語は後ろの名前を、after の語は前の名前を読む。 */
const membersAt = (
  tokens: readonly Token[],
  entry: LexiconEntry,
  range: { start: number; end: number },
  joiners: ReadonlySet<string>,
  source: string,
): ListMember[] =>
  entry.position === "after"
    ? namesInOrder(tokens.slice(0, range.start).toReversed(), joiners, source).toReversed()
    : namesInOrder(tokens.slice(range.end), joiners, source);

/** 一覧を読む言葉。frames は一覧を言う語、joiners は名前をつなぐ語、negations は打ち消しの語（小文字）。 */
export type ListWords = { readonly frames: Lexicon; readonly joiners: ReadonlySet<string>; readonly negations: ReadonlySet<string> };

/** 打ち消した文（neither is available on Docker Hub、Linux には対応していません）は、一覧に足す名前ではなく、外す名前を言う。 */
const isNegated = (tokens: readonly Token[], negations: ReadonlySet<string>): boolean =>
  tokens.some((token) => negations.has(token.surface.toLowerCase()) || negations.has((token.lemma ?? "").toLowerCase()));

/** 文の中の、一覧を言う語と、その隣の名前。group の無い語は比べる相手が決まらないので読まない。打ち消した文も読まない。 */
export const listStatementsIn = (sentence: Sentence, words: ListWords, source: string): ListStatement[] => {
  const tokens = sentence.tokens ?? [];
  const { frames, joiners } = words;
  if (isNegated(tokens, words.negations)) return [];
  return frames.flatMap((entry) => {
    const group = entry.group;
    if (group === undefined) return [];
    return entryRanges(sentence, entry).flatMap((range) => {
      const members = membersAt(tokens, entry, range, joiners, source);
      const offset = tokens[range.start]?.span.start ?? sentence.span.start;
      return members.length === 0 ? [] : [{ group, offset, members }];
    });
  });
};

/** 比べる形。大文字小文字・幅・空白は名前を変えない。 */
const comparable = (name: string): string => name.normalize("NFKC").toLowerCase().replaceAll(/\s+/gu, "");

/** 二つ以上の名前を挙げた最初の文。組ごとに一つ。 */
const announcements = (statements: readonly ListStatement[]): ReadonlyMap<string, ListStatement> =>
  statements.reduce((found, statement) => {
    if (statement.members.length >= 2 && !found.has(statement.group)) found.set(statement.group, statement);
    return found;
  }, new Map<string, ListStatement>());

/**
 * 後の文が、一覧と一つも重ならない二つ以上の名前を挙げていれば、別のものの一覧（RIS は EndNote と RefWorks、BibTeX は BibDesk と LaTeX）。
 * そこから先は、一つだけ名前を言う文がどちらの一覧の続きか決まらないので、その組は比べない。
 */
const isAnotherList = (statement: ListStatement, known: ReadonlySet<string>): boolean =>
  statement.members.length >= 2 && !statement.members.some((member) => known.has(comparable(member.name)));

/** 最初に挙げた一覧より後の文で、同じ組の語が言う、一覧に無い名前。名前ごとに最初の一つ。 */
export const outsideMembers = (statements: readonly ListStatement[]): OutsideMember[] => {
  const ordered = statements.toSorted((left, right) => left.offset - right.offset);
  const announced = announcements(ordered);
  const reported = new Set<string>();
  const ambiguous = new Set<string>();
  return ordered.flatMap((statement) => {
    const list = announced.get(statement.group);
    if (list === undefined || statement.offset <= list.offset || ambiguous.has(statement.group)) return [];
    const known = new Set(list.members.map((member) => comparable(member.name)));
    if (isAnotherList(statement, known)) {
      ambiguous.add(statement.group);
      return [];
    }
    return statement.members.flatMap((member) => {
      const key = `${statement.group}\u0000${comparable(member.name)}`;
      if (known.has(comparable(member.name)) || reported.has(key)) return [];
      reported.add(key);
      return [{ member, announced: list }];
    });
  });
};
