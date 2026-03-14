export interface ChaseAIConfig {
  endpoint?: string;
  enabled?: boolean;
}

export interface VerificationRequest {
  action: string;
  reason: string;
  context?: Record<string, unknown>;
}

export interface VerificationResponse {
  id: string;
  status: "pending" | "approved" | "rejected" | "approved_session";
}

export class ChaseAIClient {
  private endpoint: string;

  constructor(config: ChaseAIConfig = {}) {
    this.endpoint = (config.endpoint ?? "http://localhost:8090").replace(/\/$/, "");
  }

  async requestVerification(request: VerificationRequest): Promise<VerificationResponse> {
    const res = await fetch(`${this.endpoint}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      throw new Error(`ChaseAI verification request failed: ${res.status} ${res.statusText}`);
    }

    return (await res.json()) as VerificationResponse;
  }

  async checkStatus(id: string): Promise<VerificationResponse> {
    const res = await fetch(`${this.endpoint}/verify/${id}`);
    if (!res.ok) {
      throw new Error(`ChaseAI status check failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as VerificationResponse;
  }

  async waitForApproval(request: VerificationRequest, pollInterval = 2000): Promise<boolean> {
    let { id, status } = await this.requestVerification(request);

    while (status === "pending") {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      const response = await this.checkStatus(id);
      status = response.status;
    }

    return status === "approved" || status === "approved_session";
  }
}
