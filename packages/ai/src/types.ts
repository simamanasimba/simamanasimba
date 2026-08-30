export type SentimentLabel = "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED" | "UNKNOWN";

export interface SentimentResult {
  label: SentimentLabel;
  confidence: number;
  model: string;
  modelVersion?: string;
}

export interface TopicResult {
  topic: string;
  confidence: number;
  model: string;
}

export interface RelevanceResult {
  relevant: boolean;
  confidence: number;
  reason?: string;
  model: string;
}

export interface SummaryResult {
  summary: string;
  model: string;
}

/**
 * Vendor-neutral AI abstraction. Every result carries `model`/`confidence` so
 * callers can store provenance and never present inference as objective fact
 * (see AiAnalysis in the schema). When no provider is configured, use
 * NoopAiProvider — it returns UNKNOWN/low-confidence results rather than
 * fabricating an analysis.
 */
export interface AiProvider {
  readonly name: string;
  isConfigured(): boolean;
  analyzeSentiment(text: string): Promise<SentimentResult>;
  classifyTopic(text: string, candidateTopics: string[]): Promise<TopicResult>;
  classifyRelevance(text: string, organizationContext: string): Promise<RelevanceResult>;
  summarize(text: string): Promise<SummaryResult>;
}
