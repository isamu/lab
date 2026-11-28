import { quotedSpans } from "../quoted-span.ts";
import type { Span } from "../plugin.ts";

// A name the document quotes once (「maDMPsのための共通データモデル」) and then writes without the brackets: still the same
// name, so its particles are read as one noun wherever it stands. Pure: the particles a name must hold come in.

/** Whether name holds one of particles inside it. One that ends in the particle (「実際の」) quotes words, not a name. */
const holdsParticle = (name: string, particles: readonly string[]): boolean =>
  particles.some((particle) => particle !== "" && name.includes(particle) && !name.endsWith(particle));

/** The names quoted in 「」『』 anywhere in source that hold one of particles inside them, each once. */
export const quotedNames = (source: string, particles: readonly string[]): string[] => [
  ...new Set(
    quotedSpans(source)
      .map((span) => source.slice(span.start, span.end))
      .filter((name) => holdsParticle(name, particles)),
  ),
];

const placesOf = (text: string, name: string, from = 0): number[] => {
  const at = text.indexOf(name, from);
  return at === -1 ? [] : [at, ...placesOf(text, name, at + name.length)];
};

/** Where names stand in text (starting at offset in the document), with or without brackets. */
export const quotedNameSpans = (text: string, offset: number, names: readonly string[]): Span[] =>
  names.flatMap((name) => placesOf(text, name).map((at) => ({ start: offset + at, end: offset + at + name.length })));
