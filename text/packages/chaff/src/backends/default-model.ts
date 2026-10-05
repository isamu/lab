import type { BackendName } from "./types.ts";

// Apart from the backends, so reading settings does not load the providers' SDKs.

const ANTHROPIC_DEFAULT_MODEL = "claude-opus-5";

const OPENAI_DEFAULT_MODEL = "gpt-5";

export const defaultModel = (backend: BackendName): string => (backend === "openai" ? OPENAI_DEFAULT_MODEL : ANTHROPIC_DEFAULT_MODEL);
