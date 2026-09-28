import { applyByPath } from "../config/by-path.ts";
import type { Config } from "../config/load.ts";
import type { DocumentProfile } from "../plugin.ts";
import { loadProfiles } from "./load.ts";
import { chooseProfile } from "./select.ts";

type ProfileSettings = Pick<Config, "profile" | "byPath" | "baseDir">;

/** 1 ファイルの文書の種類。by_path、chaff.yaml、内容の順に選ぶ。 */
export const profileFor = (config: ProfileSettings, path: string, source: string, language: string): DocumentProfile | undefined =>
  chooseProfile(loadProfiles(), { byPath: applyByPath(config.byPath, config.baseDir, path).profile, config: config.profile, source, language })?.profile;
