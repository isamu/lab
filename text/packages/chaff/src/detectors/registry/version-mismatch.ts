import type { Detector } from "../../plugin.ts";
import { versionMismatch } from "../version-mismatch.ts";

export const detector: Detector = versionMismatch;
