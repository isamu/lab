import type { Detector, Finding, Sentence, Token } from "../plugin.ts";

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

const hasAgent = (sentence: Sentence, markers: readonly string[]): boolean => markers.some((marker) => sentence.text.includes(marker));

export const agentlessPassive: Detector = (doc, options): Finding[] => {
  const markers = (options.lexicon ?? []).map((entry) => entry.pattern);
  return doc.sentences
    .map((sentence) => ({ sentence, passives: (sentence.tokens ?? []).filter(isPassive) }))
    .filter(({ sentence, passives }) => passives.length >= options.limit && !hasAgent(sentence, markers))
    .map(({ sentence, passives }) => ({
      rule: "agentless-passive",
      severity: "warning",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: {
        count: passives.length,
        limit: options.limit,
        word: passives.map((token) => token.surface).join(" "),
        offset: passives[0]?.span.start ?? sentence.span.start,
      },
    }));
};
