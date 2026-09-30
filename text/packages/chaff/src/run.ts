import { DETECTORS } from "./detectors/index.ts";
import { resolve } from "./levels.ts";
import type { AdapterNeeds, Finding, Level, ProseDocument, RuleDefinition } from "./plugin.ts";
import { lineStarts, placeOf } from "./position.ts";
import { REASONS, type Reasons } from "./reasons.ts";
import { joinWords } from "./detectors/word-list.ts";
import { missingList } from "./declared-lists.ts";
import { unreadStructure, type Unread } from "./structure/unread.ts";
import { isMarkdownPath } from "./structure/markdown-path.ts";
import { maskSpans } from "./mask.ts";
import { textOutline } from "./page-furniture.ts";
import { uiLanguageOf } from "./ui.ts";
import { presetLevels } from "./genre-load.ts";

export type Skipped = { readonly rule: string; readonly why: string };

export type RunResult = {
  readonly findings: readonly Finding[];
  readonly skipped: readonly Skipped[];
  /** 設定で明示的に有効にした experimental な rule。実行ごとに一度報告する。spec §18.4。 */
  readonly forcedExperimental: readonly string[];
  /** The experimental rules the genre's preset turns on. Reported apart from forcedExperimental: chaff.yaml did not name them. */
  readonly presetExperimental: readonly string[];
};

export type Settings = Readonly<Record<string, Level>>;

const levelFor = (rule: RuleDefinition, settings: Settings, experimental: boolean, preset: Settings): Level => {
  const explicit = settings[rule.id];
  // 明示設定は status の既定に勝つ。名指しで有効にしたものを黙って無効にしない。
  if (explicit !== undefined) return explicit;
  // ジャンルの既定は chaff.yaml より弱く、status の既定より強い。--experimental でも、ジャンルが止めたものは止めたまま。
  const fromPreset = preset[rule.id];
  if (fromPreset !== undefined) return fromPreset;
  if (rule.status === "experimental" && !experimental) return "off";
  return "normal";
};

/** Why a rule at off did not run: chaff.yaml turned it off, the genre's preset did, or it is experimental. */
const offReason = (rule: RuleDefinition, settings: Settings, preset: Settings, genre: string, reasons: Reasons): string => {
  if (settings[rule.id] !== undefined) return reasons.turnedOff;
  return preset[rule.id] === undefined ? reasons.experimental : reasons.presetOff(genre);
};

const reasonsFor = (doc: ProseDocument): Reasons => REASONS[uiLanguageOf(doc.language)];

/**
 * 構造の rule が動けない理由。木を作れない言語か、番号の行を読めなかった文書。
 * 読めなかった文書で「参照先が無い」が 0 件なのは、確かめた結果ではないので、読めなかったと言う。
 */
/**
 * 木を読む rule の要求。structure は番号の並びを読む（読めなかった文書では動かない）。dates と quantities は木の日付と数量だけを
 * 読むので、番号を読めなかった文書でも動く。どちらも capability ではなく、adapter が木を作れるかで決まる。
 */
const TREE_NEEDS: ReadonlySet<string> = new Set(["structure", "dates", "quantities"]);
const VALUE_NEEDS: ReadonlySet<string> = new Set(["dates", "quantities"]);

const treeNeed = (rule: RuleDefinition, doc: ProseDocument): string | undefined => {
  if (rule.requires.includes("structure")) return treeProblem(doc);
  return rule.requires.some((need) => VALUE_NEEDS.has(need)) && doc.structure === undefined ? reasonsFor(doc).noStructure(doc.language) : undefined;
};

const treeProblem = (doc: ProseDocument): string | undefined => {
  if (doc.structure === undefined) return reasonsFor(doc).noStructure(doc.language);
  const unread = unreadOf(doc);
  return unread === undefined ? undefined : reasonsFor(doc).unreadStructure(unread.clauses, unread.units);
};

/** 木が読んだのと同じ本文。Markdown はコードを覆ったもの、.txt はページの飾りだけを覆ったもの（.txt の字下げはコードではない）。 */
const textTheTreeRead = (doc: ProseDocument): string =>
  isMarkdownPath(doc.path) ? (doc.prose ?? doc.source) : maskSpans(doc.source, textOutline(doc.source).opaque);

const unreadByDocument = new WeakMap<ProseDocument, Unread | undefined>();

/** 文書ごとに一度だけ数える。構造の rule が三つあっても、本文を三度なめない。 */
const unreadOf = (doc: ProseDocument): Unread | undefined => {
  if (!unreadByDocument.has(doc)) unreadByDocument.set(doc, doc.structure === undefined ? undefined : unreadStructure(textTheTreeRead(doc), doc.structure));
  return unreadByDocument.get(doc);
};

/** 知らない要求は満たされていないものとして扱う。黙って無視すると、要求なしで動いてしまう。 */
const has = (capabilities: ProseDocument["capabilities"], need: string): boolean => {
  if (need === "pos") return capabilities.pos;
  if (need === "lemma") return capabilities.lemma;
  return false;
};

/**
 * 宣言だけでなく、実際に token が来ているかも見る。
 *
 * `capabilities.pos: true` と言いながら token を返さないアダプタでも、rule は
 * `sentence.tokens ?? []` を見るので**例外にならず、指摘 0 件で終わる**。
 * 0 件は「問題なし」と見分けがつかない。
 */
const hasTokens = (doc: ProseDocument): boolean => doc.sentences.length === 0 || doc.sentences.some((sentence) => sentence.tokens !== undefined);

/** 要求を満たさない rule は動かせない。満たさないまま動かすと「指摘 0 件」が保証に見える。 */
const unmet = (rule: RuleDefinition, doc: ProseDocument): string | undefined => {
  if (rule.languages !== undefined && !rule.languages.includes(doc.language)) return reasonsFor(doc).otherLanguage(doc.language);
  const missing = rule.requires.filter((need) => !TREE_NEEDS.has(need)).find((need) => !has(doc.capabilities, need));
  if (missing !== undefined) return reasonsFor(doc).noCapability(missing);
  return undefined;
};

/**
 * 品詞は、動かす rule があるときだけ用意する（neededBy）。だから「品詞が無い」は、段階を見た後でしか言えない。
 * 先に聞くと、止めている rule まで「アダプタが品詞を返さなかった」と、違う理由で出る。
 */
const untagged = (rule: RuleDefinition, doc: ProseDocument): string | undefined =>
  rule.requires.some((need) => need === "pos" || need === "lemma") && !hasTokens(doc) ? reasonsFor(doc).noTags : undefined;

const forGenre = (rules: readonly RuleDefinition[], genre: string): RuleDefinition[] =>
  rules.filter((rule) => rule.use_for.some((target) => genre.startsWith(target)));

/** rule が品詞か見出し語を要求するか、使えるなら使うか。 */
export const wantsTags = (rule: RuleDefinition): boolean => [...rule.requires, ...rule.uses].some((need) => need === "pos" || need === "lemma");

/**
 * 解析器の初期化に払う代金を決める。動く rule が 1 本も要求しないなら読み込まない。
 * capabilities は「払えばできる」の宣言なので、ここでは見ない。
 */
export const neededBy = (rules: readonly RuleDefinition[], settings: Settings, experimental: boolean, genre: string, language: string): AdapterNeeds => ({
  pos: forGenre(rules, genre)
    .filter((rule) => rule.layer !== "L4" && levelFor(rule, settings, experimental, presetLevels(genre)) !== "off")
    .filter((rule) => rule.languages === undefined || rule.languages.includes(language))
    .some(wantsTags),
});

const place = (starts: readonly number[], finding: Finding): Finding => {
  const offset = finding.values["offset"];
  const at = placeOf(starts, typeof offset === "number" ? offset : 0);
  return { ...finding, line: at.line, column: at.column };
};

/**
 * 複合シグナル。他の rule の結果を読むので、detector の形には収まらない。run の二段目。spec §20.2。
 *
 * 1 本ずつでは何も言えないものが揃ったときだけ、1 件にまとめて出す。
 * 元の指摘は消さない。`padded-intro` のように単独でも正しい指摘が混ざっており、
 * まとめるために消すと本物の指摘が見えなくなる。
 */
const compositeOf = (rule: RuleDefinition, found: readonly Finding[], limit: number, starts: readonly number[], language: string): Finding[] => {
  const fired = rule.from.filter((id) => found.some((finding) => finding.rule === id));
  if (fired.length < limit) return [];
  const first = found.find((finding) => fired.includes(finding.rule));
  return [
    place(starts, {
      rule: rule.id,
      severity: rule.severity,
      line: 0,
      column: 0,
      quote: first?.quote ?? "",
      values: { word: joinWords(fired, language), count: fired.length, limit, offset: first === undefined ? 0 : Number(first.values["offset"] ?? 0) },
    }),
  ];
};

/** chaff.yaml の rules に数値で書いた上限。段階の表より先に効く。 */
export type Limits = Readonly<Record<string, number>>;

const limitFor = (rule: RuleDefinition, level: Level, genre: string, limits: Limits): number => limits[rule.id] ?? resolve(rule, level, genre).limit;

export const runRules = (
  doc: ProseDocument,
  rules: readonly RuleDefinition[],
  settings: Settings,
  experimental: boolean,
  genre: string,
  limits: Limits = {},
): RunResult => {
  const preset = presetLevels(genre);
  const starts = lineStarts(doc.source);
  const applicable = forGenre(rules, genre);
  const experimentalOn = applicable.filter((rule) => rule.status === "experimental" && levelFor(rule, settings, experimental, preset) !== "off");
  const forced = experimentalOn.filter((rule) => settings[rule.id] !== undefined).map((rule) => rule.id);
  const presetOn = experimentalOn.filter((rule) => settings[rule.id] === undefined && preset[rule.id] !== undefined).map((rule) => rule.id);
  const outcome = applicable.reduce<{ findings: Finding[]; skipped: Skipped[] }>(
    (acc, rule) => {
      // L4 は意味を読む検査。chaff test が扱う。ここで「検出器が無い」と言わせない。
      if (rule.layer === "L4") {
        return { findings: acc.findings, skipped: [...acc.skipped, { rule: rule.id, why: reasonsFor(doc).semantic }] };
      }
      const blocked = unmet(rule, doc);
      if (blocked !== undefined) return { findings: acc.findings, skipped: [...acc.skipped, { rule: rule.id, why: blocked }] };
      const level = levelFor(rule, settings, experimental, preset);
      if (level === "off")
        return { findings: acc.findings, skipped: [...acc.skipped, { rule: rule.id, why: offReason(rule, settings, preset, genre, reasonsFor(doc)) }] };
      const noTags = untagged(rule, doc);
      if (noTags !== undefined) return { findings: acc.findings, skipped: [...acc.skipped, { rule: rule.id, why: noTags }] };
      // 木は capability ではなく、adapter が structure を持つかで決まる。持たない言語で動かすと「参照先が無い」が 0 件に見える。
      // 段階を見た後で聞く。doc.structure は触れたときに木を作るので、止めている rule のために作らない。
      const noTree = treeNeed(rule, doc);
      if (noTree !== undefined) return { findings: acc.findings, skipped: [...acc.skipped, { rule: rule.id, why: noTree }] };
      // 複合シグナルは二段目で扱う。一段目では「検出器が無い」と言わせない。
      if (rule.from.length > 0) return acc;
      const detector = DETECTORS[rule.how_to_find];
      if (detector === undefined)
        return { findings: acc.findings, skipped: [...acc.skipped, { rule: rule.id, why: reasonsFor(doc).noDetector(rule.how_to_find) }] };
      // 語彙表を要求する rule で、その言語に語彙表が無ければ動かせない。黙って通さない。
      const absent = missingList(rule, doc.lexicons);
      if (absent !== undefined)
        return { findings: acc.findings, skipped: [...acc.skipped, { rule: rule.id, why: reasonsFor(doc).noLexicon(doc.language, absent) }] };
      const options = {
        limit: limitFor(rule, level, genre, limits),
        lexicon: rule.word_list === undefined ? undefined : doc.lexicons[rule.word_list],
        where: rule.where,
        fullSentence: rule.full_sentence,
      };
      const found = detector(doc, options).map((finding) => place(starts, { ...finding, rule: rule.id, severity: rule.severity }));
      return { findings: [...acc.findings, ...found], skipped: acc.skipped };
    },
    { findings: [], skipped: [] },
  );
  const composites = applicable
    .filter((rule) => rule.from.length > 0 && levelFor(rule, settings, experimental, preset) !== "off")
    .flatMap((rule) =>
      compositeOf(rule, outcome.findings, limitFor(rule, levelFor(rule, settings, experimental, preset), genre, limits), starts, doc.language),
    );
  const all = [...outcome.findings, ...composites];
  return { ...outcome, findings: all.toSorted((left, right) => left.line - right.line), forcedExperimental: forced, presetExperimental: presetOn };
};
