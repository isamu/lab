import type { Detector } from "../../plugin.ts";
import { modalConflict } from "../modal-conflict.ts";

export const detector: Detector = modalConflict;
