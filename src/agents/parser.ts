import type { LLMProvider, ToolCall } from "@/types";

/**
 * Parses the raw LLM response (must be valid JSON) into a ToolCall array.
 * Retries with a stricter instruction if the response is invalid.
 */
export async function parseStructuredResponse(
  provider: LLMProvider,
  rawResponse: string,
  retries = 2,
): Promise<ToolCall[]> {
  const jsonMatch =
    rawResponse.match(/```json\n?([\s\S]+?)\n?```/) ||
    rawResponse.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  const jsonStr = (jsonMatch ? jsonMatch[1] : rawResponse) ?? rawResponse;

  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    if (retries > 0) {
      const fixPrompt = `Your previous response was not valid JSON. Return ONLY a JSON array of tool calls, nothing else.\n\nPrevious response:\n${rawResponse}`;
      const retryResponse = await provider.generate(fixPrompt);
      return parseStructuredResponse(provider, retryResponse, retries - 1);
    }
    throw new Error(`Failed to parse structured response after retries: ${rawResponse}`);
  }
}
