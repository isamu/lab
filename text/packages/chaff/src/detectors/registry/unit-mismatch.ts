import type { Detector } from "../../plugin.ts";
import { unitMismatch } from "../unit-consistency.ts";

export const detector: Detector = unitMismatch;
