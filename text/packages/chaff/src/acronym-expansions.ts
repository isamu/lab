import { namesAcronym } from "./detectors/acronym-expansion.ts";

// 略語とその展開を、文書が書いたとおりに読む。同じ略語を二通りに展開していないかを比べるため。

/** 本文の一続き（文）。start は文書の中の位置。 */
export type ExpansionText = { readonly start: number; readonly text: string };

export type Expansion = { readonly acronym: string; readonly name: string; readonly offset: number };

const ACRONYM = String.raw`[A-Z][A-Z0-9&]*[A-Z]`;
const QUOTE = String.raw`["“”'‘’「」]?`;

/** 名前のあとに括弧で略語（Service Level Agreement (SLA)、(the "SLA")）。 */
const NAME_FIRST = new RegExp(String.raw`[(（]\s*(?:the\s+)?${QUOTE}(?<acronym>${ACRONYM})${QUOTE}\s*[)）]`, "gu");
/** 略語のあとに括弧で名前（SLA (Service Level Agreement)、CI（継続的インテグレーション））。 */
const ACRONYM_FIRST = new RegExp(String.raw`(?<![\p{Script=Latin}\p{N}])(?<acronym>${ACRONYM})\s?[(（](?<name>[^()（）\n]{2,60})[)）]`, "gu");

/** 頭文字に数えない短い語（Department of Defense の of）。 */
const SMALL_WORDS: ReadonlySet<string> = new Set(["of", "and", "the", "for", "to", "in", "on", "a", "an", "&", "de", "by", "with"]);

const wordsBefore = (text: string): string[] =>
  text
    .replaceAll(/["“”'‘’]/gu, "")
    .trim()
    .split(/\s+/u)
    .filter((word) => word !== "");

const initialsOf = (words: readonly string[]): string =>
  words
    .filter((word) => !SMALL_WORDS.has(word.toLowerCase()))
    .flatMap((word) => word.split("-"))
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();

/**
 * 括弧の前の語のうち、頭文字がちょうど略語になる最も短い並び（the Federal Open Market Committee (FOMC) なら
 * Federal Open Market Committee）。頭文字の揃う並びが無ければ、展開ではない（(see Table 2) や (FOMC) の前の文）。
 */
export const nameBefore = (text: string, acronym: string): string | undefined => {
  const words = wordsBefore(text).slice(-acronym.length * 2 - 2);
  const letters = acronym.replaceAll("&", "");
  const width = words.findIndex((_word, index) => initialsOf(words.slice(-(index + 1))) === letters);
  if (width < 0) return undefined;
  const name = words.slice(-(width + 1));
  const start = name.findIndex((word) => !SMALL_WORDS.has(word.toLowerCase()));
  return name
    .slice(start)
    .join(" ")
    .replace(/[,;:]$/u, "");
};

const NON_LATIN_NAME = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー・\s\p{L}\p{N}-]+$/u;
const HAS_KANA_OR_KANJI = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
/** 括弧の中の定義の語や文（以下「CI」という。、読点のある説明）は、名前ではない。 */
const NOT_A_NAME = /以下|という|[、。,;:]/u;

/** 略語のあとの括弧の中が、その略語の名前か。英字の名前は頭文字が揃うとき、日本語の名前は語だけのとき。 */
const isNameAfter = (name: string, acronym: string): boolean => {
  if (NOT_A_NAME.test(name)) return false;
  if (HAS_KANA_OR_KANJI.test(name)) return NON_LATIN_NAME.test(name);
  return namesAcronym(name, acronym);
};

/** 文の中の略語の展開。両方の形を、文書の中の位置の順に。 */
export const expansionsIn = (body: ExpansionText): Expansion[] => {
  const nameFirst = [...body.text.matchAll(NAME_FIRST)].flatMap((match) => {
    const acronym = match.groups?.["acronym"] ?? "";
    const name = nameBefore(body.text.slice(0, match.index), acronym);
    return name === undefined ? [] : [{ acronym, name, offset: body.start + match.index }];
  });
  const acronymFirst = [...body.text.matchAll(ACRONYM_FIRST)].flatMap((match) => {
    const acronym = match.groups?.["acronym"] ?? "";
    const name = (match.groups?.["name"] ?? "").trim();
    return isNameAfter(name, acronym) ? [{ acronym, name, offset: body.start + match.index }] : [];
  });
  return [...nameFirst, ...acronymFirst].toSorted((left, right) => left.offset - right.offset);
};

/** 比べる形。大文字小文字、ハイフンと空白、& と and、語の終わりの複数の s は名前を変えない。 */
export const comparableName = (name: string): string =>
  name
    .toLowerCase()
    .replaceAll("&", " and ")
    .replaceAll(/[-‐‑\s]+/gu, " ")
    .trim()
    .replaceAll(/(?<=\p{Script=Latin}{3})s\b/gu, "");

export type ExpansionConflict = { readonly expansion: Expansion; readonly first: Expansion };

/** 同じ略語の、最初の展開と違う展開。違う書き方ごとに最初の一つだけ。 */
export const expansionConflicts = (expansions: readonly Expansion[]): ExpansionConflict[] => {
  const firsts = new Map<string, Expansion>();
  const reported = new Set<string>();
  return expansions.flatMap((expansion) => {
    const first = firsts.get(expansion.acronym);
    if (first === undefined) {
      firsts.set(expansion.acronym, expansion);
      return [];
    }
    const variant = `${expansion.acronym}\u0000${comparableName(expansion.name)}`;
    if (comparableName(first.name) === comparableName(expansion.name) || reported.has(variant)) return [];
    reported.add(variant);
    return [{ expansion, first }];
  });
};
