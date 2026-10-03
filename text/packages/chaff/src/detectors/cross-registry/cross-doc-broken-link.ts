import type { CrossDetector } from "../../plugin.ts";
import { crossDocBrokenLink } from "../cross-link.ts";

export const detector: CrossDetector = crossDocBrokenLink;
