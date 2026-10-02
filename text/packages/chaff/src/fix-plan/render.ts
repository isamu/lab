import type { RewritePair } from "../rule-guide.ts";
import { shapeMeasures } from "../outline/render.ts";
import { OUTLINE_TEXT } from "../outline/text.ts";
import { uiLanguageOf } from "../ui.ts";
import type { FixPlan, PhraseHint, PlanSpot, RulePlan } from "./plan.ts";
import { FIX_PLAN_TEXT, type FixPlanText } from "./text.ts";
import { STRUCTURE_TARGET_TEXT } from "./structure-target-text.ts";

/** A phrase quoted the way the document's language quotes: 「…」 in Japanese, "…" otherwise. */
const quoted = (text: string, language: string): string => (language === "ja" ? `「${text}」` : `"${text}"`);

const bullets = (items: readonly string[]): string[] => items.map((item) => `- ${item}`);

/** Each line of a passage as a Markdown quotation, so a list inside it stays a list and does not join the plan's own. */
const blockquote = (passage: string): string[] =>
  passage
    .trimEnd()
    .split("\n")
    .map((line) => (line === "" ? ">" : `> ${line}`));

const labelled = (label: string, lines: readonly string[]): string[] => (lines.length === 0 ? [] : ["", `**${label}**`, "", ...lines]);

const pairLines = (pair: RewritePair | undefined, text: FixPlanText): string[] =>
  pair === undefined ? [] : [`${text.before}:`, "", ...blockquote(pair.before), "", `${text.after}:`, "", ...blockquote(pair.after)];

const hintLine = (hint: PhraseHint, language: string): string => `- ${quoted(hint.phrase, language)} → ${hint.rewrite}`;

const spotLines = (spot: PlanSpot, text: FixPlanText, language: string): string[] => [
  `- ${text.at(spot.line)}: ${quoted(spot.quote, language)}`,
  `  ${spot.message}`,
];

const rulePlanLines = (rule: RulePlan, text: FixPlanText, language: string): string[] => [
  "",
  `### \`${rule.rule}\` ${rule.name}`,
  "",
  `**${text.direction}**: ${rule.direction}`,
  ...labelled(text.keep, bullets(rule.keep)),
  ...labelled(text.avoid, bullets(rule.avoid)),
  ...labelled(text.example, pairLines(rule.pair, text)),
  ...labelled(
    text.phrases,
    rule.hints.map((hint) => hintLine(hint, language)),
  ),
  ...labelled(
    text.spots,
    rule.spots.flatMap((spot) => spotLines(spot, text, language)),
  ),
];

const modeLines = (plan: FixPlan, text: FixPlanText): string[] => [
  "",
  `## ${text.modeHeading}: ${text.modeName[plan.mode.mode]}`,
  "",
  text.modeReason[plan.mode.reason],
  "",
  ...bullets(text.modeWays),
];

const signalLines = (plan: FixPlan, text: FixPlanText): string[] => {
  const outline = text.outlineLine(shapeMeasures(plan.outline.shape, plan.outline.unit, OUTLINE_TEXT[uiLanguageOf(plan.language)]));
  const said = plan.signals.length === 0 ? [text.noSignals, ""] : [];
  return ["", `## ${text.signalsHeading}`, "", ...said, ...bullets([...plan.signals.map((signal) => `\`${signal.rule}\`: ${signal.message}`), outline])];
};

/** The structure score and, for each measure past the human limit, the target from the baseline; then when to stop. */
const structureLines = (plan: FixPlan): string[] => {
  const text = STRUCTURE_TARGET_TEXT[uiLanguageOf(plan.language)];
  const targets = plan.targets.map((target) => text.target[target.id](target));
  const stop = targets.length === 0 ? [] : ["", text.stop(plan.structure.limit)];
  return [
    "",
    `## ${text.heading}`,
    "",
    text.score(plan.structure.score, plan.structure.limit, plan.structure.compared),
    "",
    ...(targets.length === 0 ? [text.noTargets] : bullets(targets)),
    ...stop,
  ];
};

const notRunLines = (plan: FixPlan, text: FixPlanText): string[] => {
  const note = plan.experimental ? [] : [text.notExperimental];
  const listed = plan.notRun;
  if (note.length === 0 && listed.length === 0) return [];
  return [
    "",
    `## ${text.notRunHeading}`,
    "",
    ...note,
    ...(note.length > 0 && listed.length > 0 ? [""] : []),
    ...bullets(listed.map((skipped) => `\`${skipped.rule}\`: ${skipped.why}`)),
  ];
};

const checkLines = (plan: FixPlan, text: FixPlanText): string[] => [
  "",
  `## ${text.checksHeading}`,
  "",
  text.saveAs(plan.rewrittenPath),
  "",
  "```bash",
  ...plan.checks,
  "```",
  "",
  text.checksNote,
];

const textOf = (plan: FixPlan): FixPlanText => FIX_PLAN_TEXT[uiLanguageOf(plan.language)];

/** The plan as Markdown, in the document's language: what an agent reads before rewriting. */
export const renderFixPlanMarkdown = (plan: FixPlan): string => {
  const text = textOf(plan);
  return [
    `# ${text.title(plan.path)}`,
    "",
    text.about(plan.language, plan.genre),
    "",
    text.intro,
    "",
    `## ${text.constraintsHeading}`,
    "",
    ...text.constraints.map((constraint, index) => `${String(index + 1)}. ${constraint}`),
    ...modeLines(plan, text),
    ...signalLines(plan, text),
    ...structureLines(plan),
    ...(plan.rules.length === 0 ? [] : ["", `## ${text.rulesHeading}`]),
    ...plan.rules.flatMap((rule) => rulePlanLines(rule, text, plan.language)),
    ...notRunLines(plan, text),
    ...checkLines(plan, text),
  ].join("\n");
};

/** The same plan as JSON, with the constraints and the mode's reason in the document's language. */
export const renderFixPlanJson = (plan: FixPlan): string => {
  const text = textOf(plan);
  return JSON.stringify(
    {
      ...plan,
      constraints: text.constraints,
      mode: { ...plan.mode, name: text.modeName[plan.mode.mode], why: text.modeReason[plan.mode.reason] },
    },
    null,
    2,
  );
};
