import { hasParticle, isClosed, lastContent } from "../sentence-shape.ts";
import type { Detector, Finding, Span, Token } from "../plugin.ts";

/**
 * 文末が名詞で終わる（体言止め）。箇条書きでは普通だが、本文では文が途中で切れて読める。
 * 実文書で測ったら、指摘の 9 割が箇条書きの項目だった。箇条書きは除く。
 */
const NOMINAL = new Set(["NOUN", "PROPN"]);

/** 非自立名詞は単独では何も指さない。「回るのか。」の「の」を体言止めと読まない。 */
const isDependent = (token: Token): boolean => token.features?.["NounType"] === "Dependent";

const inside = (span: Span, spans: readonly Span[]): boolean => spans.some((other) => span.start >= other.start && span.start < other.end);

export const nounEnding: Detector = (doc, options): Finding[] => {
  const ended = doc.sentences.filter((sentence) => {
    if (inside(sentence.span, doc.listSpans) || !isClosed(sentence) || !hasParticle(sentence)) return false;
    const last = lastContent(sentence);
    return last !== undefined && NOMINAL.has(last.pos) && !isDependent(last);
  });
  const first = ended[0];
  // 文書全体の数についての指摘なので、1 文ずつ出さない。13 件並べても直す順番が分からない。
  if (first === undefined || ended.length <= options.limit) return [];
  return [
    {
      rule: "taigen-dome-in-prose",
      severity: "info",
      line: 0,
      column: 0,
      quote: first.text.trim(),
      values: { count: ended.length, limit: options.limit, offset: first.span.start },
    },
  ];
};

/**
 * 名詞を名詞に繋ぐ助詞が続けて出る。「弊社の新製品の販売の計画」は係りかたが読めなくなる典型。
 *
 * 見るのは語彙表にある助詞だけ。助詞一般を数えると、「A も B も C も」の並列と
 * 「コピーして持っていって」の連用が当たる。どちらも何重に続いても読めるので rule が合わない。
 *
 * 数えるのは**節の中**だけ。読点で切らないと「サービスの運営や、ドキュメントの作成」のような
 * 並列まで 1 つの連なりとして数える。並列は必ず読点で区切られる。
 */
type Run = { readonly surface: string; readonly tokens: readonly Token[] };

const extend = (runs: readonly Run[], token: Token): Run[] => {
  const last = runs.at(-1);
  if (last !== undefined && last.surface === token.surface) return [...runs.slice(0, -1), { surface: last.surface, tokens: [...last.tokens, token] }];
  return [...runs, { surface: token.surface, tokens: [token] }];
};

const PARTICLE = new Set(["ADP", "SCONJ", "PART", "CCONJ"]);

const BREAK: Run = { surface: "", tokens: [] };

/**
 * 名詞は連なりの中身なので飛ばす。読点と、語彙表に無い助詞は連なりを切る。
 * 「弊社のAはBの」を 2 回続いたと数えないため。「は」でいちど句が閉じている。
 */
const runsOf = (tokens: readonly Token[], nesting: readonly string[]): Run[] =>
  tokens.reduce<Run[]>((acc, token) => {
    if (nesting.includes(token.surface)) return extend(acc, token);
    return token.pos === "PUNCT" || PARTICLE.has(token.pos) ? [...acc, BREAK] : acc;
  }, []);

export const doubledParticle: Detector = (doc, options): Finding[] => {
  const nesting = (options.lexicon ?? []).map((entry) => entry.pattern);
  return doc.sentences.flatMap((sentence) =>
    runsOf(sentence.tokens ?? [], nesting)
      .filter((run) => run.tokens.length > options.limit)
      .map((run) => ({
        rule: "no-doubled-joshi",
        severity: "warning" as const,
        line: 0,
        column: 0,
        quote: sentence.text.trim(),
        values: { word: run.surface, count: run.tokens.length, limit: options.limit, offset: run.tokens[0]?.span.start ?? sentence.span.start },
      })),
  );
};
