import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listVerdicts } from "../packages/chaff/src/detectors/oxford-comma.ts";
import { listReader, FLAG_TESTS, type Flag, type ItemList } from "../packages/chaff/src/detectors/list-items.ts";
import {
  isContent,
  listSentenceOf,
  NOMINAL,
  scopeOf,
  VERBAL,
  verbFormOf,
  type ItemScope,
  type ListSentence,
  type ListWords,
} from "../packages/chaff/src/detectors/list-sentence.ts";
import {
  exampleEnd,
  hasPrepositionalTail,
  isClause,
  isModifiedNoun,
  isPluralNounPhrase,
  lastContent,
  leadShape,
  openingKind,
  participleOpening,
  shapeOf,
} from "../packages/chaff/src/detectors/list-item.ts";
import {
  after,
  contentOnlyWith,
  every,
  findAfterFirst,
  findLast,
  firstOf,
  lastOf,
  sameShapes,
  secondLastOf,
  secondOf,
  sizeOf,
  some,
  wholeList,
  withoutFirst,
  type View,
} from "../packages/chaff/src/detectors/list-view.ts";
import { citedTitles } from "../packages/chaff/src/detectors/cited-title.ts";
import { MINOR_WORDS } from "../packages/chaff/src/detectors/heading-case.ts";
import type { Lexicon, Token } from "../packages/chaff/src/plugin.ts";
import type { TokenRange } from "../packages/chaff/src/detectors/token-column.ts";

// oxford-comma-consistency reads each sentence once: the items before each and / or come from a reader that moves left to
// right (list-items.ts), a list cut down to a part is a view of it (list-view.ts), and each question about an item is
// answered from columns (list-item.ts). Each part is checked here against the plain reading it replaces, the way the
// detector first did it: split from the clause's start at every and / or, and read each item token by token.
// The sentences are generated from a fixed seed, printed on every run; set CHAFF_LIST_SEED to try others.

const SEED = Number(process.env["CHAFF_LIST_SEED"] ?? "170");
const SENTENCES = 1500;
console.log(`test_list_items seed: ${String(SEED)}`);

const randomFrom = (seed: number): (() => number) => {
  const state = { value: seed >>> 0 };
  return () => {
    state.value = (state.value + 0x6d2b79f5) >>> 0;
    const mixed = Math.imul(state.value ^ (state.value >>> 15), state.value | 1);
    const again = mixed ^ (mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61));
    return ((again ^ (again >>> 14)) >>> 0) / 4294967296;
  };
};

type Random = () => number;

const pick = <T>(random: Random, list: readonly T[], fallback: T): T => list[Math.floor(random() * list.length)] ?? fallback;

type Draft = { readonly surface: string; readonly pos: string };

const d = (surface: string, pos: string): Draft => ({ surface, pos });

const POS = ["NOUN", "PROPN", "PRON", "NUM", "ADJ", "VERB", "AUX", "DET", "ADP", "ADV", "SCONJ", "PART", "X", "PUNCT", "CCONJ"];

/** Items the detector's branches look for: noun phrases, gerunds, prepositional tails, lone modifiers, items with no content, titles, asides. */
const ITEMS: readonly (readonly Draft[])[] = [
  [d("the", "DET"), d("apples", "NOUN")],
  [d("pears", "NOUN")],
  [d("red", "ADJ"), d("goals", "NOUN")],
  [d("red", "ADJ")],
  [d("the", "DET")],
  [d("e.g.", "X")],
  [d("filling", "VERB"), d("the", "DET"), d("gaps", "NOUN")],
  [d("tested", "VERB")],
  [d("updates", "NOUN"), d("on", "ADP"), d("the", "DET"), d("Doc", "PROPN")],
  [d("Slack", "PROPN")],
  [d("the", "DET"), d("team", "NOUN"), d("fixed", "VERB"), d("it", "PRON")],
  [d("quickly", "ADV"), d("fixed", "VERB")],
  [d("meaning", "VERB"), d("ship", "NOUN")],
  [d("such", "ADJ"), d("as", "ADP"), d("apples", "NOUN")],
  [d("such", "ADJ")],
  [d("as", "ADP"), d("apples", "NOUN")],
  [d("including", "VERB"), d("the", "DET"), d("desk", "NOUN")],
  [d("between", "ADP"), d("Provider", "PROPN")],
  [d("either", "DET"), d("option", "NOUN")],
  [d("both", "DET"), d("goals", "NOUN")],
  [d("(", "PUNCT"), d("a", "DET"), d(",", "PUNCT"), d("b", "NOUN"), d(")", "PUNCT")],
  [d("(", "PUNCT"), d("a", "DET"), d(",", "NUM"), d("including", "VERB"), d(")", "PUNCT")],
  [d("Journal", "PROPN"), d("of", "ADP"), d("Money", "PROPN")],
  [d("After", "ADP"), d("the", "DET"), d("review", "NOUN")],
  [d("certified", "VERB"), d("mail", "NOUN")],
  [d("3", "NUM")],
];

const JOINS: readonly (readonly Draft[])[] = [
  [d(",", "PUNCT")],
  [d(",", "PUNCT"), d("and", "CCONJ")],
  [d("and", "CCONJ")],
  [d(",", "PUNCT"), d("or", "CCONJ")],
  [d("or", "CCONJ")],
  [d(",", "PUNCT"), d(",", "PUNCT")],
  [d(";", "PUNCT")],
  [d(",", "PUNCT"), d("such", "ADJ"), d("as", "ADP")],
  [d(",", "PUNCT"), d("e.g.", "X"), d(",", "PUNCT")],
  [d("(", "PUNCT")],
  [d(")", "PUNCT")],
];

/** One sentence: items joined by commas, conjunctions and breaks, with an odd tag, feature or comma now and then. */
const draftsOf = (random: Random): Draft[] => {
  const items = 1 + Math.floor(random() * 14);
  const family = random() < 0.5 ? [pick(random, ITEMS, []), pick(random, ITEMS, [])] : ITEMS;
  return Array.from({ length: items }).flatMap((__, index) => [
    ...(index > 0 ? pick(random, JOINS, []) : []),
    ...pick(random, family, []).map((draft) => (random() < 0.08 ? d(draft.surface, pick(random, POS, "X")) : draft)),
  ]);
};

const featuresOf = (random: Random, draft: Draft): Record<string, string> | undefined => {
  if (random() < 0.6) return undefined;
  if (draft.surface.endsWith("s") && random() < 0.7) return { Number: "Plur" };
  if (draft.surface.endsWith("ing")) return { VerbForm: "Ger" };
  if (draft.surface.endsWith("ed")) return { VerbForm: "Part" };
  return { VerbForm: pick(random, ["Part", "Ger", "Fin"], "Fin") };
};

const tokensOf = (random: Random, drafts: readonly Draft[]): Token[] =>
  drafts.map((draft, index) => {
    const features = featuresOf(random, draft);
    const span = { start: index * 12, end: index * 12 + draft.surface.length };
    return features === undefined ? { span, surface: draft.surface, pos: draft.pos } : { span, surface: draft.surface, pos: draft.pos, features };
  });

const lexiconToken = (surface: string, index: number): Token => ({ span: { start: index, end: index + 1 }, surface, pos: "X" });

const EXAMPLE: Lexicon = [
  { pattern: "such as", tokens: ["such", "as"].map(lexiconToken) },
  { pattern: "including", tokens: ["including"].map(lexiconToken) },
  { pattern: "e.g.", tokens: ["e.g."].map(lexiconToken) },
  { pattern: "such and", tokens: ["such", "and"].map(lexiconToken) },
  { pattern: "empty", tokens: [] },
  { pattern: "untokenized" },
];

const WORDS: ListWords = { participle: new Set(["meaning"]), example: EXAMPLE, pair: new Set(["between and", "both and", "either or", ", and"]), region: [] };

type Case = { readonly tokens: readonly Token[]; readonly sentence: ListSentence };

const cases = (seed: number, count: number): Case[] => {
  const random = randomFrom(seed);
  return Array.from({ length: count }, () => {
    const tokens = tokensOf(random, draftsOf(random));
    return { tokens, sentence: listSentenceOf(tokens, WORDS, "") };
  });
};

const conjunctionsOf = (tokens: readonly Token[]): number[] =>
  tokens.flatMap((token, at) => (at > 0 && ["and", "or"].includes(token.surface.toLowerCase()) ? [at] : []));

/** The item as the plain reading holds it: its tokens without the commas at the list's depth. */
const tokensIn = (scope: ItemScope, item: TokenRange): Token[] =>
  scope.sentence.tokens
    .slice(item.start, item.end)
    .filter((token, offset) => !(token.surface === "," && scope.sentence.depths[item.start + offset] === scope.level));

/** The plain reading: split from the clause's start at the commas of the conjunction's depth, then join stacked adjectives. */
const plainItems = (sentence: ListSentence, at: number): Token[][] => {
  const level = sentence.depths[at] ?? 0;
  const start = sentence.tokens.slice(0, at).findLastIndex((token) => [";", ":", "—"].includes(token.surface)) + 1;
  const split = sentence.tokens.slice(start, at).reduce<Token[][]>(
    (items, token, offset) => {
      if (token.surface === "," && sentence.depths[start + offset] === level) items.push([]);
      else items.at(-1)?.push(token);
      return items;
    },
    [[]],
  );
  const last = (item: readonly Token[]): Token | undefined => item.findLast(isContent);
  return split
    .filter((item) => item.length > 0)
    .reduce<Token[][]>((joined, item) => {
      const previous = joined.at(-1);
      if (previous !== undefined && last(previous)?.pos === "ADJ" && last(item)?.pos !== "ADJ") joined[joined.length - 1] = [...previous, ...item];
      else joined.push(item);
      return joined;
    }, []);
};

const listItems = (list: ItemList): TokenRange[] => [...list.frozen.items, ...list.tail];

/** The items a view stands for, read from its fields. */
const viewItems = (view: View): TokenRange[] => [
  ...(view.pre === undefined ? [] : [view.pre]),
  ...listItems(view.list)
    .slice(view.from)
    .filter((item) => !view.contentOnly || tokensIn(view.list.scope, item).some(isContent)),
];

/**
 * Each list the reader gives, one per conjunction, checked as soon as it is read: a list stays as read only until the next
 * read, as in the detector.
 */
const forEveryList = (count: number, check: (list: ItemList, at: number, sentence: ListSentence) => void): number =>
  cases(SEED, count).reduce((checked, { tokens, sentence }) => {
    const read = listReader(sentence);
    const conjunctions = conjunctionsOf(tokens);
    conjunctions.forEach((at) => check(read(at), at, sentence));
    return checked + conjunctions.length;
  }, 0);

const checkItems = (list: ItemList, at: number, sentence: ListSentence): void => {
  assert.deepEqual(
    listItems(list).map((item) => tokensIn(list.scope, item)),
    plainItems(sentence, at),
  );
};

describe(`listReader: the items before each and / or, read once (seed ${String(SEED)})`, () => {
  it("gives the same items as splitting the clause again at each and / or", () => {
    assert.ok(forEveryList(SENTENCES, checkItems) > SENTENCES);
  });
});

const FLAGS: readonly Flag[] = [
  "closed",
  "example",
  "participle",
  "verbalShape",
  "hasVerb",
  "isClause",
  "prepositionalTail",
  "notNounHead",
  "notProperNounHead",
];

/** Views as the detector makes them: the whole list, its first items dropped, after an item, with a part put first, content only. */
const viewsOf = (list: ItemList): View[] => {
  const whole = wholeList(list);
  const first = firstOf(whole);
  const second = secondOf(whole);
  const part = first === undefined ? undefined : { start: first.item.start + 1, end: first.item.end };
  const afterFirst = first === undefined ? whole : after(whole, first);
  const withPart = { ...afterFirst, pre: part };
  const views = [
    whole,
    withoutFirst(whole),
    withoutFirst(withoutFirst(whole)),
    afterFirst,
    contentOnlyWith(afterFirst, part),
    contentOnlyWith(whole, undefined),
  ];
  return [...views, ...(second === undefined ? [] : [after(whole, second)]), ...(part === undefined ? [] : [withPart, withoutFirst(withPart)])];
};

const sameItem = (actual: { readonly item: TokenRange } | undefined, expected: TokenRange | undefined): void => {
  assert.deepEqual(actual?.item, expected);
};

const checkFlag = (view: View, flag: Flag): void => {
  const items = viewItems(view);
  const holds = (item: TokenRange): boolean => FLAG_TESTS[flag](view.list.scope, item);
  sameItem(findLast(view, flag), items.findLast(holds));
  sameItem(
    findAfterFirst(view, flag),
    items.find((item, index) => index > 0 && holds(item)),
  );
  assert.equal(some(view, flag), items.some(holds), flag);
  assert.equal(every(view, flag), items.every(holds), flag);
};

const checkShapes = (view: View): void => {
  const shapes = new Set(viewItems(view).map((item) => shapeOf(view.list.scope, item)));
  assert.equal(sameShapes(view), shapes.size <= 1);
};

const checkPositions = (view: View): void => {
  const items = viewItems(view);
  assert.equal(sizeOf(view), items.length);
  sameItem(firstOf(view), items[0]);
  sameItem(secondOf(view), items[1]);
  sameItem(lastOf(view), items.at(-1));
  sameItem(secondLastOf(view), items.length < 2 ? undefined : items.at(-2));
};

const checkCuts = (view: View): void => {
  const items = viewItems(view);
  assert.deepEqual(viewItems(withoutFirst(view)), items.slice(1));
  const first = firstOf(view);
  if (first !== undefined) assert.deepEqual(viewItems(after(view, first)), items.slice(1));
  const last = lastOf(view);
  if (last !== undefined) assert.deepEqual(viewItems(after(view, last)), []);
};

const checkFlags = (view: View): void => FLAGS.forEach((flag) => checkFlag(view, flag));

describe(`list views: each answer matches the list the view stands for (seed ${String(SEED)})`, () => {
  /** Runs the check on every view and returns how many there were, so that a run that checks nothing fails. */
  const views = (check: (view: View) => void): number => {
    const seen = { count: 0 };
    forEveryList(SENTENCES / 3, (list) =>
      viewsOf(list).forEach((view) => {
        check(view);
        seen.count += 1;
      }),
    );
    return seen.count;
  };

  it("size, first, second, last and second to last", () => {
    assert.ok(views(checkPositions) > SENTENCES);
  });

  it("without the first item, and after an item", () => {
    assert.ok(views(checkCuts) > SENTENCES);
  });

  it("the last item, the first after the first, some and every, for each question", () => {
    assert.ok(views(checkFlags) > SENTENCES);
  });

  it("whether the items with content share one head shape", () => {
    assert.ok(
      views((view) => {
        if (view.contentOnly) checkShapes(view);
      }) > SENTENCES,
    );
  });
});

// The plain questions about an item, read token by token.
const plainShape = (item: readonly Token[]): string | undefined => {
  const head = item.find(isContent);
  if (head === undefined) return undefined;
  return NOMINAL.has(head.pos) ? "NOMINAL" : head.pos;
};

const isOpen = (token: Token): boolean => token.pos !== "PUNCT" && token.pos !== "X";

const plainIsClause = (item: readonly Token[]): boolean => {
  const first = item.find(isOpen);
  if (first === undefined || !(first.pos === "DET" || NOMINAL.has(first.pos))) return false;
  return item.some((token) => token !== first && VERBAL.has(token.pos));
};

const plainPrepositionalTail = (item: readonly Token[]): boolean => {
  const head = item.findIndex(isContent);
  return item.some((token, index) => index > head && token.pos === "ADP");
};

const plainParticiple = (item: readonly Token[]): string | undefined => {
  const opening = item.find((token) => token.pos !== "PUNCT" && token.pos !== "ADV");
  if (opening === undefined) return undefined;
  return WORDS.participle.has(opening.surface.toLowerCase()) ? "Ger" : verbFormOf(opening);
};

const plainModifiedNoun = (item: readonly Token[]): boolean => {
  const [head, ...tail] = item.filter(isOpen);
  const tailNouns = tail.every((token) => ["ADJ", "NOUN", "PROPN"].includes(token.pos));
  return ["ADJ", "VERB"].includes(head?.pos ?? "") && tail.length > 0 && tailNouns && ["NOUN", "PROPN"].includes(tail.at(-1)?.pos ?? "");
};

const plainPluralNounPhrase = (item: readonly Token[]): boolean =>
  item.filter(isContent).every((token) => ["ADJ", "NOUN", "PROPN"].includes(token.pos)) && item.findLast(isContent)?.features?.["Number"] === "Plur";

/** The tokens after the last example phrase at the list's depth that ends in the item, or undefined. */
const plainExamples = (scope: ItemScope, item: readonly Token[]): Token[] | undefined => {
  const indexOf = new Map(scope.sentence.tokens.map((token, index) => [token, index]));
  const end = item.reduce((found, token, at) => {
    const words =
      EXAMPLE.find(({ tokens = [] }) => tokens.length > 0 && tokens.every((word, offset) => item[at + offset]?.surface === word.surface))?.tokens ?? [];
    return words.length > 0 && scope.sentence.depths[indexOf.get(token) ?? -1] === scope.level ? at + words.length : found;
  }, -1);
  return end === -1 ? undefined : item.slice(end);
};

describe(`item questions: each column answer matches reading the item's tokens (seed ${String(SEED)})`, () => {
  const items: { readonly scope: ItemScope; readonly item: TokenRange }[] = [];
  forEveryList(SENTENCES, (list) => items.push(...listItems(list).map((item) => ({ scope: list.scope, item }))));
  const pieces = items.flatMap(({ scope, item }) => [
    { scope, item },
    { scope, item: { start: item.start + 1, end: item.end } },
    { scope, item: { start: item.start, end: Math.max(item.start, item.end - 1) } },
  ]);

  it("head shapes, openings, clauses and prepositional tails", () => {
    pieces.forEach(({ scope, item }) => {
      const tokens = tokensIn(scope, item);
      assert.equal(shapeOf(scope, item), plainShape(tokens));
      assert.equal(leadShape(scope, item), plainShape(tokens.filter((token) => token.pos !== "ADV")));
      const opening = tokens.find(isOpen);
      assert.equal(openingKind(scope, item), opening?.features?.["VerbForm"] === "Part" ? "PARTICIPLE" : plainShape(tokens));
      assert.equal(isClause(scope, item), plainIsClause(tokens));
      assert.equal(hasPrepositionalTail(scope, item), plainPrepositionalTail(tokens));
      assert.equal(lastContent(scope, item), tokens.findLast(isContent));
    });
  });

  it("participles, modified nouns, plural noun phrases and examples", () => {
    pieces.forEach(({ scope, item }) => {
      const tokens = tokensIn(scope, item);
      assert.equal(participleOpening(scope, item)?.form, plainParticiple(tokens));
      assert.equal(isModifiedNoun(scope, item), plainModifiedNoun(tokens));
      assert.equal(isPluralNounPhrase(scope, item), plainPluralNounPhrase(tokens));
      const end = exampleEnd(scope, item);
      assert.deepEqual(end === -1 ? undefined : tokensIn(scope, { start: end, end: item.end }), plainExamples(scope, tokens));
    });
  });
});

describe("listVerdicts: one sentence of many items takes time in proportion to its length", () => {
  const LONG = 40_000;
  const LONG_TIMEOUT_MS = 30_000;
  const noun = (surface: string, index: number): Token => ({ span: { start: index, end: index + 1 }, surface, pos: surface === "," ? "PUNCT" : "NOUN" });
  /** The test runner's timeout cannot stop a synchronous call, so the time is also checked after it returns. */
  const timedVerdicts = (tokens: readonly Token[]): (boolean | undefined)[] => {
    const started = performance.now();
    const result = listVerdicts(tokens, WORDS, "");
    assert.ok(performance.now() - started < LONG_TIMEOUT_MS, "took longer than the timeout");
    return result;
  };
  const verdicts = (surfaces: readonly string[]): (boolean | undefined)[] =>
    timedVerdicts(surfaces.map((surface, index) => (["and", "or"].includes(surface) ? { ...noun(surface, index), pos: "CCONJ" } : noun(surface, index))));

  it(`judges ${String(LONG / 2)} and's in one sentence`, { timeout: LONG_TIMEOUT_MS }, () => {
    const result = verdicts(Array.from({ length: LONG }, (_, index) => (index % 2 === 1 ? "and" : "apples")));
    assert.equal(result.length, LONG / 2);
  });

  it(`judges ${String(LONG / 4)} and's between ${String(LONG / 4)} commas`, { timeout: LONG_TIMEOUT_MS }, () => {
    const result = verdicts(Array.from({ length: LONG }, (_, index) => ["the", ",", "the", "and"][index % 4] ?? "the"));
    assert.equal(result.length, LONG / 4);
  });

  it(`judges ${String(LONG / 4)} and's inside and outside parentheses`, { timeout: LONG_TIMEOUT_MS }, () => {
    const result = verdicts(Array.from({ length: LONG }, (_, index) => ["(", "pears", "and", ")", "and", "apples", ","][index % 7] ?? "apples"));
    assert.ok(result.length > LONG / 4);
  });

  // Quadratic reading of these commas is cheap per step, so it takes a longer sentence to show.
  const LONGER = 200_000;

  it(`judges ${String(LONGER / 4)} and's after commas inside parentheses that the tagger read as numbers`, { timeout: LONG_TIMEOUT_MS }, () => {
    const surfaces = Array.from({ length: LONGER }, (_, index) => ["(", ",", ")", "and"][index % 4] ?? "and");
    const tokens = surfaces.map((surface, index): Token => {
      const pos = new Map([
        ["(", "PUNCT"],
        [")", "PUNCT"],
        [",", "NUM"],
      ]).get(surface);
      return { span: { start: index, end: index + 1 }, surface, pos: pos ?? "CCONJ" };
    });
    assert.equal(timedVerdicts(tokens).length, LONGER / 4);
  });
});

describe("scopeOf: a comma at the list's depth is not in an item; one inside parentheses is", () => {
  const tokens: Token[] = [d("a", "DET"), d("(", "PUNCT"), d(",", "NUM"), d(")", "PUNCT"), d("and", "CCONJ"), d("y", "NOUN")].map((draft, index) => ({
    span: { start: index, end: index + 1 },
    ...draft,
  }));
  const sentence = listSentenceOf(tokens, WORDS, "");
  const item = { start: 0, end: 4 };

  it("counts a comma inside parentheses, tagged as a number, as the item's content", () => {
    assert.equal(shapeOf(scopeOf(sentence, 0), item), "NOMINAL");
  });

  it("leaves out a comma at the list's own depth", () => {
    assert.equal(shapeOf(scopeOf(sentence, 1), item), undefined);
  });
});

describe("listVerdicts: pinned sentences", () => {
  const verdictsOf = (spec: string): (boolean | undefined)[] =>
    listVerdicts(
      spec.split(" ").map((part, index) => {
        const [surface = "", pos = "NOUN"] = part.split("/");
        return { span: { start: index * 10, end: index * 10 + surface.length }, surface, pos };
      }),
      WORDS,
      "",
    );

  it("reads a comma inside parentheses, tagged as a number, as the first word of a closed list's last item", () => {
    assert.deepEqual(verdictsOf("pears/NOUN ,/PUNCT and/CCONJ (/PUNCT a/DET ,/NUM tested/VERB )/PUNCT ,/PUNCT apples/NOUN or/CCONJ plums/NOUN"), [
      undefined,
      false,
    ]);
  });

  it("does not read the comma between stacked adjectives and their noun as a word that pairs with the and", () => {
    assert.deepEqual(verdictsOf("apples/NOUN ,/PUNCT red/ADJ ,/PUNCT pears/NOUN and/CCONJ plums/NOUN"), [false]);
  });

  it("does not judge an and / or that opens the sentence", () => {
    assert.deepEqual(verdictsOf("And/CCONJ pears/NOUN ,/PUNCT apples/NOUN and/CCONJ plums/NOUN"), [false]);
  });
});

// The plain reading of a cited title: read the title words to the left and right of the and / or from the sentence each time.
const TITLE_JOINERS = new Set(["-", ":"]);
const isCapitalised = (token: Token): boolean => /^\p{Lu}/u.test(token.surface);
const isTitleWord = (token: Token): boolean => isCapitalised(token) || MINOR_WORDS.has(token.surface) || TITLE_JOINERS.has(token.surface);
const adjoins = (source: string, left: Token | undefined, right: Token | undefined): boolean =>
  left === undefined || right === undefined || source.slice(left.span.end, right.span.start).trim() === "";
const isPhraseWord = (token: Token): boolean => (isCapitalised(token) || MINOR_WORDS.has(token.surface)) && !["and", "or"].includes(token.surface);

const plainCitedTitle = (tokens: readonly Token[], at: number, source: string): boolean => {
  const stopLeft = tokens
    .slice(0, at)
    .findLastIndex((token, index) => !(isTitleWord(token) || token.surface === ",") || !adjoins(source, token, tokens[index + 1]));
  const start = tokens.findIndex((token, index) => index > stopLeft && index < at && isCapitalised(token));
  const stopRight = tokens.findIndex((token, index) => index > at && (!isTitleWord(token) || !adjoins(source, tokens[index - 1], token)));
  const lastInRun = tokens.slice(at + 1, stopRight === -1 ? undefined : stopRight).findLastIndex(isCapitalised);
  const end = lastInRun === -1 ? -1 : at + 1 + lastInRun;
  const first = tokens[start];
  const last = tokens[end];
  if (start === -1 || end === -1 || first === undefined || last === undefined) return false;
  const run = tokens.slice(start, end + 1);
  if (!run.some((token, index) => index > 0 && isPhraseWord(token) && isPhraseWord(run[index - 1] ?? token))) return false;
  const before = source.slice(Math.max(0, first.span.start - 8), first.span.start);
  const after = source.slice(last.span.end, last.span.end + 8);
  const opened = /(?:["'“‘]|\*{1,3}|_{1,3})$/u.test(before) && /^[,.;:!?]?(?:["'”’]|\*{1,3}|_{1,3})(?![\p{L}\p{N}])/u.test(after);
  return opened || (/,\s*["'”’]\s*$/u.test(before) && /^\s*(?:[,;.]|$)/u.test(after));
};

const TITLE_WORDS = ["Journal", "Money", "Credit", "Banking", "Paris", "of", "the", "and", "or", ",", "-", ":", "said", "Low"];
const TITLE_GAPS = [" ", " ", " ", "", " “", "” ", '"', "*", "_", ', "', "”,", "'", " (", ") "];

const titledSentence = (random: Random): { readonly tokens: Token[]; readonly source: string } => {
  const parts = Array.from({ length: 2 + Math.floor(random() * 16) }, (__, index) => ({
    gap: index === 0 ? pick(random, ["", "“", '"', "*"], "") : pick(random, TITLE_GAPS, " "),
    surface: pick(random, TITLE_WORDS, "and"),
  }));
  const tail = pick(random, ["", "”", "*,", ".", '," Journal'], "");
  const tokens = parts.reduce<{ readonly tokens: Token[]; readonly at: number }>(
    ({ tokens: made, at }, { gap, surface }) => {
      const start = at + gap.length;
      return { tokens: [...made, { span: { start, end: start + surface.length }, surface, pos: "PROPN" }], at: start + surface.length };
    },
    { tokens: [], at: 0 },
  ).tokens;
  return { tokens, source: [...parts.flatMap(({ gap, surface }) => [gap, surface]), tail].join("") };
};

const checkTitles = ({ tokens, source }: { readonly tokens: Token[]; readonly source: string }): number => {
  const inTitle = citedTitles(tokens, source);
  const conjunctions = tokens.flatMap((token, at) => (["and", "or"].includes(token.surface) ? [at] : []));
  conjunctions.forEach((at) => assert.equal(inTitle(at), plainCitedTitle(tokens, at, source), `${source} @${String(at)}`));
  return conjunctions.length;
};

describe(`citedTitles: each answer matches reading the title words again (seed ${String(SEED)})`, () => {
  it("answers every and / or in generated title-like sentences", () => {
    const random = randomFrom(SEED);
    const checked = Array.from({ length: SENTENCES * 4 }, () => titledSentence(random)).reduce((count, sentence) => count + checkTitles(sentence), 0);
    assert.ok(checked > SENTENCES);
  });
});
