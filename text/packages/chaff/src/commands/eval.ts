import { loadAdapter } from "../adapter-load.ts";
import { applyByPath } from "../config/by-path.ts";
import { buildDocument, teamRules } from "../document.ts";
import { guessLanguage } from "../detect.ts";
import { collectTargets, readDocumentFile } from "../files.ts";
import { rulesOf } from "../custom/load.ts";
import { evaluate } from "../eval.ts";
import { renderEval } from "../render/eval.ts";
import { neededBy, tokenFeaturesOf, wantsTags } from "../run.ts";
import type { AdapterNeeds, RuleDefinition } from "../plugin.ts";
import { optionLayersOf } from "../config/option-problems.ts";
import type { Config } from "../config/load.ts";
import { profileFor } from "../profile/for-file.ts";
import { CLI_TEXT } from "../cli-text.ts";
import { uiLanguageOf, type Texts, type UiLanguage } from "../ui.ts";

const TEXT: Texts<{
  readonly mixed: (mixes: string) => string;
  readonly unknownRule: (id: string) => string;
}> = {
  ja: {
    mixed: (mixes) => `言語かジャンルが混ざっています: ${mixes}\n1 つに絞って測ってください（例: npx chaff eval examples/blog-ja/）。`,
    unknownRule: (id) => `${id} という rule はありません。`,
  },
  en: {
    mixed: (mixes) => `Languages or genres are mixed: ${mixes}\nMeasure one at a time (for example npx chaff eval examples/blog-en/).`,
    unknownRule: (id) => `There is no rule named ${id}.`,
  },
};

/**
 * What the adapter must prepare. eval measures a rule whatever its level, so a rule named with --rule gets the tags and the
 * token features it reads even when lint would not run it; without --rule, the tags are what lint would prepare.
 */
const evalNeeds = (rules: readonly RuleDefinition[], only: string | undefined, config: Config, genre: string, language: string): AdapterNeeds => {
  const measured = rules.filter((rule) => only === undefined || rule.id === only);
  const lint = neededBy(rules, config.rules, config.experimental, genre, language);
  return { pos: lint.pos || (only !== undefined && measured.some(wantsTags)), features: tokenFeaturesOf(measured) };
};

export type Context = {
  readonly config: Config;
  readonly resolveGenre: (path: string, source: string, config: Config) => { genre: string; from: string };
  readonly flag: (argv: readonly string[], name: string) => string | undefined;
  /** The language of what is not about the documents measured: chaff.yaml's language, else the locale. */
  readonly ui: UiLanguage;
};

/**
 * 閾値の較正。手元の文書を「人間の良い文書」として扱い、どの閾値なら
 * 誤検知が目標を下回るかを測る。書き換えはしない。
 * 測った結果は文書の言語で出す（混ざっていれば測らないので、言語は 1 つ）。断りは ui の言語。
 */
export const runEval = async (targets: readonly string[], argv: readonly string[], context: Context): Promise<number> => {
  const paths = collectTargets(targets.length > 0 ? targets : ["."]);
  if (paths.length === 0) {
    console.error(CLI_TEXT[context.ui].noMarkdown(targets.join(", ")));
    return 1;
  }
  const { config, resolveGenre, flag, ui } = context;
  const only = flag(argv, "--rule");
  const docs = await Promise.all(
    paths.map(async (path) => {
      const source = await readDocumentFile(path);
      const language = applyByPath(config.byPath, config.baseDir, path).language ?? config.language ?? guessLanguage(source).language;
      const adapter = await loadAdapter(language);
      const { genre } = resolveGenre(path, source, config);
      await adapter.prepare?.(evalNeeds(rulesOf(language, config), only, config, genre, language));
      return { doc: buildDocument(path, source, adapter, teamRules(config), profileFor(config, path, source, language, genre)), language, genre };
    }),
  );
  const language = docs[0]?.language ?? "ja";
  const genre = docs[0]?.genre ?? "blog/tech";
  // 言語とジャンルが混ざった corpus は測れない。閾値の単位が違うため。
  const mixed = new Set(docs.map((entry) => `${entry.language}/${entry.genre}`));
  if (mixed.size > 1) {
    console.error(TEXT[ui].mixed([...mixed].join(", ")));
    return 1;
  }
  const rules = rulesOf(language, config).filter((rule) => only === undefined || rule.id === only);
  if (rules.length === 0) {
    console.error(TEXT[ui].unknownRule(only ?? CLI_TEXT[ui].unnamed));
    return 1;
  }
  console.log(
    renderEval(
      evaluate(
        docs.map((entry) => entry.doc),
        rules,
        genre,
        language,
        config.limits,
        optionLayersOf(config),
      ),
      docs.length,
      paths.length,
      uiLanguageOf(language),
    ),
  );
  return 0;
};
