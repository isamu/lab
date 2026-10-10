import type { Token } from "./plugin.ts";
import { escapeRegExp } from "./orthography.ts";
import { nameCueAt, type NameCue, type NameCues } from "./name-cue.ts";
import { isNearSurname } from "./surname-near.ts";
import { foldedKeysOf, NO_SPELLING, type SpellingInput } from "./name-spelling-chars.ts";
import { NO_CHAR_READINGS, readingOfWords } from "./name-char-reading.ts";

// 同じ名前（人・会社・製品）を、文書の中で少しだけ違う形に書いた所。どの形が正しいかは決めず、少ないほうを指す。
// 三通りで同じ名前と見る。書き方の違いだけ（GitHub と Github、Mac OS と macOS）、読みが同じ（山田太郎 と 山田太朗）、
// 英字の一字違い（Microsoft と Microsft）。一字違いは別の名前でもありうるので、多いほうが二度以上、少ないほうが一度だけのときに限る。

/**
 * words は名前の語（記号を除く）。読みが同じ二つの名前が、どの語で違うかを見るため。person は人の名前と読めるもの（解析器が
 * 人名と読むか、敬称が付く）。cue は前後の語から見た名前らしさ（name-cue.ts）。
 */
export type NameMention = {
  readonly surface: string;
  readonly offset: number;
  readonly reading: string | undefined;
  readonly words: readonly string[];
  readonly person?: boolean;
  readonly cue?: NameCue;
};

export type NameVariant = {
  readonly mention: NameMention;
  readonly usual: string;
  readonly kind: "spelling" | "kana" | "reading" | "near" | "surname" | "character";
};

/** 字体の違う同じ字（斎・斉・齋）。字から、その組の代表の字へ。 */
export type VariantChars = ReadonlyMap<string, string>;

const NAME = "PROPN";
/**
 * 名前の語のあいだに挟まってよい記号（AT&T、Rolls-Royce、ジョン・スミス）。読点は挟まない。
 * 並べた名前（Zeebrugge, Kerk、Cook, Lisa）を一つの名前にしてしまう。
 */
const JOINERS: ReadonlySet<string> = new Set(["&", "-", "・"]);
const LETTER = /\p{L}/u;

/** 名前の語。字を含むもの。記号だけの語（wiki の '' ）を固有名詞と読む解析器がある。 */
const isName = (token: Token | undefined): boolean => token?.pos === NAME && LETTER.test(token.surface);

/** 固有名詞の続き。記号一つを挟んで固有名詞が続けば、一つの名前。 */
const runsOf = (tokens: readonly Token[]): Token[][] => {
  const runs: Token[][] = [];
  const current: Token[] = [];
  const close = (): void => {
    if (current.length > 0) runs.push(current.splice(0));
  };
  tokens.forEach((token, index) => {
    const bridges = JOINERS.has(token.surface) && current.length > 0 && isName(tokens[index + 1]);
    if (isName(token) || bridges) current.push(token);
    else close();
  });
  close();
  return runs;
};

const LOWER = /\p{Ll}/u;
const UPPER = /\p{Lu}/u;
const isUpperOnly = (text: string): boolean => UPPER.test(text) && !LOWER.test(text);
/** 小文字の英字だけの語（the、issue）。日本語の解析器は英単語を固有名詞と読むので、ふつうの語と名前の区別がつかない。 */
const LOWER_LATIN_ONLY = /^[a-z\s-]+$/u;
/** 行末で切った語のハイフン（Internet-⏎Drafts）。空白をまとめると "Internet- Drafts" になる。 */
const WRAPPED_HYPHEN = /-\s+/gu;
/** 名前の前後に付いた引用の印（wiki の斜体 ''、Hbase'）。名前の一部ではない。 */
const QUOTE_MARKS: ReadonlySet<string> = new Set(["'", "’", '"', "“", "”"]);

const withoutEdgeQuotes = (text: string): string => {
  const chars = [...text];
  const start = chars.findIndex((char) => !QUOTE_MARKS.has(char));
  const end = chars.findLastIndex((char) => !QUOTE_MARKS.has(char));
  return start < 0 ? "" : chars.slice(start, end + 1).join("");
};
/**
 * 名前として比べないもの。@ で始まる SNS のアカウント（@SpaceX は SpaceX の別の書き方ではない）と、一字の語を含むもの
 * （Attachment S、Appendix B は札で、空白を詰めると Attachments と同じ形になる）。
 */
const NOT_COMPARED = /@|(?:^|\s)\p{L}(?:\s|$)/u;

/** 人名と読む解析器の印（UD の NameType: 姓 Sur、名 Giv、どちらとも言えない人名 Prs）。 */
const PERSON_TYPES: ReadonlySet<string> = new Set(["Sur", "Giv", "Prs"]);

/** 人の名前か。解析器が人名と読む語を含むか、すぐ後ろに敬称（様、さん、氏）が付く。 */
const isPerson = (run: readonly Token[], next: Token | undefined, suffixes: readonly string[]): boolean =>
  run.some((token) => PERSON_TYPES.has(token.features?.["NameType"] ?? "")) || (next !== undefined && suffixes.includes(next.surface));

/**
 * 文の語から、名前の現れ。surface は source の上の書いたまま（折り返しの空白は一つにまとめる）。
 * 大文字だけの名前（ACME INC、NASA）は外す。契約書の署名欄や略語で、ふつうの書き方の別の形ではない。小文字の英字だけの語も外す。
 * charReadings は解析器が読めない名前の字の読み（name-char-reading.ts）。人の名前と読めるものだけに使う。
 */
export const mentionsIn = (tokens: readonly Token[], source: string, personSuffixes: readonly string[] = [], charReadings = NO_CHAR_READINGS): NameMention[] =>
  runsOf(tokens).flatMap((run) => {
    const first = run[0];
    const last = run.at(-1);
    if (first === undefined || last === undefined) return [];
    const written = source.slice(first.span.start, last.span.end).replaceAll(WRAPPED_HYPHEN, "-").replaceAll(/\s+/gu, " ");
    const surface = withoutEdgeQuotes(written);
    if (surface === "" || isUpperOnly(surface) || LOWER_LATIN_ONLY.test(surface) || NOT_COMPARED.test(surface)) return [];
    const words = run.filter((token) => !JOINERS.has(token.surface));
    const person = isPerson(run, tokens[tokens.indexOf(last) + 1], personSuffixes);
    const reading = readingOfWords(words, person ? charReadings : NO_CHAR_READINGS);
    return [{ surface, offset: first.span.start, reading, words: words.map((token) => token.surface), person }];
  });

/** 隣の語を探す範囲（UTF-16 の単位）。 */
const NEIGHBOUR_LOOKBACK = 40;
/** 隣の語の外側の記号（(Rachel、Floyd.）。名前の側の記号（Rachel, Whitford の ,）は語を切るので残す。 */
const MARK = /\p{P}/u;
const withoutLeadingMarks = (word: string): string => {
  const chars = [...word];
  const start = chars.findIndex((char) => !MARK.test(char));
  return start < 0 ? "" : chars.slice(start).join("");
};
const withoutTrailingMarks = (word: string): string => {
  const chars = [...word];
  return chars.slice(0, chars.findLastIndex((char) => !MARK.test(char)) + 1).join("");
};

const wordBeforeAt = (source: string, offset: number): string | undefined => {
  if (source.charAt(offset - 1) !== " ") return undefined;
  const from = Math.max(0, offset - 1 - NEIGHBOUR_LOOKBACK);
  const parts = source.slice(from, offset - 1).split(/\s/u);
  const word = withoutLeadingMarks(parts.at(-1) ?? "");
  return word === "" || (from > 0 && parts.length === 1) ? undefined : word;
};

const wordAfterAt = (source: string, end: number): string | undefined => {
  if (source.charAt(end) !== " ") return undefined;
  const word = withoutTrailingMarks(source.slice(end + 1, end + 1 + NEIGHBOUR_LOOKBACK).split(/\s/u)[0] ?? "");
  return word === "" ? undefined : word;
};

/**
 * 解析器が名前の一語を名前と読まなかった所（to Rachel Whitford の Rachel を動詞と読む）。空白一つで隣の語と合わせた形を、ほかの所で
 * 名前と読めていれば、その形の現れと見る。隣の語がほかの名前の現れに入るなら合わせない。
 */
export const withKnownNeighbours = (mentions: readonly NameMention[], source: string): NameMention[] => {
  const known = new Set(mentions.filter((mention) => mention.words.length >= 2).map((mention) => mention.surface));
  const taken = (start: number, end: number): boolean => mentions.some((mention) => mention.offset < end && start < mention.offset + mention.surface.length);
  return mentions.map((mention) => {
    const end = mention.offset + mention.surface.length;
    const before = wordBeforeAt(source, mention.offset);
    const after = wordAfterAt(source, end);
    if (before !== undefined && known.has(`${before} ${mention.surface}`) && !taken(mention.offset - 1 - before.length, mention.offset - 1)) {
      return {
        ...mention,
        surface: `${before} ${mention.surface}`,
        offset: mention.offset - 1 - before.length,
        reading: undefined,
        words: [before, ...mention.words],
      };
    }
    if (after !== undefined && known.has(`${mention.surface} ${after}`) && !taken(end + 1, end + 1 + after.length)) {
      return { ...mention, surface: `${mention.surface} ${after}`, reading: undefined, words: [...mention.words, after] };
    }
    return mention;
  });
};

/** 敬称の前の名前の字数（髙橋、髙橋太郎）。長い漢字の連なり（株式会社髙橋）は名前だけを切り出せない。 */
const MAX_SUFFIXED_NAME = 4;
const MIN_SUFFIXED_NAME = 2;
/** 敬称の前を読む範囲（UTF-16 の単位）。名前より長い漢字の連なりを、長いまま見るため。 */
const SUFFIX_LOOKBACK = 20;
const HAN = /^\p{Script=Han}$/u;

/** 文字列の終わりの漢字の連なり。 */
const trailingHan = (text: string): string => {
  const letters = [...text];
  return letters.slice(letters.findLastIndex((letter) => !HAN.test(letter)) + 1).join("");
};

/**
 * 解析器が名前と読めなかった、字体の違う字を含む人の名前（髙橋様、𠮷田様、﨑山様）。敬称のすぐ前の漢字の連なりで、語彙表の字を
 * 含み、ほかの名前の現れと重ならないもの。
 */
export const suffixedNamesIn = (source: string, suffixes: readonly string[], chars: VariantChars, taken: readonly NameMention[]): NameMention[] =>
  suffixes.flatMap((suffix) =>
    [...source.matchAll(new RegExp(escapeRegExp(suffix), "gu"))].flatMap((match) => {
      const run = trailingHan(source.slice(Math.max(0, match.index - SUFFIX_LOOKBACK), match.index));
      const length = [...run].length;
      if (length < MIN_SUFFIXED_NAME || length > MAX_SUFFIXED_NAME || ![...run].some((letter) => chars.has(letter))) return [];
      const offset = match.index - run.length;
      if (taken.some((mention) => mention.offset < match.index && offset < mention.offset + mention.surface.length)) return [];
      return [{ surface: run, offset, reading: undefined, words: [run], person: true }];
    }),
  );

const HAN_RUN = /\p{Script=Han}+/gu;

/**
 * 解析器が名前と読めず、敬称も無いが、前後の語で名前と読める、字体の違う字を含む漢字（担当の髙橋です、髙橋まで）。
 * ほかの名前の現れと重ならないもの。
 */
export const cuedNamesIn = (source: string, cues: NameCues, chars: VariantChars, taken: readonly NameMention[]): NameMention[] =>
  [...source.matchAll(HAN_RUN)].flatMap((match) => {
    const [run] = match;
    const cue = nameCueAt(source, match.index, run, cues);
    if (cue === undefined || cue === "bare" || ![...run].some((letter) => chars.has(letter))) return [];
    const end = match.index + run.length;
    if (taken.some((mention) => mention.offset < end && match.index < mention.offset + mention.surface.length)) return [];
    return [{ surface: run, offset: match.index, reading: undefined, words: [run], cue }];
  });

/** 比べる形。幅（ＡＷＳ と AWS）、大文字小文字、空白と記号は名前を変えない。 */
export const nameKey = (surface: string): string =>
  surface
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll(/[\s\p{P}\p{S}]/gu, "");

/**
 * 名前の現れから言えること。person: 人の名前と読める。named: 人を指す前置きか敬称が付く。nameLike: 名前の来る場所にある（前置き
 * か敬称、名前のすぐ後ろに来る語）。解析器の人名の印は地名にも付く（鹿嶋へ）ので、nameLike には数えない。
 */
export type NameEvidence = { readonly person: boolean; readonly named: boolean; readonly nameLike: boolean };

type Tally = NameEvidence & { readonly surface: string; readonly first: NameMention; readonly count: number };

const evidenceOf = (mention: NameMention): NameEvidence => ({
  person: mention.person === true,
  named: mention.cue === "person",
  nameLike: mention.cue === "person" || mention.cue === "slot",
});

/** 書き方ごとの数と、どれかの現れが言えること。 */
const talliesOf = (mentions: readonly NameMention[]): Tally[] => {
  const tallies = new Map<string, Tally>();
  mentions.forEach((mention) => {
    const tally = tallies.get(mention.surface);
    const evidence = evidenceOf(mention);
    tallies.set(
      mention.surface,
      tally === undefined
        ? { surface: mention.surface, first: mention, count: 1, ...evidence }
        : {
            ...tally,
            count: tally.count + 1,
            person: tally.person || evidence.person,
            named: tally.named || evidence.named,
            nameLike: tally.nameLike || evidence.nameLike,
          },
    );
  });
  return [...tallies.values()];
};

/** 多いほう。同数なら先に書いたほう。 */
const usualOf = (group: readonly Tally[]): Tally | undefined =>
  group.toSorted((left, right) => right.count - left.count || left.first.offset - right.first.offset)[0];

const groupBy = (tallies: readonly Tally[], keysOf: (tally: Tally) => readonly string[]): Tally[][] => {
  const groups = new Map<string, Tally[]>();
  tallies.forEach((tally) =>
    keysOf(tally).forEach((key) => {
      const group = groups.get(key);
      if (group === undefined) groups.set(key, [tally]);
      else group.push(tally);
    }),
  );
  return [...groups.values()].filter((group) => group.length > 1);
};

/**
 * 組の中で、それぞれの書き方を、同じ名前と言える相手（alike）のうち多いほうと比べる。組全体で一番多いものとだけ比べると、
 * 同じ読みの別の名前（山田太郎 と 矢間田多労）が多ければ、本当の書き分け（山田太朗）が隠れる。
 */
const variantsIn = (groups: readonly Tally[][], kind: NameVariant["kind"], alike: (tally: Tally, other: Tally) => boolean = () => true): NameVariant[] =>
  groups.flatMap((group) =>
    group.flatMap((tally) => {
      const usual = usualOf([tally, ...group.filter((other) => other !== tally && alike(tally, other))]);
      return usual === undefined || usual === tally ? [] : [{ mention: tally.first, usual: usual.surface, kind }];
    }),
  );

/**
 * 読みが同じでも、別の名前のことが多い（毅 と 敦士、札幌 と サッポロ）。語が二つ以上あり、違うのが一語だけのとき
 * （山田太郎 と 山田太朗）に限る。
 */
const oneWordApart = (tally: Tally, usual: Tally): boolean => {
  const words = tally.first.words;
  const others = usual.first.words;
  return words.length >= 2 && words.length === others.length && words.filter((word, index) => word !== others[index]).length === 1;
};

/** 一字違いを比べる語の長さ。短い語（Iran と Iraq、RET と REU、II と VI）は一字違いでも別の語。 */
const MIN_NEAR_LENGTH = 5;
const LATIN_WORD = /^[a-z]+$/u;

const wordsOf = (surface: string): string[] => surface.toLowerCase().split(/[\s-]+/u);

/** 一字の置き換えか、隣どうしの入れ替え（Microsfot）。 */
const isSwapOrReplace = (left: string, right: string): boolean => {
  const differ = [...left].flatMap((char, index) => (char === right.charAt(index) ? [] : [index]));
  const [first, second] = differ;
  if (differ.length === 1) return true;
  return (
    differ.length === 2 &&
    first !== undefined &&
    second === first + 1 &&
    left.charAt(first) === right.charAt(second) &&
    left.charAt(second) === right.charAt(first)
  );
};

/**
 * 語の中の一字の抜け。語の終わりの抜け（Service と Services、America と American）は語の形の違い、頭の抜け（State と XState）は
 * 別の名前で、書き損じではない。
 */
const isInnerDrop = (longer: string, shorter: string): boolean =>
  [...longer].some((_char, index) => index > 0 && index < longer.length - 1 && longer.slice(0, index) + longer.slice(index + 1) === shorter);

/** 二つの語が一字違いか。英字だけの、長さ 5 以上の語で。 */
export const isNearWord = (left: string, right: string): boolean => {
  if (left === right || !LATIN_WORD.test(left) || !LATIN_WORD.test(right) || Math.min(left.length, right.length) < MIN_NEAR_LENGTH) return false;
  if (left.length === right.length) return isSwapOrReplace(left, right);
  if (left.length === right.length + 1) return isInnerDrop(left, right);
  return right.length === left.length + 1 && isInnerDrop(right, left);
};

/** 語の一つを伏せた形。ほかの語が同じ二つの名前は、同じ形を一つ持つ。 */
const maskedKeys = (tally: Tally): string[] => {
  const words = wordsOf(tally.surface);
  return words.map((_word, index) => words.map((word, at) => (at === index ? "*" : word)).join(" "));
};

const differingWords = (left: Tally, right: Tally): readonly [string, string] | undefined => {
  const leftWords = wordsOf(left.surface);
  const rightWords = wordsOf(right.surface);
  const at = leftWords.findIndex((word, index) => word !== rightWords[index]);
  const [leftWord, rightWord] = [leftWords[at], rightWords[at]];
  return leftWords.length === rightWords.length && leftWord !== undefined && rightWord !== undefined ? [leftWord, rightWord] : undefined;
};

/** 一語だけが一字違いで、相手が二度以上、こちらが一度だけ。 */
const isSlipOf = (tally: Tally, other: Tally): boolean => {
  if (tally.count !== 1 || other.count < 2) return false;
  const words = differingWords(tally, other);
  return words !== undefined && isNearWord(...words);
};

const nearVariants = (tallies: readonly Tally[]): NameVariant[] => variantsIn(groupBy(tallies, maskedKeys), "near", isSlipOf);

/**
 * 名が同じで姓だけが二字ほど違う人の名前（Rachel Whitford と Rachel Whitfield）。一字違い（near）より遠いので、名と姓の二語以上
 * で、違うのが最後の語のときに限る。相手が二度以上、こちらが一度だけ。名の違う二人（Sara Whitford と Rachel Whitfield）は比べない。
 */
const isSurnameSlipOf = (tally: Tally, other: Tally): boolean => {
  if (tally.count !== 1 || other.count < 2) return false;
  const [words, others] = [wordsOf(tally.surface), wordsOf(other.surface)];
  const last = words.length - 1;
  const sameBefore = words.slice(0, last).every((word, index) => word === others[index]);
  return last >= 1 && words.length === others.length && sameBefore && isNearSurname(words[last] ?? "", others[last] ?? "");
};

const surnameVariants = (tallies: readonly Tally[]): NameVariant[] => variantsIn(groupBy(tallies, maskedKeys), "surname", isSurnameSlipOf);

/** 字体の違う字（斎と斉）を組の代表の字に寄せた形。 */
const characterKey = (tally: Tally, chars: VariantChars): string => [...tally.surface].map((letter) => chars.get(letter) ?? letter).join("");

/**
 * 字体の違う字で書き分けた二つを、同じ人の名前と見るか。どちらも人の名前と読めるか、片方に人を指す前置きか敬称が付き
 * （担当の斎藤です）、もう片方が名前の来る場所にある（斉藤まで）。地名にも同じ組がある（鹿島 と 鹿嶋）ので、名前の来る場所どうし
 * だけでは見ない。
 */
export const isCharacterPair = (left: NameEvidence, right: NameEvidence): boolean =>
  (left.person && right.person) || (left.named && right.nameLike) || (right.named && left.nameLike);

/** 人の名前を、字体の違う同じ字（斎藤 と 斉藤、渡辺 と 渡邊）で書き分けた所。 */
const characterVariants = (tallies: readonly Tally[], chars: VariantChars): NameVariant[] =>
  variantsIn(
    groupBy(
      tallies.filter((tally) => tally.person || tally.nameLike),
      (tally) => [characterKey(tally, chars)],
    ),
    "character",
    isCharacterPair,
  );

/** 字数が同じで、一字だけが違う（松本 と 松元）。 */
const oneCharApart = (left: string, right: string): boolean => {
  const [leftChars, rightChars] = [[...left], [...right]];
  return leftChars.length === rightChars.length && leftChars.filter((char, index) => char !== rightChars[index]).length === 1;
};

/**
 * 読みが同じ人の名前が、一字だけ違う（松本 と 松元）。読みの同じ別の姓（伊藤 と 伊東）もあるので、多いほうが二度以上、
 * 少ないほうが一度だけのときに限る。
 */
const isPersonSlipOf = (tally: Tally, other: Tally): boolean => tally.count === 1 && other.count >= 2 && oneCharApart(tally.surface, other.surface);

const personReadingVariants = (tallies: readonly Tally[]): NameVariant[] =>
  variantsIn(
    groupBy(
      tallies.filter((tally) => tally.person),
      (tally) => (tally.first.reading === undefined ? [] : [tally.first.reading]),
    ),
    "reading",
    isPersonSlipOf,
  );

/**
 * 同じ名前の、少ないほうの書き方。書き方ごとに最初の現れを一つ。同じ現れを二つの見方が言えば、先の見方だけ。chars は字体の
 * 違う同じ字の組（語彙表 name-variant-char）。
 */
export const nameVariants = (mentions: readonly NameMention[], chars: VariantChars = new Map(), spelling: SpellingInput = NO_SPELLING): NameVariant[] => {
  const tallies = talliesOf(mentions);
  const found = [
    ...variantsIn(
      groupBy(tallies, (tally) => [nameKey(tally.surface)]),
      "spelling",
    ),
    ...variantsIn(
      groupBy(talliesOf([...mentions, ...spelling.alsoWritten]), (tally) => foldedKeysOf(tally.surface, spelling.chars).map(nameKey)),
      "kana",
    ),
    ...variantsIn(
      groupBy(tallies, (tally) => (tally.first.reading === undefined ? [] : [tally.first.reading])),
      "reading",
      oneWordApart,
    ),
    ...nearVariants(tallies),
    ...surnameVariants(tallies),
    ...characterVariants(tallies, chars),
    ...personReadingVariants(tallies),
  ];
  const reported = new Set<string>();
  return found
    .filter((variant) => !reported.has(variant.mention.surface) && reported.add(variant.mention.surface).size > 0)
    .toSorted((left, right) => left.mention.offset - right.mention.offset);
};
