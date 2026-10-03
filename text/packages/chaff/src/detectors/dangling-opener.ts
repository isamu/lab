import type { Detector, Finding, Lexicon, Token } from "../plugin.ts";

/**
 * 分詞で始めた句の後ろの主語が、形だけの it か there の文（Having reviewed the code, it is ready.）。
 * 分詞の動作をしたのは書き手か読み手で、it ではない。読むのはこの形だけに絞り、主語が名詞の文は読まない。
 * 読むのは -ing の分詞だけ。決まった言い方として読まれる分詞（Given, Based on, Generally speaking）は語彙表 dangling-participle の exempt が言う。
 */

export type DanglingOpener = { readonly opener: string; readonly subject: Token; readonly offset: number };

/** 分詞の句として読む語の数の上限。長い句は読点の位置が当てにならない。 */
const MAX_OPENER_TOKENS = 12;
const BE = "be";
const HAVE = "have";
/** be の後ろで読点が来たら、it is … は挿入句（Testing the integration, it is worth noting, requires …）。 */
const PARENTHETICAL_REACH = 4;

const lower = (token: Token | undefined): string => token?.surface.toLowerCase() ?? "";

/** -ing の分詞だけ。過去分詞の句（Configured with SSO, it is ready.）は it そのものを言うことが多い。 */
const isPresentParticiple = (token: Token | undefined): boolean => token?.pos === "VERB" && token.features?.["VerbForm"] === "Ger";

const lemmaOf = (token: Token | undefined): string => token?.lemma?.toLowerCase() ?? "";

/** 文の頭が決まった言い方か。語彙表の語は空白で区切って、頭の語と順に比べる。 */
const opensWithExempt = (tokens: readonly Token[], exempt: readonly string[]): boolean =>
  exempt.some((phrase) => phrase.split(/\s+/u).every((word, at) => lower(tokens[at]) === word));

/** 形だけの主語の後ろの be（it is / there are）、助動詞と be（it can be）、have と been（it has been）。 */
const isBeAfter = (tokens: readonly Token[], at: number): boolean => {
  const verb = tokens[at];
  if (lemmaOf(verb) === BE) return true;
  return (verb?.pos === "AUX" || lemmaOf(verb) === HAVE) && lemmaOf(tokens[at + 1]) === BE;
};

const isParenthetical = (tokens: readonly Token[], at: number): boolean => tokens.slice(at, at + PARENTHETICAL_REACH).some((token) => token.surface === ",");

export const danglingOpenerIn = (
  source: string,
  tokens: readonly Token[],
  subjects: ReadonlySet<string>,
  exempt: readonly string[],
): DanglingOpener | undefined => {
  const [first] = tokens;
  if (first === undefined || !isPresentParticiple(first) || opensWithExempt(tokens, exempt)) return undefined;
  const comma = tokens.findIndex((token, at) => at > 0 && token.surface === ",");
  const subject = tokens[comma + 1];
  if (comma === -1 || comma > MAX_OPENER_TOKENS || subject === undefined || !subjects.has(lower(subject)) || !isBeAfter(tokens, comma + 2)) return undefined;
  if (isParenthetical(tokens, comma + 3)) return undefined;
  const last = tokens[comma - 1] ?? first;
  return { opener: source.slice(first.span.start, last.span.end), subject, offset: first.span.start };
};

const patternsIn = (lexicon: Lexicon, group: string): string[] => lexicon.filter((entry) => entry.group === group).map((entry) => entry.pattern.toLowerCase());

export const danglingOpener: Detector = (doc): Finding[] => {
  const words = doc.lexicons["dangling-participle"] ?? [];
  const subjects = new Set(patternsIn(words, "subject"));
  const exempt = patternsIn(words, "exempt");
  return doc.sentences.flatMap((sentence) => {
    const found = sentence.embeddedLanguage === undefined ? danglingOpenerIn(doc.source, sentence.tokens ?? [], subjects, exempt) : undefined;
    if (found === undefined) return [];
    return [
      {
        rule: "",
        severity: "info",
        line: 0,
        column: 0,
        quote: sentence.text.trim(),
        values: { opener: found.opener, subject: found.subject.surface, offset: found.offset },
      },
    ];
  });
};
