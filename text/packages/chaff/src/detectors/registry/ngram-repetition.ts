import type { Detector } from "../../plugin.ts";
import { ngramRepetition } from "../gram-repetition.ts";

export const detector: Detector = ngramRepetition;
