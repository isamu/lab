import type { Detector } from "../../plugin.ts";
import { katakanaLongVowel } from "../long-vowel.ts";

export const detector: Detector = katakanaLongVowel;
