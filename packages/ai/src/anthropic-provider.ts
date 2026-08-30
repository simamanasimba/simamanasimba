import type { AiProvider, RelevanceResult, SentimentLabel, SentimentResult, SummaryResult, TopicResult } from "./types";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

interface JsonToolResponse {
  [key: string]: unknown;
}

/**
 * Calls the Anthropic Messages API directly over fetch (no SDK dependency,
 * keeping the platform vendor-neutral at the abstraction layer). Every prompt
 * asks for strict JSON so results are parsed deterministically.
 */
export class AnthropicAiProvider implements AiProvider {
  readonly name = "anthropic";

  constructor(private readonly apiKey: string) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private async complete(system: string, user: string): Promise<JsonToolResponse> {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic API error (${res.status}): ${body}`);
    }
    const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
    const text = data.content.find((c) => c.type === "text")?.text ?? "{}";
    const match = text.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : text) as JsonToolResponse;
  }

  async analyzeSentiment(text: string): Promise<SentimentResult> {
    const result = await this.complete(
      "You classify sentiment. Respond with strict JSON only: {\"label\": one of POSITIVE|NEUTRAL|NEGATIVE|MIXED, \"confidence\": 0-1}.",
      text,
    );
    const label = (result.label as SentimentLabel) ?? "UNKNOWN";
    return { label, confidence: Number(result.confidence ?? 0), model: this.name, modelVersion: MODEL };
  }

  async classifyTopic(text: string, candidateTopics: string[]): Promise<TopicResult> {
    const result = await this.complete(
      `You classify text into exactly one of these topics: ${candidateTopics.join(", ")}. Respond with strict JSON only: {"topic": "...", "confidence": 0-1}.`,
      text,
    );
    return { topic: String(result.topic ?? "Other"), confidence: Number(result.confidence ?? 0), model: this.name };
  }

  async classifyRelevance(text: string, organizationContext: string): Promise<RelevanceResult> {
    const result = await this.complete(
      `Determine if this content is actually about the organization described as: "${organizationContext}". Respond with strict JSON only: {"relevant": true|false, "confidence": 0-1, "reason": "..."}.`,
      text,
    );
    return {
      relevant: Boolean(result.relevant),
      confidence: Number(result.confidence ?? 0),
      reason: result.reason ? String(result.reason) : undefined,
      model: this.name,
    };
  }

  async summarize(text: string): Promise<SummaryResult> {
    const result = await this.complete(
      'Summarize in one or two sentences. Respond with strict JSON only: {"summary": "..."}.',
      text,
    );
    return { summary: String(result.summary ?? text.slice(0, 200)), model: this.name };
  }
}
