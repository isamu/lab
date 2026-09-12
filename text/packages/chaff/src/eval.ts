import { DETECTORS } from "./detectors/index.ts";
import { charLength } from "./measure.ts";
import type { ProseDocument, RuleDefinition } from "./plugin.ts";

/**
 * 閾値の較正。
 *
 * examples/ に置いた文書は、実際に公開した「人間の良い文書」。そこで多く発火する
 * rule は、閾値が現実に合っていない疑いがある。spec §21 の目標（人間の良い文書での
 * 誤検知率 5% 未満）を、そのまま推奨の判断に使う。
 *
 * これは較正であって正解ではない。corpus が変われば答えも変わる。だから自動では
 * 適用せず、提示して選ばせる。
 */
export const TARGET_HIT_RATE = 0.05;

/** 文書単位の割合は corpus が小さいと粗い。文字数あたりの密度を併記する。 */
export type Point = { readonly limit: number; readonly findings: number; readonly documents: number; readonly per10k: number };

/** 5% を表せるだけの文書数。これを下回ると割合が「0 か全部」になる。 */
export const MIN_CORPUS = 20;

export type RuleReport = {
  readonly rule: string;
  readonly name: string;
  readonly current: number;
  readonly sweep: readonly Point[];
  readonly recommended: number | undefined;
  readonly total: number;
};

/** strict が relaxed より大きい rule は、値が大きいほど厳しい（sentence-rhythm）。 */
const stricterIsHigher = (rule: RuleDefinition): boolean => (rule.levels.strict ?? 0) > (rule.levels.relaxed ?? 0);

const MULTIPLIERS = [0.5, 0.7, 0.85, 1, 1.25, 1.5, 2, 3];

/** rule 自身が持つ段を基点に掃引する。rule ごとに単位が違うので、倍率で散らす。 */
const candidates = (rule: RuleDefinition): number[] => {
  const base = rule.levels.normal ?? 1;
  const fromLevels = [rule.levels.strict, rule.levels.normal, rule.levels.relaxed].filter((value) => value !== undefined);
  const scaled = MULTIPLIERS.map((factor) => Math.max(1, Math.round(base * factor)));
  return [...new Set([...fromLevels, ...scaled])].sort((left, right) => left - right);
};

const countAt = (docs: readonly ProseDocument[], rule: RuleDefinition, limit: number): Point => {
  const detector = DETECTORS[rule.how_to_find];
  if (detector === undefined) return { limit, findings: 0, documents: 0, per10k: 0 };
  const perDoc = docs.map((doc) => {
    const lexicon = rule.word_list === undefined ? undefined : doc.lexicons[rule.word_list];
    if (rule.word_list !== undefined && lexicon === undefined) return 0;
    return detector(doc, { limit, lexicon, where: rule.where }).length;
  });
  const findings = perDoc.reduce((sum, count) => sum + count, 0);
  const chars = docs.reduce((sum, doc) => sum + doc.sentences.reduce((inner, sentence) => inner + charLength(sentence), 0), 0);
  return { limit, findings, documents: perDoc.filter((count) => count > 0).length, per10k: chars === 0 ? 0 : (findings / chars) * 10000 };
};

/** 目標の誤検知率を満たす中で、いちばん厳しい閾値を選ぶ。 */
const recommend = (rule: RuleDefinition, sweep: readonly Point[], total: number): number | undefined => {
  const ok = sweep.filter((point) => point.documents / Math.max(1, total) <= TARGET_HIT_RATE);
  if (ok.length === 0) return undefined;
  const strictest = stricterIsHigher(rule) ? Math.max(...ok.map((p) => p.limit)) : Math.min(...ok.map((p) => p.limit));
  return strictest;
};

/**
 * lint で動かない rule は掃引しない。
 * 動かないものの閾値を測ると、「どの閾値でも 0 件」が「よく校正されている」に見える。
 */
const measurable = (rule: RuleDefinition, docs: readonly ProseDocument[], genre: string, language: string): boolean => {
  if (rule.layer === "L4" || !rule.use_for.some((target) => genre.startsWith(target))) return false;
  if (rule.languages !== undefined && !rule.languages.includes(language)) return false;
  if (rule.from.length > 0) return false;
  const capabilities = docs[0]?.capabilities;
  return !rule.requires.some((need) => (need === "lemma" ? capabilities?.lemma : capabilities?.pos) !== true);
};

export const evaluate = (docs: readonly ProseDocument[], rules: readonly RuleDefinition[], genre: string, language: string): RuleReport[] =>
  rules
    .filter((rule) => measurable(rule, docs, genre, language))
    .map((rule) => {
      const sweep = candidates(rule).map((limit) => countAt(docs, rule, limit));
      const current = rule.levels.normal ?? 1;
      return {
        rule: rule.id,
        name: rule.name[language] ?? rule.id,
        current,
        sweep,
        recommended: recommend(rule, sweep, docs.length),
        total: docs.length,
      };
    });
