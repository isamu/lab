import type { Detector } from "../../plugin.ts";
import { unbalancedBracket } from "../unbalanced-bracket.ts";

export const detector: Detector = unbalancedBracket;
