import type { Detector } from "../../plugin.ts";
import { clauseChain } from "../sentence-load.ts";

export const detector: Detector = clauseChain;
