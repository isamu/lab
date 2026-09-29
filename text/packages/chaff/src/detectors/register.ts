import type { Sentence, Span, Token } from "../plugin.ts";

export type Register = "polite" | "plain";

const PREDICATE = new Set(["VERB", "ADJ", "AUX"]);

const isPredicate = (token: Token | undefined): boolean => token !== undefined && PREDICATE.has(token.pos);

const isDependent = (token: Token | undefined): boolean => token?.features?.["NounType"] === "Dependent";

/**
 * 述語に続く非自立名詞で終わる文末（「予約できること。」「前述したとおり。」）は、その述語が調子を持つ。
 * 要件や規程のである調は「〜こと。」で書く。
 */
const withPredicate = (ending: readonly Token[], before: Token | undefined): readonly Token[] =>
  before !== undefined && isPredicate(before) && isDependent(ending[0]) ? [before, ...ending] : ending;

/**
 * 文末の語の調子。before は文末の語の一つ手前の語。
 * 文末に述語（動詞・形容詞・助動詞）が無ければ、ですます調でもである調でもないので undefined。
 * 「以下の通り。」「円錐形の麦わら帽子。」のような名詞で終わる文を数えると、そのままである調の少数派になっていた。
 * 書いた形でも原形でも当てる。「ください」の原形は「くださる」で、原形だけを見ると丁寧な文末を見落とす。
 */
export const registerOf = (ending: readonly Token[], before: Token | undefined, polite: readonly string[]): Register | undefined => {
  const judged = withPredicate(ending, before);
  if (!judged.some(isPredicate)) return undefined;
  const isPolite = judged.some((token) => polite.includes(token.surface) || (token.lemma !== undefined && polite.includes(token.lemma)));
  return isPolite ? "polite" : "plain";
};

/**
 * 次の文が間を置かずに助詞で始まるか。「作っていた！！という人」「導入しませんか？が断られた」は、
 * 分割器が「！」「？」で切っても一つの文で、切れ目の手前は書き手の文末ではない。
 */
export const continuesInto = (sentence: Sentence, next: Sentence | undefined): boolean =>
  next !== undefined && next.span.start === sentence.span.end && next.tokens?.[0]?.pos === "ADP";

/** 位置 offset を含む一番外側の箇条書きの始まり。本文なら undefined。入れ子の項目は外側の箇条書きと一緒に見る。 */
export const outermostList = (offset: number, lists: readonly Span[]): number | undefined =>
  lists
    .filter((list) => offset >= list.start && offset < list.end)
    .reduce<number | undefined>((outer, list) => (outer === undefined || list.start < outer ? list.start : outer), undefined);

/** group: 文が入っている箇条書き（outermostList の値）。本文なら undefined。 */
export type Judged = { readonly register: Register; readonly group: number | undefined };

/** 混ざった文と、その文が属する本文または箇条書きの中の少数派の数。 */
export type Slip<T extends Judged> = { readonly entry: T; readonly count: number };

const countIn = (judged: readonly Judged[], register: Register): number => judged.filter((entry) => entry.register === register).length;

/** 少ないほう。同数なら文書全体で少ないほう、それも同数なら丁寧体。 */
const minorityOf = (group: readonly Judged[], whole: readonly Judged[]): Register => {
  const difference = countIn(group, "polite") - countIn(group, "plain");
  if (difference !== 0) return difference < 0 ? "polite" : "plain";
  return countIn(whole, "polite") <= countIn(whole, "plain") ? "polite" : "plain";
};

const slipsInGroup = <T extends Judged>(judged: readonly T[], group: number | undefined, limit: number): Slip<T>[] => {
  const members = judged.filter((entry) => entry.group === group);
  const minority = minorityOf(members, judged);
  const slips = members.filter((entry) => entry.register === minority);
  // 片方しか無ければ揃っている。少数派が閾値を超えて多ければ、混在ではなく別の文体。
  if (slips.length === 0 || slips.length > limit) return [];
  return slips.map((entry) => ({ entry, count: slips.length }));
};

/**
 * 調子が混ざった文を、judged の順で。本文は本文どうし、箇条書きは 1 つずつ、その中で揃っているかを見る。
 * ですます調の本文に常体の箇条書きを置くのはよくある書き方で、箇条書きが丸ごと揃っていれば混在ではない。
 */
export const slipsOf = <T extends Judged>(judged: readonly T[], limit: number): Slip<T>[] => {
  const slips = [...new Set(judged.map((entry) => entry.group))].flatMap((group) => slipsInGroup(judged, group, limit));
  return judged.flatMap((entry) => slips.filter((slip) => slip.entry === entry));
};
