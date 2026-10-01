import { existsSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_FILE, EMPTY, loadConfig, type Config } from "./load.ts";
import { withStyle } from "./style.ts";
import { loadStyles } from "../style-load.ts";

/** The chaff.yaml in dir with its style applied, or the defaults when there is none. */
export const readConfigIn = (dir: string): Config => (existsSync(join(dir, CONFIG_FILE)) ? withStyle(loadConfig(join(dir, CONFIG_FILE)), loadStyles()) : EMPTY);
