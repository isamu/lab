import { existsSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_FILE, EMPTY, configOf, type Config } from "./load.ts";
import { withStyle } from "./style.ts";
import { readYamlFile } from "./yaml-file.ts";
import { loadStyles } from "../style-load.ts";

/** 設定ファイルが無くても動く。あっても、既定から変えたものだけが書かれている。spec §18。 */
export const loadConfig = (path: string): Config => configOf(readYamlFile(path), path);

/** The chaff.yaml in dir with its style applied, or the defaults when there is none. */
export const readConfigIn = (dir: string): Config => (existsSync(join(dir, CONFIG_FILE)) ? withStyle(loadConfig(join(dir, CONFIG_FILE)), loadStyles()) : EMPTY);
