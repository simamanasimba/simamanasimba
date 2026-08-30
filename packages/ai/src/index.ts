export * from "./types";
export { NoopAiProvider } from "./noop-provider";
export { AnthropicAiProvider } from "./anthropic-provider";

import type { AiProvider } from "./types";
import { NoopAiProvider } from "./noop-provider";
import { AnthropicAiProvider } from "./anthropic-provider";

export function createAiProvider(opts: { provider: "anthropic" | "openai" | "none"; apiKey?: string }): AiProvider {
  if (opts.provider === "anthropic" && opts.apiKey) {
    return new AnthropicAiProvider(opts.apiKey);
  }
  // OpenAI provider intentionally not implemented yet — falls through to Noop
  // rather than silently pretending to support a vendor with no adapter.
  return new NoopAiProvider();
}
