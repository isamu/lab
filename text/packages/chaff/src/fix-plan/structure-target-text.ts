import type { Texts } from "../ui.ts";
import type { FeatureId } from "../structure-shape/features.ts";
import type { StructureTarget } from "./structure-targets.ts";

export type StructureTargetText = {
  readonly heading: string;
  /** The score, what it counts, and the count at which the plan rewrites from the outline. */
  readonly score: (score: number, limit: number, compared: number) => string;
  readonly noTargets: string;
  /** One target per measure past the human limit, from the baseline's numbers. */
  readonly target: Readonly<Record<FeatureId, (target: StructureTarget) => string>>;
  /** When the rewrite of the outline is done. */
  readonly stop: (limit: number) => string;
};

const v = (value: number): string => String(value);

const withDetail = (detail: string | undefined, wrap: (detail: string) => string): string => (detail === undefined ? "" : wrap(detail));

const formJa = (form: string): string => `（多いのは「${form}」）`;
const quotedJa = (heading: string): string => `「${heading}」`;
const pairsJa = (pairs: string): string => `（${pairs}）`;
const formEn = (form: string): string => ` (most: "${form}")`;
const quotedEn = (heading: string): string => ` "${heading}"`;
const pairsEn = (pairs: string): string => ` (${pairs})`;

export const STRUCTURE_TARGET_TEXT: Texts<StructureTargetText> = {
  ja: {
    heading: "構成の目標",
    score: (score, limit, compared) =>
      `構成の AI らしさ: ${v(score)}（人の記事の 9 割を超えた項目の数。比べた ${v(compared)} 項目のうち）。${v(limit)} 以上なら構成から書き直します。`,
    noTargets: "構成の項目は、どれも人の記事の範囲にあります。",
    target: {
      "heading-density": (target) => {
        const budget = target.headings;
        const counts =
          budget === undefined ? "" : `いま ${v(budget.now)} 個。この長さの人の記事なら多くて ${v(budget.most)} 個、ふつうは ${v(budget.usual)} 個です。`;
        return `見出しを減らす: ${counts}一段落ごとに見出しを立てず、中身のまとまりごとに立てます。`;
      },
      "short-sections": (target) => `1〜2 段落しかない節を、前後の節と合わせる: いま ${v(target.value)}%（人の記事の 9 割は ${v(target.limit)}% まで）。`,
      "section-uniformity": (target) =>
        `節の長さを揃えない: ばらつきがいま ${v(target.value)}%（人の記事の 9 割は ${v(target.limit)}% 以上、ふつうは ${v(target.median)}%）。書くことの少ない節は短く、多い節は長くします。`,
      "heading-forms": (target) =>
        `見出しの形を変える: いま ${v(target.value)}% が決まった形${withDetail(target.detail, formJa)}です（人の記事の 9 割は ${v(target.limit)}% まで）。「〜とは」「〜のメリット」をやめ、その節で言うことを見出しにします。`,
      "three-subsections": (target) =>
        `3 つの小見出しに分けた見出しを、中身の数に合わせる: いま ${v(target.value)} か所（人の記事の 9 割は ${v(target.limit)} か所まで）。`,
      bookends: () => "「はじめに」と「まとめ」の見出しを外す: 要点か具体的な場面から書き始め、最後の節は本文の続きにします。",
      "closing-restatement": (target) =>
        `本文を言い直す${withDetail(target.detail, quotedJa)}を消す: 言い直しがいま ${v(target.value)}%（人の記事の 9 割は ${v(target.limit)}% まで）。言いたいことは前の節の最後に入れます。`,
      "three-item-lists": (target) => `3 項目に揃えた箇条書きを、中身の数に合わせる: いま ${v(target.value)}%（人の記事の 9 割は ${v(target.limit)}% まで）。`,
      "bold-labels": (target) => `太字の札で始まる項目 ${v(target.value)} 個を文に戻す（人の記事の 9 割は ${v(target.limit)} 個まで）。`,
      "emoji-headings": (target) => `見出しの絵文字 ${v(target.value)} 個を外す（人の記事の 9 割は ${v(target.limit)} 個まで）。`,
      "pro-con": (target) => `メリットとデメリットを対にした節${withDetail(target.detail, pairsJa)}を、代わりに払うものも書いた一つの話にまとめる。`,
    },
    stop: (limit) =>
      `\`chaff outline <元の文書> <書き直した文書>\` で、上の項目に ✗ が付かなくなり、構成の AI らしさが ${v(limit)} 未満になったら構成の書き直しを止めます。`,
  },
  en: {
    heading: "Structure targets",
    score: (score, limit, compared) =>
      `Structure score: ${v(score)} (measures past 90% of human articles, of ${v(compared)} compared). At ${v(limit)} or more, rewrite from the outline.`,
    noTargets: "Every structure measure is within the range of human articles.",
    target: {
      "heading-density": (target) => {
        const budget = target.headings;
        const counts =
          budget === undefined ? "" : `${v(budget.now)} now; a human article this long has ${v(budget.most)} at most, ${v(budget.usual)} usually. `;
        return `Fewer headings: ${counts}Give a heading to a unit of content, not to every paragraph.`;
      },
      "short-sections": (target) =>
        `Merge sections of one or two paragraphs into their neighbours: ${v(target.value)}% now (90% of human articles: ${v(target.limit)}% or less).`,
      "section-uniformity": (target) =>
        `Let section lengths vary: variation ${v(target.value)}% now (90% of human articles: ${v(target.limit)}% or more, median ${v(target.median)}%). Thin sections stay thin, full ones run long.`,
      "heading-forms": (target) =>
        `Vary the heading forms: ${v(target.value)}% are in a stock form now${withDetail(target.detail, formEn)} (90% of human articles: ${v(target.limit)}% or less). Say in the heading what the section says, not "What is X" or "Benefits of X".`,
      "three-subsections": (target) =>
        `Split a section as many ways as its content has: ${v(target.value)} headings split into three now (90% of human articles: ${v(target.limit)} or fewer).`,
      bookends: () => 'Drop the "Introduction" and "Conclusion" headings: open with the point or a concrete scene, and let the last section continue the body.',
      "closing-restatement": (target) =>
        `Cut the closing${withDetail(target.detail, quotedEn)} that restates the body: ${v(target.value)}% restated now (90% of human articles: ${v(target.limit)}% or less). Put the point at the end of the section before.`,
      "three-item-lists": (target) =>
        `Give each list as many items as its content has: ${v(target.value)}% of lists have three now (90% of human articles: ${v(target.limit)}% or less).`,
      "bold-labels": (target) => `Turn the ${v(target.value)} bold-label list items back into sentences (90% of human articles: ${v(target.limit)} or fewer).`,
      "emoji-headings": (target) => `Take the emoji out of ${v(target.value)} headings (90% of human articles: ${v(target.limit)} or fewer).`,
      "pro-con": (target) => `Fold the paired pros and cons sections${withDetail(target.detail, pairsEn)} into one account that also says what it costs.`,
    },
    stop: (limit) =>
      `Stop rewriting the outline when \`chaff outline <original> <rewrite>\` marks none of these with ✗ and the structure score is under ${v(limit)}.`,
  },
};
