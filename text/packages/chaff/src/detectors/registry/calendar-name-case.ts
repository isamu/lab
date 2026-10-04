import type { Detector } from "../../plugin.ts";
import { lowercaseName } from "../lowercase-name.ts";

export const detector: Detector = lowercaseName;
