import type { Detector, Token } from "../plugin.ts";
import { markedWordDetector } from "./marked-word.ts";

/** 言語アダプタが、さ入れ言葉の一部の語に付ける印（lang-ja の CausativeSa=Inserted）。 */
const isSaInserted = (token: Token): boolean => token.features?.["CausativeSa"] === "Inserted";

export const saIre: Detector = markedWordDetector(isSaInserted);
