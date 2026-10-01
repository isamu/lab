import { collectTargets } from "../files.ts";
import { renderSuppressions, type PerFile } from "../render/suppressions.ts";
import type { UiLanguage } from "../ui.ts";

/** `chaff suppressions`: what the stets in these files (this folder by default) silence, and the stets whose rule did not run. */
export const runSuppressions = async (
  targets: readonly string[],
  inspect: (path: string) => Promise<{ readonly perFile: PerFile }>,
  ui: UiLanguage,
): Promise<number> => {
  const inspected = await Promise.all(collectTargets(targets.length > 0 ? targets : ["."]).map(inspect));
  console.log(
    renderSuppressions(
      inspected.map((file) => file.perFile),
      ui,
    ),
  );
  return 0;
};
