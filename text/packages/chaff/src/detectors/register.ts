import { isPoliteWord } from "./polite-word.ts";
import type { LexiconEntry, Sentence, Span, Token } from "../plugin.ts";

export type Register = "polite" | "plain";

const PREDICATE = new Set(["VERB", "ADJ", "AUX"]);

const isPredicate = (token: Token): boolean => PREDICATE.has(token.pos);

const isDependent = (token: Token | undefined): boolean => token?.features?.["NounType"] === "Dependent";

/** preceding の後ろの述語の連なり: 助動詞の連なりと、その前の語一つ。「おかけしましたこと」なら「し・まし・た」。 */
const chainAtEnd = (preceding: readonly Token[]): readonly Token[] => {
  const head = preceding.findLastIndex((token) => token.pos !== "AUX");
  return preceding.slice(Math.max(head, 0));
};

/** 語彙表 neutral-ending の語（「こと」）か。書いた形か原形で照らす。 */
const isNeutralWord = (token: Token | undefined, neutral: readonly LexiconEntry[]): boolean =>
  token !== undefined && neutral.some((entry) => token.surface === entry.pattern || token.lemma === entry.pattern);

/**
 * 非自立名詞で終わる文末は、手前の述語の連なりまで見る。「使っているのかな？」は手前の述語が調子を持つ。
 * 「以下のとおり。」は手前も述語でないので、調子を持たないまま。
 * 語彙表 neutral-ending の語（「こと」）で終わる文末は手前を見ない。「〜を保持すること。」は体言止めで、要件や規程の箇条書きは
 * ですます調の文書でもである調の文書でもこの形で書く。
 */
const withPreceding = (ending: readonly Token[], preceding: readonly Token[], neutral: readonly LexiconEntry[]): readonly Token[] =>
  isDependent(ending[0]) && !isNeutralWord(ending[0], neutral) ? [...chainAtEnd(preceding), ...ending] : ending;

/**
 * 文末の語の調子。preceding は文末の語より前の語。neutral は調子を持たない文末の語（語彙表 neutral-ending）。
 * 文末に述語（動詞・形容詞・助動詞）が無ければ、ですます調でもである調でもないので undefined。
 * 「以下の通り。」「円錐形の麦わら帽子。」のような名詞で終わる文を数えると、そのままである調の少数派になっていた。
 * 書いた形でも原形でも読みでも当てる（polite-word.ts）。「ください」の原形は「くださる」で、原形だけを見ると丁寧な文末を見落とす。
 */
export const registerOf = (
  ending: readonly Token[],
  preceding: readonly Token[],
  polite: readonly LexiconEntry[],
  neutral: readonly LexiconEntry[] = [],
): Register | undefined => {
  const judged = withPreceding(ending, preceding, neutral);
  if (!judged.some(isPredicate)) return undefined;
  return judged.some((token) => isPoliteWord(token, polite)) ? "polite" : "plain";
};

const EXCLAIMED = /[！？!?]$/u;

/**
 * 「！」「？」で切れた文が、間を置かずに助詞で始まる次の文へ続くか。「作っていた！！という人」「導入しませんか？が断られた」は、
 * 分割器が切っても一つの文で、切れ目の手前は書き手の文末ではない。「。」で切れた文は続きとは見ない。
 */
export const continuesInto = (sentence: Sentence, next: Sentence | undefined): boolean =>
  EXCLAIMED.test(sentence.text) && next !== undefined && next.span.start === sentence.span.end && next.tokens?.[0]?.pos === "ADP";

/** 位置 offset を含む一番外側の箇条書きの始まり。本文なら undefined。入れ子の項目は外側の箇条書きと一緒に見る。 */
export const outermostList = (offset: number, lists: readonly Span[]): number | undefined =>
  lists
    .filter((list) => offset >= list.start && offset < list.end)
    .reduce<number | undefined>((outer, list) => (outer === undefined || list.start < outer ? list.start : outer), undefined);

/** 文が入っているまとまりの始まり。一番外側の箇条書き、それが無ければ番号で始まる段落の並び（runs）。本文なら undefined。 */
export const groupOf = (offset: number, lists: readonly Span[], runs: readonly Span[]): number | undefined =>
  outermostList(offset, lists) ?? outermostList(offset, runs);

/** group: 文が入っているまとまり（groupOf の値）。本文なら undefined。 */
export type Judged = { readonly register: Register; readonly group: number | undefined };

/** 混ざった文と、その文が属するまとまり（本文、または箇条書き 1 つ）の中の少数派の数。文書全体の数ではない。 */
export type Slip<T extends Judged> = { readonly entry: T; readonly count: number };

const countIn = (judged: readonly Judged[], register: Register): number => judged.filter((entry) => entry.register === register).length;

/** 多いほう。同数なら undefined。 */
export const majorityOf = (judged: readonly Judged[]): Register | undefined => {
  const difference = countIn(judged, "polite") - countIn(judged, "plain");
  if (difference === 0) return undefined;
  return difference > 0 ? "polite" : "plain";
};

/** 少ないほう。同数なら文書全体で少ないほう、それも同数なら丁寧体。 */
const minorityOf = (group: readonly Judged[], whole: readonly Judged[]): Register => {
  const majority = majorityOf(group);
  if (majority !== undefined) return majority === "polite" ? "plain" : "polite";
  return countIn(whole, "polite") <= countIn(whole, "plain") ? "polite" : "plain";
};

/**
 * 箇条書きの中の少数派が、文書全体では多数派か。それなら箇条書きの中で文書の調子に寄せた側なので、直す側ではない。
 * 常体の多い箇条書きにですます調の文が混ざっても、ですます調の文書なら「多いほうに揃えて」は文書の少数派へ揃えることになる。
 */
export const followsDocument = (group: number | undefined, minority: Register, whole: readonly Judged[]): boolean =>
  group !== undefined && majorityOf(whole) === minority;

const slipsInGroup = <T extends Judged>(judged: readonly T[], group: number | undefined, limit: number): Slip<T>[] => {
  const members = judged.filter((entry) => entry.group === group);
  const minority = minorityOf(members, judged);
  if (followsDocument(group, minority, judged)) return [];
  const slips = members.filter((entry) => entry.register === minority);
  // 片方しか無ければ揃っている。少数派が閾値を超えて多ければ、混在ではなく別の文体。
  if (slips.length === 0 || slips.length > limit) return [];
  return slips.map((entry) => ({ entry, count: slips.length }));
};

/**
 * 調子が混ざった文を、judged の順で。本文は本文どうし、箇条書きと番号で始まる段落の並びは 1 つずつ、その中で揃っているかを見る。
 * ですます調の本文に常体の箇条書きを置くのはよくある書き方で、箇条書きが丸ごと揃っていれば混在ではない。
 * 箇条書きの中で混ざっていても、少数派が文書全体の多数派なら指さない（followsDocument）。
 */
export const slipsOf = <T extends Judged>(judged: readonly T[], limit: number): Slip<T>[] => {
  const slips = [...new Set(judged.map((entry) => entry.group))].flatMap((group) => slipsInGroup(judged, group, limit));
  return judged.flatMap((entry) => slips.filter((slip) => slip.entry === entry));
};
