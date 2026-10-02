import type { Detector } from "../../plugin.ts";
import { danglingReference } from "../structure-tree.ts";

export const detector: Detector = danglingReference;
