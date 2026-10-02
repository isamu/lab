import type { Detector } from "../../plugin.ts";
import { danglingFigure } from "../dangling-figure.ts";

export const detector: Detector = danglingFigure;
