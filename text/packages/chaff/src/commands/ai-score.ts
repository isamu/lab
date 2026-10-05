import { rulesOf } from "../custom/load.ts";
import { resolveGenre } from "../resolve-genre.ts";
import { aiScoreOfDocument, genreGroupOf } from "../ai-score/of-document.ts";
import { aiScoreJson, renderAiScoreCompact, renderAiScoreFriendly } from "../ai-score/render.ts";
import type { AiScore } from "../ai-score/score.ts";
import { AI_SCORE_TEXT } from "../ai-score/text.ts";
import { scoreViewOf } from "../ai-score/view.ts";
import type { LengthUnit } from "../plugin.ts";
import { documentFromSource } from "./read-document.ts";
import { readSource, treeLanguage, type TreeContext } from "./tree.ts";

/** Options whose value is the next argument. That value is not a file. */
const VALUED: ReadonlySet<string> = new Set(["--genre", "--format", "--language"]);

const FORMATS: ReadonlySet<string> = new Set(["text", "json"]);

export const aiScoreTargets = (argv: readonly string[]): string[] =>
  argv.slice(1).filter((arg, index, all) => !arg.startsWith("--") && !VALUED.has(all[index - 1] ?? ""));

type Scored = { readonly path: string; readonly language: string; readonly genre: string; readonly unit: LengthUnit; readonly score: AiScore };

/** One file read as lint reads it (part-of-speech tags on, as the human shares were measured), and scored. */
const scoreFile = async (path: string, argv: readonly string[], context: TreeContext): Promise<Scored | undefined> => {
  const source = await readSource(path, context);
  if (source === undefined) return undefined;
  const language = treeLanguage(path, source, argv, context);
  const genre = resolveGenre(path, source, context.config, context.flag(argv, "--genre")).genre;
  const { doc } = await documentFromSource(path, source, { language, genre }, context.config, true);
  return { path, language, genre, unit: doc.lengthUnit, score: aiScoreOfDocument(doc, rulesOf(language, context.config), genre) };
};

const scoreAll = async (paths: readonly string[], argv: readonly string[], context: TreeContext): Promise<Scored[] | undefined> =>
  paths.reduce<Promise<Scored[] | undefined>>(async (previous, path) => {
    const earlier = await previous;
    if (earlier === undefined) return undefined;
    const next = await scoreFile(path, argv, context);
    return next === undefined ? undefined : [...earlier, next];
  }, Promise.resolve([]));

const friendly = (scored: Scored, context: TreeContext): string[] =>
  renderAiScoreFriendly(
    scored.path,
    scored.score,
    scoreViewOf(scored.language, scored.unit, genreGroupOf(scored.genre), rulesOf(scored.language, context.config)),
  );

const render = (all: readonly Scored[], format: string, argv: readonly string[], context: TreeContext): string => {
  if (format === "json")
    return JSON.stringify(
      all.map((scored) => ({ path: scored.path, language: scored.language, genre: scored.genre, ...aiScoreJson(scored.score) })),
      null,
      2,
    );
  if (argv.includes("--compact")) return all.map((scored) => renderAiScoreCompact(scored.path, scored.score)).join("\n");
  return all.flatMap((scored, index) => [...(index > 0 ? [""] : []), ...friendly(scored, context)]).join("\n");
};

/**
 * The AI-likeness quick score of each file: how many signs of generated text it shows that human documents of its genre
 * rarely do, as low, medium or high. Measures; never judges who wrote it, so it ends with 0 once the files are read.
 */
export const runAiScore = async (targets: readonly string[], argv: readonly string[], context: TreeContext): Promise<number> => {
  const text = AI_SCORE_TEXT[context.ui ?? "ja"];
  const format = context.flag(argv, "--format") ?? (argv.includes("--json") ? "json" : "text");
  if (!FORMATS.has(format)) {
    console.error(text.unknownFormat(format));
    return 1;
  }
  if (targets.length === 0) {
    console.error(text.usage);
    return 1;
  }
  const all = await scoreAll(targets, argv, context);
  if (all === undefined) return 1;
  console.log(render(all, format, argv, context));
  return 0;
};
