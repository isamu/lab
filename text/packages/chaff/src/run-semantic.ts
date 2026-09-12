import { severityOf, type UserCheck } from "./checks.ts";
import { ask, type JudgeOptions } from "./judge.ts";
import { FILTERS, type Candidate } from "./semantic.ts";
import { narrow, type Narrowing } from "./look-at.ts";
import { localized } from "./render/text.ts";
import type { Finding, Level, ProseDocument, RuleDefinition, Severity } from "./plugin.ts";
import { lineStarts, placeOf } from "./position.ts";

export type SemanticResult = {
  readonly findings: readonly Finding[];
  readonly skipped: readonly { rule: string; why: string }[];
  readonly asked: number;
  readonly sentencesSeen: number;
  /** 利用者の検査が、どこまで絞り込めたか。絞り込めていないものを黙って通さない。 */
  readonly narrowed: readonly { readonly name: string; readonly narrowing: Narrowing }[];
};

export type Job = {
  readonly rule: string;
  readonly name: string;
  readonly rubric: string;
  readonly howToFix: string;
  readonly severity: Severity;
  readonly candidates: readonly Candidate[];
  readonly narrowing?: Narrowing;
};

/**
 * 知らない絞り込みを文書全体に落とさない。spec §14 は「絞り込みを持たない L4 rule は
 * 登録できない」と決めている。落とすと、**書いていない範囲が黙って LLM に送られる**。
 */
const filterFor = (name: string | undefined): (typeof FILTERS)[string] | undefined => FILTERS[name ?? "whole-document"];

const SEVERITY_BY_VALUE: readonly Severity[] = ["info", "info", "warning", "error"];

const severityFromLevel = (rule: RuleDefinition, level: Level): Severity => {
  if (level === "off") return "info";
  const value = rule.levels[level] ?? rule.levels.normal ?? 2;
  return SEVERITY_BY_VALUE[Math.min(3, Math.max(1, Math.round(value)))] ?? "warning";
};

const builtInJobs = (doc: ProseDocument, rules: readonly RuleDefinition[], settings: Readonly<Record<string, Level>>, genre: string): Job[] =>
  rules
    .filter((rule) => rule.layer === "L4" && rule.use_for.some((target) => genre.startsWith(target)) && settings[rule.id] !== "off")
    .flatMap((rule) => {
      const rubric = rule.what_to_check === undefined ? undefined : localized(rule.what_to_check, doc.language);
      if (rubric === undefined || rubric.length === 0) return [];
      // 絞り込みが無い rule は動かさない。黙って落とさず、下の skipped に出す。
      const filter = filterFor(rule.how_to_find);
      if (filter === undefined) return [];
      return [
        {
          rule: rule.id,
          name: localized(rule.name, doc.language),
          rubric,
          howToFix: localized(rule.how_to_fix, doc.language),
          severity: severityFromLevel(rule, settings[rule.id] ?? "normal"),
          candidates: filter(doc),
        },
      ];
    });

const userJobs = (doc: ProseDocument, checks: readonly UserCheck[], genre: string): Job[] =>
  checks
    .filter((check) => check.level !== "off" && check.use_for.some((target) => genre.startsWith(target)))
    .map((check) => {
      // look_at の括弧の中を取り出して絞り込む。取り出せなければ文書全体。spec §14。
      const { candidates, narrowing } = narrow(doc, check.look_at, FILTERS["whole-document"] ?? (() => []));
      return {
        rule: check.id,
        name: check.name,
        rubric: check.look_at === undefined ? check.check : `${check.check}\n\n見るところ: ${check.look_at}`,
        howToFix: check.how_to_fix,
        severity: severityOf(check.level),
        candidates,
        narrowing,
      };
    });

const findingOf = (job: Job, candidate: Candidate, reason: string, confidence: number, threshold: number, starts: readonly number[]): Finding => {
  const at = placeOf(starts, candidate.offset);
  // 確からしさが低いものは指摘として出すが、重さを下げる。spec §14。
  const severity = confidence < threshold ? "info" : job.severity;
  return {
    rule: job.rule,
    severity,
    line: at.line,
    column: at.column,
    quote: candidate.text.slice(0, 200),
    values: { reason, confidence: confidence.toFixed(2), offset: candidate.offset },
  };
};

export type SemanticOptions = JudgeOptions & { readonly confidenceThreshold: number };

/**
 * 何を問い合わせるかを決めるところまで。API を呼ばない。
 * 鍵が無くても「何が送られるのか」を確かめられるようにするため、run から切り出してある。
 */
export const planSemantic = (
  doc: ProseDocument,
  rules: readonly RuleDefinition[],
  checks: readonly UserCheck[],
  settings: Readonly<Record<string, Level>>,
  genre: string,
): Job[] => [...builtInJobs(doc, rules, settings, genre), ...userJobs(doc, checks, genre)];

export const runSemantic = async (
  doc: ProseDocument,
  rules: readonly RuleDefinition[],
  checks: readonly UserCheck[],
  settings: Readonly<Record<string, Level>>,
  genre: string,
  options: SemanticOptions,
): Promise<SemanticResult> => {
  const jobs = planSemantic(doc, rules, checks, settings, genre);
  const starts = lineStarts(doc.source);
  const unfiltered = rules
    .filter((rule) => rule.layer === "L4" && rule.use_for.some((target) => genre.startsWith(target)) && filterFor(rule.how_to_find) === undefined)
    .map((rule) => ({ rule: rule.id, why: `絞り込み ${rule.how_to_find} が無いため（文書全体は送りません）` }));
  const skipped = [...jobs.filter((job) => job.candidates.length === 0).map((job) => ({ rule: job.rule, why: "見るところが無かったため" })), ...unfiltered];
  const live = jobs.filter((job) => job.candidates.length > 0);
  const answers = await Promise.all(
    live.flatMap((job) =>
      job.candidates.map(async (candidate) => {
        const verdict = await ask({ rule: job.rule, rubric: job.rubric, candidate: candidate.text, language: doc.language }, options);
        return verdict.violated ? findingOf(job, candidate, verdict.reason, verdict.confidence, options.confidenceThreshold, starts) : undefined;
      }),
    ),
  );
  return {
    findings: answers.filter((finding) => finding !== undefined).sort((left, right) => left.line - right.line),
    skipped,
    asked: live.reduce((sum, job) => sum + job.candidates.length, 0),
    sentencesSeen: doc.sentences.length,
    narrowed: jobs.flatMap((job) => (job.narrowing === undefined ? [] : [{ name: job.name, narrowing: job.narrowing }])),
  };
};
