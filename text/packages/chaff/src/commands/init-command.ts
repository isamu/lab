import { runInit } from "../init.ts";
import type { UiLanguage } from "../ui.ts";
import { initGenre } from "./init-ask.ts";
import { runInitPlugin } from "./plugin-init.ts";

/** chaff init: chaff.yaml for a project, or with --plugin, a rule pack to start from. flag reads an option's value. */
export const runInitCommand = async (flag: (name: string) => string | undefined, plugin: boolean, ui: UiLanguage, dir: string): Promise<number> => {
  if (plugin) return runInitPlugin(dir, flag("--plugin"), ui);
  const chosen = await initGenre(flag("--genre"), ui, dir);
  if ("error" in chosen) console.error(chosen.error);
  else runInit(dir, chosen.genre, ui).forEach((line) => console.log(line));
  return "error" in chosen ? 1 : 0;
};
