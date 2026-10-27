// One model for every agent: DeepSeek V4.1 Flash 1017 on Nebius Token Factory (OpenAI-compatible).
import type { MastraModelConfig } from "@mastra/core/llm";

export const MODEL_ID = process.env.NEBIUS_MODEL || "deepseek-ai/DeepSeek-V4.1-Flash-1017";

export function nebius(): MastraModelConfig {
  const apiKey = process.env.NEBIUS_API_KEY;
  if (!apiKey) throw new Error("NEBIUS_API_KEY is not set. Copy .env.example to .env and add your key.");
  return {
    providerId: "nebius",
    modelId: MODEL_ID,
    url: process.env.NEBIUS_BASE_URL || "https://api.tokenfactory.us-north1.nebius.com/v1/",
    apiKey,
  };
}

/**
 * Per-call options. Reading is transcription, so thinking stays off; scoring can afford to think.
 * The output cap is explicit: a 4-page transcript is several thousand tokens and the provider default truncates it.
 */
export const callOptions = (thinking: boolean, maxOutputTokens: number, cacheKey?: string) => ({
  modelSettings: { temperature: 0, maxRetries: 2, maxOutputTokens },
  // Nebius caches identical prompt prefixes automatically (best effort), so fixed instructions go first. The
  // prompt_cache_key groups calls that share a prefix. https://docs.tokenfactory.nebius.com/cached-tokens
  providerOptions: { nebius: { chat_template_kwargs: { enable_thinking: thinking }, ...(cacheKey ? { prompt_cache_key: cacheKey } : {}) } },
});

/** Runs fn up to `attempts` times, until accept() is happy with the result. Throws the last error if every try failed. */
export async function untilValid<T>(attempts: number, fn: () => Promise<T>, accept: (r: T) => boolean): Promise<T> {
  let last: T | undefined;
  let error: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      last = await fn();
      if (accept(last)) return last;
    } catch (e) {
      error = e;
    }
  }
  if (last !== undefined) return last;
  throw error instanceof Error ? error : new Error("The model call failed.");
}
