import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Texts, UiLanguage } from "../ui.ts";

/** The skill ships in the package, beside rules/. Two levels up from src/commands or dist/commands. */
export const SKILL_SOURCE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "skills", "chaff", "SKILL.md");

/** Where Claude Code reads a skill: this folder's .claude/skills, or the user's. */
export const skillTarget = (root: string): string => join(root, ".claude", "skills", "chaff", "SKILL.md");

export type SkillOutcome = { readonly status: "written" | "updated" | "same" | "kept"; readonly path: string };

/**
 * Writes the skill. A file that is already there and differs may have been edited by hand, so it is replaced
 * only with `force`; the same file is left alone.
 */
export const installSkill = (skill: string, target: string, force: boolean): SkillOutcome => {
  if (existsSync(target)) {
    const current = readFileSync(target, "utf8");
    if (current === skill) return { status: "same", path: target };
    if (!force) return { status: "kept", path: target };
    writeFileSync(target, skill, "utf8");
    return { status: "updated", path: target };
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, skill, "utf8");
  return { status: "written", path: target };
};

const TEXT: Texts<Readonly<Record<SkillOutcome["status"], (path: string) => string>>> = {
  ja: {
    written: (path) => `Claude Code の skill を書きました: ${path}\nClaude Code を開き直すと /chaff で使えます。`,
    updated: (path) => `skill を新しい版に置き換えました: ${path}`,
    same: (path) => `skill は既に最新です: ${path}`,
    kept: (path) => `${path} は手で直されているかもしれないので、置き換えていません。\n置き換えるときは --force を付けてください。`,
  },
  en: {
    written: (path) => `Wrote the Claude Code skill: ${path}\nReopen Claude Code and it is available as /chaff.`,
    updated: (path) => `Replaced the skill with the new version: ${path}`,
    same: (path) => `The skill is up to date: ${path}`,
    kept: (path) => `${path} may have been edited by hand, so it was not replaced.\nAdd --force to replace it.`,
  },
};

const FAILED: Texts<(path: string, why: string) => string> = {
  ja: (path, why) => `skill を ${path} に書けませんでした: ${why}`,
  en: (path, why) => `Could not write the skill to ${path}: ${why}`,
};

/** The outcome, or why the file system refused. */
const attempt = (install: () => SkillOutcome): SkillOutcome | { readonly failure: string } => {
  try {
    return install();
  } catch (err) {
    return { failure: err instanceof Error ? err.message : String(err) };
  }
};

export type SkillContext = { readonly cwd: string; readonly home: string; readonly ui: UiLanguage };

/** `chaff skill [--global] [--force]`: installs or updates the skill. Exit 1 when a differing file was kept. */
export const runSkill = (argv: readonly string[], context: SkillContext): number => {
  const target = skillTarget(argv.includes("--global") ? context.home : context.cwd);
  const outcome = attempt(() => installSkill(readFileSync(SKILL_SOURCE, "utf8"), target, argv.includes("--force")));
  if ("failure" in outcome) {
    console.error(FAILED[context.ui](target, outcome.failure));
    return 1;
  }
  const say = TEXT[context.ui][outcome.status](outcome.path);
  if (outcome.status === "kept") console.error(say);
  else console.log(say);
  return outcome.status === "kept" ? 1 : 0;
};
