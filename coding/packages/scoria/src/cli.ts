import { relative } from "node:path";
import { assay } from "./run.ts";
import { detectConfig, writeConfig, CONFIG_FILENAME, type ScoriaConfig } from "./config.ts";
import { renderExplain, renderReport } from "./render.ts";

interface Options {
  readonly command: "assay" | "init";
  readonly target: string;
  readonly json: boolean;
  readonly explain: string | undefined;
  readonly write: boolean;
}

const valueAfter = (argv: readonly string[], flag: string): string | undefined => {
  const at = argv.indexOf(flag);
  return at < 0 ? undefined : argv[at + 1];
};

const parse = (argv: readonly string[]): Options => {
  const explain = valueAfter(argv, "--explain");
  const positional = argv.filter((arg) => !arg.startsWith("--") && arg !== explain);
  const command = positional[0] === "init" ? "init" : "assay";
  const target = (command === "init" ? positional[1] : positional[0]) ?? ".";
  return { command, target, json: argv.includes("--json"), explain, write: !argv.includes("--no-write") };
};

const describe = (config: ScoriaConfig): string => `profile: ${config.profile} · stacks: ${config.stacks.join(", ")}`;

/** 対象が cwd の外なら絶対パスのほうが読みやすい。`../../..` が並ぶのを避ける。 */
const displayPath = (path: string): string => {
  const fromHere = relative(process.cwd(), path);
  return fromHere === "" || fromHere.startsWith("..") ? path : fromHere;
};

const runInit = async (target: string): Promise<void> => {
  const config = await detectConfig(target);
  const path = await writeConfig(target, config);
  process.stdout.write(`\n${displayPath(path)} を書きました\n  ${describe(config)}\n\n`);
  process.stdout.write("検出結果はここで凍結されます。依存が増えても勝手に追随しません。\n");
  process.stdout.write("測り方が run ごとに変わると、時系列の比較が成立しないためです。\n\n");
};

/**
 * 設定が無いまま測ると、依存が 1 つ増えただけでスコアが飛ぶ（spec §9.2）。
 * 最初の実行で検出結果を書き出して凍結する。CI では書かない。
 */
const freezeIfNeeded = async (target: string, frozen: boolean, write: boolean): Promise<string | undefined> => {
  if (frozen) return undefined;
  if (!write || process.env["CI"] === "true") return "設定がありません。検出したまま測っています（凍結されていません）";
  const config = await detectConfig(target);
  await writeConfig(target, config);
  return `${CONFIG_FILENAME} を作成しました（${describe(config)}）。commit してください`;
};

export const main = async (argv: readonly string[]): Promise<void> => {
  const options = parse(argv);
  if (options.command === "init") {
    await runInit(options.target);
    return;
  }
  const { report, loaded } = await assay(options.target);
  const notice = await freezeIfNeeded(options.target, loaded.frozen, options.write);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write(
    options.explain === undefined ? renderReport(report, { source: loaded.source, drift: loaded.drift, notice }) : renderExplain(report, options.explain),
  );
};
