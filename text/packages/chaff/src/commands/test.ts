import { plainSource } from "../plain-source.ts";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAdapter } from "../adapter-load.ts";
import { applyByPath } from "../config/by-path.ts";
import { buildDocument, teamRules } from "../document.ts";
import { guessLanguage } from "../detect.ts";
import { collectTargets } from "../files.ts";
import { loadRules } from "../rule-load.ts";
import { CHECKS_FILE, loadChecks, type UserCheck } from "../checks.ts";
import { CACHE_DIR, credentialHint, describeFailure, hasCredentials, type JudgeOptions } from "../judge.ts";
import { ENV_FILE, loadEnvFile } from "../env.ts";
import { planSemantic, runSemantic } from "../run-semantic.ts";
import { machineBanner, renderPlan, renderSemantic } from "../render/semantic.ts";
import type { Config } from "../config/load.ts";
import type { Finding, RuleDefinition } from "../plugin.ts";
import type { BackendName, Failure } from "../backends/types.ts";
import { profileFor } from "../profile/for-file.ts";
import { CLI_TEXT } from "../cli-text.ts";
import { sharedLanguage, type Texts, type UiLanguage } from "../ui.ts";

const TEXT: Texts<{
  readonly total: (total: number) => string;
  readonly sentTo: (backend: string, model: string, found: boolean) => string;
  readonly envRead: (path: string) => string;
  readonly envWhere: (found: string | undefined) => string;
  readonly notRun: (why: string, what: string, where: string) => readonly string[];
  readonly noCredentials: (backend: BackendName) => string;
  readonly refused: (backend: BackendName, status: string) => string;
  readonly checkKey: string;
  readonly quota: (backend: BackendName, status: string) => string;
  readonly returned: (backend: BackendName, status: string) => string;
  readonly noCause: string;
  readonly tally: (machine: number, ai: number) => string;
  readonly untouched: string;
}> = {
  ja: {
    total: (total) => `  合計 ${total} 箇所を送ります。--dry-run なので API は呼んでいません。`,
    sentTo: (backend, model, found) => `  送り先: ${backend} / ${model}（認証${found ? "あり" : "なし"}）`,
    envRead: (path) => `  ${path} を読みました。`,
    envWhere: (found) => (found === undefined ? `${ENV_FILE} に書いても読みます（いまは ${ENV_FILE} がありません）` : `${found} は読みました`),
    notRun: (why, what, where) => [`  意味を読む検査は動かしていません。${why}`, `  ${what}`, `  ${where}。`, "  機械による判定はすべて動いています。"],
    noCredentials: (backend) => `${backend} の認証情報がありません。`,
    refused: (backend, status) => `${backend} が鍵を受け付けませんでした（${status}）。`,
    checkKey: "鍵が正しいか、その provider のものかを確かめてください。",
    quota: (backend, status) => `${backend} の残高か上限に達しました（${status}）。`,
    returned: (backend, status) => `${backend} が ${status} を返しました。`,
    noCause: "原因は返ってきませんでした",
    tally: (machine, ai) => `  機械 ${machine} 件 / AI ${ai} 件`,
    untouched: "  文章は書き換えていません。直すのは書いた人です。",
  },
  en: {
    total: (total) => `  ${total} ${total === 1 ? "passage" : "passages"} in all would be sent. With --dry-run the API was not called.`,
    sentTo: (backend, model, found) => `  Sent to: ${backend} / ${model} (${found ? "credentials found" : "no credentials"})`,
    envRead: (path) => `  Read ${path}.`,
    envWhere: (found) => (found === undefined ? `A key written in ${ENV_FILE} is read too (there is no ${ENV_FILE} now)` : `${found} was read`),
    notRun: (why, what, where) => [`  The checks that read meaning did not run. ${why}`, `  ${what}`, `  ${where}.`, "  Every machine check ran."],
    noCredentials: (backend) => `There are no credentials for ${backend}.`,
    refused: (backend, status) => `${backend} did not accept the key (${status}).`,
    checkKey: "Check that the key is right and that it is for that provider.",
    quota: (backend, status) => `${backend} has run out of balance or hit a limit (${status}).`,
    returned: (backend, status) => `${backend} returned ${status}.`,
    noCause: "No reason was given.",
    tally: (machine, ai) => `  ${machine} by machine / ${ai} by AI`,
    untouched: "  The text was not changed. Fixing it is the writer's job.",
  },
};

const DIVIDER = "─".repeat(60);

export type TestContext = {
  readonly config: Config;
  readonly resolveGenre: (path: string, source: string, config: Config) => { genre: string; from: string };
  readonly inspect: (
    path: string,
    config: Config,
    argv: readonly string[],
  ) => Promise<{ text: string; language: string; outcome: { findings: readonly Finding[] } }>;
  /** The language of what is not about the documents: chaff.yaml's language, else the locale. */
  readonly ui: UiLanguage;
  /** The judges to call instead of the providers' own clients. Tests pass stand-ins; the command line never does. */
  readonly clients?: Pick<JudgeOptions, "anthropicClient" | "openaiClient">;
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
      const source = plainSource(await readFile(path, "utf8"));
      const language = applyByPath(config.byPath, config.baseDir, path).language ?? config.language ?? guessLanguage(source).language;
      const adapter = await loadAdapter(language);
      const doc = buildDocument(path, source, adapter, teamRules(config), profileFor(config, path, source, language));
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
  closing: { readonly envFile: string | undefined; readonly language: UiLanguage },
): Promise<void> => {
  const plans = await Promise.all(
    paths.map(async (path) => {
      const source = plainSource(await readFile(path, "utf8"));
      const language = applyByPath(config.byPath, config.baseDir, path).language ?? config.language ?? guessLanguage(source).language;
      const adapter = await loadAdapter(language);
      const doc = buildDocument(path, source, adapter, teamRules(config), profileFor(config, path, source, language));
      const { genre } = resolveGenre(path, source, config);
      return { path, jobs: planSemantic(doc, loadRules(language), checks, config.rules, genre), sentences: doc.sentences.length, language };
    }),
  );
  plans.forEach(({ path, jobs, sentences, language }) => console.log(renderPlan(path, jobs, sentences, language).join("\n")));
  const total = plans.reduce((sum, plan) => sum + plan.jobs.reduce((count, job) => count + job.candidates.length, 0), 0);
  const text = TEXT[closing.language];
  const from = closing.envFile === undefined ? [] : [text.envRead(closing.envFile)];
  console.log(["", DIVIDER, "", text.total(total), text.sentTo(config.aiBackend, config.aiModel, hasCredentials(config.aiBackend)), ...from, ""].join("\n"));
};

/**
 * API が返した失敗を人の言葉にする。生のスタックトレースを人に見せない。
 * 鍵はあるのに弾かれたときに「ありません」と言うと、設定済みの鍵をもう一度設定しに行かせる。
 * 残高切れも同じで、「鍵を確かめてください」と言われても鍵は正しい。
 */
const whyFailed = (failure: Failure, backend: BackendName, language: UiLanguage): { why: string; what: string } => {
  const text = TEXT[language];
  const status = String(failure.status ?? "?");
  if (failure.kind === "auth") return { why: text.refused(backend, status), what: text.checkKey };
  const what = failure.message ?? text.noCause;
  return failure.kind === "quota" ? { why: text.quota(backend, status), what } : { why: text.returned(backend, status), what };
};

/** Why the checks that read meaning did not run, and where a key would be read from. */
const notRunNotice = (why: string, what: string, envFile: string | undefined, language: UiLanguage): string =>
  ["", ...TEXT[language].notRun(why, what, TEXT[language].envWhere(envFile)), ""].join("\n");

/**
 * 機械と AI を見出しで分けて出す。読む人が「これは揺れる判定か」を知らないと、
 * AI の誤検知に振り回される。workflow spec §7、samples/README の軸 2。
 * 見出しと指摘は文書の言語、締めは文書がそろっていればその言語、混ざっていれば ui の言語。
 */
export const runTest = async (targets: readonly string[], argv: readonly string[], context: TestContext): Promise<number> => {
  const paths = collectTargets(targets.length > 0 ? targets : ["."]);
  if (paths.length === 0) {
    console.error(CLI_TEXT[context.ui].noMarkdown(targets.join(", ")));
    return 1;
  }
  const { config, resolveGenre, inspect } = context;
  // 鍵の置き場所で「設定したのに効かない」を起こさせない。シェルの環境変数のほうが勝つ。
  const envFile = loadEnvFile(process.cwd());
  const checks = loadChecks(join(process.cwd(), CHECKS_FILE));
  const results = await Promise.all(paths.map((path) => inspect(path, config, argv)));
  results.forEach((result) => {
    console.log(result.text.replace(/\n/u, `\n${machineBanner(result.language).join("\n")}`));
  });
  const closing = sharedLanguage(
    results.map((result) => result.language),
    context.ui,
  );
  const machineOnly = results.some((result) => result.outcome.findings.some((finding) => finding.severity === "error")) ? 1 : 0;
  if (argv.includes("--dry-run")) {
    await dryRun(paths, config, checks, resolveGenre, { envFile, language: closing });
    return machineOnly;
  }
  // 呼んでから落ちるのを待たない。認証が無いときの SDK の例外は型で判別できない。
  if (!hasCredentials(config.aiBackend)) {
    console.log(notRunNotice(TEXT[closing].noCredentials(config.aiBackend), credentialHint(config.aiBackend, closing), envFile, closing));
    return machineOnly;
  }
  const options = {
    model: config.aiModel,
    backend: config.aiBackend,
    cacheDir: join(process.cwd(), CACHE_DIR),
    confidenceThreshold: config.confidenceThreshold,
    ...context.clients,
  };
  const semantic = await judgeAll(paths, config, checks, options, resolveGenre).catch((error: unknown) => {
    // API が返した失敗だけを受け止める。ネットワーク断やコードの誤りは握りつぶさない。
    const failure = describeFailure(config.aiBackend, error);
    if (failure === undefined) throw error;
    const { why, what } = whyFailed(failure, config.aiBackend, closing);
    console.log(notRunNotice(why, what, envFile, closing));
    return undefined;
  });
  if (semantic === undefined) return machineOnly;
  semantic.forEach((entry) => {
    if (entry.outcome.findings.length === 0 && entry.outcome.asked === 0) return;
    console.log([`${entry.path}`, ...renderSemantic(entry.outcome, entry.rules, checks, entry.language)].join("\n"));
  });
  const machine = results.flatMap((result) => result.outcome.findings);
  const ai = semantic.flatMap((entry) => entry.outcome.findings);
  console.log(["", DIVIDER, "", TEXT[closing].tally(machine.length, ai.length), TEXT[closing].untouched, ""].join("\n"));
  return [...machine, ...ai].some((finding) => finding.severity === "error") ? 1 : 0;
};
