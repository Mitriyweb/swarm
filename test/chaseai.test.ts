import { afterEach, describe, expect, it, mock } from "bun:test";
import { ChaseAIClient } from "@/chaseai";

describe("ChaseAIClient", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should request verification successfully", async () => {
    global.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ id: "req-1", status: "pending" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ) as any;

    const client = new ChaseAIClient();
    const result = await client.requestVerification({
      action: "test_action",
      reason: "test_reason",
    });

    expect(result.id).toBe("req-1");
    expect(result.status).toBe("pending");
    expect(global.fetch).toHaveBeenCalled();
  });

  it("should throw error when verification request fails", async () => {
    global.fetch = mock(() =>
      Promise.resolve(new Response("Internal Error", { status: 500 })),
    ) as any;

    const client = new ChaseAIClient();
    await expect(client.requestVerification({ action: "fail", reason: "testing" })).rejects.toThrow(
      "ChaseAI verification request failed: 500",
    );
  });

  it("should check status successfully", async () => {
    global.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ id: "req-1", status: "approved" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ) as any;

    const client = new ChaseAIClient();
    const result = await client.checkStatus("req-1");

    expect(result.status).toBe("approved");
    expect(global.fetch).toHaveBeenCalled();
  });

  it("should throw error when status check fails", async () => {
    global.fetch = mock(() => Promise.resolve(new Response("Not Found", { status: 404 }))) as any;

    const client = new ChaseAIClient();
    await expect(client.checkStatus("req-nonexistent")).rejects.toThrow(
      "ChaseAI status check failed: 404",
    );
  });

  it("should wait for approval successfully", async () => {
    let callCount = 0;
    global.fetch = mock(() => {
      callCount++;
      if (callCount === 1) {
        // requestVerification
        return Promise.resolve(
          new Response(JSON.stringify({ id: "req-2", status: "pending" }), {
            status: 200,
          }),
        );
      }
      // checkStatus
      return Promise.resolve(
        new Response(JSON.stringify({ id: "req-2", status: "approved" }), {
          status: 200,
        }),
      );
    }) as any;

    const client = new ChaseAIClient();
    const result = await client.waitForApproval(
      { action: "wait", reason: "testing" },
      10, // fast poll
      1000,
    );

    expect(result).toBe(true);
    expect(callCount).toBe(2);
  });

  it("should timeout in waitForApproval", async () => {
    global.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ id: "req-timeout", status: "pending" }), {
          status: 200,
        }),
      ),
    ) as any;

    const client = new ChaseAIClient();
    await expect(
      client.waitForApproval({ action: "wait", reason: "testing" }, 10, 50),
    ).rejects.toThrow("ChaseAI approval timed out after 50ms");
  });
});
