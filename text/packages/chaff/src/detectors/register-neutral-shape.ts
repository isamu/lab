import type { LexiconEntry, Sentence, Token } from "../plugin.ts";

/**
 * ですます調にもである調にも数えない文の形。どちらの調子の文書にも同じ形で現れる。
 * - へりくだる動詞の願い（受け継いでいただきたい。ご協力願いたい。）: 丁寧さは動詞が持ち、訓示でも論文でもこの形で頼む。
 * - 句点で閉じた常体の問い（対処できているか。どうすればよいのだろうか。）: 自分や聞き手に投げる問いで、ですます調の演説や記事にも混ざる。
 * - 言いさし（いつもと違っていたら・・・。）: 条件だけ言って文末を言わない文には、文末の調子が無い。
 * Pure。
 */

const WISH = "たい";
const QUESTION = "か";
const CONDITIONAL = new Set(["たら", "だら"]);
/** 三点リーダー・二点リーダーと、二つ以上の中黒、三つ以上のピリオドで書いた「…」。後ろの句点は除いてから見る。 */
const ELLIPSIS_ENDINGS = ["…", "‥", "・・", "..."];
const FULL_STOP = /[。．]$/u;

const endsWithEllipsis = (text: string): boolean => {
  const body = text.replace(FULL_STOP, "");
  return ELLIPSIS_ENDINGS.some((ellipsis) => body.endsWith(ellipsis));
};

/** 語彙表 neutral-request の動詞（いただく、願う）に「たい」だけが付いて終わる文末。「いただきたかった」「いただきたいです」は入らない。 */
const isHumbleWish = (ending: readonly Token[], verbs: readonly LexiconEntry[]): boolean => {
  const [verb, wish, ...rest] = ending;
  return rest.length === 0 && wish?.surface === WISH && verbs.some((entry) => entry.pattern === verb?.lemma || entry.pattern === verb?.surface);
};

/** 問いの「か」の後ろに来て、問いを書き言葉で閉じる印。「〜のかな？」「〜か？」は読み手に話しかける常体で、数える。 */
const CLOSES_QUESTION = new Set(["。", "．", "、", "，"]);

/** 文末の語のすぐ後ろが問いの「か」で、その後ろが句点か読点。 */
const endsAsQuestion = (sentence: Sentence, ending: readonly Token[]): boolean => {
  const tokens = sentence.tokens ?? [];
  const last = ending.at(-1);
  if (last === undefined) return false;
  const at = tokens.indexOf(last);
  return tokens[at + 1]?.surface === QUESTION && CLOSES_QUESTION.has(tokens[at + 2]?.surface ?? "");
};

const trailsOff = (sentence: Sentence, ending: readonly Token[]): boolean =>
  CONDITIONAL.has(ending.at(-1)?.surface ?? "") && endsWithEllipsis(sentence.text.trim());

/** 常体と読める文末でも調子に数えない文か。ending は sentence-shape の endingTokens、verbs は語彙表 neutral-request。 */
export const isNeutralPlainShape = (sentence: Sentence, ending: readonly Token[], verbs: readonly LexiconEntry[]): boolean =>
  isHumbleWish(ending, verbs) || endsAsQuestion(sentence, ending) || trailsOff(sentence, ending);
