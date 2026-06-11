/**
 * Shared Gemini AI utility helpers.
 *
 * Provides:
 * - `callGeminiWithTimeout`: wraps generateContent with a 20s AbortController timeout
 * - `safeParseJSON`: safely parses a JSON string, returning null on failure
 * - `callGeminiWithRetry`: retries Gemini calls with exponential backoff
 * - `parseAIDate`: validates and parses dates returned by AI before DB writes
 */
import { GoogleGenAI, GenerateContentConfig } from "@google/genai";

/** Initialize the Gemini client, throwing if API key is missing. */
export function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Wraps a Gemini generateContent call with a timeout.
 * Throws if the request takes longer than `timeoutMs` (default 20s).
 */
export async function callGeminiWithTimeout(
  ai: GoogleGenAI,
  params: {
    model: string;
    contents: string | object;
    config?: GenerateContentConfig;
  },
  timeoutMs = 20_000
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await ai.models.generateContent({
      model: params.model,
      contents: params.contents as string,
      config: params.config,
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }
    return text;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Gemini API call timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Safely parses a JSON string returned by Gemini.
 * Returns null instead of throwing on malformed input.
 */
export function safeParseJSON<T = unknown>(text: string, context?: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    console.error(
      `[Gemini] Failed to parse JSON response${context ? ` (${context})` : ""}:`,
      text.substring(0, 200),
      err
    );
    return null;
  }
}

/**
 * Validates a date string returned by AI before using it in database writes.
 * Returns null for invalid or unparseable dates instead of writing Invalid Date.
 */
export function parseAIDate(str: string | null | undefined): Date | null {
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(d.getTime())) {
    console.warn(`[Gemini] Discarding invalid AI-returned date: "${str}"`);
    return null;
  }
  return d;
}

/**
 * Retries a Gemini call up to `maxRetries` times with exponential backoff.
 * Useful for handling 429 (rate limit) and transient 5xx errors.
 */
export async function callGeminiWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.warn(`[Gemini] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, err);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
