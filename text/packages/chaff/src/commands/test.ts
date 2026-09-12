import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAdapter } from "../adapter-load.ts";
import { applyByPath } from "../config/by-path.ts";
import { buildDocument } from "../document.ts";
import { guessLanguage } from "../detect.ts";
import { collectTargets } from "../files.ts";
import { loadRules } from "../rule-load.ts";
import { CHECKS_FILE, loadChecks, type UserCheck } from "../checks.ts";
import { CACHE_DIR, credentialHint, hasCredentials, isAuthFailure } from "../judge.ts";
import { ENV_FILE, loadEnvFile } from "../env.ts";
import { planSemantic, runSemantic } from "../run-semantic.ts";
import { MACHINE_BANNER, renderPlan, renderSemantic } from "../render/semantic.ts";
import type { Config } from "../config/load.ts";
import type { Finding, RuleDefinition } from "../plugin.ts";

export type TestContext = {
  readonly config: Config;
  readonly resolveGenre: (path: string, source: string, config: Config) => { genre: string; from: string };
  readonly inspect: (path: string, config: Config, argv: readonly string[]) => Promise<{ text: string; outcome: { findings: readonly Finding[] } }>;
};

type Judged = { path: string; outcome: Awaited<ReturnType<typeof runSemantic>>; rules: RuleDefinition[]; language: string };

const judgeAll = async (
  paths: readonly string[],
  config: Config,
  checks: readonly UserCheck[],
  options: Parameters<typeof runSemantic>[5],
  resolveGenre: TestContext["resolveGenre"],
): Promise<Judged[]> =>
  Promise.all(
    paths.map(async (path) => {
      const source = await readFile(path, "utf8");
      const language = applyByPath(config.byPath, config.baseDir, path).language ?? config.language ?? guessLanguage(source).language;
      const adapter = await loadAdapter(language);
      const doc = buildDocument(path, source, adapter);
      const { genre } = resolveGenre(path, source, config);
      const rules = loadRules(language);
      return { path, outcome: await runSemantic(doc, rules, checks, config.rules, genre, options), rules, language };
    }),
  );

/** API を呼ばずに、何が送られるかだけを出す。鍵が無くても二段構えの 1 段目を確かめられる。 */
const dryRun = async (
  paths: readonly string[],
  config: Config,
  checks: readonly UserCheck[],
  resolveGenre: TestContext["resolveGenre"],
  envFile: string | undefined,
): Promise<void> => {
  const plans = await Promise.all(
    paths.map(async (path) => {
      const source = await readFile(path, "utf8");
      const language = applyByPath(config.byPath, config.baseDir, path).language ?? config.language ?? guessLanguage(source).language;
      const adapter = await loadAdapter(language);
      const doc = buildDocument(path, source, adapter);
      const { genre } = resolveGenre(path, source, config);
      return { path, jobs: planSemantic(doc, loadRules(language), checks, config.rules, genre), sentences: doc.sentences.length };
    }),
  );
  plans.forEach(({ path, jobs, sentences }) => console.log(renderPlan(path, jobs, sentences).join("\n")));
  const total = plans.reduce((sum, plan) => sum + plan.jobs.reduce((count, job) => count + job.candidates.length, 0), 0);
  const from = envFile === undefined ? "" : `  ${envFile} を読みました。`;
  const where = `${config.aiBackend} / ${config.aiModel}（認証${hasCredentials(config.aiBackend) ? "あり" : "なし"}）`;
  console.log(
    [
      "",
      "─".repeat(60),
      "",
      `  合計 ${total} 箇所を送ります。--dry-run なので API は呼んでいません。`,
      `  送り先: ${where}`,
      ...(from === "" ? [] : [from]),
      "",
    ].join("\n"),
  );
};

/**
 * 機械と AI を見出しで分けて出す。読む人が「これは揺れる判定か」を知らないと、
 * AI の誤検知に振り回される。workflow spec §7、samples/README の軸 2。
 */
export const runTest = async (targets: readonly string[], argv: readonly string[], context: TestContext): Promise<number> => {
  const paths = collectTargets(targets.length > 0 ? targets : ["."]);
  if (paths.length === 0) {
    console.error(`Markdown が 1 つも見つかりませんでした: ${targets.join(", ")}`);
    return 1;
  }
  const { config, resolveGenre, inspect } = context;
  // 鍵の置き場所で「設定したのに効かない」を起こさせない。シェルの環境変数のほうが勝つ。
  const envFile = loadEnvFile(process.cwd());
  const checks = loadChecks(join(process.cwd(), CHECKS_FILE));
  const results = await Promise.all(paths.map((path) => inspect(path, config, argv)));
  results.forEach((result) => {
    console.log(result.text.replace(/\n/u, `\n${MACHINE_BANNER.join("\n")}`));
  });
  const machineOnly = results.some((result) => result.outcome.findings.some((finding) => finding.severity === "error")) ? 1 : 0;
  const where = envFile === undefined ? `${ENV_FILE} に書いても読みます（いまは ${ENV_FILE} がありません）` : `${envFile} は読みました`;
  const notRun = (why: string, what: string): string =>
    ["", `  意味を読む検査は動かしていません。${why}`, `  ${what}`, `  ${where}。`, "  機械による判定はすべて動いています。", ""].join("\n");
  const noCredentials = notRun(`${config.aiBackend} の認証情報がありません。`, credentialHint(config.aiBackend));
  // 鍵はあるのに弾かれたときに「ありません」と言うと、設定済みの鍵をもう一度設定しに行かせる。
  const rejected = notRun(`${config.aiBackend} が鍵を受け付けませんでした（401）。`, "鍵が正しいか、その provider のものかを確かめてください。");
  if (argv.includes("--dry-run")) {
    await dryRun(paths, config, checks, resolveGenre, envFile);
    return machineOnly;
  }
  // 呼んでから落ちるのを待たない。認証が無いときの SDK の例外は型で判別できない。
  if (!hasCredentials(config.aiBackend)) {
    console.log(noCredentials);
    return machineOnly;
  }
  const options = {
    model: config.aiModel,
    backend: config.aiBackend,
    cacheDir: join(process.cwd(), CACHE_DIR),
    confidenceThreshold: config.confidenceThreshold,
  };
  const semantic = await judgeAll(paths, config, checks, options, resolveGenre).catch((error: unknown) => {
    if (!isAuthFailure(config.aiBackend, error)) throw error;
    console.log(rejected);
    return undefined;
  });
  if (semantic === undefined) return machineOnly;
  semantic.forEach((entry) => {
    if (entry.outcome.findings.length === 0 && entry.outcome.asked === 0) return;
    console.log([`${entry.path}`, ...renderSemantic(entry.outcome, entry.rules, checks, entry.language)].join("\n"));
  });
  const machine = results.flatMap((result) => result.outcome.findings);
  const ai = semantic.flatMap((entry) => entry.outcome.findings);
  console.log(
    ["", "─".repeat(60), "", `  機械 ${machine.length} 件 / AI ${ai.length} 件`, "  文章は書き換えていません。直すのは書いた人です。", ""].join("\n"),
  );
  return [...machine, ...ai].some((finding) => finding.severity === "error") ? 1 : 0;
};
