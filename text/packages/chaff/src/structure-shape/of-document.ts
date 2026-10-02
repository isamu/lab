import type { ProseDocument } from "../plugin.ts";
import { STRUCTURE_BASELINE } from "./baseline-load.ts";
import { structureFeaturesOf } from "./features.ts";
import { structureScoreOf, type StructureScore } from "./score.ts";

/** A document's structure measures against the shipped human baseline of its language. */
export const structureOf = (doc: ProseDocument): StructureScore => structureScoreOf(structureFeaturesOf(doc), STRUCTURE_BASELINE[doc.language]);
