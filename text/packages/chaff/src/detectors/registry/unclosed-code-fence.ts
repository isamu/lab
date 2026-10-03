import type { Detector } from "../../plugin.ts";
import { unclosedCodeFence } from "../markdown-slip.ts";

export const detector: Detector = unclosedCodeFence;
