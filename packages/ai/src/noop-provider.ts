import type { AiProvider, RelevanceResult, SentimentResult, SummaryResult, TopicResult } from "./types";

/**
 * Used when no AI_API_KEY is configured. Deliberately returns UNKNOWN/low
 * confidence rather than a guessed label — the platform must never present
 * fabricated AI inference as fact (spec section 46).
 */
export class NoopAiProvider implements AiProvider {
  readonly name = "none";

  isConfigured(): boolean {
    return false;
  }

  async analyzeSentiment(): Promise<SentimentResult> {
    return { label: "UNKNOWN", confidence: 0, model: this.name };
  }

  async classifyTopic(): Promise<TopicResult> {
    return { topic: "Other", confidence: 0, model: this.name };
  }

  async classifyRelevance(): Promise<RelevanceResult> {
    return { relevant: false, confidence: 0, reason: "No AI provider configured", model: this.name };
  }

  async summarize(text: string): Promise<SummaryResult> {
    return { summary: text.slice(0, 200), model: this.name };
  }
}
