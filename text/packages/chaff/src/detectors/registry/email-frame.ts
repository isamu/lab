import type { Detector } from "../../plugin.ts";
import { emailFrame } from "../email-letter.ts";

export const detector: Detector = emailFrame;
