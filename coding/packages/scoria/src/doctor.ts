import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { collectConfigFiles } from "./config-files.ts";
import { configGaps, type Gap } from "./probes/config-integrity.ts";
import { ciGaps } from "./probes/ci-integrity.ts";
import { isTypeScriptProject } from "./stacks/ts.ts";
import { readPackageJson } from "./package-json.ts";
import { messagesFor, type Lang } from "./messages.ts";

/**
 * Reports the gaps in a project's own gates, and repairs the unambiguous ones.
 *
 * The line for `--fix` is narrow on purpose. Appending `node_modules/` to .gitignore has exactly
 * one correct outcome; choosing a lint configuration for someone does not. Anything that requires
 * a judgement is reported with the reason and left alone — installing the toolchain is what
 * ever-better is for.
 */

const TYPECHECK_COMMAND = "tsc --noEmit";

export interface Diagnosis {
  readonly gaps: readonly Gap[];
  readonly root: string;
}

export const diagnose = async (target: string): Promise<Diagnosis> => {
  const root = resolve(target);
  const configFiles = await collectConfigFiles(root);
  const typescript = isTypeScriptProject(await readPackageJson(root));
  return { root, gaps: [...configGaps(configFiles, typescript), ...ciGaps(configFiles, typescript)] };
};

const appendGitignore = async (root: string): Promise<string> => {
  const path = join(root, ".gitignore");
  const existing = await readFile(path, "utf8").catch(() => "");
  const separator = existing === "" || existing.endsWith("\n") ? "" : "\n";
  await writeFile(path, `${existing}${separator}node_modules/\n`, "utf8");
  return ".gitignore: added node_modules/";
};

const addTypecheckScript = async (root: string): Promise<string | undefined> => {
  const path = join(root, "package.json");
  const text = await readFile(path, "utf8").catch(() => undefined);
  if (text === undefined || text.includes('"typecheck"')) return undefined;
  const updated = text.replace(/"scripts"\s*:\s*\{/, `"scripts": {\n    "typecheck": "${TYPECHECK_COMMAND}",`);
  if (updated === text) return undefined;
  await writeFile(path, updated, "utf8");
  return `package.json: added "typecheck": "${TYPECHECK_COMMAND}"`;
};

type Fix = (root: string) => Promise<string | undefined>;

const FIXES: Readonly<Record<string, Fix>> = {
  "gitignore-node-modules": appendGitignore,
  "script-typecheck": addTypecheckScript,
};

const fixesFor = (gaps: readonly Gap[]): readonly Fix[] =>
  gaps
    .filter((gap) => gap.fixable)
    .flatMap((gap) => {
      const fix = FIXES[gap.id];
      return fix === undefined ? [] : [fix];
    });

export const applyFixes = async (diagnosis: Diagnosis): Promise<readonly string[]> => {
  const applied = await Promise.all(fixesFor(diagnosis.gaps).map((fix) => fix(diagnosis.root)));
  return applied.filter((line): line is string => line !== undefined);
};

const gapBlock = (gap: Gap): readonly string[] => [
  `  ${gap.severity === "error" ? "×" : "!"} ${gap.title}`,
  `      ${gap.detail}`,
  ...(gap.fixable ? ["      fixable with --fix"] : []),
  "",
];

export const renderDoctor = (diagnosis: Diagnosis, applied: readonly string[], lang: Lang): string => {
  const messages = messagesFor(lang);
  if (diagnosis.gaps.length === 0) return `\n${diagnosis.root}\n\n  ${messages.doctorClean}\n\n`;
  const fixableLeft = diagnosis.gaps.filter((gap) => gap.fixable).length - applied.length;
  return [
    "",
    diagnosis.root,
    "",
    messages.doctorFound(diagnosis.gaps.length),
    "",
    ...diagnosis.gaps.flatMap(gapBlock),
    ...(applied.length > 0 ? [messages.doctorApplied, ...applied.map((line) => `  ${line}`), ""] : []),
    ...(fixableLeft > 0 ? [messages.doctorFixHint(fixableLeft), ""] : []),
    messages.doctorScopeNote,
    "",
  ].join("\n");
};
