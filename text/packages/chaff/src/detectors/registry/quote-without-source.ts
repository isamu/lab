import type { Detector } from "../../plugin.ts";
import { quoteWithoutSource } from "../quote-without-source.ts";

export const detector: Detector = quoteWithoutSource;
