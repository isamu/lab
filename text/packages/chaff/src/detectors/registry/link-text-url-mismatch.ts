import type { Detector } from "../../plugin.ts";
import { linkTextUrlMismatch } from "../link-shape.ts";

export const detector: Detector = linkTextUrlMismatch;
