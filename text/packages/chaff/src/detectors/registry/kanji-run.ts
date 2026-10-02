import type { Detector } from "../../plugin.ts";
import { kanjiRun } from "../char-shape.ts";

export const detector: Detector = kanjiRun;
