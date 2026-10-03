import type { Detector } from "../../plugin.ts";
import { danglingOpener } from "../dangling-opener.ts";

export const detector: Detector = danglingOpener;
