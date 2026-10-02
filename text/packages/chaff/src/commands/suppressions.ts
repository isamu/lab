import { collectTargets } from "../files.ts";
import { renderSuppressions, type PerFile } from "../render/suppressions.ts";
import type { UiLanguage } from "../ui.ts";

/** `chaff suppressions`: what the stets in these files (this folder by default) silence, and the stets whose rule did not run. */
export const runSuppressions = async (
  targets: readonly string[],
  inspectRun: (paths: readonly string[]) => Promise<readonly { readonly perFile: PerFile }[]>,
  ui: UiLanguage,
): Promise<number> => {
  const inspected = await inspectRun(collectTargets(targets.length > 0 ? targets : ["."]));
  console.log(
    renderSuppressions(
      inspected.map((file) => file.perFile),
      ui,
    ),
  );
  return 0;
};
