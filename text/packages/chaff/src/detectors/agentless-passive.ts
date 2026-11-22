import type { Detector, Finding, Lexicon, Sentence, Token } from "../plugin.ts";

/**
 * 受動のまま動作主を書かないと、誰がしたのかが文から消える。
 * 「決定されました」は、決めた人を名指さずに決定を伝える。
 *
 * 受動かどうかはアダプタが Voice=Pass で印を付ける。日本語の「れる/られる」と
 * 英語の be + 過去分詞は形が全く違うので、その判断は言語の側に置く。spec §12.1。
 * 「名詞を修飾しているだけか」の判断も、語順が言語で逆になるため同じくアダプタ側。
 * 動作主の語（によって / by）も言語ごとの語彙表から引く。detector は言語を知らない。
 */
const isPassive = (token: Token): boolean => token.features?.["Voice"] === "Pass";

/** 起点の語（から）と、数のすぐ後ろで時を言う単位（月、時）。どちらも語彙表の group で受け取る。 */
const SOURCE_GROUP = "source";
const TIME_GROUP = "time";

type AgentWords = { readonly markers: readonly string[]; readonly sources: readonly string[]; readonly timeUnits: readonly string[] };

const patternsOf = (lexicon: Lexicon, group: string | undefined): string[] => lexicon.filter((entry) => entry.group === group).map((entry) => entry.pattern);

const agentWordsOf = (lexicon: Lexicon): AgentWords => ({
  markers: patternsOf(lexicon, undefined),
  sources: patternsOf(lexicon, SOURCE_GROUP),
  timeUnits: patternsOf(lexicon, TIME_GROUP),
});

/** 時の語: 副詞のように使う名詞（来月、本日）か、数のすぐ後ろの時の単位（4月、10時）。 */
const isTime = (tokens: readonly Token[], at: number, timeUnits: readonly string[]): boolean => {
  const token = tokens[at];
  if (token === undefined) return false;
  if (token.features?.["Adverbial"] === "Yes") return true;
  return timeUnits.includes(token.surface) && tokens[at - 1]?.features?.["NumType"] === "Card";
};

/** 起点の語のうち、すぐ前が時の語でないもの（部長から）。来月から、4月1日からは時の起点で、した人を言わない。 */
const namesSource = (tokens: readonly Token[], { sources, timeUnits }: AgentWords): boolean =>
  tokens.some((token, at) => sources.includes(token.surface) && at > 0 && !isTime(tokens, at - 1, timeUnits));

const hasAgent = (sentence: Sentence, words: AgentWords): boolean =>
  words.markers.some((marker) => sentence.text.includes(marker)) || namesSource(sentence.tokens ?? [], words);

const isLightVerb = (token: Token | undefined): boolean => token?.pos === "VERB" && token.features?.["VerbType"] === "Light";
const isVerbalNoun = (token: Token | undefined): boolean => token?.pos === "NOUN" && token.features?.["VerbForm"] === "Vnoun";
const touches = (left: Token | undefined, right: Token | undefined): boolean => left !== undefined && right !== undefined && left.span.end === right.span.start;

/** 受け身の印のすぐ前に続けて書いた動詞の始まり（送ら れ、決定 さ れ）。印が動詞そのもの（reviewed）なら印の位置。 */
const verbStart = (tokens: readonly Token[], at: number): number => {
  const before = tokens[at - 1];
  if (!touches(before, tokens[at]) || before?.pos !== "VERB") return at;
  return isLightVerb(before) && isVerbalNoun(tokens[at - 2]) && touches(tokens[at - 2], before) ? at - 2 : at - 1;
};

/** 指摘が引く受け身の語。印だけ（れ）では読み手に何の受け身かが分からないので、動詞から引く（決定され）。 */
const passiveVerb = (source: string, tokens: readonly Token[], passive: Token): string => {
  const start = tokens[verbStart(tokens, tokens.indexOf(passive))]?.span.start ?? passive.span.start;
  return source.slice(start, passive.span.end);
};

export const agentlessPassive: Detector = (doc, options): Finding[] => {
  const words = agentWordsOf(options.lexicon ?? []);
  return doc.sentences
    .map((sentence) => ({ sentence, passives: (sentence.tokens ?? []).filter(isPassive) }))
    .filter(({ sentence, passives }) => passives.length >= options.limit && !hasAgent(sentence, words))
    .map(({ sentence, passives }) => ({
      rule: "agentless-passive",
      severity: "warning",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: {
        count: passives.length,
        limit: options.limit,
        word: passives.map((token) => passiveVerb(doc.source, sentence.tokens ?? [], token)).join(" "),
        offset: passives[0]?.span.start ?? sentence.span.start,
      },
    }));
};
