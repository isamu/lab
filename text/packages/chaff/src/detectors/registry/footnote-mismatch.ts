import type { Detector } from "../../plugin.ts";
import { footnoteMismatch } from "../footnote-mismatch.ts";

export const detector: Detector = footnoteMismatch;
