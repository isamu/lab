import type { Detector } from "../../plugin.ts";
import { attachmentMissing } from "../email-letter.ts";

export const detector: Detector = attachmentMissing;
