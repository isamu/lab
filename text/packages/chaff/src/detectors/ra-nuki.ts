import type { Detector, Token } from "../plugin.ts";
import { markedWordDetector } from "./marked-word.ts";

/** 言語アダプタが、ら抜き言葉の一部の語に付ける印（lang-ja の PotentialRa=Dropped）。 */
const isRaDropped = (token: Token): boolean => token.features?.["PotentialRa"] === "Dropped";

export const raNuki: Detector = markedWordDetector(isRaDropped);
