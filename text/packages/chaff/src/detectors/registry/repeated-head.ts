import type { Detector } from "../../plugin.ts";
import { repeatedHead } from "../repeated-head.ts";

export const detector: Detector = repeatedHead;
