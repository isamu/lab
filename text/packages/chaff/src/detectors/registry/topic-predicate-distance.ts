import type { Detector } from "../../plugin.ts";
import { topicPredicateDistance } from "../sentence-load.ts";

export const detector: Detector = topicPredicateDistance;
