export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  jitter?: boolean;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    jitter = true,
  } = options;

  let retries = 0;

  while (true) {
    try {
      return await fn();
    } catch (error: unknown) {
      const err = error as { status?: number; name?: string; message?: string };
      const isRetryable =
        err.status === 429 ||
        (err.status && err.status >= 500) ||
        err.name === "AbortError" ||
        err.message?.includes("fetch failed") ||
        err.message?.includes("network");

      if (!isRetryable || retries >= maxRetries) {
        throw error;
      }

      retries++;
      let delay = initialDelay * factor ** (retries - 1);
      delay = Math.min(delay, maxDelay);

      if (jitter) {
        delay = delay * (0.5 + Math.random());
      }

      console.warn(
        `Retryable error occurred: ${error.message}. Retrying in ${delay.toFixed(0)}ms... (Attempt ${retries}/${maxRetries})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
