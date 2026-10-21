import type { LexiconEntry, Sentence, Token } from "../plugin.ts";

/**
 * ですます調にもである調にも数えない文の形。どちらの調子の文書にも同じ形で現れる。
 * - へりくだる動詞の願い（受け継いでいただきたい。ご協力願いたい。）: 丁寧さは動詞が持ち、訓示でも論文でもこの形で頼む。
 * - 常体の問い（対処できているか。どうすればよいのだろうか。）: 自分や聞き手に投げる問いで、ですます調の演説や記事にも混ざる。
 * - 言いさし（いつもと違っていたら・・・。）: 条件だけ言って文末を言わない文には、文末の調子が無い。
 * Pure。
 */

const WISH = "たい";
const QUESTION = "か";
const CONDITIONAL = new Set(["たら", "だら"]);
const ELLIPSIS_END = /(?:…|‥|・・・?|\.\.\.)[。．]?$/u;

/** 語彙表 neutral-request の動詞（いただく、願う）に「たい」だけが付いて終わる文末。「いただきたかった」「いただきたいです」は入らない。 */
const isHumbleWish = (ending: readonly Token[], verbs: readonly LexiconEntry[]): boolean => {
  const [verb, wish, ...rest] = ending;
  return rest.length === 0 && wish?.surface === WISH && verbs.some((entry) => entry.pattern === verb?.lemma || entry.pattern === verb?.surface);
};

/** 文末の語のすぐ後ろが問いの「か」。 */
const endsAsQuestion = (sentence: Sentence, ending: readonly Token[]): boolean => {
  const tokens = sentence.tokens ?? [];
  const last = ending.at(-1);
  return last !== undefined && tokens[tokens.indexOf(last) + 1]?.surface === QUESTION;
};

const trailsOff = (sentence: Sentence, ending: readonly Token[]): boolean =>
  CONDITIONAL.has(ending.at(-1)?.surface ?? "") && ELLIPSIS_END.test(sentence.text.trim());

/** 常体と読める文末でも調子に数えない文か。ending は sentence-shape の endingTokens、verbs は語彙表 neutral-request。 */
export const isNeutralPlainShape = (sentence: Sentence, ending: readonly Token[], verbs: readonly LexiconEntry[]): boolean =>
  isHumbleWish(ending, verbs) || endsAsQuestion(sentence, ending) || trailsOff(sentence, ending);
