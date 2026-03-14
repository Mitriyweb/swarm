import { describe, expect, it, mock } from "bun:test";
import { parseStructuredResponse } from "@/agents/parser";
import type { LLMProvider } from "@/types";

describe("parseStructuredResponse", () => {
  const mockProvider = {
    generate: mock(() => Promise.resolve("[]")),
    getUsage: () => ({ promptTokens: 0, completionTokens: 0, totalTokens: 0 }),
  } as LLMProvider;

  it("should parse valid JSON array", async () => {
    const raw = '[{"action": "read_file", "path": "test.txt"}]';
    const result = await parseStructuredResponse(mockProvider, raw);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("read_file");
  });

  it("should parse JSON within markdown blocks", async () => {
    const raw = 'Here is the plan:\n```json\n[{"action": "list_dir"}]\n```';
    const result = await parseStructuredResponse(mockProvider, raw);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("list_dir");
  });

  it("should retry on invalid JSON", async () => {
    const invalidRaw = "Not JSON at all";
    const fixedRaw = '[{"action": "create_file"}]';
    (
      mockProvider.generate as unknown as { mockResolvedValue: (v: string) => void }
    ).mockResolvedValue(fixedRaw);

    const result = await parseStructuredResponse(mockProvider, invalidRaw);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("create_file");
    expect(mockProvider.generate).toHaveBeenCalled();
  });
});
