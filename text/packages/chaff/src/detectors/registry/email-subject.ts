import type { Detector } from "../../plugin.ts";
import { emailSubject } from "../email-letter.ts";

export const detector: Detector = emailSubject;
