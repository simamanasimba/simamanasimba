import { Injectable } from "@nestjs/common";
import { createAiProvider, type AiProvider } from "@event-intel/ai";

@Injectable()
export class AiProviderService {
  readonly provider: AiProvider;

  constructor() {
    this.provider = createAiProvider({
      provider: (process.env.AI_PROVIDER as "anthropic" | "openai" | "none") ?? "none",
      apiKey: process.env.AI_API_KEY,
    });
  }
}
