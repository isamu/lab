import type { BodyText, DefinedTerm } from "./definition-use.ts";
import { isGenericPlural } from "./generic-role.ts";

/**
 * 当事者を、定めた呼び名でなく立場の語で書いた所（「乙」と定めたあとの「受託者」、the "Supplier" のあとの the Vendor）。
 * 当事者の定義は、文の途中で括弧に入れて短い呼び名を定めた所のうち、呼び名が当事者の呼び名の語（甲・乙・当社）か立場の語
 * そのもの（Supplier）であるもの、または括弧のすぐ前に会社の形（株式会社、Ltd）を書いたもの。語は言語パッケージの語彙表から取る。
 * 立場の語は、それ自体を定義した語や、定義した語の一部として書いた所（Receiving Party と定義した所の Party）なら指さない。
 */
export type PartyWords = {
  /** 当事者の立場の語（委託者、受託者、Supplier、Recipient）。 */
  readonly roles: readonly string[];
  /** 当事者の呼び名に使う語（甲、乙、当社、we）。 */
  readonly shortNames: readonly string[];
  /** 会社の形（株式会社、Ltd、Inc.）。 */
  readonly companyForms: readonly string[];
};

export type Party = { readonly term: string; readonly end: number };
export type RoleUse = { readonly offset: number; readonly role: string };

/** 会社の形を探す、括弧の前の幅。名前一つ分。 */
const NAME_REACH = 40;
/** 語の前後の一字がこれなら、語は長い語の一部（再受託者、受託者側の「受託者」は語の一部でない側も含む）。 */
const WORD_CHAR = /[\p{Script=Han}\p{Script=Katakana}\p{Script=Latin}\p{N}ー]/u;
const LATIN_START = /^\p{Script=Latin}/u;
/** 英語の立場の語は、冠詞か所有の語に続く大文字の語だけ（the Vendor）。小文字の the vendor は普通の名詞。 */
const ENGLISH_LEAD = /(?:^|[^\p{L}])(?:the|The|each|Each|any|Any|such|Such)\s+$/u;
const LEAD_REACH = 8;

const occurrences = (text: string, word: string): number[] => {
  const found: number[] = [];
  let at = text.indexOf(word);
  while (at !== -1) {
    found.push(at);
    at = text.indexOf(word, at + word.length);
  }
  return found;
};

const LETTER = /\p{L}/u;

/** 英字の語は、英字の続き（Including の Inc）では語と読まない。 */
const wordAt = (text: string, word: string, at: number): boolean =>
  !LATIN_START.test(word) || (!LETTER.test(text.charAt(at - 1)) && !LETTER.test(text.charAt(at + word.length)));

/** 括弧の前の名前に会社の形があるか。 */
const namedCompanyBefore = (source: string, definition: DefinedTerm, forms: readonly string[]): boolean => {
  const before = source.slice(Math.max(0, definition.span.start - NAME_REACH), definition.span.start);
  return forms.some((form) => form !== "" && occurrences(before, form).some((at) => wordAt(before, form, at)));
};

/** 文書が当事者として定めた呼び名と、その定義の終わり。 */
export const partiesOf = (source: string, terms: readonly DefinedTerm[], words: PartyWords): Party[] =>
  terms
    .filter((term) => term.inline)
    .filter((term) => words.shortNames.includes(term.term) || words.roles.includes(term.term) || namedCompanyBefore(source, term, words.companyForms))
    .map((term) => ({ term: term.term, end: term.span.end }));

/** 英語の立場の語のあとに付いてよいもの: 複数形と所有の形（Vendors、Vendor's）。 */
const ENGLISH_ENDING = /^(?:s|['’]s?)?(?![\p{L}\p{N}])/u;
/** 文や項目の頭（"Vendor shall"、"1. Vendor shall"）。 */
const CLAUSE_START = /^[\s\d.()*+-]*$/u;

/** 英語の立場の語は、冠詞か所有の語のあと（the Vendor）か、文の頭の大文字の語だけ。小文字の the vendor は普通の名詞。 */
const englishRoleAt = (text: BodyText, at: number, role: string): boolean => {
  const before = text.text.slice(0, at);
  const after = text.text.slice(at + role.length);
  const bare = CLAUSE_START.test(before);
  return ENGLISH_ENDING.test(after) && !isGenericPlural(bare, after) && (bare || ENGLISH_LEAD.test(before.slice(-LEAD_REACH)));
};

const standsAlone = (source: string, text: BodyText, at: number, role: string): boolean => {
  const offset = text.start + at;
  if (WORD_CHAR.test(source.charAt(offset - 1))) return false;
  return LATIN_START.test(role) ? englishRoleAt(text, at, role) : !/[\p{Script=Han}\p{Script=Katakana}ー]/u.test(source.charAt(offset + role.length));
};

/** 定義した語がこの位置を覆うか（Receiving Party の Party、本受託者規程の受託者）。 */
const insideDefined = (source: string, offset: number, role: string, defined: readonly string[]): boolean =>
  defined.some((term) => term !== role && term.includes(role) && occurrences(term, role).some((at) => source.startsWith(term, offset - at)));

/**
 * 当事者を定めた後（after より後）で、立場の語を書いた所。立場の語それ自体を定義した文書では、その語は呼び名なので指さない。
 */
export const roleUses = (source: string, texts: readonly BodyText[], roles: readonly string[], defined: readonly string[], after: number): RoleUse[] =>
  roles
    .filter((role) => role !== "" && !defined.includes(role))
    .flatMap((role) =>
      texts.flatMap((text) =>
        occurrences(text.text, role)
          .filter((at) => text.start + at > after && standsAlone(source, text, at, role) && !insideDefined(source, text.start + at, role, defined))
          .map((at) => ({ offset: text.start + at, role })),
      ),
    )
    .toSorted((left, right) => left.offset - right.offset)
    .filter((use, index, all) => all.findIndex((other) => other.offset <= use.offset && use.offset < other.offset + other.role.length) === index);
