import type { Detector, Finding } from "../plugin.ts";
import { minorityStyle } from "../orthography.ts";
import { isClosed } from "../sentence-shape.ts";
import { phraseJoints, type Joint, type JointKind } from "../stray-space.ts";

const KINDS: readonly JointKind[] = ["between-phrases", "inside-phrase"];

type Quoted = Joint & { readonly quote: string };

/**
 * 空けたほうが少ないときだけ、その空白を指摘する。空けたほうが多い文書（文節ごとに空ける分かち書き）は、
 * その書き方を選んでいるので何も言わない。詰めた境目を「空け忘れ」とは言わない。どこで空けるかは書き手が決める。
 */
const strays = (joints: readonly Quoted[]): readonly Quoted[] => (minorityStyle(joints) === true ? joints.filter((joint) => joint.spaced) : []);

/**
 * 日本語の語句の途中の空白（「こころさんが 払った」「確認 しました」）。句点で終わる文だけを見る。
 * 句点の無い行（歌、名札と値、表のような行）の空白は区切りとして書かれている。
 */
export const straySpace: Detector = (doc, options): Finding[] => {
  const joints: Quoted[] = doc.sentences
    .filter(isClosed)
    .flatMap((sentence) =>
      phraseJoints(sentence, doc.source.slice(sentence.span.start, sentence.span.end)).map((joint) => ({ ...joint, quote: sentence.text.trim() })),
    );
  return KINDS.flatMap((kind) => {
    const ofKind = joints.filter((joint) => joint.kind === kind);
    const odd = strays(ofKind);
    if (odd.length < options.limit) return [];
    return odd.map((joint) => ({
      rule: "",
      severity: "warning",
      line: 0,
      column: 0,
      quote: joint.quote,
      variant: kind,
      values: { before: joint.before, after: joint.after, count: odd.length, of: ofKind.length, limit: options.limit, offset: joint.offset },
    }));
  });
};
