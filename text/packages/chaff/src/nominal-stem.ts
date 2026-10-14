import type { Token } from "./plugin.ts";

/** The last kana of a verb's dictionary form, and the kana its stem form (連用形) ends in instead: 払い込む → 払い込み. */
const STEM_ENDING: Readonly<Record<string, string>> = { う: "い", く: "き", ぐ: "ぎ", す: "し", つ: "ち", ぬ: "に", ぶ: "び", む: "み", る: "り" };

/**
 * Whether a verb is written in its stem form (払い込み from 払い込む, 申出 from 申出る). Other forms that differ from the
 * dictionary form (ください from 下さる, 払い込ん before で) are not: they are never a noun.
 */
export const isStemForm = (surface: string, lemma: string): boolean => {
  const last = lemma.slice(-1);
  const stem = lemma.slice(0, -1);
  if (stem === "") return false;
  return surface === stem + (STEM_ENDING[last] ?? "\u0000") || (last === "る" && surface === stem);
};

/** What carries a verb on (払い込み、払い込んで, 払い込みます, 払い込みやすい): after these the stem form is still the verb. */
const VERB_GOES_ON = new Set(["AUX", "SCONJ", "VERB", "ADJ"]);
const CLAUSE_COMMA = new Set(["、", "，", ","]);

/**
 * A free noun after the stem form may begin the next clause (疾病にかかり療養のために), so the stem form stays a verb; a suffix
 * (払込み等), or a noun the caller lists as one (受取り前), may not.
 */
const verbGoesOn = (next: Token, suffixes: ReadonlySet<string>): boolean =>
  VERB_GOES_ON.has(next.pos) || CLAUSE_COMMA.has(next.surface) || (next.pos === "NOUN" && next.features?.["Bound"] !== "Yes" && !suffixes.has(next.surface));

/**
 * A verb's stem form that the verb does not go on from (払込みの期日, 申出により, 株式の買取り）): a noun the analyser read as the
 * verb, returned as the noun it is, spelled as written. Official Japanese spells the noun and the verb apart (払込み, 払い込む),
 * so the two are not one word in two spellings; the noun is compared with nouns. Any other token is returned as it is.
 */
export const asNounWhereNominal = (token: Token, next: Token | undefined, suffixes: ReadonlySet<string> = new Set()): Token => {
  if (token.pos !== "VERB" || token.lemma === undefined || !isStemForm(token.surface, token.lemma)) return token;
  return next !== undefined && verbGoesOn(next, suffixes) ? token : { ...token, pos: "NOUN", lemma: token.surface };
};
