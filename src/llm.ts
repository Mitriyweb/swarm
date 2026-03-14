import type { LLMConfig, LLMProvider, LLMUsage } from "@/types";
import { withRetry } from "@/retry";
import Anthropic from "@anthropic-ai/sdk";

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private usage: LLMUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  constructor(config: LLMConfig) {
    this.model = config.model || "claude-sonnet-4-5";
    this.maxTokens = config.maxTokens || 1024;

    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL:
        config.baseUrl || "https://apim-multimodel-common.azure-api.net/anthropic-model/anthropic",
      defaultHeaders: {
        "api-key": config.apiKey,
      },
    });
  }

  /**
   * Sends a message to the LLM and returns the response text.
   */
  async generate(prompt: string): Promise<string> {
    try {
      const message = await withRetry(() =>
        this.client.messages.create({
          model: this.model,
          max_tokens: this.maxTokens,
          messages: [{ role: "user", content: prompt }],
        }),
      );

      if (message.usage) {
        this.usage.promptTokens += message.usage.input_tokens;
        this.usage.completionTokens += message.usage.output_tokens;
        this.usage.totalTokens = this.usage.promptTokens + this.usage.completionTokens;
      }

      const firstContent = message.content[0];
      if (firstContent && "text" in firstContent) {
        return firstContent.text;
      }

      return "";
    } catch (error) {
      console.error("LLM API call failed:", error);
      throw error;
    }
  }

  getUsage(): LLMUsage {
    return { ...this.usage };
  }
}
