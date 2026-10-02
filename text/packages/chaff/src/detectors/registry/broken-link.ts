import type { Detector } from "../../plugin.ts";
import { brokenLink } from "../broken-link.ts";

export const detector: Detector = brokenLink;
