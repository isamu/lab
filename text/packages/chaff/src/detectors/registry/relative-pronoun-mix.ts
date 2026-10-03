import type { Detector } from "../../plugin.ts";
import { relativePronounMix } from "../relative-pronoun-mix.ts";

export const detector: Detector = relativePronounMix;
