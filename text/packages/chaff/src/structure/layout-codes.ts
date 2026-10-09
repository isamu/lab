// layout-code-mismatch: a layout code (2LDK, "2 bedrooms") against the rooms a listing names. Pure: the words come in as
// LayoutWords (the layout-code and layout-room lexicons), the text as strings.

export type LayoutPart = "living" | "dining" | "kitchen";
export type LetterGroup = LayoutPart | "storage" | "one-room";
export type RoomGroup = LayoutPart | "room" | "storage" | "unclear";

export type LayoutWords = {
  /** One-letter marks written right after the number (L, D, K, S, R). */
  readonly letters: ReadonlyMap<string, LetterGroup>;
  /** Marks that add a room not counted (2LDK+S). */
  readonly joiners: readonly string[];
  /** Words after the number that say what it counts ("bedrooms", "BR"). */
  readonly counted: readonly string[];
  readonly rooms: readonly { readonly pattern: string; readonly group: RoomGroup }[];
  /** Words after a number that make it a count of rooms (洋室2室): an entry with one is not read as one room. */
  readonly counters: readonly string[];
};

export type LayoutCode = {
  readonly text: string;
  /** Where the code starts and ends in the text it was read from. */
  readonly start: number;
  readonly end: number;
  readonly rooms: number;
  /** The L, D and K a lettered code has. Undefined for a code that says nothing about them ("2 bedrooms", 1R). */
  readonly parts: ReadonlySet<LayoutPart> | undefined;
};

export type Breakdown = {
  readonly rooms: number;
  /** Each L, D or K part the breakdown names, with the entry that names it. */
  readonly parts: ReadonlyMap<LayoutPart, string>;
  /** An entry that is a room in some listings and not in others, or names two kinds at once. */
  readonly unclear: boolean;
};

export type LayoutSlip =
  { readonly kind: "count"; readonly code: LayoutCode; readonly listed: number } | { readonly kind: "part"; readonly code: LayoutCode; readonly entry: string };

const FULLWIDTH_OFFSET = 0xfee0;
const FULLWIDTH_FIRST = 0xff01;
const FULLWIDTH_LAST = 0xff5e;

/** Full-width ASCII (２ＬＤＫ) as ASCII, one character for one, so offsets stay those of the source. */
export const foldWidth = (text: string): string =>
  text.replace(/[！-～]/gu, (char) => {
    const code = char.charCodeAt(0);
    return code >= FULLWIDTH_FIRST && code <= FULLWIDTH_LAST ? String.fromCharCode(code - FULLWIDTH_OFFSET) : char;
  });

const DIGITS = /\d+/uy;
const LATIN = /[a-z]/iu;
const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Whether text has pattern at index, and does not run on into a longer word when the pattern is Latin (2BR is a word after a number). */
const wordAt = (text: string, index: number, pattern: string): boolean => {
  if (text.slice(index, index + pattern.length).toLowerCase() !== pattern.toLowerCase()) return false;
  if (!LATIN.test(pattern)) return true;
  return !WORD_CHAR.test(text.charAt(index + pattern.length)) && !/\p{L}/u.test(text.charAt(index - 1));
};

/** The longest code letters run (3SLDK). A longer run is a word, not a code. */
const MAX_CODE_LETTERS = 5;
/** The most "+S" a code adds (2LDK+S+納戸). */
const MAX_JOINS = 3;

/** The run of code letters at index (LDK, SLDK), with what they say; empty when the run is longer than a code. */
const lettersAt = (text: string, index: number, words: LayoutWords): LetterGroup[] => {
  const head = [...text.slice(index, index + MAX_CODE_LETTERS + 1)];
  const stop = head.findIndex((char) => !words.letters.has(char));
  const length = stop === -1 ? head.length : stop;
  if (length > MAX_CODE_LETTERS) return [];
  return head.slice(0, length).flatMap((char) => words.letters.get(char) ?? []);
};

/** After a lettered code, each "+S" or "+納戸" that adds a room not counted: the index where they end. */
const joinedEnd = (text: string, index: number, words: LayoutWords, joins = 0): number => {
  const joiner = words.joiners.find((mark) => text.startsWith(mark, index));
  if (joiner === undefined || joins === MAX_JOINS) return index;
  const after = index + joiner.length;
  const letter = words.letters.get(text.charAt(after)) === "storage" ? 1 : 0;
  const word = words.rooms.find((room) => room.group === "storage" && wordAt(text, after, room.pattern))?.pattern.length ?? letter;
  return word === 0 ? index : joinedEnd(text, after + word, words, joins + 1);
};

const letteredCode = (text: string, start: number, digitsEnd: number, words: LayoutWords): LayoutCode | undefined => {
  const groups = lettersAt(text, digitsEnd, words);
  const lettersEnd = digitsEnd + groups.length;
  if (!groups.includes("kitchen") && !groups.includes("one-room")) return undefined;
  if (LATIN.test(text.charAt(lettersEnd))) return undefined;
  const end = joinedEnd(text, lettersEnd, words);
  const parts = groups.includes("one-room") ? undefined : new Set(groups.filter((group): group is LayoutPart => group !== "storage"));
  return { text: text.slice(start, end), start, end, rooms: Number(text.slice(start, digitsEnd)), parts };
};

const SPACER = /[ \-‐–]?/uy;

const countedCode = (text: string, start: number, digitsEnd: number, words: LayoutWords): LayoutCode | undefined => {
  SPACER.lastIndex = digitsEnd;
  const after = digitsEnd + (SPACER.exec(text)?.[0].length ?? 0);
  const word = words.counted.find((pattern) => wordAt(text, after, pattern));
  if (word === undefined) return undefined;
  const end = after + word.length;
  return { text: text.slice(start, end), start, end, rooms: Number(text.slice(start, digitsEnd)), parts: undefined };
};

const codeAt = (text: string, start: number, words: LayoutWords): LayoutCode | undefined => {
  if (/[\p{L}\p{N}.,]/u.test(text.charAt(start - 1))) return undefined;
  DIGITS.lastIndex = start;
  const digits = DIGITS.exec(text)?.[0];
  if (digits === undefined) return undefined;
  const digitsEnd = start + digits.length;
  return letteredCode(text, start, digitsEnd, words) ?? countedCode(text, start, digitsEnd, words);
};

/**
 * The one layout code a field value gives (2LDK, 3SLDK, 2LDK+S, "2 bedrooms", 2-bed, 2BR). A value with two codes of
 * different counts ("2LDK or 3DK") gives none: which one the breakdown is for cannot be told.
 */
export const parseLayoutCode = (value: string, words: LayoutWords): LayoutCode | undefined => {
  const text = foldWidth(value);
  const codes = [...text.matchAll(/\d+/gu)].flatMap((match) => codeAt(text, match.index, words) ?? []);
  const first = codes[0];
  if (first === undefined || codes.some((code) => code.rooms !== first.rooms)) return undefined;
  return { ...first, text: value.slice(first.start, first.end) };
};

const ENTRY_SEPARATOR = /[、，,・/／+＋;；\n]/u;
const MULTIPLIER = /(?:[×✕]|(?<=[\s\d])[xX])\s*(\d+)\s*$/u;

/** The kinds of room an entry names, by the room words in it; a lone run of code letters (LDK 12帖, S 4帖) by its letters. */
const groupsOfEntry = (entry: string, words: LayoutWords): RoomGroup[] => {
  const named = words.rooms.filter((room) => positions(entry).some((index) => wordAt(entry, index, room.pattern))).map((room) => room.group);
  if (named.length > 0) return [...new Set(named)];
  const letters = /^[A-Z]+(?![A-Za-z])/u.exec(entry)?.[0] ?? "";
  const groups = [...letters].map((letter) => words.letters.get(letter));
  if (letters === "" || groups.some((group) => group === undefined || group === "one-room")) return [];
  return [...new Set(groups.flatMap((group): RoomGroup[] => (group === undefined || group === "one-room" ? [] : [group])))];
};

const positions = (entry: string): number[] => Array.from({ length: entry.length }, (_, index) => index);

/** How many rooms an entry names in words (Bedroom 1 and Bedroom 2 names two). */
const roomMentions = (entry: string, words: LayoutWords): number => {
  const rooms = words.rooms.filter((room) => room.group === "room");
  return positions(entry).filter((index) => rooms.some((room) => wordAt(entry, index, room.pattern))).length;
};

/** Whether the entry counts rooms with a number (洋室2室, 和室 2間). */
const countsRooms = (entry: string, words: LayoutWords): boolean =>
  [...entry.matchAll(/\d+\s*/gu)].some((match) => words.counters.some((counter) => entry.startsWith(counter, match.index + match[0].length)));

const isPart = (group: RoomGroup): group is LayoutPart => group === "living" || group === "dining" || group === "kitchen";

type Tally = { rooms: number; parts: Map<LayoutPart, string>; unclear: boolean };

const tallyEntry = (tally: Tally, entry: string, words: LayoutWords): Tally => {
  const groups = groupsOfEntry(entry, words);
  const rooms = groups.includes("room");
  const several = rooms && (groups.length > 1 || roomMentions(entry, words) > 1 || countsRooms(entry, words));
  if (groups.includes("unclear") || several) return { ...tally, unclear: true };
  const times = Number(MULTIPLIER.exec(entry)?.[1] ?? 1);
  const parts = new Map(tally.parts);
  groups.filter(isPart).forEach((part) => parts.set(part, parts.get(part) ?? entry));
  return { rooms: tally.rooms + (rooms ? times : 0), parts, unclear: tally.unclear };
};

/** The rooms a breakdown names ("LDK 11.5帖、洋室 6帖、洋室 5帖", "Bedroom 1, Bedroom 2, Bathroom"). Entries it cannot name are left out. */
export const parseBreakdown = (entries: readonly string[], words: LayoutWords): Breakdown =>
  entries
    .flatMap((entry) => foldWidth(entry).split(ENTRY_SEPARATOR))
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "")
    .reduce<Tally>((tally, entry) => tallyEntry(tally, entry, words), { rooms: 0, parts: new Map(), unclear: false });

/**
 * Where a code and the breakdown of the same listing disagree. Silent when the breakdown names no room (it may list only
 * the LDK), or names one that is counted in some listings and not in others. A lettered code is also checked for an L, D or
 * K part the breakdown names and the code lacks; a one-room code (1R) and a counted code ("2 bedrooms") are not.
 */
export const layoutSlip = (code: LayoutCode, breakdown: Breakdown): LayoutSlip | undefined => {
  if (breakdown.unclear || breakdown.rooms === 0) return undefined;
  if (breakdown.rooms !== code.rooms) return { kind: "count", code, listed: breakdown.rooms };
  const parts = code.parts;
  if (parts === undefined) return undefined;
  const extra = [...breakdown.parts].find(([part]) => !parts.has(part));
  return extra === undefined ? undefined : { kind: "part", code, entry: extra[1] };
};

/**
 * The codes and breakdowns of one page, paired listing by listing: within one scope (a section), the first code with the
 * first breakdown and so on, but only when the scope has as many of each. Any other count is several listings that cannot
 * be told apart, and none is paired.
 */
export const pairByScope = <C extends { readonly scope: number }, B extends { readonly scope: number }>(
  codes: readonly C[],
  breakdowns: readonly B[],
): [C, B][] => {
  const scopes = [...new Set(codes.map((code) => code.scope))];
  return scopes.flatMap((scope) => {
    const inCodes = codes.filter((code) => code.scope === scope);
    const inBreakdowns = breakdowns.filter((breakdown) => breakdown.scope === scope);
    if (inCodes.length !== inBreakdowns.length) return [];
    return inCodes.flatMap((code, index): [C, B][] => {
      const breakdown = inBreakdowns[index];
      return breakdown === undefined ? [] : [[code, breakdown]];
    });
  });
};
