import { realpathSync } from "node:fs";
import { isAbsolute } from "node:path";
import { isInside } from "../custom/module-path.ts";

// The path check of custom/module-path.ts reads only the path as written, so a symbolic link inside the project can
// still point outside it. Before code is loaded, the same check runs on the real paths.

/** Whether a file written as a relative path is really inside baseDir once links are followed. An absolute path was written on purpose. */
export const staysInside = (written: string, file: string, baseDir: string): boolean =>
  isAbsolute(written) || isInside(realpathSync(baseDir), realpathSync(file));
