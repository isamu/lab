import type { Token } from "./plugin.ts";
import { touches } from "./bound-word-particles.ts";

// The の after a word that only says when (現在の状態, the current state), when the noun it joins ends the chain: the time word and
// its noun read as one name for that noun, so the の does not nest the chain deeper. A time word earlier in the chain
// (今後の種の保存法の在り方の検討) attaches far ahead and is still counted. Pure.

const NOMINAL = new Set(["NOUN", "PROPN"]);

/** Whether the noun after tokens[at] (several words for a compound: 組合員数) is followed by anything but a counted particle. */
const endsChainAfter = (tokens: readonly Token[], at: number, particles: readonly string[]): boolean => {
  const rest = tokens.slice(at + 1);
  if (!NOMINAL.has(rest[0]?.pos ?? "")) return false;
  const after = rest.find((token) => !NOMINAL.has(token.pos));
  return !particles.includes(after?.surface ?? "");
};

/** The counted particles (particles) written straight after a time word (words: 現在) whose next noun ends the chain. */
export const timeWordParticles = (tokens: readonly Token[], particles: readonly string[], words: readonly string[]): ReadonlySet<Token> =>
  new Set(
    tokens.filter(
      (token, at) =>
        particles.includes(token.surface) &&
        touches(tokens[at - 1], token) &&
        words.includes(tokens[at - 1]?.surface ?? "") &&
        endsChainAfter(tokens, at, particles),
    ),
  );
