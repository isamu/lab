import type { Detector } from "../../plugin.ts";
import { ngramRepetition } from "../signals.ts";

export const detector: Detector = ngramRepetition;
