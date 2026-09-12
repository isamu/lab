import { readFile } from "node:fs/promises";
import { loadAdapter } from "../adapter-load.ts";
import { applyByPath } from "../config/by-path.ts";
import { buildDocument } from "../document.ts";
import { guessLanguage } from "../detect.ts";
import { collectTargets } from "../files.ts";
import { loadRules } from "../rule-load.ts";
import { evaluate } from "../eval.ts";
import { renderEval } from "../render/eval.ts";
import { neededBy } from "../run.ts";
import type { Config } from "../config/load.ts";

export type Context = {
  readonly config: Config;
  readonly resolveGenre: (path: string, source: string, config: Config) => { genre: string; from: string };
  readonly flag: (argv: readonly string[], name: string) => string | undefined;
};

/**
 * 閾値の較正。手元の文書を「人間の良い文書」として扱い、どの閾値なら
 * 誤検知が目標を下回るかを測る。書き換えはしない。
 */
export const runEval = async (targets: readonly string[], argv: readonly string[], context: Context): Promise<number> => {
  const paths = collectTargets(targets.length > 0 ? targets : ["."]);
  if (paths.length === 0) {
    console.error(`Markdown が 1 つも見つかりませんでした: ${targets.join(", ")}`);
    return 1;
  }
  const { config, resolveGenre, flag } = context;
  const only = flag(argv, "--rule");
  const docs = await Promise.all(
    paths.map(async (path) => {
      const source = await readFile(path, "utf8");
      const language = applyByPath(config.byPath, config.baseDir, path).language ?? config.language ?? guessLanguage(source).language;
      const adapter = await loadAdapter(language);
      const { genre } = resolveGenre(path, source, config);
      await adapter.prepare?.(neededBy(loadRules(language), config.rules, config.experimental, genre, language));
      return { doc: buildDocument(path, source, adapter), language, genre };
    }),
  );
  const language = docs[0]?.language ?? "ja";
  const genre = docs[0]?.genre ?? "blog/tech";
  // 言語とジャンルが混ざった corpus は測れない。閾値の単位が違うため。
  const mixed = new Set(docs.map((entry) => `${entry.language}/${entry.genre}`));
  if (mixed.size > 1) {
    console.error(`言語かジャンルが混ざっています: ${[...mixed].join(", ")}\n1 つに絞って測ってください（例: npx chaff eval examples/blog-ja/）。`);
    return 1;
  }
  const rules = loadRules(language).filter((rule) => only === undefined || rule.id === only);
  if (rules.length === 0) {
    console.error(`${only ?? "(名前なし)"} という rule はありません。`);
    return 1;
  }
  console.log(
    renderEval(
      evaluate(
        docs.map((entry) => entry.doc),
        rules,
        genre,
        language,
      ),
      docs.length,
      paths.length,
    ),
  );
  return 0;
};
