import type { Detector } from "../../plugin.ts";
import { fullwidthAlnum } from "../fullwidth-alnum.ts";

export const detector: Detector = fullwidthAlnum;
