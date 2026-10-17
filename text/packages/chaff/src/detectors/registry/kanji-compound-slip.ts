import type { Detector } from "../../plugin.ts";
import { kanjiCompoundSlip } from "../kanji-compound-slip.ts";

export const detector: Detector = kanjiCompoundSlip;
