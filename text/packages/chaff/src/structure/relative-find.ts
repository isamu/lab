import type { DocumentProfile, Mention, RelativeVocabulary, Span } from "../plugin.ts";

/**
 * 前条・次項・同号・本条・前各項・前二項・前条第二項、条を書かない「第一項」を行の中から探す。語は文書の種類（profiles/*.yaml）が決める。
 * ここでは番地を決めず、何をどれだけ指すかだけを attrs に残す。番地は木ができてから relative-resolve.ts が決める。
 */
type RelativeWay = "before" | "after" | "same" | "current" | "continue";

type NumberReader = (text: string) => number | undefined;

const escape = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const oneOf = (words: readonly string[]): string => (words.length === 0 ? "(?!)" : words.map(escape).join("|"));

type Compiled = {
  readonly named: RegExp;
  readonly bare: RegExp | undefined;
  readonly suffix: RegExp;
  readonly notAfter: RegExp | undefined;
  readonly joins: RegExp;
  readonly ways: ReadonlyMap<string, RelativeWay>;
};

const waysOf = (vocabulary: RelativeVocabulary): Map<string, RelativeWay> =>
  new Map<string, RelativeWay>([
    ...vocabulary.before.map((word): [string, RelativeWay] => [word, "before"]),
    ...vocabulary.after.map((word): [string, RelativeWay] => [word, "after"]),
    ...vocabulary.same.map((word): [string, RelativeWay] => [word, "same"]),
    ...vocabulary.current.map((word): [string, RelativeWay] => [word, "current"]),
  ]);

/** 後ろの決まり: 番地の並びと同じく、つなぎの語を挟んで address_end。「前条件」の「前条」を参照にしない。 */
const endOf = (profile: DocumentProfile): string => {
  const connectives = profile.connectives.length === 0 ? "" : `(?:${oneOf(profile.connectives)})*`;
  return profile.addressEnd === undefined ? "" : `(?=${connectives}(?:${profile.addressEnd}))`;
};

const compile = (profile: DocumentProfile, vocabulary: RelativeVocabulary): Compiled => {
  const units = oneOf(Object.keys(vocabulary.units));
  const suffix = `${escape(vocabulary.suffixPrefix)}(?:${vocabulary.count})(?:${units})`;
  const end = endOf(profile);
  const start = vocabulary.notAfter === undefined ? "" : `(?<!${vocabulary.notAfter})`;
  const way = oneOf([...vocabulary.before, ...vocabulary.after, ...vocabulary.same, ...vocabulary.current]);
  const count = `${oneOf(vocabulary.every)}|${vocabulary.count}`;
  const inside = `${escape(vocabulary.suffixPrefix)}(?:${vocabulary.count})(?:${oneOf(vocabulary.inside)})`;
  return {
    named: new RegExp(`${start}(?<way>${way})(?<count>${count})?(?<unit>${units})(?<suffix>(?:${suffix})*)${end}`, "gu"),
    // 前の文字は見ない。語に続くもの（別表第一第一号）も見つけて、並びの続きを止めるのに使う。
    bare: vocabulary.inside.length === 0 ? undefined : new RegExp(`(?<suffix>${inside}(?:${suffix})*)${end}`, "gu"),
    suffix: new RegExp(`${escape(vocabulary.suffixPrefix)}(?<n>${vocabulary.count})(?<unit>${units})`, "gu"),
    notAfter: vocabulary.notAfter === undefined ? undefined : new RegExp(`(?:${vocabulary.notAfter})$`, "u"),
    joins: new RegExp(`(?:${[...vocabulary.joiners, ...profile.connectives.map(escape)].join("|") || "(?!)"})`, "gu"),
    ways: waysOf(vocabulary),
  };
};

const compiled = new WeakMap<DocumentProfile, Compiled>();

/** 「第二項第三号」を「2:2,3:3」（深さ:番号）にする。読めない数があれば undefined。 */
const suffixOf = (text: string, patterns: Compiled, vocabulary: RelativeVocabulary, number: NumberReader): string | undefined => {
  const parts = [...text.matchAll(patterns.suffix)].map((match) => {
    const value = number(match.groups?.["n"] ?? "");
    const depth = vocabulary.units[match.groups?.["unit"] ?? ""];
    return value === undefined || depth === undefined ? undefined : `${String(depth)}:${String(value)}`;
  });
  return parts.includes(undefined) ? undefined : parts.join(",");
};

/** 「各」は前の全部（0）、数が無ければ 1。 */
const countOf = (count: string | undefined, vocabulary: RelativeVocabulary, number: NumberReader): number | undefined => {
  if (count === undefined) return 1;
  return vocabulary.every.includes(count) ? 0 : number(count);
};

type Substitution = NonNullable<RelativeVocabulary["substitution"]>;

/** 文字と、その位置（UTF-16 の単位で）。絵文字のような 2 単位の文字も 1 文字として読む。 */
const characters = (text: string): { readonly char: string; readonly at: number }[] => {
  const found: { char: string; at: number }[] = [];
  let at = 0;
  for (const char of text) {
    found.push({ char, at });
    at += char.length;
  }
  return found;
};

/** 一番外側の括弧の範囲。閉じの無い開きは捨てる。 */
const outerQuotes = (text: string, quote: Substitution): Span[] => {
  const spans: Span[] = [];
  const opens: number[] = [];
  characters(text).forEach(({ char, at }) => {
    if (char === quote.open) opens.push(at);
    const start = char === quote.close ? opens.pop() : undefined;
    if (start !== undefined && opens.length === 0) spans.push({ start, end: at + char.length });
  });
  return spans;
};

/** 読み替えの括弧（閉じの直後か開きの直前に目印があるもの）の範囲。 */
const substitutionSpans = (text: string, quote: Substitution | undefined): Span[] =>
  quote === undefined
    ? []
    : outerQuotes(text, quote).filter(
        (span) => quote.after.some((marker) => text.startsWith(marker, span.end)) || quote.before.some((marker) => text.slice(0, span.start).endsWith(marker)),
      );

/** 閉じた括弧書きを内側から外す。 */
const withoutAsides = (gap: string, aside: RelativeVocabulary["aside"]): string => {
  if (aside === undefined) return gap;
  const inner = new RegExp(`${escape(aside.open)}[^${escape(aside.open)}${escape(aside.close)}]*${escape(aside.close)}`, "gu");
  const once = gap.replace(inner, "");
  return once === gap ? gap : withoutAsides(once, aside);
};

/** あいだが、並びをつなぐもの・つなぎの語・閉じた括弧書き・空白だけか。 */
const onlyJoins = (gap: string, patterns: Compiled, vocabulary: RelativeVocabulary): boolean =>
  withoutAsides(gap, vocabulary.aside).replace(patterns.joins, "").trim() === "";

const overlaps = (start: number, end: number, others: readonly Mention[]): boolean => others.some((other) => start < other.end && other.start < end);

/** 行き先を決められない番地。並びの続きを止めるためだけに覚え、参照にはしない。 */
const OPAQUE = "opaque";

/** すぐ前が not_after に当たる（「別表第一」の「一」に続く「第一号」）。 */
const glued = (text: string, start: number, patterns: Compiled): boolean => patterns.notAfter?.test(text.slice(0, start)) === true;

type Bare = { readonly start: number; readonly end: number; readonly label: string; readonly suffix: string; readonly first: number };

const bareCandidates = (text: string, patterns: Compiled, vocabulary: RelativeVocabulary, number: NumberReader): Bare[] =>
  patterns.bare === undefined
    ? []
    : [...text.matchAll(patterns.bare)].flatMap((match) => {
        const suffix = suffixOf(match.groups?.["suffix"] ?? "", patterns, vocabulary, number);
        const first = Number(suffix?.split(":")[0]);
        return suffix === undefined || !Number.isInteger(first)
          ? []
          : [{ start: match.index, end: match.index + match[0].length, label: match[0], suffix, first }];
      });

/** 並びの中での扱い: 前の参照の続きか、今いるところの中か、行き先を決められないか。 */
type BareWay = { readonly way: string; readonly continues?: Mention | undefined };

/** 並びの中での扱い: 前の参照の続きか、今いるところの中か、行き先を決められないか。続きなら、どの参照の続きか。 */
const wayOfBare = (text: string, bare: Bare, known: readonly Mention[], patterns: Compiled, vocabulary: RelativeVocabulary): BareWay => {
  if (glued(text, bare.start, patterns)) return { way: OPAQUE };
  const depth = openAsides(text, bare.start, vocabulary).length;
  const sameDepth = known.filter((other) => other.end <= bare.start && openAsides(text, other.end, vocabulary).length === depth);
  const previous = sameDepth.toSorted((left, right) => left.end - right.end).at(-1);
  const joined = previous !== undefined && onlyJoins(text.slice(previous.end, bare.start), patterns, vocabulary) ? previous : undefined;
  const continues = joined ?? ownerOfAside(text, bare.start, known, vocabulary);
  if (continues === undefined) return { way: "current" };
  return continues.attrs["relative"] === OPAQUE ? { way: OPAQUE } : { way: "continue", continues };
};

/** at の位置で開いたままの括弧書きの開きの位置。並びは同じ深さの参照どうしでつながる。 */
const openAsides = (text: string, at: number, vocabulary: RelativeVocabulary): number[] => {
  const aside = vocabulary.aside;
  const opens: number[] = [];
  if (aside === undefined) return opens;
  characters(text.slice(0, at)).forEach(({ char, at: position }) => {
    if (char === aside.open) opens.push(position);
    if (char === aside.close) opens.pop();
  });
  return opens;
};

/**
 * 参照の直後に開いた括弧書きの中なら、その参照。「第二十七条（第四項を除き、第五項及び第六項の規定を…）」の番地は、どれも第二十七条の中。
 */
const ownerOfAside = (text: string, at: number, known: readonly Mention[], vocabulary: RelativeVocabulary): Mention | undefined => {
  const open = openAsides(text, at, vocabulary).at(-1);
  return open === undefined ? undefined : known.find((other) => other.end === open);
};

/**
 * 条を書かない「第一項」。すぐ前の参照とのあいだがつなぎの語だけなら、その参照の続き（continue）。
 * そうでなければ、書いた場所を含む一つ上のまとまり（current）の中。
 */
const bareMentions = (text: string, patterns: Compiled, vocabulary: RelativeVocabulary, number: NumberReader, before: readonly Mention[]): Mention[] => {
  const found: Mention[] = [];
  bareCandidates(text, patterns, vocabulary, number).forEach((bare) => {
    const known = [...before, ...found];
    if (overlaps(bare.start, bare.end, known)) return;
    const { way, continues } = wayOfBare(text, bare, known, patterns, vocabulary);
    // 条を書かない番地は、その一つ上（level）ではなく、書いた単位（level + 1）から名指しする。「第一項」は「同条」の行き先を変えない。
    // continues は、続きの元の参照がどれだけ前から始まるか。木の中で、その参照を位置で引く。
    const back = continues === undefined ? {} : { continues: bare.start - continues.start };
    const attrs = { label: bare.label, relative: way, level: bare.first - 1, count: 1, suffix: bare.suffix, names: bare.first, ...back };
    found.push({ start: bare.start, end: bare.end, attrs });
  });
  return found.filter((mention) => mention.attrs["relative"] !== OPAQUE);
};

const namedMentions = (text: string, patterns: Compiled, vocabulary: RelativeVocabulary, number: NumberReader): Mention[] =>
  [...text.matchAll(patterns.named)].flatMap((match) => {
    const groups = match.groups ?? {};
    const way = patterns.ways.get(groups["way"] ?? "");
    const level = vocabulary.units[groups["unit"] ?? ""];
    const count = countOf(groups["count"], vocabulary, number);
    const suffix = suffixOf(groups["suffix"] ?? "", patterns, vocabulary, number);
    if (way === undefined || level === undefined || count === undefined || suffix === undefined) return [];
    return [{ start: match.index, end: match.index + match[0].length, attrs: { label: match[0], relative: way, level, count, suffix } }];
  });

/** absolute は同じ行の番地を名指しした参照。条を書かない番地が、その続きかどうかを決めるのに使う。 */
export const relativeMentions = (
  text: string,
  profile: DocumentProfile | undefined,
  number: NumberReader | undefined,
  absolute: readonly Mention[] = [],
): Mention[] => {
  const vocabulary = profile?.relative;
  if (profile === undefined || vocabulary === undefined || number === undefined) return [];
  if (!compiled.has(profile)) compiled.set(profile, compile(profile, vocabulary));
  const patterns = compiled.get(profile);
  if (patterns === undefined) return [];
  const substituted = substitutionSpans(text, vocabulary.substitution);
  const named = namedMentions(text, patterns, vocabulary, number);
  const bare = bareMentions(text, patterns, vocabulary, number, [...absolute, ...named]);
  return [...named, ...bare]
    .filter((mention) => !substituted.some((span) => span.start <= mention.start && mention.start < span.end))
    .sort((left, right) => left.start - right.start);
};
