import type { Detector } from "../../plugin.ts";
import { unlistedItemUsed } from "../unlisted-items.ts";

export const detector: Detector = unlistedItemUsed;
