import { relative } from "node:path";
import { assay } from "./run.ts";
import { detectConfig, writeConfig, CONFIG_FILENAME, type ScoriaConfig } from "./config.ts";
import { isLang, messagesFor, type Lang } from "./messages.ts";
import { renderExplain, renderReport } from "./render.ts";
import { applyFixes, diagnose, renderDoctor } from "./doctor.ts";

interface Options {
  readonly command: "assay" | "init" | "doctor";
  readonly target: string;
  readonly json: boolean;
  readonly explain: string | undefined;
  readonly write: boolean;
  readonly fix: boolean;
  readonly lang: Lang | undefined;
}

const valueAfter = (argv: readonly string[], flag: string): string | undefined => {
  const at = argv.indexOf(flag);
  return at < 0 ? undefined : argv[at + 1];
};

const parse = (argv: readonly string[]): Options => {
  const explain = valueAfter(argv, "--explain");
  const lang = valueAfter(argv, "--lang");
  const consumed = [explain, lang];
  const positional = argv.filter((arg) => !arg.startsWith("--") && !consumed.includes(arg));
  const first = positional[0];
  const command = first === "init" || first === "doctor" ? first : "assay";
  const target = (command === "assay" ? positional[0] : positional[1]) ?? ".";
  return {
    command,
    target,
    json: argv.includes("--json"),
    explain,
    write: !argv.includes("--no-write"),
    fix: argv.includes("--fix"),
    lang: isLang(lang) ? lang : undefined,
  };
};

const describe = (config: ScoriaConfig): string => `profile: ${config.profile} · stacks: ${config.stacks.join(", ")}`;

/** An absolute path reads better than a chain of `..` when the target is outside the cwd. */
const displayPath = (path: string): string => {
  const fromHere = relative(process.cwd(), path);
  return fromHere === "" || fromHere.startsWith("..") ? path : fromHere;
};

const runInit = async (target: string, lang: Lang): Promise<void> => {
  const messages = messagesFor(lang);
  const detected = await detectConfig(target);
  const config: ScoriaConfig = { ...detected, lang };
  const path = await writeConfig(target, config);
  const lines = ["", messages.wroteConfig(displayPath(path)), `  ${describe(config)}`, "", ...messages.frozenNote, ""];
  process.stdout.write(`${lines.join("\n")}\n`);
};

/**
 * Measuring without a config means one added dependency can move the score (spec §9.2).
 * The first run writes the detection out and freezes it. Nothing is written under CI.
 */
const freezeIfNeeded = async (target: string, frozen: boolean, write: boolean, lang: Lang): Promise<string | undefined> => {
  const messages = messagesFor(lang);
  if (frozen) return undefined;
  if (!write || process.env["CI"] === "true") return messages.notFrozen;
  const detected = await detectConfig(target);
  await writeConfig(target, { ...detected, lang });
  return messages.createdConfig(CONFIG_FILENAME, describe(detected));
};

export const main = async (argv: readonly string[]): Promise<void> => {
  const options = parse(argv);
  if (options.command === "init") {
    await runInit(options.target, options.lang ?? "en");
    return;
  }
  if (options.command === "doctor") {
    const diagnosis = await diagnose(options.target);
    const applied = options.fix ? await applyFixes(diagnosis) : [];
    process.stdout.write(renderDoctor(diagnosis, applied, options.lang ?? "en"));
    return;
  }
  const { report, loaded } = await assay(options.target);
  const lang = options.lang ?? loaded.config.lang;
  const notice = await freezeIfNeeded(options.target, loaded.frozen, options.write, lang);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write(
    options.explain === undefined
      ? renderReport(report, { source: loaded.source, drift: loaded.drift, notice, lang })
      : renderExplain(report, options.explain, lang),
  );
};
