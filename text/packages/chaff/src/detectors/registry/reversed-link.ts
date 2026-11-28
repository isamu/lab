import type { Detector } from "../../plugin.ts";
import { reversedLink } from "../reversed-link.ts";

export const detector: Detector = reversedLink;
